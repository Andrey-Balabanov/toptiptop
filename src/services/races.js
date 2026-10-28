/**
 * Live typing races, kept in memory (one server instance; rooms are short-lived).
 *
 * The host creates a room with the text, friends join with the room code, the
 * host starts a countdown and everyone types the same text. Browsers poll the
 * room and report their position; speed is computed here from the shared start
 * time, so a client can't claim a faster finish than its reports allow.
 */

const { newCode } = require('./groups');

const MAX_ROOMS = 500;
const MAX_PLAYERS = 10;
const MAX_TEXT_LENGTH = 1000;
const COUNTDOWN_MS = 5000;
const ROOM_TTL_MS = 30 * 60 * 1000;
/** A position can't advance faster than this (≈ 360 WPM) between two reports. */
const MAX_CHARS_PER_SEC = 30;

const rooms = new Map();

function cleanup(now) {
  for (const [code, room] of rooms) {
    if (now - room.createdAt > ROOM_TTL_MS) rooms.delete(code);
  }
}

function publicRoom(room, now) {
  const players = [...room.players.values()]
    .map(p => ({
      id: p.id,
      username: p.username,
      pos: p.pos,
      progress: room.text.length ? p.pos / room.text.length : 0,
      wpm: p.wpm,
      errors: p.errors,
      finishedAt: p.finishedAt,
      place: p.place,
    }))
    .sort((a, b) => (a.place || Infinity) - (b.place || Infinity) || b.pos - a.pos);
  return {
    code: room.code,
    hostId: room.hostId,
    lang: room.lang,
    text: room.text,
    status: room.status,
    startAt: room.startAt,
    serverNow: now,
    players,
  };
}

function createRace(user, { text, lang }, now = Date.now()) {
  cleanup(now);
  if (rooms.size >= MAX_ROOMS) throw new Error('TOO_MANY_ROOMS');
  if (typeof text !== 'string' || text.length < 10 || text.length > MAX_TEXT_LENGTH) throw new Error('BAD_TEXT');
  let code;
  do { code = newCode(); } while (rooms.has(code));
  const room = {
    code,
    hostId: user.id,
    lang: lang === 'en' ? 'en' : 'ru',
    text,
    status: 'waiting',
    startAt: null,
    createdAt: now,
    players: new Map(),
  };
  rooms.set(code, room);
  addPlayer(room, user, now);
  return publicRoom(room, now);
}

function addPlayer(room, user) {
  if (!room.players.has(user.id)) {
    if (room.players.size >= MAX_PLAYERS) throw new Error('ROOM_FULL');
    room.players.set(user.id, {
      id: user.id, username: user.username, pos: 0, errors: 0,
      wpm: 0, finishedAt: null, place: null, lastReport: null,
    });
  }
}

function getRoom(code) {
  const room = rooms.get(String(code).toUpperCase());
  if (!room) throw new Error('RACE_NOT_FOUND');
  return room;
}

function joinRace(user, code, now = Date.now()) {
  const room = getRoom(code);
  if (room.status !== 'waiting' && !room.players.has(user.id)) throw new Error('RACE_STARTED');
  addPlayer(room, user, now);
  return publicRoom(room, now);
}

function startRace(user, code, now = Date.now()) {
  const room = getRoom(code);
  if (room.hostId !== user.id) throw new Error('NOT_HOST');
  if (room.status === 'waiting') {
    room.status = 'running';
    room.startAt = now + COUNTDOWN_MS;
  }
  return publicRoom(room, now);
}

function reportProgress(user, code, { pos, errors }, now = Date.now()) {
  const room = getRoom(code);
  const p = room.players.get(user.id);
  if (!p) throw new Error('NOT_IN_RACE');
  if (room.status !== 'running' || now < room.startAt || p.finishedAt) return publicRoom(room, now);

  const target = Math.max(0, Math.min(Number(pos) || 0, room.text.length));
  // Cap the advance by elapsed time since the last report (or the start)
  const since = p.lastReport || room.startAt;
  const maxAdvance = Math.ceil(((now - since) / 1000) * MAX_CHARS_PER_SEC) + 2;
  p.pos = Math.max(p.pos, Math.min(target, p.pos + maxAdvance));
  p.errors = Math.max(0, Number(errors) || 0);
  p.lastReport = now;
  const minutes = (now - room.startAt) / 60000;
  p.wpm = minutes > 0 ? Math.round((p.pos / 5) / minutes) : 0;

  if (p.pos >= room.text.length) {
    p.finishedAt = now;
    p.place = [...room.players.values()].filter(x => x.finishedAt).length;
    if ([...room.players.values()].every(x => x.finishedAt)) room.status = 'finished';
  }
  return publicRoom(room, now);
}

function getRace(user, code, now = Date.now()) {
  const room = getRoom(code);
  if (!room.players.has(user.id)) throw new Error('NOT_IN_RACE');
  return publicRoom(room, now);
}

function leaveRace(user, code) {
  const room = rooms.get(String(code).toUpperCase());
  if (!room) return;
  room.players.delete(user.id);
  if (room.players.size === 0) rooms.delete(room.code);
  else if (room.hostId === user.id) room.hostId = room.players.keys().next().value;
}

/** Test helper */
function _reset() {
  rooms.clear();
}

module.exports = {
  createRace, joinRace, startRace, reportProgress, getRace, leaveRace, _reset,
  COUNTDOWN_MS, MAX_PLAYERS,
};

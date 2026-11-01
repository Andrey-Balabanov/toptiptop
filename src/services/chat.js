const { getDb } = require('../db');

const MAX_LENGTH = 500;
const PAGE_SIZE = 50;
/** Older messages beyond this many per channel are pruned. */
const KEEP_PER_CHANNEL = 1000;
/** Anti-flood: at most MAX_BURST messages per BURST_WINDOW_S seconds per user. */
const MAX_BURST = 5;
const BURST_WINDOW_S = 10;

/**
 * Channel ids: 'global' (every player) or 'group:<id>' (members of that group).
 * @returns {{ type: 'global' } | { type: 'group', groupId: number } | null}
 */
function parseChannel(channel) {
  if (channel === 'global') return { type: 'global' };
  const m = /^group:(\d{1,10})$/.exec(String(channel));
  return m ? { type: 'group', groupId: Number(m[1]) } : null;
}

/** Throws CHANNEL_NOT_FOUND unless `userId` may read and write `channel`. */
function assertAccess(db, userId, channel) {
  const parsed = parseChannel(channel);
  if (!parsed) throw new Error('CHANNEL_NOT_FOUND');
  if (parsed.type === 'group') {
    const member = db.prepare('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?').get(parsed.groupId, userId);
    if (!member) throw new Error('CHANNEL_NOT_FOUND');
  }
  return parsed;
}

/** Strip control characters, collapse runs of blank lines, trim. */
function cleanBody(body) {
  return String(body ?? '')
    .replace(/\r\n?/g, '\n')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0009\u000B-\u001F\u007F​-‏‪-‮⁦-⁩]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** The channels a user can chat in: the global one, then their groups. */
function listChannels(userId) {
  const groups = getDb().prepare(`
    SELECT g.id, g.name FROM user_groups g JOIN group_members m ON m.group_id = g.id
    WHERE m.user_id = ? ORDER BY g.created_at DESC
  `).all(userId);
  return [
    { id: 'global', type: 'global' },
    ...groups.map(g => ({ id: `group:${g.id}`, type: 'group', name: g.name })),
  ];
}

/** Message DTO; `mine` / `canDelete` are relative to the viewer. */
function formatMessage(row, viewer) {
  const mine = row.user_id === viewer.id;
  return {
    id: row.id,
    userId: row.user_id,
    username: row.username,
    body: row.body,
    createdAt: row.created_at,
    mine,
    canDelete: mine || viewer.role === 'admin' || row.group_owner_id === viewer.id,
  };
}

/**
 * Messages of a channel, oldest first. With `after` only newer messages are
 * returned (polling); with `before`, the page just older than that id
 * (scrolling back); otherwise the latest page.
 */
function getMessages(viewer, channel, { after, before } = {}) {
  const db = getDb();
  const parsed = assertAccess(db, viewer.id, channel);
  const ownerId = parsed.type === 'group'
    ? db.prepare('SELECT owner_id FROM user_groups WHERE id = ?').get(parsed.groupId).owner_id
    : null;
  const select = `SELECT c.id, c.user_id, c.body, c.created_at, u.username
    FROM chat_messages c JOIN users u ON u.id = c.user_id WHERE c.channel = ?`;
  let rows;
  if (Number.isInteger(after) && after >= 0) {
    rows = db.prepare(`${select} AND c.id > ? ORDER BY c.id ASC LIMIT ?`).all(channel, after, PAGE_SIZE * 2);
  } else if (Number.isInteger(before) && before > 0) {
    rows = db.prepare(`${select} AND c.id < ? ORDER BY c.id DESC LIMIT ?`).all(channel, before, PAGE_SIZE).reverse();
  } else {
    rows = db.prepare(`${select} ORDER BY c.id DESC LIMIT ?`).all(channel, PAGE_SIZE).reverse();
  }
  return rows.map(r => formatMessage({ ...r, group_owner_id: ownerId }, viewer));
}

function postMessage(viewer, channel, body) {
  const db = getDb();
  assertAccess(db, viewer.id, channel);
  const text = cleanBody(body);
  if (!text) throw new Error('EMPTY_MESSAGE');
  if (text.length > MAX_LENGTH) throw new Error('MESSAGE_TOO_LONG');
  const { n } = db.prepare(`SELECT COUNT(*) AS n FROM chat_messages
    WHERE user_id = ? AND created_at > datetime('now', ?)`).get(viewer.id, `-${BURST_WINDOW_S} seconds`);
  if (n >= MAX_BURST) throw new Error('SLOW_DOWN');

  const { lastInsertRowid } = db.prepare('INSERT INTO chat_messages (channel, user_id, body) VALUES (?, ?, ?)')
    .run(channel, viewer.id, text);
  const id = Number(lastInsertRowid);
  // Keep each channel bounded; cheap thanks to the (channel, id) index
  if (id % 50 === 0) {
    db.prepare(`DELETE FROM chat_messages WHERE channel = ? AND id <= (
      SELECT id FROM chat_messages WHERE channel = ? ORDER BY id DESC LIMIT 1 OFFSET ?)`)
      .run(channel, channel, KEEP_PER_CHANNEL);
  }
  const row = db.prepare('SELECT id, user_id, body, created_at FROM chat_messages WHERE id = ?').get(id);
  return formatMessage({ ...row, username: viewer.username }, viewer);
}

/** The author, an admin, or the owner of the group the message is in may delete it. */
function deleteMessage(viewer, messageId) {
  const db = getDb();
  const msg = db.prepare('SELECT id, channel, user_id FROM chat_messages WHERE id = ?').get(messageId);
  if (!msg) throw new Error('MESSAGE_NOT_FOUND');
  let allowed = msg.user_id === viewer.id || viewer.role === 'admin';
  if (!allowed) {
    const parsed = parseChannel(msg.channel);
    if (parsed && parsed.type === 'group') {
      const group = db.prepare('SELECT owner_id FROM user_groups WHERE id = ?').get(parsed.groupId);
      allowed = !!group && group.owner_id === viewer.id;
    }
  }
  if (!allowed) throw new Error('NOT_ALLOWED');
  db.prepare('DELETE FROM chat_messages WHERE id = ?').run(messageId);
  return true;
}

module.exports = {
  listChannels, getMessages, postMessage, deleteMessage, parseChannel, cleanBody,
  MAX_LENGTH, MAX_BURST,
};

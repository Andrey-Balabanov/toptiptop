/**
 * Unit tests for src/services/races.js (in-memory live races)
 */

jest.mock('../db', () => ({ getDb: jest.fn() }));

const races = require('../services/races');

const host = { id: 1, username: 'host' };
const guest = { id: 2, username: 'guest' };
const TEXT = 'abcde abcde abcde abcde'; // 23 chars

describe('races', () => {
  beforeEach(() => races._reset());

  it('creates a room with the host as the first player', () => {
    const room = races.createRace(host, { text: TEXT, lang: 'en' }, 1000);
    expect(room.code).toMatch(/^[A-Z2-9]{6}$/);
    expect(room.status).toBe('waiting');
    expect(room.players.map(p => p.username)).toEqual(['host']);
  });

  it('lets friends join before the start, not after', () => {
    const { code } = races.createRace(host, { text: TEXT }, 1000);
    expect(races.joinRace(guest, code.toLowerCase(), 2000).players).toHaveLength(2);
    races.startRace(host, code, 3000);
    expect(() => races.joinRace({ id: 3, username: 'late' }, code, 4000)).toThrow('RACE_STARTED');
  });

  it('only the host can start; the start is after a countdown', () => {
    const { code } = races.createRace(host, { text: TEXT }, 1000);
    races.joinRace(guest, code, 1000);
    expect(() => races.startRace(guest, code, 2000)).toThrow('NOT_HOST');
    const room = races.startRace(host, code, 2000);
    expect(room.startAt).toBe(2000 + races.COUNTDOWN_MS);
  });

  it('ignores progress during the countdown and caps implausible jumps', () => {
    const { code } = races.createRace(host, { text: TEXT }, 0);
    const { startAt } = races.startRace(host, code, 0);
    expect(races.reportProgress(host, code, { pos: 10 }, startAt - 100).players[0].pos).toBe(0);
    // 100 ms after the start nobody can be 23 characters in
    const after = races.reportProgress(host, code, { pos: 23 }, startAt + 100);
    expect(after.players[0].pos).toBeLessThan(10);
  });

  it('records finish order, speed and ends when everyone finished', () => {
    const { code } = races.createRace(host, { text: TEXT }, 0);
    races.joinRace(guest, code, 0);
    const { startAt } = races.startRace(host, code, 0);
    races.reportProgress(guest, code, { pos: 23 }, startAt + 6000);
    let room = races.reportProgress(host, code, { pos: 23 }, startAt + 9000);
    expect(room.players.map(p => [p.username, p.place])).toEqual([['guest', 1], ['host', 2]]);
    expect(room.players[0].wpm).toBe(46); // 23 chars / 5 / 0.1 min
    expect(room.status).toBe('finished');
  });

  it('rejects bad texts and unknown rooms', () => {
    expect(() => races.createRace(host, { text: 'short' })).toThrow('BAD_TEXT');
    expect(() => races.getRace(host, 'ZZZZZZ')).toThrow('RACE_NOT_FOUND');
  });

  it('hands the room to another player when the host leaves', () => {
    const { code } = races.createRace(host, { text: TEXT }, 0);
    races.joinRace(guest, code, 0);
    races.leaveRace(host, code);
    expect(races.getRace(guest, code).hostId).toBe(2);
  });
});

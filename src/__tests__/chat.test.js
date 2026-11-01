/**
 * Integration tests for src/services/chat.js against an in-memory SQLite DB
 */

jest.mock('../config', () => ({
  dbPath: ':memory:',
  jwtSecret: 'test-secret',
  jwtExpiresIn: '7d',
  mail: {},
}));

const { getDb } = require('../db');
const chat = require('../services/chat');
const groups = require('../services/groups');

function addUser(name, role = 'user') {
  const id = Number(getDb().prepare('INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)')
    .run(name, `${name}@example.test`, 'x', role).lastInsertRowid);
  return { id, username: name, role };
}

/** Pretend the user's earlier messages were sent a minute ago, so the flood limit doesn't kick in. */
function ageMessages(user) {
  getDb().prepare("UPDATE chat_messages SET created_at = datetime('now', '-1 minute') WHERE user_id = ?").run(user.id);
}

describe('chat', () => {
  let alice, bob, carol, admin;

  beforeAll(() => {
    alice = addUser('alice');
    bob = addUser('bob');
    carol = addUser('carol');
    admin = addUser('boss', 'admin');
  });

  it('posts to the global channel and returns new messages to everyone', () => {
    const first = chat.postMessage(alice, 'global', '  hello  ');
    expect(first).toMatchObject({ username: 'alice', body: 'hello', mine: true, canDelete: true });
    chat.postMessage(bob, 'global', 'hi alice');
    const seen = chat.getMessages(carol, 'global');
    expect(seen.map(m => m.body)).toEqual(['hello', 'hi alice']);
    expect(seen[0]).toMatchObject({ mine: false, canDelete: false });
    expect(chat.getMessages(carol, 'global', { after: first.id }).map(m => m.body)).toEqual(['hi alice']);
    expect(chat.getMessages(carol, 'global', { before: seen[1].id }).map(m => m.body)).toEqual(['hello']);
  });

  it('keeps group chats to members and lists them as channels', () => {
    const g = groups.createGroup(alice.id, 'Class');
    groups.joinGroup(bob.id, g.code);
    const channel = `group:${g.id}`;
    chat.postMessage(bob, channel, 'group only');
    expect(chat.getMessages(alice, channel).map(m => m.body)).toEqual(['group only']);
    expect(() => chat.getMessages(carol, channel)).toThrow('CHANNEL_NOT_FOUND');
    expect(() => chat.postMessage(carol, channel, 'let me in')).toThrow('CHANNEL_NOT_FOUND');
    expect(chat.listChannels(bob.id).map(c => c.id)).toEqual(['global', channel]);
    expect(chat.listChannels(carol.id).map(c => c.id)).toEqual(['global']);
    // The owner moderates their group's chat
    expect(chat.getMessages(alice, channel)[0].canDelete).toBe(true);

    groups.leaveGroup(alice.id, g.id); // owner leaving deletes the group and its chat
    expect(getDb().prepare('SELECT COUNT(*) AS n FROM chat_messages WHERE channel = ?').get(channel).n).toBe(0);
  });

  it('rejects unknown channels, empty and over-long messages', () => {
    expect(() => chat.getMessages(alice, 'secret')).toThrow('CHANNEL_NOT_FOUND');
    expect(() => chat.postMessage(alice, 'group:abc', 'x')).toThrow('CHANNEL_NOT_FOUND');
    expect(() => chat.postMessage(alice, 'global', ' \n​ ')).toThrow('EMPTY_MESSAGE');
    expect(() => chat.postMessage(alice, 'global', 'x'.repeat(chat.MAX_LENGTH + 1))).toThrow('MESSAGE_TOO_LONG');
  });

  it('strips control characters and collapses blank lines', () => {
    expect(chat.cleanBody('a\u0007b\r\n\r\n\r\n\r\nc‮')).toBe('ab\n\nc');
  });

  it('limits bursts of messages', () => {
    ageMessages(carol);
    for (let i = 0; i < chat.MAX_BURST; i++) chat.postMessage(carol, 'global', `spam ${i}`);
    expect(() => chat.postMessage(carol, 'global', 'one more')).toThrow('SLOW_DOWN');
    ageMessages(carol);
    expect(() => chat.postMessage(carol, 'global', 'later')).not.toThrow();
  });

  it('lets the author or an admin delete a message, nobody else', () => {
    ageMessages(bob);
    const msg = chat.postMessage(bob, 'global', 'oops');
    expect(() => chat.deleteMessage(alice, msg.id)).toThrow('NOT_ALLOWED');
    expect(chat.getMessages(admin, 'global').find(m => m.id === msg.id).canDelete).toBe(true);
    chat.deleteMessage(admin, msg.id);
    expect(() => chat.deleteMessage(bob, msg.id)).toThrow('MESSAGE_NOT_FOUND');
    const own = chat.postMessage(bob, 'global', 'mine');
    chat.deleteMessage(bob, own.id);
    expect(chat.getMessages(bob, 'global').some(m => m.id === own.id)).toBe(false);
  });
});

/**
 * Integration tests for src/services/groups.js against an in-memory SQLite DB
 */

jest.mock('../config', () => ({
  dbPath: ':memory:',
  jwtSecret: 'test-secret',
  jwtExpiresIn: '7d',
  mail: {},
}));

const { getDb } = require('../db');
const groups = require('../services/groups');

function addUser(name, bestWpm = 0) {
  return Number(getDb().prepare('INSERT INTO users (username, email, password, best_wpm) VALUES (?, ?, ?, ?)')
    .run(name, `${name}@example.test`, 'x', bestWpm).lastInsertRowid);
}

describe('groups', () => {
  let teacher, alice, bob;

  beforeAll(() => {
    teacher = addUser('teacher', 40);
    alice = addUser('alice', 70);
    bob = addUser('bob', 55);
  });

  it('creates a group with an invite code and the owner as member', () => {
    const g = groups.createGroup(teacher, 'Class 7B');
    expect(g).toMatchObject({ name: 'Class 7B', isOwner: true, memberCount: 1 });
    expect(g.code).toMatch(/^[A-Z2-9]{6}$/);
  });

  it('lets others join by code (case-insensitive, idempotent) and ranks by speed', () => {
    const g = groups.createGroup(teacher, 'Friends');
    groups.joinGroup(alice, g.code.toLowerCase());
    groups.joinGroup(bob, g.code);
    groups.joinGroup(bob, g.code);
    const view = groups.getGroup(alice, g.id);
    expect(view.members.map(m => m.username)).toEqual(['alice', 'bob', 'teacher']);
    expect(view.members[0]).not.toHaveProperty('recentAccuracy'); // members don't see teacher-only fields
    expect(groups.getGroup(teacher, g.id).members[0]).toHaveProperty('lastActive');
  });

  it('hides a group from non-members and rejects unknown codes', () => {
    const g = groups.createGroup(alice, 'Private');
    expect(groups.getGroup(bob, g.id)).toBeNull();
    expect(() => groups.joinGroup(bob, 'ZZZZZZ')).toThrow('GROUP_NOT_FOUND');
  });

  it('lists my groups, lets members leave and the owner remove them', () => {
    const g = groups.createGroup(teacher, 'Team');
    groups.joinGroup(alice, g.code);
    groups.joinGroup(bob, g.code);
    expect(groups.listMyGroups(bob).some(x => x.id === g.id)).toBe(true);
    expect(() => groups.removeMember(alice, g.id, bob)).toThrow('NOT_OWNER');
    groups.removeMember(teacher, g.id, bob);
    expect(groups.listMyGroups(bob).some(x => x.id === g.id)).toBe(false);
    groups.leaveGroup(alice, g.id);
    expect(groups.getGroup(teacher, g.id).members).toHaveLength(1);
  });

  it('deletes the group when the owner leaves', () => {
    const g = groups.createGroup(bob, 'Temp');
    groups.joinGroup(alice, g.code);
    groups.leaveGroup(bob, g.id);
    expect(groups.getGroup(alice, g.id)).toBeNull();
  });
});

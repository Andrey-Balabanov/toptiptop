const crypto = require('crypto');
const { getDb } = require('../db');

/** Unambiguous characters for invite codes (no 0/O, 1/I/L). */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;
const MAX_MEMBERS = 200;
const MAX_GROUPS_PER_USER = 20;

function newCode() {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) code += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)];
  return code;
}

function countUserGroups(db, userId) {
  return db.prepare('SELECT COUNT(*) AS n FROM group_members WHERE user_id = ?').get(userId).n;
}

/** Create a group owned by `ownerId` (who becomes its first member). */
function createGroup(ownerId, name) {
  const db = getDb();
  if (countUserGroups(db, ownerId) >= MAX_GROUPS_PER_USER) throw new Error('TOO_MANY_GROUPS');
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = newCode();
    try {
      const create = db.transaction(() => {
        const { lastInsertRowid } = db.prepare('INSERT INTO user_groups (name, code, owner_id) VALUES (?, ?, ?)')
          .run(name, code, ownerId);
        db.prepare('INSERT INTO group_members (group_id, user_id) VALUES (?, ?)').run(lastInsertRowid, ownerId);
        return { id: Number(lastInsertRowid), name, code, isOwner: true, memberCount: 1 };
      });
      return create();
    } catch (err) {
      if (!String(err.message).includes('UNIQUE')) throw err; // retry on a code collision
    }
  }
  throw new Error('CODE_COLLISION');
}

/** Join by invite code; joining a group you are already in is a no-op. */
function joinGroup(userId, code) {
  const db = getDb();
  const group = db.prepare('SELECT id, name, code, owner_id FROM user_groups WHERE code = ?').get(String(code).toUpperCase());
  if (!group) throw new Error('GROUP_NOT_FOUND');
  const already = db.prepare('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?').get(group.id, userId);
  if (!already) {
    const { n } = db.prepare('SELECT COUNT(*) AS n FROM group_members WHERE group_id = ?').get(group.id);
    if (n >= MAX_MEMBERS) throw new Error('GROUP_FULL');
    if (countUserGroups(db, userId) >= MAX_GROUPS_PER_USER) throw new Error('TOO_MANY_GROUPS');
    db.prepare('INSERT INTO group_members (group_id, user_id) VALUES (?, ?)').run(group.id, userId);
  }
  return { id: group.id, name: group.name, code: group.code, isOwner: group.owner_id === userId };
}

function listMyGroups(userId) {
  return getDb().prepare(`
    SELECT g.id, g.name, g.code, g.owner_id,
           (SELECT COUNT(*) FROM group_members m2 WHERE m2.group_id = g.id) AS member_count
    FROM user_groups g JOIN group_members m ON m.group_id = g.id
    WHERE m.user_id = ? ORDER BY g.created_at DESC
  `).all(userId).map(g => ({
    id: g.id, name: g.name, code: g.code, isOwner: g.owner_id === userId, memberCount: g.member_count,
  }));
}

/**
 * A group's leaderboard. Every member sees speed, XP and this week's activity;
 * the owner (teacher / organiser) also sees accuracy and when each member was last active.
 * @returns {object|null} null when the user is not a member
 */
function getGroup(userId, groupId) {
  const db = getDb();
  const group = db.prepare('SELECT id, name, code, owner_id FROM user_groups WHERE id = ?').get(groupId);
  if (!group) return null;
  const isMember = db.prepare('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?').get(groupId, userId);
  if (!isMember) return null;
  const isOwner = group.owner_id === userId;
  const members = db.prepare(`
    SELECT u.id, u.username, u.best_wpm, u.total_xp, u.session_count,
           (SELECT COUNT(*) FROM sessions s WHERE s.user_id = u.id AND s.is_draft = 0
              AND s.created_at >= datetime('now', '-7 days')) AS week_sessions,
           (SELECT MAX(s.wpm) FROM sessions s WHERE s.user_id = u.id AND s.is_draft = 0
              AND s.created_at >= datetime('now', '-7 days')) AS week_best_wpm,
           (SELECT ROUND(AVG(a.accuracy)) FROM (SELECT accuracy FROM sessions s WHERE s.user_id = u.id
              AND s.is_draft = 0 ORDER BY s.created_at DESC LIMIT 10) a) AS recent_accuracy,
           (SELECT MAX(s.created_at) FROM sessions s WHERE s.user_id = u.id) AS last_active
    FROM group_members m JOIN users u ON u.id = m.user_id
    WHERE m.group_id = ?
    ORDER BY u.best_wpm DESC
  `).all(groupId).map((m, i) => ({
    rank: i + 1,
    id: m.id,
    username: m.username,
    bestWpm: m.best_wpm,
    totalXp: m.total_xp,
    sessionCount: m.session_count,
    weekSessions: m.week_sessions,
    weekBestWpm: m.week_best_wpm || 0,
    isOwner: m.id === group.owner_id,
    ...(isOwner ? { recentAccuracy: m.recent_accuracy, lastActive: m.last_active } : {}),
  }));
  return { id: group.id, name: group.name, code: group.code, isOwner, members };
}

/** Leave a group; the owner leaving deletes the group for everyone. */
function leaveGroup(userId, groupId) {
  const db = getDb();
  const group = db.prepare('SELECT owner_id FROM user_groups WHERE id = ?').get(groupId);
  if (!group) return false;
  if (group.owner_id === userId) {
    db.prepare('DELETE FROM group_members WHERE group_id = ?').run(groupId);
    db.prepare('DELETE FROM user_groups WHERE id = ?').run(groupId);
    return true;
  }
  return db.prepare('DELETE FROM group_members WHERE group_id = ? AND user_id = ?').run(groupId, userId).changes > 0;
}

/** Owner removes a member (not themselves). */
function removeMember(ownerId, groupId, memberId) {
  const db = getDb();
  const group = db.prepare('SELECT owner_id FROM user_groups WHERE id = ?').get(groupId);
  if (!group || group.owner_id !== ownerId) throw new Error('NOT_OWNER');
  if (memberId === ownerId) throw new Error('CANNOT_REMOVE_OWNER');
  return db.prepare('DELETE FROM group_members WHERE group_id = ? AND user_id = ?').run(groupId, memberId).changes > 0;
}

module.exports = { createGroup, joinGroup, listMyGroups, getGroup, leaveGroup, removeMember, newCode, CODE_ALPHABET };

const { getDb } = require('../db');

const SESSION_COLUMNS = [
  'id', 'mode', 'wpm', 'accuracy', 'total_errors', 'xp_earned',
  'duration_ms', 'text_length', 'streak_max', 'is_draft', 'created_at',
].join(', ');

function createSession(userId, data) {
  const db = getDb();

  // Single round-trip in the common (new session) case: INSERT OR IGNORE
  // deduplicates on client_session_id via the UNIQUE constraint. Only when a
  // duplicate is actually detected (changes === 0) do we pay an extra SELECT
  // to fetch the existing row's id.
  const result = db.prepare(`
    INSERT OR IGNORE INTO sessions (user_id, client_session_id, mode, wpm, accuracy, total_errors, xp_earned, duration_ms, text_length, streak_max, is_draft)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    userId,
    data.clientSessionId,
    data.mode,
    data.wpm,
    data.accuracy,
    data.totalErrors,
    data.xpEarned,
    data.durationMs,
    data.textLength,
    data.streakMax,
    data.isDraft ? 1 : 0
  );

  if (result.changes === 0) {
    const existing = db.prepare('SELECT id FROM sessions WHERE client_session_id = ?').get(data.clientSessionId);
    return { id: existing ? existing.id : null, duplicate: true };
  }

  return { id: result.lastInsertRowid, duplicate: false };
}

function listSessions(userId, { limit = 50, offset = 0, mode, from, to } = {}) {
  const db = getDb();
  // Explicit column list instead of SELECT * — avoids pulling unused fields.
  let sql = `SELECT ${SESSION_COLUMNS} FROM sessions WHERE user_id = ?`;
  const params = [userId];

  if (mode) {
    sql += ' AND mode = ?';
    params.push(mode);
  }
  if (from) {
    sql += ' AND created_at >= ?';
    params.push(from);
  }
  if (to) {
    sql += ' AND created_at <= ?';
    params.push(to);
  }

  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const rows = db.prepare(sql).all(...params);
  return rows.map(row => ({
    id: row.id,
    mode: row.mode,
    wpm: row.wpm,
    accuracy: row.accuracy,
    totalErrors: row.total_errors,
    xpEarned: row.xp_earned,
    durationMs: row.duration_ms,
    textLength: row.text_length,
    streakMax: row.streak_max,
    isDraft: !!row.is_draft,
    createdAt: row.created_at,
  }));
}

function getSessionById(sessionId, userId) {
  const db = getDb();
  const row = db.prepare(`SELECT ${SESSION_COLUMNS} FROM sessions WHERE id = ? AND user_id = ?`).get(sessionId, userId);
  if (!row) return null;
  return {
    id: row.id,
    mode: row.mode,
    wpm: row.wpm,
    accuracy: row.accuracy,
    totalErrors: row.total_errors,
    xpEarned: row.xp_earned,
    durationMs: row.duration_ms,
    textLength: row.text_length,
    streakMax: row.streak_max,
    isDraft: !!row.is_draft,
    createdAt: row.created_at,
  };
}

function getLeaderboard(type = 'wpm', limit = 20) {
  const db = getDb();
  const orderBy = type === 'xp' ? 'total_xp' : 'best_wpm';
  const rows = db.prepare(`SELECT id, username, total_xp, best_wpm, best_streak, session_count FROM users ORDER BY ${orderBy} DESC LIMIT ?`).all(limit);
  return rows.map((row, idx) => ({
    rank: idx + 1,
    id: row.id,
    username: row.username,
    totalXp: row.total_xp,
    bestWpm: row.best_wpm,
    bestStreak: row.best_streak,
    sessionCount: row.session_count,
  }));
}

module.exports = { createSession, listSessions, getSessionById, getLeaderboard };

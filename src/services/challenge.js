const { getDb } = require('../db');

/**
 * ISO-8601 week key ('2026-W44') of a date, in UTC.
 * Must match weekKey() in public/js/challenge.js — both sides name the week's mode.
 */
function weekKey(date = new Date()) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/** Session mode under which this week's challenge runs are saved. */
function weeklyMode(lang, week = weekKey()) {
  return `weekly-${lang === 'en' ? 'en' : 'ru'}@${week}`;
}

const MIN_ACCURACY = 90;

/** Best run per user this week (accuracy ≥ 90%), fastest first, plus the caller's own place. */
function getWeeklyLeaderboard(lang, userId = null, limit = 20) {
  const db = getDb();
  const mode = weeklyMode(lang);
  const rows = db.prepare(`
    SELECT u.id, u.username, MAX(s.wpm) AS wpm
    FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.mode = ? AND s.is_draft = 0 AND s.accuracy >= ?
    GROUP BY u.id ORDER BY wpm DESC
  `).all(mode, MIN_ACCURACY);
  const ranked = rows.map((r, i) => ({ rank: i + 1, id: r.id, username: r.username, wpm: r.wpm }));
  const me = userId ? ranked.find(r => r.id === userId) || null : null;
  return { week: weekKey(), mode, total: ranked.length, leaderboard: ranked.slice(0, limit), me };
}

module.exports = { weekKey, weeklyMode, getWeeklyLeaderboard, MIN_ACCURACY };

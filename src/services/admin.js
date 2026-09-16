const bcrypt = require('bcryptjs');
const config = require('../config');
const { getDb } = require('../db');

const SALT_ROUNDS = 10;

/**
 * Bootstrap the admin account configured via environment variables.
 * Called once at server startup (see server.js), before app.listen().
 *
 * Contract:
 *  - ADMIN_EMAIL and ADMIN_PASSWORD are required; ADMIN_USERNAME defaults to 'admin'.
 *  - Login is performed by EMAIL + password, so ADMIN_EMAIL must be a real
 *    email the operator controls.
 *  - If a user with this email already exists, they are promoted to admin,
 *    unbanned, verified and their password is reset to ADMIN_PASSWORD.
 *    This guarantees a way back in even after a DB reset / role change / ban,
 *    and makes password rotation via .env work on the next restart.
 *  - Never throws: DB errors are caught and logged, so a misconfigured
 *    bootstrap can never take the whole server down.
 *
 * @returns {number|null} admin user id, or null when bootstrap was skipped.
 */
function bootstrapAdmin() {
  const missing = getMissingAdminVars();
  if (missing.length > 0) {
    console.warn(renderMissingVarsMessage(missing));
    return null;
  }

  if (!config.admin.email.includes('@')) {
    console.warn(`⚠️  ADMIN_EMAIL задан, но выглядит некорректно (нет символа «@»): «${config.admin.email}».`);
    console.warn('   Админ-аккаунт не создан. Исправьте ADMIN_EMAIL в .env и перезапустите сервер.');
    return null;
  }

  try {
    const db = getDb();
    const email = config.admin.email.trim().toLowerCase();
    const username = (config.admin.username || 'admin').trim() || 'admin';

    const existing = db
      .prepare('SELECT id, username, password FROM users WHERE email = ?')
      .get(email);

    if (existing) {
      return ensureExistingAdmin(db, existing, email, username);
    }
    return createAdmin(db, email, username);
  } catch (err) {
    console.warn(`⚠️  Не удалось создать/обновить админ-аккаунт: ${err.message}`);
    console.warn('   Сервер продолжит работу, но вход в админ-панель может быть недоступен.');
    return null;
  }
}

/**
 * Which of the required admin variables are missing/empty.
 * @returns {string[]} e.g. ['ADMIN_EMAIL', 'ADMIN_PASSWORD']
 */
function getMissingAdminVars() {
  const missing = [];
  if (!config.admin.email) missing.push('ADMIN_EMAIL');
  if (!config.admin.password) missing.push('ADMIN_PASSWORD');
  return missing;
}

/**
 * Actionable, per-variable startup warning (Russian, matching codebase style).
 */
function renderMissingVarsMessage(missing) {
  const list = missing.join(', ');
  return [
    `⚠️  Админ-аккаунт НЕ создан: не заданы переменные ${list}.`,
    '   Добавьте их в файл .env в корне проекта (или в переменные окружения хостинга):',
    '     ADMIN_EMAIL=admin@example.com',
    '     ADMIN_USERNAME=admin',
    '     ADMIN_PASSWORD="надёжный-пароль"',
    '   Перезапустите сервер — админ-аккаунт создастся автоматически.',
    '   Подробнее: .env.example и раздел «Админ-аккаунт» в GUIDE_RUN_LOCALLY.md.',
  ].join('\n');
}

/**
 * User with the configured email already exists → promote to admin, unban,
 * verify, fix username (if free) and rotate the password when ADMIN_PASSWORD
 * changed. Idempotent: repeated restarts just refresh the same row.
 */
function ensureExistingAdmin(db, existing, email, preferredUsername) {
  const targetUsername = resolveAdminUsername(db, preferredUsername, existing.id);
  const passwordChanged = !bcrypt.compareSync(config.admin.password, existing.password);
  const storedPassword = passwordChanged
    ? bcrypt.hashSync(config.admin.password, SALT_ROUNDS)
    : existing.password;

  db.prepare(`
    UPDATE users SET
      role = 'admin',
      is_banned = 0,
      banned_at = NULL,
      email_verified = 1,
      username = ?,
      password = ?
    WHERE id = ?
  `).run(targetUsername, storedPassword, existing.id);

  const rotated = passwordChanged ? ' Пароль обновлён из .env.' : '';
  console.log(`✅ Admin account created/ensured: ${email} (login: ${targetUsername}).${rotated}`);
  return existing.id;
}

/**
 * No user with the configured email → insert a brand-new admin.
 */
function createAdmin(db, email, preferredUsername) {
  const targetUsername = resolveAdminUsername(db, preferredUsername, null);
  const hash = bcrypt.hashSync(config.admin.password, SALT_ROUNDS);
  const result = db.prepare(
    `INSERT INTO users (username, email, password, email_verified, role, is_banned)
     VALUES (?, ?, ?, 1, 'admin', 0)`
  ).run(targetUsername, email, hash);
  console.log(`✅ Admin account created/ensured: ${email} (login: ${targetUsername})`);
  return result.lastInsertRowid;
}

/**
 * Returns a username for the admin that is not occupied by another user.
 * Prefers the configured username; on collision tries admin2, admin3, ...
 * and finally falls back to a timestamp suffix — so a username conflict with
 * a regular user can never crash startup (UNIQUE constraint).
 */
function resolveAdminUsername(db, preferred, excludeUserId) {
  const base = (preferred || 'admin').trim() || 'admin';

  const isTaken = (candidate) => {
    const row = excludeUserId != null
      ? db.prepare('SELECT id FROM users WHERE username = ? AND id != ?').get(candidate, excludeUserId)
      : db.prepare('SELECT id FROM users WHERE username = ?').get(candidate);
    return !!row;
  };

  if (!isTaken(base)) return base;
  for (let i = 2; i < 100; i += 1) {
    const candidate = `${base}${i}`;
    if (!isTaken(candidate)) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

/** Admin view of a user — includes email, role, ban state. */
function formatAdminUser(row) {
  return {
    id: row.id,
    username: row.username,
    email: row.email || null,
    emailVerified: !!row.email_verified,
    role: row.role || 'user',
    isBanned: !!row.is_banned,
    bannedAt: row.banned_at || null,
    language: row.language || 'ru',
    profile: row.profile || 'general',
    totalXp: row.total_xp,
    bestWpm: row.best_wpm,
    bestStreak: row.best_streak,
    sessionCount: row.session_count,
    createdAt: row.created_at,
  };
}

function listUsers({ search = '', limit = 50, offset = 0, onlyBanned = false } = {}) {
  const db = getDb();
  let sql = `
    SELECT id, username, email, email_verified, role, is_banned, banned_at,
           language, profile, total_xp, best_wpm, best_streak, session_count, created_at
    FROM users
  `;
  const where = [];
  const params = [];

  if (search) {
    where.push('(username LIKE ? OR email LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }
  if (onlyBanned) {
    where.push('is_banned = 1');
  }
  if (where.length) {
    sql += ' WHERE ' + where.join(' AND ');
  }
  sql += ' ORDER BY id ASC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const rows = db.prepare(sql).all(...params);
  return rows.map(formatAdminUser);
}

function getUser(id) {
  const db = getDb();
  const row = db.prepare(`
    SELECT id, username, email, email_verified, role, is_banned, banned_at,
           language, profile, total_xp, best_wpm, best_streak, session_count, created_at
    FROM users WHERE id = ?
  `).get(id);
  if (!row) return null;
  return formatAdminUser(row);
}

function setRole(id, role) {
  const db = getDb();
  db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, id);
}

function setBan(id, isBanned) {
  const db = getDb();
  if (isBanned) {
    db.prepare(
      "UPDATE users SET is_banned = 1, banned_at = datetime('now') WHERE id = ?"
    ).run(id);
  } else {
    db.prepare(
      'UPDATE users SET is_banned = 0, banned_at = NULL WHERE id = ?'
    ).run(id);
  }
}

function deleteUser(id) {
  const db = getDb();
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id);
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
}

function resetPassword(id, newPassword) {
  const db = getDb();
  const hash = bcrypt.hashSync(newPassword, SALT_ROUNDS);
  db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hash, id);
}

module.exports = {
  bootstrapAdmin,
  getMissingAdminVars,
  renderMissingVarsMessage,
  ensureExistingAdmin,
  createAdmin,
  resolveAdminUsername,
  listUsers,
  getUser,
  setRole,
  setBan,
  deleteUser,
  resetPassword,
};

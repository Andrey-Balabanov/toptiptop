const jwt = require('jsonwebtoken');
const config = require('../config');
const { getDb } = require('../db');

/**
 * Authenticates the user via JWT, then loads the fresh user row from the DB
 * so that role changes and bans take effect immediately (no need to wait
 * for token expiry). Rejects banned accounts on every protected route.
 */
function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Требуется авторизация' });
  }
  const token = header.slice(7);

  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret);
  } catch (err) {
    return res.status(401).json({ error: 'Токен недействителен или истёк' });
  }

  if (!payload || !payload.userId) {
    return res.status(401).json({ error: 'Токен недействителен или истёк' });
  }

  // Single PK lookup per request — cheap with better-sqlite3 and keeps
  // ban/role state fresh without caching stale tokens.
  const user = getDb().prepare(
    'SELECT id, username, role, is_banned, language, profile FROM users WHERE id = ?'
  ).get(payload.userId);

  if (!user) {
    return res.status(401).json({ error: 'Пользователь не найден' });
  }
  if (user.is_banned) {
    return res.status(403).json({ error: 'Аккаунт заблокирован администратором' });
  }

  req.user = {
    id: user.id,
    username: user.username,
    role: user.role || 'user',
    isBanned: !!user.is_banned,
    language: user.language || 'ru',
    profile: user.profile || 'general',
  };
  next();
}

/**
 * Must be used AFTER authMiddleware.
 * Grants access only to users with the 'admin' role.
 */
function adminMiddleware(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Доступ только для администраторов' });
  }
  next();
}

module.exports = { authMiddleware, adminMiddleware };

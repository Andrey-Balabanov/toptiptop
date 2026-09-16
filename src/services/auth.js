const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const config = require('../config');
const { getDb } = require('../db');
const { sendVerificationCode } = require('./mail');

const SALT_ROUNDS = 10;

/**
 * Normalize an email address for storage/lookup: trim whitespace and
 * lowercase. The admin bootstrap stores ADMIN_EMAIL lowercased, so login
 * must apply the same normalization or case differences would silently
 * break admin access.
 */
function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

/* ============ Registration with email ============ */

async function registerUser(username, email, password) {
  const db = getDb();
  email = normalizeEmail(email);

  // Check username
  const existingUser = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existingUser) {
    throw new Error('USERNAME_TAKEN');
  }

  // Check email (case-insensitive so mixed-case duplicates are rejected)
  const existingEmail = db.prepare('SELECT id FROM users WHERE email = ? COLLATE NOCASE').get(email);
  if (existingEmail) {
    throw new Error('EMAIL_TAKEN');
  }

  const hash = await bcrypt.hash(password, SALT_ROUNDS);

  const result = db.prepare(
    'INSERT INTO users (username, email, password, email_verified, role, is_banned) VALUES (?, ?, ?, ?, ?, 0)'
  ).run(username, email, hash, config.devAutoVerify ? 1 : 0, 'user');

  // If dev auto-verify, return token immediately
  if (config.devAutoVerify) {
    const token = jwt.sign(
      { userId: result.lastInsertRowid, username, role: 'user' },
      config.jwtSecret,
      { expiresIn: config.jwtExpiresIn }
    );

    return {
      token,
      user: formatUser({
        id: result.lastInsertRowid,
        username,
        email,
        language: 'ru',
        profile: 'general',
        keyboard_layout: 'pc-ansi',
        total_xp: 0,
        best_wpm: 0,
        best_streak: 0,
        session_count: 0,
        role: 'user',
        is_banned: 0,
      }),
    };
  }

  // Send verification code
  const code = generateCode();
  storeVerificationCode(email, code, 'register');

  let mailError = null;
  let fallbackCode = null;
  try {
    await sendVerificationCode(email, code, 'register');
  } catch (err) {
    console.warn('[AUTH] Failed to send verification email:', err.message);
    mailError = err.code || 'MAIL_SMTP_ERROR';
  }

  // If MAIL_HOST is not configured, return code as fallback for frontend
  if (!config.mail.host) {
    fallbackCode = code;
  }

  const response = {
    needVerification: true,
    email,
    user: {
      id: result.lastInsertRowid,
      username,
      email,
      role: 'user',
      isBanned: false,
    },
  };

  if (fallbackCode) {
    response.code = fallbackCode;
    response.mailError = 'MAIL_DEV_FALLBACK';
    response.message = 'Код подтверждения: ' + fallbackCode;
  } else if (mailError) {
    response.mailError = mailError;
    response.message = 'Пользователь создан, но не удалось отправить письмо. Код сохранён в логах сервера.';
  } else {
    response.message = 'Код подтверждения отправлен на email';
  }

  return response;
}

/* ============ Resend verification code ============ */

async function resendCode(email) {
  const db = getDb();
  email = normalizeEmail(email);

  const user = db.prepare('SELECT id, email_verified, is_banned FROM users WHERE email = ?').get(email);
  if (!user) {
    throw new Error('USER_NOT_FOUND');
  }
  if (user.is_banned) {
    throw new Error('ACCOUNT_BANNED');
  }
  if (user.email_verified) {
    throw new Error('ALREADY_VERIFIED');
  }

  // Invalidate old unused codes
  db.prepare(`
    UPDATE email_verification_codes SET used = 1
    WHERE email = ? AND purpose = 'register' AND used = 0
  `).run(email);

  // Generate new code
  const code = generateCode();
  storeVerificationCode(email, code, 'register');

  let mailError = null;
  let fallbackCode = null;
  try {
    await sendVerificationCode(email, code, 'register');
  } catch (err) {
    console.warn('[AUTH] Failed to resend verification email:', err.message);
    mailError = err.code || 'MAIL_SMTP_ERROR';
  }

  if (!config.mail.host) {
    fallbackCode = code;
  }

  const response = {};

  if (fallbackCode) {
    response.code = fallbackCode;
    response.mailError = 'MAIL_DEV_FALLBACK';
    response.message = 'Новый код: ' + fallbackCode;
  } else if (mailError) {
    response.mailError = mailError;
    response.message = 'Не удалось отправить письмо. Код сохранён в логах сервера.';
  } else {
    response.message = 'Новый код отправлен на email';
  }

  return response;
}

/* ============ Verify email ============ */

async function verifyEmail(email, code) {
  const db = getDb();
  email = normalizeEmail(email);

  // Find valid, unused code
  const record = db.prepare(`
    SELECT * FROM email_verification_codes
    WHERE email = ? AND code = ? AND purpose = 'register'
    AND used = 0 AND expires_at > datetime('now')
    ORDER BY created_at DESC LIMIT 1
  `).get(email, code);

  if (!record) {
    throw new Error('INVALID_OR_EXPIRED_CODE');
  }

  // Mark code as used
  db.prepare('UPDATE email_verification_codes SET used = 1 WHERE id = ?').run(record.id);

  // Mark user as verified
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user) {
    throw new Error('USER_NOT_FOUND');
  }
  if (user.is_banned) {
    throw new Error('ACCOUNT_BANNED');
  }

  db.prepare('UPDATE users SET email_verified = 1 WHERE id = ?').run(user.id);

  // Generate token
  const token = jwt.sign(
    { userId: user.id, username: user.username, role: user.role || 'user' },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );

  return {
    token,
    user: formatUser(user),
  };
}

/* ============ Login with email + password ============ */

async function loginWithEmail(email, password) {
  const db = getDb();
  email = normalizeEmail(email);
  // COLLATE NOCASE keeps legacy mixed-case accounts reachable, while the
  // bootstrap always stores ADMIN_EMAIL lowercased.
  const user = db.prepare('SELECT * FROM users WHERE email = ? COLLATE NOCASE').get(email);
  if (!user) {
    throw new Error('INVALID_CREDENTIALS');
  }

  // Banned accounts cannot log in at all (even with a correct password)
  if (user.is_banned) {
    throw new Error('ACCOUNT_BANNED');
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    throw new Error('INVALID_CREDENTIALS');
  }

  const token = jwt.sign(
    { userId: user.id, username: user.username, role: user.role || 'user' },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );

  return {
    token,
    user: formatUser(user),
  };
}

/* ============ User profile management ============ */

function getUserById(userId) {
  const db = getDb();
  const user = db.prepare(
    `SELECT id, username, email, email_verified, language, profile, keyboard_layout,
            total_xp, best_wpm, best_streak, session_count, created_at,
            role, is_banned
     FROM users WHERE id = ?`
  ).get(userId);
  if (!user) return null;
  return formatUser(user);
}

function updateUserLanguage(userId, language) {
  const db = getDb();
  db.prepare('UPDATE users SET language = ? WHERE id = ?').run(language, userId);
}

function updateUserProfile(userId, profile) {
  const db = getDb();
  db.prepare('UPDATE users SET profile = ? WHERE id = ?').run(profile, userId);
}

function updateUserKeyboardLayout(userId, layout) {
  const db = getDb();
  db.prepare('UPDATE users SET keyboard_layout = ? WHERE id = ?').run(layout, userId);
}

function updateUserStats(userId, newXp, newWpm, newStreak) {
  const db = getDb();
  db.prepare(`
    UPDATE users SET
      total_xp = total_xp + ?,
      best_wpm = MAX(best_wpm, ?),
      best_streak = MAX(best_streak, ?),
      session_count = session_count + 1
    WHERE id = ?
  `).run(newXp, newWpm, newStreak, userId);
}

/* ============ Helpers ============ */

function formatUser(row) {
  return {
    id: row.id,
    username: row.username,
    email: row.email || null,
    emailVerified: !!row.email_verified,
    language: row.language || 'ru',
    profile: row.profile || 'general',
    keyboardLayout: row.keyboard_layout || 'pc-ansi',
    totalXp: row.total_xp,
    bestWpm: row.best_wpm,
    bestStreak: row.best_streak,
    sessionCount: row.session_count,
    role: row.role || 'user',
    isBanned: !!row.is_banned,
    createdAt: row.created_at,
  };
}

function generateCode() {
  return crypto.randomInt(100000, 999999).toString();
}

function storeVerificationCode(email, code, purpose) {
  const db = getDb();
  // Expire in 10 minutes
  db.prepare(`
    INSERT INTO email_verification_codes (email, code, purpose, expires_at)
    VALUES (?, ?, ?, datetime('now', '+10 minutes'))
  `).run(email, code, purpose);
}

module.exports = {
  registerUser,
  resendCode,
  verifyEmail,
  loginWithEmail,
  getUserById,
  updateUserLanguage,
  updateUserProfile,
  updateUserKeyboardLayout,
  updateUserStats,
};

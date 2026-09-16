/**
 * Validation middleware for session body, auth body, and profile updates
 */

const MAX_PASSWORD_LENGTH = 128;

const VALID_LANGUAGES = ['ru', 'en', 'de', 'fr', 'es', 'it', 'pt', 'pl', 'uk'];
const VALID_PROFILES = ['general', 'writer', 'programmer', 'accountant', 'journalist', 'student', 'doctor', 'lawyer'];

function validateSessionBody(req, res, next) {
  const { wpm, accuracy, totalErrors, xpEarned, durationMs, textLength, streakMax, mode, clientSessionId } = req.body;

  const errors = [];
  if (wpm == null || typeof wpm !== 'number' || wpm < 0 || wpm > 500) errors.push('wpm (0–500)');
  if (accuracy == null || typeof accuracy !== 'number' || accuracy < 0 || accuracy > 100) errors.push('accuracy (0–100)');
  if (totalErrors == null || typeof totalErrors !== 'number' || totalErrors < 0) errors.push('totalErrors');
  if (xpEarned == null || typeof xpEarned !== 'number') errors.push('xpEarned');
  if (durationMs == null || typeof durationMs !== 'number' || durationMs < 0) errors.push('durationMs');
  if (textLength == null || typeof textLength !== 'number' || textLength < 1) errors.push('textLength');
  if (streakMax == null || typeof streakMax !== 'number' || streakMax < 0) errors.push('streakMax');
  if (!mode || typeof mode !== 'string') errors.push('mode');
  if (!clientSessionId || typeof clientSessionId !== 'string') errors.push('clientSessionId');

  if (errors.length > 0) {
    return res.status(400).json({ error: `Неверные поля: ${errors.join(', ')}` });
  }
  next();
}

function validateAuthBody(req, res, next) {
  const { username, email, password } = req.body;
  const errors = [];
  if (!username || typeof username !== 'string' || username.length < 3 || username.length > 30) {
    errors.push('username (3–30 символов)');
  }
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    errors.push('email (валидный email)');
  }
  if (!password || typeof password !== 'string' || password.length < 6 || password.length > MAX_PASSWORD_LENGTH) {
    errors.push(`password (6–${MAX_PASSWORD_LENGTH} символов)`);
  }
  if (errors.length > 0) {
    return res.status(400).json({ error: `Неверные поля: ${errors.join(', ')}` });
  }
  next();
}

function validateLoginBody(req, res, next) {
  const { email, password } = req.body;
  const errors = [];
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    errors.push('email');
  }
  if (!password || typeof password !== 'string' || password.length < 6 || password.length > MAX_PASSWORD_LENGTH) {
    errors.push('password');
  }
  if (errors.length > 0) {
    return res.status(400).json({ error: `Неверные поля: ${errors.join(', ')}` });
  }
  next();
}

function validateProfileUpdate(req, res, next) {
  const { language, profile } = req.body;

  if (language && !VALID_LANGUAGES.includes(language)) {
    return res.status(400).json({ error: `Неверный язык. Допустимые: ${VALID_LANGUAGES.join(', ')}` });
  }
  if (profile && !VALID_PROFILES.includes(profile)) {
    return res.status(400).json({ error: `Неверный профиль. Допустимые: ${VALID_PROFILES.join(', ')}` });
  }
  next();
}

module.exports = { validateSessionBody, validateAuthBody, validateLoginBody, validateProfileUpdate, VALID_LANGUAGES, VALID_PROFILES };

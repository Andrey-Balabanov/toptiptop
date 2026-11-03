const { Router } = require('express');
const { authMiddleware } = require('../middleware/auth');
const {
  getUserById,
  updateUserLanguage,
  updateUserProfile,
  updateUserKeyboardLayout,
  mergeUserProgress,
} = require('../services/auth');
const { getLeaderboard } = require('../services/sessions');
const { getWeeklyLeaderboard } = require('../services/challenge');
const { optionalUserId } = require('../middleware/auth');

const router = Router();

const VALID_KEYBOARD_LAYOUTS = ['pc-ansi', 'pc-iso', 'mac-ansi', 'mac-iso'];
const ACHIEVEMENT_ID = /^[a-z0-9-]{1,40}$/;
const MAX_ACHIEVEMENTS = 200;
const MAX_KEY_STATS = 300;
const isCount = n => Number.isInteger(n) && n >= 0;
const isPlainObject = o => !!o && typeof o === 'object' && !Array.isArray(o);

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** { goal, lastGoalDay, streak, best, today: { date, texts, ms } } */
function isValidDaily(d) {
  return isPlainObject(d) &&
    isCount(d.goal) && d.goal >= 1 && d.goal <= 50 &&
    (d.lastGoalDay === null || DAY.test(d.lastGoalDay)) &&
    isCount(d.streak) && isCount(d.best) &&
    isPlainObject(d.today) && (d.today.date === null || DAY.test(d.today.date)) &&
    isCount(d.today.texts) && isCount(d.today.ms);
}

/** { ru: { passed: 3, best: { '0': { wpm: 20, accuracy: 97 } } } } */
function isValidCourse(course) {
  if (!isPlainObject(course)) return false;
  return Object.entries(course).every(([language, c]) =>
    /^[a-z]{2}$/.test(language) && isPlainObject(c) &&
    isCount(c.passed) && c.passed <= 100 && isPlainObject(c.best || {}) &&
    Object.entries(c.best || {}).every(([i, r]) =>
      /^\d{1,3}$/.test(i) && isPlainObject(r) &&
      Number.isFinite(r.wpm) && r.wpm >= 0 && r.wpm <= 400 &&
      Number.isFinite(r.accuracy) && r.accuracy >= 0 && r.accuracy <= 100));
}

// Get current user profile
router.get('/me', authMiddleware, (req, res) => {
  try {
    const user = getUserById(req.user.id);
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
    res.json(user);
  } catch (err) {
    console.error('Get user error:', err);
    res.status(500).json({ error: 'Ошибка загрузки профиля' });
  }
});

// Update user language preference
router.patch('/me/language', authMiddleware, (req, res) => {
  try {
    const { language } = req.body;
    const validLanguages = ['ru', 'en', 'de', 'fr', 'es', 'it', 'pt', 'pl'];
    if (!language || !validLanguages.includes(language)) {
      return res.status(400).json({ error: 'Неподдерживаемый язык' });
    }
    updateUserLanguage(req.user.id, language);
    res.json({ language });
  } catch (err) {
    console.error('Update language error:', err);
    res.status(500).json({ error: 'Ошибка обновления языка' });
  }
});

// Update user profile
router.patch('/me/profile', authMiddleware, (req, res) => {
  try {
    const { profile } = req.body;
    const validProfiles = ['general', 'writer', 'programmer', 'accountant', 'journalist', 'student', 'doctor', 'lawyer'];
    if (!profile || !validProfiles.includes(profile)) {
      return res.status(400).json({ error: 'Неподдерживаемый профиль' });
    }
    updateUserProfile(req.user.id, profile);
    res.json({ profile });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Ошибка обновления профиля' });
  }
});

// Update user keyboard layout
router.patch('/me/keyboard', authMiddleware, (req, res) => {
  try {
    const { layout } = req.body;
    if (!layout || !VALID_KEYBOARD_LAYOUTS.includes(layout)) {
      return res.status(400).json({
        error: 'Неподдерживаемая раскладка. Допустимые: ' + VALID_KEYBOARD_LAYOUTS.join(', '),
      });
    }
    updateUserKeyboardLayout(req.user.id, layout);
    res.json({ layout });
  } catch (err) {
    console.error('Update keyboard layout error:', err);
    res.status(500).json({ error: 'Ошибка обновления раскладки клавиатуры' });
  }
});

// Merge achievements / total characters into the account (union, never removes)
router.patch('/me/progress', authMiddleware, (req, res) => {
  try {
    const { achievements = {}, totalChars = 0, keyStats = {}, course = {}, daily = null, counters = {} } = req.body || {};
    const entries = achievements && typeof achievements === 'object' && !Array.isArray(achievements)
      ? Object.entries(achievements)
      : null;
    if (!entries || entries.length > MAX_ACHIEVEMENTS ||
        !entries.every(([id, ts]) => ACHIEVEMENT_ID.test(id) && Number.isFinite(ts) && ts > 0)) {
      return res.status(400).json({ error: 'Некорректные достижения' });
    }
    if (!Number.isInteger(totalChars) || totalChars < 0) {
      return res.status(400).json({ error: 'Некорректное число символов' });
    }
    const statEntries = keyStats && typeof keyStats === 'object' && !Array.isArray(keyStats)
      ? Object.entries(keyStats)
      : null;
    if (!statEntries || statEntries.length > MAX_KEY_STATS ||
        !statEntries.every(([key, s]) => [...key].length === 1 && s && isCount(s.h) && isCount(s.m))) {
      return res.status(400).json({ error: 'Некорректная статистика клавиш' });
    }
    if (!isValidCourse(course)) {
      return res.status(400).json({ error: 'Некорректный прогресс курса' });
    }
    if (daily !== null && !isValidDaily(daily)) {
      return res.status(400).json({ error: 'Некорректная дневная цель' });
    }
    if (!isPlainObject(counters) || Object.keys(counters).length > 20 ||
        !Object.entries(counters).every(([k, v]) => /^[a-zA-Z]{1,30}$/.test(k) && isCount(v) && v < 1e9)) {
      return res.status(400).json({ error: 'Некорректные счётчики' });
    }
    const result = mergeUserProgress(req.user.id, achievements, totalChars, keyStats, course, daily, counters);
    if (!result) return res.status(404).json({ error: 'Пользователь не найден' });
    res.json(result);
  } catch (err) {
    console.error('Update progress error:', err);
    res.status(500).json({ error: 'Ошибка сохранения прогресса' });
  }
});

// Leaderboard (no auth required) — MUST come BEFORE /:id catch-all
router.get('/leaderboard', (req, res) => {
  try {
    const type = req.query.type === 'xp' ? 'xp' : 'wpm';
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    const data = getLeaderboard(type, limit);
    res.json(data);
  } catch (err) {
    console.error('Leaderboard error:', err);
    res.status(500).json({ error: 'Ошибка загрузки лидерборда' });
  }
});

// Weekly challenge leaderboard (no auth required; logged-in callers also get their own place)
router.get('/challenge/weekly', (req, res) => {
  try {
    const lang = req.query.lang === 'en' ? 'en' : 'ru';
    res.json(getWeeklyLeaderboard(lang, optionalUserId(req)));
  } catch (err) {
    console.error('Weekly challenge error:', err);
    res.status(500).json({ error: 'Ошибка загрузки испытания недели' });
  }
});

// Get user by id (public) — catch-all AFTER specific routes
router.get('/:id', (req, res) => {
  try {
    const user = getUserById(parseInt(req.params.id, 10));
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
    // Strip sensitive fields
    const { email, emailVerified, role, isBanned, ...safe } = user;
    res.json(safe);
  } catch (err) {
    console.error('Get user error:', err);
    res.status(500).json({ error: 'Ошибка загрузки профиля' });
  }
});

module.exports = router;

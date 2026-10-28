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

const router = Router();

const VALID_KEYBOARD_LAYOUTS = ['pc-ansi', 'pc-iso', 'mac-ansi', 'mac-iso'];
const ACHIEVEMENT_ID = /^[a-z0-9-]{1,40}$/;
const MAX_ACHIEVEMENTS = 200;
const MAX_KEY_STATS = 300;
const isCount = n => Number.isInteger(n) && n >= 0;

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
    const validLanguages = ['ru', 'en', 'de', 'fr', 'es', 'it', 'pt', 'pl', 'uk'];
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
    const { achievements = {}, totalChars = 0, keyStats = {} } = req.body || {};
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
    const result = mergeUserProgress(req.user.id, achievements, totalChars, keyStats);
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

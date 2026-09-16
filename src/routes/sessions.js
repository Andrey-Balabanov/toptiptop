const { Router } = require('express');
const { authMiddleware } = require('../middleware/auth');
const { validateSessionBody } = require('../middleware/validate');
const { createSession, listSessions, getSessionById } = require('../services/sessions');
const { updateUserStats } = require('../services/auth');

const router = Router();

// Create a completed session
router.post('/', authMiddleware, validateSessionBody, (req, res) => {
  try {
    const result = createSession(req.user.id, { ...req.body, isDraft: false });
    if (!result.duplicate) {
      updateUserStats(req.user.id, req.body.xpEarned, req.body.wpm, req.body.streakMax);
    }
    res.status(result.duplicate ? 200 : 201).json({ id: result.id });
  } catch (err) {
    console.error('Create session error:', err);
    res.status(500).json({ error: 'Ошибка сохранения сессии' });
  }
});

// Create a draft session (auto-save)
router.post('/draft', authMiddleware, validateSessionBody, (req, res) => {
  try {
    const result = createSession(req.user.id, { ...req.body, isDraft: true });
    res.status(result.duplicate ? 200 : 201).json({ id: result.id });
  } catch (err) {
    console.error('Create draft error:', err);
    res.status(500).json({ error: 'Ошибка сохранения черновика' });
  }
});

// List sessions
router.get('/', authMiddleware, (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const offset = parseInt(req.query.offset, 10) || 0;
    const { mode, from, to } = req.query;
    const sessions = listSessions(req.user.id, { limit, offset, mode, from, to });
    res.json(sessions);
  } catch (err) {
    console.error('List sessions error:', err);
    res.status(500).json({ error: 'Ошибка загрузки сессий' });
  }
});

// Get single session
router.get('/:id', authMiddleware, (req, res) => {
  try {
    const session = getSessionById(parseInt(req.params.id, 10), req.user.id);
    if (!session) return res.status(404).json({ error: 'Сессия не найдена' });
    res.json(session);
  } catch (err) {
    console.error('Get session error:', err);
    res.status(500).json({ error: 'Ошибка загрузки сессии' });
  }
});

module.exports = router;

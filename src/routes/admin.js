const { Router } = require('express');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const adminService = require('../services/admin');

const router = Router();

const VALID_ROLES = ['user', 'admin'];

// All admin routes require authentication + admin role
router.use(authMiddleware, adminMiddleware);

// GET /api/admin/users?search=&banned=1&limit=&offset=
router.get('/users', (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const offset = parseInt(req.query.offset, 10) || 0;
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const onlyBanned = req.query.banned === '1' || req.query.banned === 'true';
    const users = adminService.listUsers({ search, limit, offset, onlyBanned });
    res.json({ users, count: users.length });
  } catch (err) {
    console.error('Admin list users error:', err);
    res.status(500).json({ error: 'Ошибка загрузки пользователей' });
  }
});

// GET /api/admin/users/:id
router.get('/users/:id', (req, res) => {
  try {
    const user = adminService.getUser(parseInt(req.params.id, 10));
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
    res.json(user);
  } catch (err) {
    console.error('Admin get user error:', err);
    res.status(500).json({ error: 'Ошибка загрузки пользователя' });
  }
});

// PATCH /api/admin/users/:id  { role?, isBanned? }
router.patch('/users/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { role, isBanned } = req.body || {};

    if (id === req.user.id && isBanned === true) {
      return res.status(400).json({ error: 'Нельзя заблокировать самого себя' });
    }

    const user = adminService.getUser(id);
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

    if (role !== undefined) {
      if (!VALID_ROLES.includes(role)) {
        return res.status(400).json({ error: `Недопустимая роль. Допустимые: ${VALID_ROLES.join(', ')}` });
      }
      adminService.setRole(id, role);
    }
    if (isBanned !== undefined) {
      adminService.setBan(id, !!isBanned);
    }

    res.json(adminService.getUser(id));
  } catch (err) {
    console.error('Admin update user error:', err);
    res.status(500).json({ error: 'Ошибка обновления пользователя' });
  }
});

// DELETE /api/admin/users/:id
router.delete('/users/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (id === req.user.id) {
      return res.status(400).json({ error: 'Нельзя удалить самого себя' });
    }
    const user = adminService.getUser(id);
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
    adminService.deleteUser(id);
    res.json({ ok: true });
  } catch (err) {
    console.error('Admin delete user error:', err);
    res.status(500).json({ error: 'Ошибка удаления пользователя' });
  }
});

// POST /api/admin/users/:id/reset-password  { password }
router.post('/users/:id/reset-password', (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { password } = req.body || {};
    if (!password || typeof password !== 'string' || password.length < 6 || password.length > 128) {
      return res.status(400).json({ error: 'Пароль должен быть от 6 до 128 символов' });
    }
    const user = adminService.getUser(id);
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
    adminService.resetPassword(id, password);
    res.json({ ok: true });
  } catch (err) {
    console.error('Admin reset password error:', err);
    res.status(500).json({ error: 'Ошибка сброса пароля' });
  }
});

module.exports = router;

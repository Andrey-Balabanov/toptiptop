const { Router } = require('express');
const { authMiddleware } = require('../middleware/auth');
const groups = require('../services/groups');

const router = Router();

const ERRORS = {
  GROUP_NOT_FOUND: [404, 'Группа с таким кодом не найдена'],
  GROUP_FULL: [409, 'В группе уже максимум участников'],
  TOO_MANY_GROUPS: [409, 'Можно состоять не более чем в 20 группах'],
  NOT_OWNER: [403, 'Это может сделать только создатель группы'],
  CANNOT_REMOVE_OWNER: [400, 'Создателя нельзя удалить из группы'],
};

function fail(res, err, fallback) {
  const known = ERRORS[err.message];
  if (known) return res.status(known[0]).json({ error: known[1] });
  console.error(fallback, err);
  return res.status(500).json({ error: 'Ошибка сервера' });
}

router.use(authMiddleware);

router.get('/', (req, res) => {
  try {
    res.json(groups.listMyGroups(req.user.id));
  } catch (err) { fail(res, err, 'List groups error:'); }
});

router.post('/', (req, res) => {
  const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
  if (name.length < 2 || name.length > 40) {
    return res.status(400).json({ error: 'Название группы: от 2 до 40 символов' });
  }
  try {
    res.status(201).json(groups.createGroup(req.user.id, name));
  } catch (err) { fail(res, err, 'Create group error:'); }
});

router.post('/join', (req, res) => {
  const code = typeof req.body.code === 'string' ? req.body.code.trim() : '';
  if (!/^[A-Za-z0-9]{6}$/.test(code)) return res.status(400).json({ error: 'Код группы — 6 символов' });
  try {
    res.json(groups.joinGroup(req.user.id, code));
  } catch (err) { fail(res, err, 'Join group error:'); }
});

router.get('/:id', (req, res) => {
  try {
    const group = groups.getGroup(req.user.id, parseInt(req.params.id, 10));
    if (!group) return res.status(404).json({ error: 'Группа не найдена' });
    res.json(group);
  } catch (err) { fail(res, err, 'Get group error:'); }
});

// Leave (the owner leaving deletes the group)
router.delete('/:id/members/me', (req, res) => {
  try {
    groups.leaveGroup(req.user.id, parseInt(req.params.id, 10));
    res.json({ ok: true });
  } catch (err) { fail(res, err, 'Leave group error:'); }
});

// Owner removes a member
router.delete('/:id/members/:userId', (req, res) => {
  try {
    groups.removeMember(req.user.id, parseInt(req.params.id, 10), parseInt(req.params.userId, 10));
    res.json({ ok: true });
  } catch (err) { fail(res, err, 'Remove member error:'); }
});

module.exports = router;

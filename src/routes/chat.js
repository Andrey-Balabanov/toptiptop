const { Router } = require('express');
const { authMiddleware } = require('../middleware/auth');
const chat = require('../services/chat');

const router = Router();

const ERRORS = {
  CHANNEL_NOT_FOUND: [404, 'Чат не найден'],
  EMPTY_MESSAGE: [400, 'Сообщение пустое'],
  MESSAGE_TOO_LONG: [400, `Сообщение длиннее ${chat.MAX_LENGTH} символов`],
  SLOW_DOWN: [429, 'Слишком много сообщений подряд, подождите немного'],
  MESSAGE_NOT_FOUND: [404, 'Сообщение не найдено'],
  NOT_ALLOWED: [403, 'Нельзя удалить чужое сообщение'],
};

function handle(fn) {
  return (req, res) => {
    try {
      res.json(fn(req));
    } catch (err) {
      const known = ERRORS[err.message];
      if (known) return res.status(known[0]).json({ error: known[1] });
      console.error('Chat error:', err);
      res.status(500).json({ error: 'Ошибка сервера' });
    }
  };
}

const intParam = v => (v === undefined ? undefined : parseInt(v, 10));

router.use(authMiddleware);

router.get('/channels', handle(req => chat.listChannels(req.user.id)));
router.get('/:channel/messages', handle(req => chat.getMessages(req.user, req.params.channel, {
  after: intParam(req.query.after),
  before: intParam(req.query.before),
})));
router.post('/:channel/messages', handle(req => chat.postMessage(req.user, req.params.channel, req.body && req.body.body)));
router.delete('/messages/:id', handle(req => {
  chat.deleteMessage(req.user, parseInt(req.params.id, 10));
  return { ok: true };
}));

module.exports = router;

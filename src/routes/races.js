const { Router } = require('express');
const { authMiddleware } = require('../middleware/auth');
const races = require('../services/races');

const router = Router();

const ERRORS = {
  RACE_NOT_FOUND: [404, 'Гонка с таким кодом не найдена или уже закончилась'],
  RACE_STARTED: [409, 'Гонка уже началась'],
  ROOM_FULL: [409, 'В гонке уже максимум участников'],
  NOT_HOST: [403, 'Начать гонку может только её создатель'],
  NOT_IN_RACE: [403, 'Вы не участвуете в этой гонке'],
  TOO_MANY_ROOMS: [503, 'Сейчас слишком много гонок, попробуйте позже'],
  BAD_TEXT: [400, 'Некорректный текст гонки'],
};

function handle(fn) {
  return (req, res) => {
    try {
      res.json(fn(req));
    } catch (err) {
      const known = ERRORS[err.message];
      if (known) return res.status(known[0]).json({ error: known[1] });
      console.error('Race error:', err);
      res.status(500).json({ error: 'Ошибка сервера' });
    }
  };
}

router.use(authMiddleware);

router.post('/', handle(req => races.createRace(req.user, { text: req.body.text, lang: req.body.lang })));
router.get('/:code', handle(req => races.getRace(req.user, req.params.code)));
router.post('/:code/join', handle(req => races.joinRace(req.user, req.params.code)));
router.post('/:code/start', handle(req => races.startRace(req.user, req.params.code)));
router.post('/:code/progress', handle(req => races.reportProgress(req.user, req.params.code, req.body || {})));
router.post('/:code/leave', handle(req => {
  races.leaveRace(req.user, req.params.code);
  return { ok: true };
}));

module.exports = router;

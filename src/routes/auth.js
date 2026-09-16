const { Router } = require('express');
const rateLimit = require('express-rate-limit');
const {
  registerUser,
  verifyEmail,
  loginWithEmail,
  resendCode,
} = require('../services/auth');
const { validateLoginBody, validateAuthBody } = require('../middleware/validate');

const router = Router();

// Rate limiter for resend-code: max 1 request per 60 seconds per email
const resendLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 1,
  message: { error: 'Код можно запросить не чаще 1 раза в 60 секунд' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const email = req.body && req.body.email
      ? String(req.body.email).trim().toLowerCase()
      : req.ip;
    return email ? `resend:${email}` : `resend:ip:${req.ip}`;
  },
});

// Register with username + email + password
router.post('/register', validateAuthBody, async (req, res) => {
  try {
    const { username, password, email } = req.body;

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({ error: 'Укажите корректный email' });
    }

    const result = await registerUser(username, email, password);

    // If code is returned as fallback (dev mode without MAIL_HOST), include it
    if (result.code) {
      return res.status(201).json(result);
    }

    // If mail sending failed, still return success but warn the user
    if (result.mailError) {
      return res.status(201).json(result);
    }

    res.status(201).json(result);
  } catch (err) {
    if (err.message === 'USERNAME_TAKEN') {
      return res.status(409).json({ error: 'Имя пользователя уже занято' });
    }
    if (err.message === 'EMAIL_TAKEN') {
      return res.status(409).json({ error: 'Email уже используется' });
    }
    console.error('Register error:', err);
    res.status(500).json({ error: 'Ошибка регистрации' });
  }
});

// Resend verification code
router.post('/resend-code', resendLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({ error: 'Укажите корректный email' });
    }

    const result = await resendCode(email);
    res.json(result);
  } catch (err) {
    if (err.message === 'USER_NOT_FOUND') {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }
    if (err.message === 'ALREADY_VERIFIED') {
      return res.status(400).json({ error: 'Email уже подтверждён' });
    }
    if (err.message === 'ACCOUNT_BANNED') {
      return res.status(403).json({ error: 'Аккаунт заблокирован администратором' });
    }
    console.error('Resend code error:', err);
    res.status(500).json({ error: 'Ошибка при повторной отправке кода' });
  }
});

// Verify email with code (registration only)
router.post('/verify-email', async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      return res.status(400).json({ error: 'Email и код обязательны' });
    }
    const result = await verifyEmail(email, code);
    res.json(result);
  } catch (err) {
    if (err.message === 'INVALID_OR_EXPIRED_CODE') {
      return res.status(400).json({ error: 'Неверный или просроченный код' });
    }
    if (err.message === 'USER_NOT_FOUND') {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }
    if (err.message === 'ACCOUNT_BANNED') {
      return res.status(403).json({ error: 'Аккаунт заблокирован администратором' });
    }
    console.error('Verify email error:', err);
    res.status(500).json({ error: 'Ошибка верификации email' });
  }
});

// Login with email + password only
router.post('/login', validateLoginBody, async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await loginWithEmail(email, password);
    res.json(result);
  } catch (err) {
    if (err.message === 'INVALID_CREDENTIALS') {
      return res.status(401).json({ error: 'Неверный email или пароль' });
    }
    if (err.message === 'ACCOUNT_BANNED') {
      return res.status(403).json({ error: 'Аккаунт заблокирован администратором' });
    }
    console.error('Login error:', err);
    res.status(500).json({ error: 'Ошибка входа' });
  }
});

module.exports = router;

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const config = require('./src/config');
const authRoutes = require('./src/routes/auth');
const sessionRoutes = require('./src/routes/sessions');
const userRoutes = require('./src/routes/users');
const adminRoutes = require('./src/routes/admin');
const { bootstrapAdmin } = require('./src/services/admin');

const app = express();

// Trust proxy hops when deployed behind a reverse proxy (nginx, etc.).
// Set TRUST_PROXY=1 (or the number of hops) in .env so rate limiters
// see the real client IP instead of the proxy IP (which is shared by ALL users
// and previously caused the whole app to get blocked together).
if (process.env.TRUST_PROXY) {
  const hops = parseInt(process.env.TRUST_PROXY, 10);
  app.set('trust proxy', Number.isFinite(hops) && hops > 0 ? hops : 1);
}

// Security headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'same-origin' },
  contentSecurityPolicy: false, // Disabled because we use inline styles and scripts
}));

// CORS — restrict to known origins in production
const allowedOrigins = [
  'http://localhost:3001',
  'http://localhost:3000',
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? allowedOrigins
    : '*',
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '100kb' }));

/* ============ Rate limiting (fixes false "too many attempts" blocks) ============ */

// Login brute-force protection: counts ONLY failed attempts, keyed per email+IP.
// A successful login never trips the limit, and one account's failed logins
// don't block other accounts on the same IP (NAT / proxy).
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 failed attempts per email+IP per window
  message: { error: 'Слишком много неудачных попыток входа. Попробуйте позже.' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // only count requests that returned an error (401/4xx)
  keyGenerator: (req) => {
    const email = req.body && req.body.email
      ? String(req.body.email).trim().toLowerCase()
      : '';
    return email ? `login:${email}|${req.ip}` : `login:ip:${req.ip}`;
  },
});

// Registration flow (register + verify-email): generous per-IP cap so legit
// users behind a shared IP are not blocked, while mass signups are deterred.
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 60, // 60 registration-related requests per IP per hour
  message: { error: 'Слишком много запросов на регистрацию. Попробуйте позже.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// General API protection (sessions, users, etc.)
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 600,
  message: { error: 'Слишком много запросов. Попробуйте позже.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiters (order matters: specific first, then general).
app.use('/api/auth/login', loginLimiter);
app.use('/api/auth/register', registerLimiter);
app.use('/api/auth/verify-email', registerLimiter);
app.use('/api/auth/resend-code', registerLimiter);
app.use('/api', generalLimiter);

// Serve static files from public/.
// JS/CSS assets get a short browser cache (they are only rebuilt on deploy);
// index.html keeps default revalidation via ETag so the SPA entry is never stale.
const publicDir = path.resolve(__dirname, 'public');
app.use(express.static(publicDir, {
  etag: true,
  setHeaders(res, filePath) {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.js' || ext === '.css') {
      res.setHeader('Cache-Control', 'public, max-age=3600');
    }
  },
}));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);

// Dedicated admin UI; the page performs its own authenticated role check.
app.get('/admin', (req, res) => {
  res.sendFile(path.resolve(publicDir, 'admin.html'));
});

// SPA fallback — serve index.html for all non-API routes
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Неизвестный маршрут' });
  }
  const indexPath = path.resolve(publicDir, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).json({ error: 'Файл index.html не найден' });
  }
});

// Global error handler
app.use((err, req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Внутренняя ошибка сервера' });
});

// ---------------------------------------------------------------------------
// Refuse to start in production with an insecure JWT_SECRET.
//
// Values shipped as placeholders in .env / .env.example are PUBLIC (they live in
// the repo), so anyone could forge login tokens — including the admin session.
// The previous check compared a single literal ('dev-secret-change-me') and was
// therefore bypassed by the value that .env.example actually ships
// ('change-this-to-a-random-secret-in-production').
// ---------------------------------------------------------------------------
const INSECURE_JWT_SECRETS = new Set([
  'dev-secret-change-me',
  'change-this-to-a-random-secret-in-production',
  'change-me',
  'changeme',
  'replace-me',
  'your-secret-key',
  'jwt-secret',
  'secret',
]);
const MIN_JWT_SECRET_LENGTH = 16;

if (process.env.NODE_ENV === 'production') {
  const secret = String(config.jwtSecret || '');
  let reason = null;

  if (INSECURE_JWT_SECRETS.has(secret.trim().toLowerCase())) {
    reason = `is a known placeholder value ("${secret}") that is public in the repository`;
  } else if (secret.length < MIN_JWT_SECRET_LENGTH) {
    reason = `is too short (${secret.length} chars, minimum is ${MIN_JWT_SECRET_LENGTH})`;
  }

  if (reason) {
    console.error(`❌ CRITICAL: JWT_SECRET ${reason}.`);
    console.error('   Refusing to start: tokens (and the admin session) could be forged by anyone.');
    console.error('   Generate a strong one with:');
    console.error('     node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"');
    console.error('   Render: Dashboard → your service → Environment → JWT_SECRET → Manual Deploy.');
    console.error('   Details: ENV_REFERENCE.md (section «Секреты и безопасность»).');
    process.exit(1);
  }
}

// Bootstrap admin account (from ADMIN_EMAIL / ADMIN_USERNAME / ADMIN_PASSWORD)
bootstrapAdmin();

app.listen(config.port, () => {
  console.log(`TopTipTop server running on http://localhost:${config.port}`);
  if (config.devAutoVerify) {
    console.log('⚡ DEV_AUTO_VERIFY enabled — emails are auto-verified');
  }
});

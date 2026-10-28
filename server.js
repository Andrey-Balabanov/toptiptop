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
const groupRoutes = require('./src/routes/groups');
const raceRoutes = require('./src/routes/races');
const { bootstrapAdmin } = require('./src/services/admin');

const app = express();

// Render and other reverse proxies forward the client IP in X-Forwarded-For.
// Trust one proxy by default in production so express-rate-limit can identify
// clients correctly; TRUST_PROXY can override this for a different topology.
const trustProxyValue = process.env.TRUST_PROXY ||
  (process.env.NODE_ENV === 'production' || process.env.RENDER ? '1' : '');
if (trustProxyValue) {
  const hops = parseInt(trustProxyValue, 10);
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
  // Live races poll about once a second and have their own, higher limit below
  skip: req => req.path.startsWith('/races'),
  message: { error: 'Слишком много запросов. Попробуйте позже.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiters (order matters: specific first, then general).
app.use('/api/auth/login', loginLimiter);
app.use('/api/auth/register', registerLimiter);
app.use('/api/auth/verify-email', registerLimiter);
app.use('/api/auth/resend-code', registerLimiter);
const raceLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 4000,
  message: { error: 'Слишком много запросов. Попробуйте позже.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/races', raceLimiter);
app.use('/api', generalLimiter);

// Serve static files from public/.
// JS/CSS assets always revalidate via ETag (cheap 304s) so a deploy never mixes
// new JS with a stale stylesheet; index.html keeps default ETag revalidation too.
const publicDir = path.resolve(__dirname, 'public');
app.get('/index.html', (req, res) => res.redirect(301, '/'));
app.use(express.static(publicDir, {
  etag: true,
  // index.html is served by the SPA route below so the site address can be filled in
  index: false,
  setHeaders(res, filePath) {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.js' || ext === '.css') {
      res.setHeader('Cache-Control', 'no-cache');
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
app.use('/api/groups', groupRoutes);
app.use('/api/races', raceRoutes);

// Dedicated admin UI; the page performs its own authenticated role check.
app.get('/admin', (req, res) => {
  res.sendFile(path.resolve(publicDir, 'admin.html'));
});

/** Public address of the site: PUBLIC_URL if set, else derived from the request (proxy-aware). */
function siteOrigin(req) {
  return (process.env.PUBLIC_URL || `${req.protocol}://${req.get('host')}`).replace(/\/+$/, '');
}

app.get('/robots.txt', (req, res) => {
  res.type('text/plain').send(`User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /admin\n\nSitemap: ${siteOrigin(req)}/sitemap.xml\n`);
});

app.get('/sitemap.xml', (req, res) => {
  res.type('application/xml').send(
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    `  <url><loc>${siteOrigin(req)}/</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>\n` +
    '</urlset>\n'
  );
});

/**
 * Optional privacy-friendly analytics (Plausible, Umami or compatible), off by default:
 * set ANALYTICS_SCRIPT_URL (and ANALYTICS_SITE_ID for Umami / data-domain for Plausible).
 */
function analyticsTag() {
  const src = process.env.ANALYTICS_SCRIPT_URL;
  if (!src || !/^https:\/\//.test(src)) return '';
  const id = process.env.ANALYTICS_SITE_ID;
  const attr = id ? ` data-domain="${id.replace(/"/g, '')}" data-website-id="${id.replace(/"/g, '')}"` : '';
  return `<script defer src="${src.replace(/"/g, '')}"${attr}></script>`;
}

let indexTemplate = null;
function renderIndex(req) {
  if (indexTemplate === null || process.env.NODE_ENV !== 'production') {
    indexTemplate = fs.readFileSync(path.resolve(publicDir, 'index.html'), 'utf8');
  }
  return indexTemplate
    .replace(/__ORIGIN__/g, siteOrigin(req))
    .replace('<!--ANALYTICS-->', analyticsTag());
}

// SPA fallback — serve index.html for all non-API routes
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Неизвестный маршрут' });
  }
  try {
    res.set('Cache-Control', 'no-cache').type('html').send(renderIndex(req));
  } catch {
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

/**
 * Unit tests for src/config.js — the single place where the `.env` file and
 * `process.env` are turned into the application config object.
 *
 * These tests lock down the behaviour documented in ENV_REFERENCE.md:
 *   - `.env` is read from the PROJECT ROOT (not from src/, not from cwd)
 *   - `process.env` has priority over `.env` (dotenv never overwrites)
 *   - every documented default value is really produced by the code
 *   - JWT_SECRET falls back to a throwaway random secret + warning
 *
 * dotenv is mocked so the tests never depend on the developer's local .env —
 * we assert *how* it is called and then feed process.env ourselves.
 */

const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const ENV_FILE = path.join(ROOT, '.env');

jest.mock('dotenv', () => ({ config: jest.fn() }));

const dotenv = require('dotenv');

// Every variable that src/config.js understands. Cleared before each load so
// tests are isolated from the developer's shell and from the repo's .env.
const MANAGED_KEYS = [
  'PORT',
  'JWT_SECRET',
  'JWT_EXPIRES_IN',
  'DB_PATH',
  'BASE_URL',
  'DEV_AUTO_VERIFY',
  'ADMIN_EMAIL',
  'ADMIN_USERNAME',
  'ADMIN_PASSWORD',
  'MAIL_HOST',
  'MAIL_PORT',
  'MAIL_USER',
  'MAIL_PASS',
  'MAIL_FROM',
  'NODE_ENV',
  'TRUST_PROXY',
  'FRONTEND_URL',
];

const ORIGINAL_ENV = { ...process.env };

/** Require a fresh src/config.js seeing ONLY the variables in `env`. */
function loadConfig(env = {}) {
  for (const key of MANAGED_KEYS) delete process.env[key];
  Object.assign(process.env, env);
  let config;
  jest.isolateModules(() => {
    config = require('../config');
  });
  return config;
}

describe('src/config.js', () => {
  let warnSpy;

  beforeEach(() => {
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.clearAllMocks();
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  afterAll(() => {
    for (const key of MANAGED_KEYS) delete process.env[key];
    Object.assign(process.env, ORIGINAL_ENV);
  });

  /* ============ .env file location ============ */

  describe('env file location', () => {
    it('reads .env from the project ROOT (next to server.js / package.json)', () => {
      loadConfig();

      expect(dotenv.config).toHaveBeenCalledTimes(1);
      expect(dotenv.config).toHaveBeenCalledWith({ path: ENV_FILE });
      // It must not be resolved relative to cwd or to src/.
      expect(ENV_FILE).toBe(path.resolve(ROOT, '.env'));
    });
  });

  /* ============ documented defaults ============ */

  describe('defaults when nothing is set (ENV_REFERENCE.md table)', () => {
    it('falls back to port 3001', () => {
      expect(loadConfig().port).toBe(3001);
    });

    it('falls back to JWT_EXPIRES_IN=7d', () => {
      expect(loadConfig().jwtExpiresIn).toBe('7d');
    });

    it('resolves DB_PATH to <root>/data/toptiptop.db (absolute path)', () => {
      const config = loadConfig();
      expect(config.dbPath).toBe(path.join(ROOT, 'data', 'toptiptop.db'));
      expect(path.isAbsolute(config.dbPath)).toBe(true);
    });

    it('falls back to BASE_URL=http://localhost:3001', () => {
      expect(loadConfig().baseUrl).toBe('http://localhost:3001');
    });

    it('defaults DEV_AUTO_VERIFY to false (email verification stays ON)', () => {
      expect(loadConfig().devAutoVerify).toBe(false);
    });

    it('applies the documented mail defaults', () => {
      expect(loadConfig().mail).toEqual({
        host: '',
        port: 587,
        user: '',
        pass: '',
        from: 'noreply@toptiptop.app',
      });
    });

    it('applies the documented admin defaults (username=admin, rest empty)', () => {
      expect(loadConfig().admin).toEqual({
        email: '',
        username: 'admin',
        password: '',
      });
    });
  });

  /* ============ JWT secret ============ */

  describe('JWT_SECRET', () => {
    it('generates a throwaway 64-byte hex secret and warns when it is missing', () => {
      const config = loadConfig();

      expect(config.jwtSecret).toMatch(/^[0-9a-f]{128}$/);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('JWT_SECRET not set')
      );
      // Docs promise: tokens die on restart when no secret is configured.
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('invalidated on restart')
      );
    });

    it('generates a DIFFERENT random secret on every start', () => {
      const first = loadConfig().jwtSecret;
      const second = loadConfig().jwtSecret;

      expect(first).not.toBe(second);
    });

    it('uses the provided JWT_SECRET verbatim and does not warn', () => {
      const config = loadConfig({ JWT_SECRET: 'super-long-random-secret' });

      expect(config.jwtSecret).toBe('super-long-random-secret');
      expect(warnSpy).not.toHaveBeenCalled();
    });
  });

  /* ============ priority: process.env beats .env ============ */

  describe('source priority (process.env > .env > default)', () => {
    it('uses process.env values, ignoring whatever .env would contain', () => {
      // dotenv is mocked, so this simulates "the hosting dashboard wins":
      // the values are already in process.env before dotenv runs.
      const config = loadConfig({
        JWT_SECRET: 'from-dashboard',
        DB_PATH: './data/from-dashboard.db',
        JWT_EXPIRES_IN: '1h',
      });

      expect(config.jwtSecret).toBe('from-dashboard');
      expect(config.jwtExpiresIn).toBe('1h');
      expect(config.dbPath).toBe(path.join(ROOT, 'data', 'from-dashboard.db'));
    });

    it('loads .env only after process.env is already populated (config called once)', () => {
      loadConfig({ JWT_SECRET: 'x' });
      expect(dotenv.config).toHaveBeenCalledTimes(1);
    });
  });

  /* ============ PORT ============ */

  describe('PORT', () => {
    it('parses a numeric string into a number', () => {
      expect(loadConfig({ PORT: '8080' }).port).toBe(8080);
    });

    it('falls back to 3001 for a non-numeric value', () => {
      expect(loadConfig({ PORT: 'abc' }).port).toBe(3001);
    });

    it('falls back to 3001 for an empty string', () => {
      expect(loadConfig({ PORT: '' }).port).toBe(3001);
    });

    it('falls back to 3001 for PORT=0 (port 0 is unusable for a listener)', () => {
      expect(loadConfig({ PORT: '0' }).port).toBe(3001);
    });

    it('truncates a partially numeric value (parseInt semantics)', () => {
      expect(loadConfig({ PORT: '3001abc' }).port).toBe(3001);
    });
  });

  /* ============ DB_PATH / BASE_URL ============ */

  describe('DB_PATH and BASE_URL', () => {
    it('resolves a relative DB_PATH against the project root', () => {
      expect(loadConfig({ DB_PATH: './data/custom.db' }).dbPath)
        .toBe(path.join(ROOT, 'data', 'custom.db'));
    });

    it('keeps an absolute DB_PATH as-is', () => {
      expect(loadConfig({ DB_PATH: '/var/data/app.db' }).dbPath).toBe('/var/data/app.db');
    });

    it('uses BASE_URL when provided', () => {
      expect(loadConfig({ BASE_URL: 'https://toptiptop.onrender.com' }).baseUrl)
        .toBe('https://toptiptop.onrender.com');
    });
  });

  /* ============ DEV_AUTO_VERIFY ============ */

  describe('DEV_AUTO_VERIFY (strict "true" only)', () => {
    it.each(['true'])('enables it for %s', (value) => {
      expect(loadConfig({ DEV_AUTO_VERIFY: value }).devAutoVerify).toBe(true);
    });

    it.each(['false', 'TRUE', 'True', '1', 'yes', 'on', ' true ', ''])(
      'keeps it disabled for %p',
      (value) => {
        expect(loadConfig({ DEV_AUTO_VERIFY: value }).devAutoVerify).toBe(false);
      }
    );
  });

  /* ============ MAIL ============ */

  describe('MAIL_*', () => {
    it('maps all mail variables', () => {
      const config = loadConfig({
        MAIL_HOST: 'smtp.yandex.ru',
        MAIL_PORT: '465',
        MAIL_USER: 'user@yandex.ru',
        MAIL_PASS: 'app-password',
        MAIL_FROM: 'noreply@example.com',
      });

      expect(config.mail).toEqual({
        host: 'smtp.yandex.ru',
        port: 465,
        user: 'user@yandex.ru',
        pass: 'app-password',
        from: 'noreply@example.com',
      });
    });

    it('falls back to port 587 for an invalid MAIL_PORT', () => {
      expect(loadConfig({ MAIL_PORT: 'not-a-port' }).mail.port).toBe(587);
    });

    it('an empty MAIL_HOST means "log verification codes to the console"', () => {
      expect(loadConfig({ MAIL_HOST: '' }).mail.host).toBe('');
    });
  });

  /* ============ ADMIN ============ */

  describe('ADMIN_*', () => {
    it('normalises ADMIN_EMAIL (trim + lowercase) because login is by email', () => {
      expect(loadConfig({ ADMIN_EMAIL: '  Admin@Example.COM  ' }).admin.email)
        .toBe('admin@example.com');
    });

    it('trims ADMIN_USERNAME but keeps its case', () => {
      expect(loadConfig({ ADMIN_USERNAME: '  SuperAdmin  ' }).admin.username)
        .toBe('SuperAdmin');
    });

    it('does NOT trim ADMIN_PASSWORD (spaces may be intentional)', () => {
      expect(loadConfig({ ADMIN_PASSWORD: ' pa ss ' }).admin.password).toBe(' pa ss ');
    });

    it('defaults ADMIN_USERNAME to admin when unset', () => {
      expect(loadConfig({}).admin.username).toBe('admin');
    });

    it('a whitespace-only ADMIN_USERNAME collapses to an empty string', () => {
      // Quirk of `(x || 'admin').trim()`: '   ' survives the falsy check,
      // so the caller (services/admin.js) is the one that re-applies 'admin'.
      expect(loadConfig({ ADMIN_USERNAME: '   ' }).admin.username).toBe('');
    });
  });

  /* ============ shape of the exported config ============ */

  describe('exported shape', () => {
    it('exposes exactly the documented top-level keys', () => {
      const config = loadConfig();

      expect(Object.keys(config).sort()).toEqual([
        'admin',
        'baseUrl',
        'dbPath',
        'devAutoVerify',
        'jwtExpiresIn',
        'jwtSecret',
        'mail',
        'port',
      ]);
    });

    it('does not contain NODE_ENV / TRUST_PROXY / FRONTEND_URL (read by server.js directly)', () => {
      const config = loadConfig({
        NODE_ENV: 'production',
        TRUST_PROXY: '1',
        FRONTEND_URL: 'https://example.com',
      });

      expect(config).not.toHaveProperty('nodeEnv');
      expect(config).not.toHaveProperty('trustProxy');
      expect(config).not.toHaveProperty('frontendUrl');
      // ...and those values are still visible to server.js via process.env
      expect(process.env.NODE_ENV).toBe('production');
      expect(process.env.TRUST_PROXY).toBe('1');
      expect(process.env.FRONTEND_URL).toBe('https://example.com');
    });
  });
});

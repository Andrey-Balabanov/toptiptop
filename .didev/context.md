# Project Knowledge Base: toptiptop

## Overview

`toptiptop` is a blind-typing trainer ("Тренажёр слепой печати") shipped as a single Node.js/Express application that serves both the JSON API and the browser SPA from the same `public/` directory. Registered users practise typing, and each completed session (WPM, accuracy, errors, XP, streak, duration) is persisted to SQLite and rolled up into lifetime stats that feed public leaderboards. The app includes first-class account management (email + password login with 6-digit email verification, JWT sessions delivered as HttpOnly cookies or Bearer tokens) and a role-based admin panel at `/admin` for moderating users (promote/demote, ban, delete, reset password). It is deployed as a backend service (with explicit support for Render / reverse proxies via `trust proxy`).

## Architecture

The codebase follows a classic **layered Express architecture** with strict separation between transport (routes), request validation/middleware, business logic (services), and persistence (a small data-access layer over `better-sqlite3`).

```
server.js                   ← composition root: security, CORS, rate limits, static, route mounting, SPA fallback
├── src/config.js           ← .env + process.env → typed config object (single source of truth)
├── src/db.js               ← lazy singleton SQLite connection + idempotent migrate()
├── src/middleware/
│     auth.js               ← JWT verification → fresh DB user row → req.user (ban/role aware)
│     authCookies.js        ← set/clear/read auth cookies; Bearer token precedence
│     validate.js           ← body validators returning Russian 400 messages
├── src/routes/             ← thin HTTP handlers (no business logic, no SQL)
│     auth.js  sessions.js  users.js  admin.js
└── src/services/           ← all business logic + SQL
      auth.js               ← registration, verification, login, profile/stats updates
      sessions.js           ← session CRUD, dedupe via INSERT OR IGNORE, leaderboard
      admin.js              ← admin bootstrap, user listing/moderation
      mail.js               ← pooled nodemailer transporter + SMTP error mapping
      email.js              ← DEPRECATED (token-link flow, unused)
```

**Request/data flow (typical authenticated write):**

1. `server.js` applies helmet → CORS → `express.json({ limit: '100kb' })` → the matching rate limiter.
2. Route handler in `src/routes/*.js` runs one or more validators from `src/middleware/validate.js`, then `authMiddleware`.
3. `authMiddleware` verifies the JWT via `jsonwebtoken`, then **re-reads the user row from SQLite on every request** (`SELECT id, username, role, is_banned, language, profile FROM users WHERE id = ?`) so bans and role changes take effect immediately without waiting for token expiry. Banned users get `403`, invalid/missing tokens get `401` plus `clearAuthCookies(res)`.
4. The service layer (`src/services/*.js`) executes `better-sqlite3` prepared statements and returns **camelCase DTOs** mapped from snake_case DB columns.
5. Handlers catch thrown errors by **error-code strings** (`err.message === 'USERNAME_TAKEN'`) and map them to HTTP status + Russian message; anything unrecognised becomes `console.error(...)` + `500`.

**Conventions that define the architecture:**

- **Service functions throw string-coded `Error`s, not HTTP errors.** Routes translate them (`INVALID_CREDENTIALS` → 401, `EMAIL_TAKEN` → 409, `ACCOUNT_BANNED` → 403, `INVALID_OR_EXPIRED_CODE` → 400, etc.).
- **Services are the only place that touch `getDb()`** (with the single exception of `authMiddleware`, which deliberately reads the user row directly to stay stateless).
- **Routes never re-implement validation** — `VALID_LANGUAGES` and `VALID_PROFILES` exist in both `src/middleware/validate.js` and inline in `src/routes/users.js` (a known duplication: routes validate their own accepted values, `validateProfileUpdate` is currently unused by the routes).
- **CommonJS (`require`) everywhere** — no ESM, no TypeScript.

## Key Modules

| File | Purpose |
|---|---|
| `server.js` | App composition: helmet, CORS allow-list, 3 rate limiters, static assets with per-extension cache headers, `/api/health`, route mounting, `/admin` page, SPA fallback, global error handler, insecure-`JWT_SECRET` production guard. |
| `src/config.js` | Loads `.env` from the project root via `dotenv.config({ path: … })`, exposes `port`, `jwtSecret`, `jwtExpiresIn`, `dbPath`, `baseUrl`, `devAutoVerify`, `mail{}`, `admin{}`. Generates a throwaway 64-byte hex JWT secret + warning if `JWT_SECRET` is unset. |
| `src/db.js` | Lazy `getDb()` singleton. Creates the parent directory of the DB file, enables WAL + `foreign_keys = ON`, runs `migrate()`. |
| `src/middleware/auth.js` | `authMiddleware` (JWT → fresh user row → `req.user`, rejects banned/missing users) and `adminMiddleware` (requires `req.user.role === 'admin'`). |
| `src/middleware/authCookies.js` | `setAuthCookies` / `clearAuthCookies` / `getAuthToken`. Writes `toptip_session` (HttpOnly) + `toptip_authenticated=1` (readable by the SPA). Bearer header takes priority over the cookie. |
| `src/middleware/validate.js` | `validateSessionBody`, `validateAuthBody`, `validateLoginBody`, `validateProfileUpdate`; exports `VALID_LANGUAGES` (9 locales) and `VALID_PROFILES` (8 profiles). `MAX_PASSWORD_LENGTH = 128`. |
| `src/routes/auth.js` | `POST /register`, `/resend-code` (own 1-per-60s per-email limiter), `/verify-email`, `/login`, `/logout`. Sets auth cookies on register/verify/login. |
| `src/routes/sessions.js` | `POST /` (completed session → also calls `updateUserStats`), `POST /draft`, `GET /` (filter by `mode`, `from`, `to`), `GET /:id`. |
| `src/routes/users.js` | `GET /me`, `PATCH /me/language`, `/me/profile`, `/me/keyboard`, public `GET /leaderboard`, public `GET /:id` (strips `email`, `emailVerified`, `role`, `isBanned`). |
| `src/routes/admin.js` | Entire router guarded by `authMiddleware, adminMiddleware`. List/get/patch/delete users, reset password; blocks self-ban and self-delete. |
| `src/services/auth.js` | Core auth: `registerUser`, `resendCode`, `verifyEmail`, `loginWithEmail`, `getUserById`, `updateUserLanguage/Profile/KeyboardLayout`, `updateUserStats`, plus `normalizeEmail`, `generateCode`, `storeVerificationCode`, `formatUser`. |
| `src/services/sessions.js` | `createSession` (dedupe via `INSERT OR IGNORE` on `client_session_id`), `listSessions`, `getSessionById`, `getLeaderboard(type, limit)`. |
| `src/services/admin.js` | `bootstrapAdmin()` (runs at startup, never throws), `ensureExistingAdmin`, `createAdmin`, `resolveAdminUsername`, `formatAdminUser`, `listUsers`, `getUser`, `setRole`, `setBan`, `deleteUser`, `resetPassword`. |
| `src/services/mail.js` | Pooled singleton nodemailer transporter, `sendEmail`, `sendVerificationCode(email, code, purpose)`, `mapSmtpError` (maps SMTP failures to Russian user-facing strings). Dev fallback logs to console when `MAIL_HOST` is empty. |
| `src/services/email.js` | **Deprecated** token-link flow over an `email_verifications` table that no longer exists. Reference only. |
| `src/__tests__/` | `auth.cookies.test.js` (supertest cookie behaviour), `auth.service.test.js` (service unit tests with mocked DB/config/mail), `config.test.js` (locks documented defaults, `.env` path, env priority, JWT secret fallback). |

### Database schema (created by `migrate()` in `src/db.js`)

- **`users`** — `id`, `username` (UNIQUE), `email` (UNIQUE), `password` (bcrypt), `email_verified`, `language`, `profile`, `created_at`, `total_xp`, `best_wpm`, `best_streak`, `session_count`, `role`, `is_banned`, `banned_at`. (`keyboard_layout` is added via `ALTER TABLE` only, not in the `CREATE TABLE`.)
- **`email_verification_codes`** — `email`, `code`, `purpose` (`register` | `login`), `expires_at`, `used`, `created_at`; pruned on every startup (`DELETE … WHERE expires_at < datetime('now') OR used = 1`).
- **`sessions`** — `user_id` FK, `client_session_id` (**globally UNIQUE**, not per-user), `mode`, `wpm`, `accuracy`, `total_errors`, `xp_earned`, `duration_ms`, `text_length`, `streak_max`, `is_draft`, `created_at`.
- Indexes: `idx_evc_email`, `idx_evc_code`, `idx_sessions_user_id`, `idx_sessions_created`, `idx_users_best_wpm`, `idx_sessions_user_created` (composite for the history pagination query), `idx_users_total_xp` (leaderboard sort).
- Safe migrations: for each of `email`, `email_verified`, `language`, `profile`, `keyboard_layout`, `role`, `is_banned`, `banned_at` the code checks `PRAGMA table_info('users')` and issues `ALTER TABLE … ADD COLUMN` only when missing.

## Tech Stack

| Layer | Choice | Why / notes |
|---|---|---|
| Runtime | Node.js, CommonJS | `"main": "server.js"`, `require()` throughout. |
| Web framework | `express@^4.21.2` | `Router()` per resource file, `app.set('trust proxy', …)`. |
| Database | `better-sqlite3@^13.0.3` | Synchronous prepared statements — no async/await in the data layer, no ORM. WAL journal mode. |
| Auth | `jsonwebtoken@^9.0.2` + `bcryptjs@^2.4.3` | JWT payload `{ userId, username, role }`, `expiresIn` from `JWT_EXPIRES_IN` (default `7d`). Passwords hashed with `SALT_ROUNDS = 10`. |
| Session transport | `res.cookie` (Express built-in) | HttpOnly `toptip_session` + non-HttpOnly `toptip_authenticated` indicator; `sameSite: 'lax'`, `secure` in production or on Render. Bearer token still supported for API clients. |
| Security middleware | `helmet@^8`, `express-rate-limit@^7.5`, `cors@^2.8.5` | helmet with `contentSecurityPolicy: false` (inline styles/scripts) and `crossOriginResourcePolicy: 'same-origin'`. |
| Email | `nodemailer@^9.0.3` | Pooled transporter (`pool: true`, `maxConnections: 3`, `maxMessages: 100`, 10s/10s/15s timeouts). |
| Config | `dotenv@^16.4.7` | Loads `<root>/.env`; `process.env` always wins because dotenv never overwrites. |
| IDs | `uuid@^11.1.0` | Available for client session IDs (dedupe key). |
| Testing | `jest@^30`, `supertest@^7`, `@babel/core` + `@babel/preset-env` | Babel is present to transform sources for Jest; `npm test` runs `jest --forceExit --detectOpenHandles`. |

## Coding Conventions

**Naming**
- Files: lowercase, one concern per file (`authCookies.js`, `validate.js`, `sessions.js`). Services and routes share the same base name (`routes/auth.js` ↔ `services/auth.js`).
- Functions: camelCase verbs (`registerUser`, `createSession`, `getLeaderboard`, `bootstrapAdmin`, `resolveAdminUsername`).
- DB columns: snake_case (`email_verified`, `client_session_id`, `total_xp`); API JSON: camelCase (`emailVerified`, `clientSessionId`, `totalXp`). Services perform the mapping explicitly — never `SELECT *` in `src/services/sessions.js` (it uses a shared `SESSION_COLUMNS` list).
- Constants: UPPER_SNAKE (`SALT_ROUNDS`, `MAX_PASSWORD_LENGTH`, `INSECURE_JWT_SECRETS`, `MIN_JWT_SECRET_LENGTH`, `VALID_ROLES`, `VALID_KEYBOARD_LAYOUTS`, `AUTH_COOKIE`).
- Cookies: prefixed `toptip_` (`toptip_session`, `toptip_authenticated`).

**Error handling**
- Services throw `new Error('SOME_CODE')`; routes switch on `err.message` and return the matching HTTP status and a **Russian** user-facing message. Unknown errors are `console.error(...)`-logged and answered with `500` + a generic Russian message.
- Recognised codes in use: `USERNAME_TAKEN`, `EMAIL_TAKEN`, `USER_NOT_FOUND`, `ALREADY_VERIFIED`, `ACCOUNT_BANNED`, `INVALID_OR_EXPIRED_CODE`, `INVALID_CREDENTIALS`, `MAIL_SMTP_ERROR`.
- `bootstrapAdmin()` and `sendEmail()` are the two places designed **never to throw into the request path**: the admin bootstrap catches and warns, and the mail service logs a `[MAIL FALLBACK]` copy of the code before throwing a mapped error.
- Every route handler is wrapped in `try/catch` — there is no async error-wrapper middleware for route bodies (only the terminal 4-arg handler in `server.js`).

**Comments & documentation**
- Comments explain *why*, not *what* — e.g. why the `data/` directory must be `mkdirSync`'d, why `loginLimiter` uses `skipSuccessfulRequests`, why the JWT-secret check compares a *set* of placeholders rather than one literal.
- JSDoc blocks are used on the public functions of `src/services/admin.js` and `src/services/mail.js`, including `@returns` and `@deprecated` markers.
- Startup log lines use emoji (`✅ Admin account created/ensured`, `⚠️  …`) and the warning body is multi-line and actionable.

**Validation & limits**
- `express.json({ limit: '100kb' })`; pagination is clamped in the route (`Math.min(parseInt(req.query.limit, 10) || 50, 200)` for admin/users, `… || 20, 100` for the leaderboard).
- `validateSessionBody` enforces `wpm ∈ [0, 500]`, `accuracy ∈ [0, 100]`, `textLength >= 1`, `durationMs >= 0`, plus required `mode` and `clientSessionId`.
- Password length is `6–128` in both registration and admin password reset.

## Development

```bash
# Install
npm install

# Run (production-style)
npm start                 # node server.js

# Run with auto-restart
npm run dev               # node --watch server.js

# Tests
npm test                  # jest --forceExit --detectOpenHandles
npm run test:watch        # jest --watch --forceExit
```

**Environment (`.env` in the project root — `src/config.js` resolves it explicitly against `__dirname/..`):**

| Variable | Default | Notes |
|---|---|---|
| `PORT` | `3001` | Parsed with `parseInt`. |
| `JWT_SECRET` | random 128-hex-char string | Random fallback warns and invalidates every token on restart. In production, placeholder values and secrets shorter than 16 chars are rejected at startup. |
| `JWT_EXPIRES_IN` | `7d` | Passed straight to `jwt.sign`. |
| `DB_PATH` | `./data/toptiptop.db` | Resolved to an absolute path under the project root. |
| `BASE_URL` | `http://localhost:3001` | Used by the deprecated email flow. |
| `DEV_AUTO_VERIFY` | `false` | When `'true'`, registration skips email verification and returns a JWT immediately. |
| `MAIL_HOST` / `MAIL_PORT` / `MAIL_USER` / `MAIL_PASS` / `MAIL_FROM` | `''` / `587` / `''` / `''` / `noreply@toptiptop.app` | Empty `MAIL_HOST` ⇒ dev mode: codes are console-logged, and `registerUser`/`resendCode` return the code plus `mailError: 'MAIL_DEV_FALLBACK'`. |
| `ADMIN_EMAIL` / `ADMIN_USERNAME` / `ADMIN_PASSWORD` | `''` / `'admin'` / `''` | Both email and password are required for the bootstrap to run. |
| `NODE_ENV` | — | `production` enables the CORS allow-list, the secure-cookie flag, the trust-proxy default, and the insecure-secret guard. |
| `TRUST_PROXY` | `'1'` in production/Render, otherwise unset | Parsed as an integer hop count; non-numeric values fall back to `1`. |
| `FRONTEND_URL` | — | Appended to the allowed-origins list (together with `http://localhost:3000` and `:3001`). |
| `RENDER` | — | Presence alone implies production-like behaviour (secure cookies, trust proxy). |

**Startup sequence** (`server.js`): configure trust proxy → helmet → CORS → JSON → rate limiters → static → `/api/health` → API routers → `/admin` → SPA fallback → error handler → validate `JWT_SECRET` (fatal in production) → `bootstrapAdmin()` → `app.listen(config.port)`.

**Test approach:** `src/__tests__/auth.service.test.js` mocks `../db`, `../config` and `../services/mail` to unit-test services in isolation; `src/__tests__/auth.cookies.test.js` mocks `express-rate-limit` *and* `../middleware/validate` so supertest can exercise real routes without the limiter or validation in the way; `src/__tests__/config.test.js` mocks `dotenv` and uses `jest.isolateModules` to re-require `src/config.js` under controlled `process.env`. New tests should follow that mocking pattern, especially the `jest.mock('express-rate-limit', () => () => (req, res, next) => next())` trick.

## Important Notes

1. **`better-sqlite3` does not create parent directories.** `getDb()` calls `fs.mkdirSync(path.dirname(config.dbPath), { recursive: true })` before `new Database(...)`. Without this, a fresh clone (where `data/` is git-ignored) fails on every DB-touching route. Do not remove it.
2. **The JWT secret guard is a set-membership check, not an equality check.** `INSECURE_JWT_SECRETS` lists `dev-secret-change-me`, `change-this-to-a-random-secret-in-production`, `change-me`, `changeme`, `replace-me`, `your-secret-key`, `jwt-secret`, `secret`; secrets shorter than `MIN_JWT_SECRET_LENGTH = 16` are also rejected in production. The comparison is case-insensitive/length-aware by design — do not "simplify" it back to a single literal.
3. **Rate-limit ordering matters in `server.js`.** Specific limiters (`/api/auth/login`, `/api/auth/register`, `/api/auth/verify-email`, `/api/auth/resend-code`) must be registered *before* `app.use('/api', generalLimiter)`. `loginLimiter` counts **only failed requests** (`skipSuccessfulRequests: true`) and keys on `email|ip`, so successful logins never burn the quota and one account cannot lock out others behind the same NAT. `routes/auth.js` adds a second, stricter limiter on `/resend-code` (1 per 60 s per email).
4. **Auth is DB-backed on every request.** `authMiddleware` re-reads the user row so a ban or role change applies immediately, at the cost of one PK lookup per request. Banned users receive `403` and their cookies are cleared; missing/invalid tokens receive `401` with cleared cookies. Any change to `req.user` shape must be reflected here.
5. **Bearer wins over cookie.** `getAuthToken` checks `Authorization: Bearer …` first and only then scans the `Cookie` header for `toptip_session`, decoding with `decodeURIComponent` inside a `try/catch` (returns `null` on malformed encoding). The SPA uses the non-HttpOnly `toptip_authenticated` cookie purely as a client-side hint.
6. **`sessions.client_session_id` is globally UNIQUE, not unique per user.** `createSession` relies on `INSERT OR IGNORE`; when `result.changes === 0` it returns `{ duplicate: true }` with the existing row's id, and the route answers `200` instead of `201`. `updateUserStats` is deliberately **skipped** for duplicates *and* for drafts. A UUID collision across users would therefore be silently deduplicated — use `uuid` for these IDs.
7. **Route ordering in `src/routes/users.js` is load-bearing.** `GET /leaderboard` must be declared before `GET /:id`, otherwise `"leaderboard"` is parsed as an id. `GET /:id` strips `email`, `emailVerified`, `role` and `isBanned` before responding.
8. **Admin bootstrap is self-healing and idempotent.** `bootstrapAdmin()` runs once before `listen()`, requires `ADMIN_EMAIL` + `ADMIN_PASSWORD`, and additionally rejects an `ADMIN_EMAIL` without `@`. If the email exists it promotes to `admin`, unbans, verifies, renames (only if the desired username is free) and rotates the password when `ADMIN_PASSWORD` no longer matches the stored hash — so password rotation via `.env` works on restart. `resolveAdminUsername` falls back to `admin2`, `admin3`… up to 100, then `<base>-<base36 timestamp>`, so a username collision can never crash startup. **It never throws** — always check the startup logs.
9. **Email case normalization is mandatory.** `normalizeEmail()` lowercases and trims; registration also checks duplicates with `COLLATE NOCASE`, and `bootstrapAdmin` stores the admin email lowercased. Skipping this in any new code path silently breaks mixed-case logins and admin access.
10. **Two email flows exist; only one is live.** `src/services/mail.js` (`sendVerificationCode`, 6-digit codes in `email_verification_codes`) is the active path. `src/services/email.js` is explicitly `@deprecated` and references a nonexistent `email_verifications` table — its dev auto-verify branch would throw if executed.
11. **Dev fallback leaks the verification code by design.** With no `MAIL_HOST`, `registerUser`/`resendCode` include `code`, `mailError: 'MAIL_DEV_FALLBACK'` and a human-readable `message` in the 201/200 response. Never configure a production deployment without `MAIL_HOST`.
12. **The database layer is synchronous.** `better-sqlite3` calls are blocking; keep queries indexed (the composite `idx_sessions_user_created` exists specifically for the `WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?` history query) and avoid adding N+1 loops inside request handlers.
13. **Bans and roles propagate through one field.** `req.user.role`/`isBanned` come from the DB, while the JWT payload only carries `{ userId, username, role }`. Never authorise on the token payload alone.
14. **Static caching is extension-specific.** `.js` is served with `Cache-Control: no-cache`, `.css` with `public, max-age=3600`, and `index.html`/other files rely on Express's default ETag revalidation so the SPA entry point is never stale.
15. **`/api/*` never falls through to the SPA.** The `app.get('*')` handler returns `{ error: 'Неизвестный маршрут' }` with `404` for any unmatched `/api/` path, and serves `public/index.html` (or a `404` JSON if the file is missing) otherwise.
16. **`helmet`'s CSP is intentionally disabled** because the served pages use inline styles and scripts; `crossOriginResourcePolicy` is set to `same-origin`. Re-enabling CSP requires auditing the static frontend first.
17. **All user-facing strings are Russian** and returned as `{ error: '…' }` for failures or bare objects for success (`{ ok: true }`, `{ language }`, `{ id }`, `{ users, count }`). Keep new messages consistent with the existing tone and language.
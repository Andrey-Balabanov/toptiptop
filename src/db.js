const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const config = require('./config');

let db;

function getDb() {
  if (!db) {
    // better-sqlite3 does NOT create missing parent directories. `data/` is
    // git-ignored, so on a fresh clone (Render, new machine) the directory does
    // not exist and `new Database()` fails with
    // "Cannot open database because the directory does not exist" — every route
    // that touches the DB would then answer 500. Create it explicitly.
    fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });
    db = new Database(config.dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    migrate();
  }
  return db;
}

function migrate() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      username        TEXT UNIQUE NOT NULL,
      email           TEXT UNIQUE,
      password        TEXT NOT NULL,
      email_verified  INTEGER DEFAULT 0,
      language        TEXT DEFAULT 'ru',
      profile         TEXT DEFAULT 'general',
      created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
      total_xp        INTEGER DEFAULT 0,
      best_wpm        REAL DEFAULT 0,
      best_streak     INTEGER DEFAULT 0,
      session_count   INTEGER DEFAULT 0,
      role            TEXT DEFAULT 'user',
      is_banned       INTEGER DEFAULT 0,
      banned_at       DATETIME
    );

    CREATE TABLE IF NOT EXISTS email_verification_codes (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      email     TEXT NOT NULL,
      code      TEXT NOT NULL,
      purpose   TEXT NOT NULL DEFAULT 'register',  -- 'register' | 'login'
      expires_at DATETIME NOT NULL,
      used      INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_evc_email ON email_verification_codes(email);
    CREATE INDEX IF NOT EXISTS idx_evc_code ON email_verification_codes(code);

    CREATE TABLE IF NOT EXISTS sessions (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id           INTEGER NOT NULL REFERENCES users(id),
      client_session_id TEXT NOT NULL,
      mode              TEXT NOT NULL,
      wpm               REAL NOT NULL,
      accuracy          REAL NOT NULL,
      total_errors      INTEGER NOT NULL,
      xp_earned         INTEGER NOT NULL,
      duration_ms       INTEGER NOT NULL,
      text_length       INTEGER NOT NULL,
      streak_max        INTEGER NOT NULL,
      is_draft          INTEGER DEFAULT 0,
      created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(client_session_id)
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_created ON sessions(created_at);
    CREATE INDEX IF NOT EXISTS idx_users_best_wpm ON users(best_wpm DESC);

    -- Composite index for the hot per-user history query:
    -- WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?
    -- Lets SQLite walk the index directly instead of sorting the full user's rows.
    CREATE INDEX IF NOT EXISTS idx_sessions_user_created ON sessions(user_id, created_at);

    -- Cover the leaderboard sorted by total_xp (previously a full sort).
    CREATE INDEX IF NOT EXISTS idx_users_total_xp ON users(total_xp DESC);
  `);

  // Add new columns if they don't exist (safe migration)
  const tableInfo = db.prepare("PRAGMA table_info('users')").all();
  const columns = tableInfo.map(c => c.name);
  if (!columns.includes('email')) {
    db.exec("ALTER TABLE users ADD COLUMN email TEXT UNIQUE");
  }
  if (!columns.includes('email_verified')) {
    db.exec("ALTER TABLE users ADD COLUMN email_verified INTEGER DEFAULT 0");
  }
  if (!columns.includes('language')) {
    db.exec("ALTER TABLE users ADD COLUMN language TEXT DEFAULT 'ru'");
  }
  if (!columns.includes('profile')) {
    db.exec("ALTER TABLE users ADD COLUMN profile TEXT DEFAULT 'general'");
  }
  if (!columns.includes('keyboard_layout')) {
    db.exec("ALTER TABLE users ADD COLUMN keyboard_layout TEXT DEFAULT 'pc-ansi'");
  }
  // Admin / moderation columns
  if (!columns.includes('role')) {
    db.exec("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user'");
  }
  if (!columns.includes('is_banned')) {
    db.exec("ALTER TABLE users ADD COLUMN is_banned INTEGER DEFAULT 0");
  }
  if (!columns.includes('banned_at')) {
    db.exec("ALTER TABLE users ADD COLUMN banned_at DATETIME");
  }

  // Opportunistic cleanup: expired or already-used verification codes are dead
  // weight. Prune them on startup so the table never grows without bound
  // (which would otherwise slow down every email/code lookup over time).
  db.prepare("DELETE FROM email_verification_codes WHERE expires_at < datetime('now') OR used = 1").run();
}

module.exports = { getDb };

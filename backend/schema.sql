-- NEXUS AI schema

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  salt          TEXT NOT NULL,
  created_at    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS conversations (
  id         TEXT NOT NULL,
  user_id    TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  data       TEXT NOT NULL,
  PRIMARY KEY (id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_conv_user ON conversations(user_id, updated_at DESC);

-- Deleted conversations stay tombstoned so a stale tab or another device
-- cannot push the same chat back into the account after it was removed.
CREATE TABLE IF NOT EXISTS deleted_conversations (
  user_id        TEXT NOT NULL,
  conversation_id TEXT NOT NULL,
  deleted_at     INTEGER NOT NULL,
  PRIMARY KEY (user_id, conversation_id)
);

CREATE TABLE IF NOT EXISTS files (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  name       TEXT,
  mime       TEXT,
  size       INTEGER NOT NULL,
  data       BLOB NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_files_user ON files(user_id);

-- Estimated Cloudflare Workers AI consumption, keyed by UTC day.
CREATE TABLE IF NOT EXISTS usage (
  day        TEXT PRIMARY KEY,
  replies    INTEGER NOT NULL DEFAULT 0,
  images     INTEGER NOT NULL DEFAULT 0,
  neurons    REAL NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);

-- Owner moderation (FL3SH Console)
CREATE TABLE IF NOT EXISTS moderation (
  id            TEXT PRIMARY KEY,
  target_user_id TEXT,
  target_email  TEXT,
  ip_hash       TEXT,
  ip_display    TEXT,
  type          TEXT NOT NULL,
  reason        TEXT NOT NULL,
  status        TEXT NOT NULL,
  created_by    TEXT NOT NULL,
  expires_at    INTEGER,
  created_at    INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_mod_user ON moderation(target_user_id);
CREATE INDEX IF NOT EXISTS idx_mod_ip ON moderation(ip_hash);
CREATE INDEX IF NOT EXISTS idx_mod_status ON moderation(status);

CREATE TABLE IF NOT EXISTS owner_alerts (
  id            TEXT PRIMARY KEY,
  moderation_id TEXT,
  title         TEXT NOT NULL,
  detail        TEXT NOT NULL,
  status        TEXT NOT NULL,
  severity      TEXT NOT NULL DEFAULT 'extreme',
  created_at    INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_alerts_status ON owner_alerts(status);

-- Explicit user memory. NEXUS only sees facts the user chose to save.
CREATE TABLE IF NOT EXISTS memories (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  label      TEXT NOT NULL,
  value      TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (user_id, label)
);
CREATE INDEX IF NOT EXISTS idx_memories_user ON memories(user_id, updated_at DESC);

-- Signed-in progression so levels, badges, streaks, and stickers follow the
-- account across devices. Guests keep the same data in localStorage only.
CREATE TABLE IF NOT EXISTS progress (
  user_id    TEXT PRIMARY KEY,
  data       TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

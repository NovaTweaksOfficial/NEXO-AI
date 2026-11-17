-- Account-scoped NEXUS progression.
CREATE TABLE IF NOT EXISTS progress (
  user_id    TEXT PRIMARY KEY,
  data       TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

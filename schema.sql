CREATE TABLE IF NOT EXISTS votes (
  voter_id TEXT PRIMARY KEY,
  side TEXT NOT NULL CHECK (side IN ('left', 'right')),
  created_at INTEGER NOT NULL,
  country TEXT
);

CREATE INDEX IF NOT EXISTS idx_votes_created ON votes(created_at);

CREATE TABLE IF NOT EXISTS rate (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  window_start INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT OR IGNORE INTO meta (key, value) VALUES ('freeze', '0');
INSERT OR IGNORE INTO meta (key, value) VALUES ('started_at', '0');

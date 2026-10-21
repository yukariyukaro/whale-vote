CREATE TABLE IF NOT EXISTS votes (
  voter_id TEXT PRIMARY KEY,
  side TEXT NOT NULL CHECK (side IN ('left', 'right')),
  created_at INTEGER NOT NULL,
  country TEXT,
  network_key TEXT
);

CREATE INDEX IF NOT EXISTS idx_votes_created ON votes(created_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_votes_network_key ON votes(network_key) WHERE network_key IS NOT NULL;

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

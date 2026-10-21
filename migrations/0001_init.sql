-- 0001_init.sql — whale-vote baseline schema.
--
-- This is the ORIGINAL schema, before network-level deduplication existed.
-- Every statement is idempotent so this migration can be applied safely to:
--   * an existing database whose tables were created with `d1 execute`
--     before migration tracking existed (all statements are no-ops), and
--   * a brand-new database (creates the baseline before 0002 runs).
--
-- Do not add network_key here. 0002_network_dedup.sql owns that change.

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

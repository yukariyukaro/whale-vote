-- Preserve all existing votes; legacy rows have no recoverable network identifier.
ALTER TABLE votes ADD COLUMN network_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_votes_network_key ON votes(network_key) WHERE network_key IS NOT NULL;

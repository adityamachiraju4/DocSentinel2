-- DocSentinel v2 — document integrity SHA-256
-- Security roadmap item 5
ALTER TABLE documents ADD COLUMN IF NOT EXISTS sha256 VARCHAR;

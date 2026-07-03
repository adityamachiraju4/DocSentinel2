-- add_versioning.sql
-- Sprint C Phase 1: Version History — immutable document groups.
--
-- PostgreSQL only (deploy batch). Local SQLite gets these via
-- Base.metadata.create_all (new table) + a manual ALTER for the 3
-- documents columns on pre-existing dev DBs.
--
-- Model:
--   document_groups = the logical document (the stable identity).
--   documents.group_id NULL = standalone (common case); set only when
--     the doc is explicitly promoted into a version group.
--   current_version = monotonic allocator on the group; promote does
--     current_version += 1 under a row lock (no MAX() aggregate, race-safe).
--   is_latest maintained in the service layer, NOT a trigger (dialect parity).

CREATE TABLE IF NOT EXISTS document_groups (
    id              SERIAL PRIMARY KEY,
    owner_id        INTEGER NOT NULL REFERENCES users(id),
    display_name    TEXT,
    current_version INTEGER NOT NULL DEFAULT 1,
    created_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE documents ADD COLUMN IF NOT EXISTS group_id       INTEGER REFERENCES document_groups(id);
ALTER TABLE documents ADD COLUMN IF NOT EXISTS version_number INTEGER;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS is_latest      BOOLEAN;

-- Fast "latest / standalone" filtering for list + search (added in later commits).
CREATE INDEX IF NOT EXISTS documents_group_latest ON documents (group_id, is_latest);

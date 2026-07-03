-- add_version_events.sql
-- Sprint C Phase 2: Version History event log — immutable audit records.
--
-- PostgreSQL only (deploy batch, DPDP-gated). Local SQLite gets this via
-- Base.metadata.create_all (new table). One row is written per promotion,
-- inside the same transaction as the promote, by versioning_service.
--
-- Model:
--   Each promote emits exactly one VERSION_CREATED event capturing the
--   from -> to document transition, the group, the actor, and the
--   (previously accepted-not-persisted) reason string.
--   event_type is present from day one so this table can host future
--   events (VERSION_RESTORED, VERSION_RENAMED, VERSION_MERGED) without a
--   migration. Rows are immutable historical records: if document deletion
--   is ever supported, prefer soft-delete so history stays intact.

CREATE TABLE IF NOT EXISTS document_version_events (
    id                 SERIAL PRIMARY KEY,
    event_type         TEXT NOT NULL,
    group_id           INTEGER NOT NULL REFERENCES document_groups(id),
    from_document_id   INTEGER REFERENCES documents(id),
    to_document_id     INTEGER NOT NULL REFERENCES documents(id),
    reason             TEXT,
    created_by         INTEGER NOT NULL REFERENCES users(id),
    created_at         TIMESTAMPTZ DEFAULT now()
);

-- Timeline lookups: all events for a group, chronological.
CREATE INDEX IF NOT EXISTS document_version_events_group ON document_version_events (group_id, created_at);

-- DocSentinel v2 — audit_events (batched deploy)
CREATE TABLE IF NOT EXISTS audit_events (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users(id),
    document_id INTEGER REFERENCES documents(id) ON DELETE SET NULL,
    event_type  VARCHAR NOT NULL,
    ip_hash     VARCHAR,
    device      VARCHAR,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_audit_events_user_id ON audit_events(user_id);
CREATE INDEX IF NOT EXISTS ix_audit_events_document_id ON audit_events(document_id);
CREATE INDEX IF NOT EXISTS ix_audit_doc_created ON audit_events(document_id, created_at);

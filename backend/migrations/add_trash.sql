-- Sprint D — Trash / Recovery
-- Soft-delete: NULL = live, timestamp = trashed. Purge destroys row + R2 object.
-- DPDP-gated: NOT run on Railway until compliance review. Low exposure —
-- operates only on the owner's own documents; no new processing of others' data.
ALTER TABLE documents ADD COLUMN deleted_at TIMESTAMP NULL;

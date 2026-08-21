-- add_folders.sql
-- Phase 4a: Household Drive foundation — user-owned organizational folders.
--
-- PostgreSQL only (deploy batch). Local SQLite gets these via
-- Base.metadata.create_all (new table) + a manual ALTER for the
-- documents.folder_id column on pre-existing dev DBs.
--
-- Model:
--   folders = the user's OWN organization axis ("my Taxes folder"),
--     distinct from the global `collections` type taxonomy. Orthogonal.
--   parent_folder_id is a nullable self-FK so nesting can be added later
--     WITHOUT a migration; v1 enforces flat in the service layer.
--   vault_type is NOT here yet — it arrives in Phase 4b. 4a is folders
--     only (no crypto), so ownership isolation is proven on a plain
--     container before encryption is layered on.
--   documents.folder_id NULL = unfiled (common case). Folder delete
--     unfiles docs (folder_id -> NULL); it never trashes/destroys content.
--
-- DPDP: Category B (no personal-data sharing surface in v1).
CREATE TABLE IF NOT EXISTS folders (
    id               SERIAL PRIMARY KEY,
    user_id          INTEGER NOT NULL REFERENCES users(id),
    name             TEXT NOT NULL,
    parent_folder_id INTEGER REFERENCES folders(id),
    created_at       TIMESTAMPTZ DEFAULT now(),
    updated_at       TIMESTAMPTZ
);
ALTER TABLE documents ADD COLUMN IF NOT EXISTS folder_id INTEGER REFERENCES folders(id);
-- Fast per-owner folder listing.
CREATE INDEX IF NOT EXISTS folders_user ON folders (user_id);
-- Fast "documents in this folder" filtering for the Drive view.
CREATE INDEX IF NOT EXISTS documents_folder ON documents (folder_id);

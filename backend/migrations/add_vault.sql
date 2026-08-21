-- add_vault.sql
-- Phase 4b: Private Vault schema — the columns the zero-knowledge core needs.
--
-- PostgreSQL only (deploy batch). Local SQLite dev DBs get these via manual
-- ALTERs (create_all only creates new tables, never adds columns to existing
-- ones). All three columns are SCHEMA-ONLY discriminators/holders in this
-- batch — no crypto logic ships in the migration itself.
--
-- Columns:
--   folders.vault_type   — per-folder mode discriminator. 'smart' (default,
--     server-searchable, AI extraction runs) | 'private' (zero-knowledge).
--     The per-folder mode model: a file cannot be both server-searchable AND
--     zero-knowledge, so the choice is made at the folder. NOT NULL, defaults
--     'smart' so every existing folder is unambiguously server-searchable.
--   users.vault_kdf_salt — per-user Argon2id salt for vault key derivation.
--     NULL until the user initializes a private vault. Salt only — the vault
--     key itself is derived client-side and never reaches the server.
--   documents.wrapped_dek — per-document Data Encryption Key, wrapped by the
--     vault key. NULL for smart docs. Ciphertext only; the server never sees
--     the unwrapped DEK or the plaintext for private docs.
--
-- Nesting/expansion doors: none needed here — these are additive columns.
--
-- DPDP: Category B (private-folder sharing is OUT for v1; no personal-data
-- sharing surface. Everything here stays owner-scoped).
ALTER TABLE folders   ADD COLUMN IF NOT EXISTS vault_type TEXT NOT NULL DEFAULT 'smart';
ALTER TABLE users     ADD COLUMN IF NOT EXISTS vault_kdf_salt TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS wrapped_dek TEXT;

-- Verification Layer: per-field metadata + document verification state
ALTER TABLE documents ADD COLUMN IF NOT EXISTS field_metadata TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS verification_status VARCHAR NOT NULL DEFAULT 'AI_EXTRACTED';
ALTER TABLE documents ADD COLUMN IF NOT EXISTS verified_fields_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS total_verifiable_fields INTEGER NOT NULL DEFAULT 0;

-- Session/device manager: device + ip_hash + last_used_at on refresh_tokens
ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS device VARCHAR;
ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS ip_hash VARCHAR;
ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ;

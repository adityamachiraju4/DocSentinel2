-- Sprint B feature 2: document summaries (cached, on-demand)
-- JSON: {version, summary, key_points[]}
ALTER TABLE documents ADD COLUMN IF NOT EXISTS summary TEXT;

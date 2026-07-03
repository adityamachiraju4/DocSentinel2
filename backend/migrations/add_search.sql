-- add_search.sql
-- Smart Search: trigger-maintained tsvector + weighted GIN index.
--
-- search_version = 1
-- PostgreSQL only
-- Requires deployment migration batch
-- Production validation pending first Railway deploy
--
-- Weights:
--   A  vendor_name, invoice_number
--   B  document_type, gstin
--   C  summary
--   D  extracted_text, original_filename, hsn_codes
--
-- NULLs normalized to '' inside the trigger (no scattered COALESCE at query time).
-- Reindex after any weight/field change: UPDATE documents SET id = id;  (re-fires trigger)

ALTER TABLE documents ADD COLUMN IF NOT EXISTS tsv tsvector;

CREATE OR REPLACE FUNCTION documents_tsv_update() RETURNS trigger AS $$
BEGIN
  NEW.tsv :=
    setweight(to_tsvector('english', coalesce(NEW.vendor_name, '')),       'A') ||
    setweight(to_tsvector('english', coalesce(NEW.invoice_number, '')),    'A') ||
    setweight(to_tsvector('english', coalesce(NEW.document_type, '')),     'B') ||
    setweight(to_tsvector('english', coalesce(NEW.gstin, '')),             'B') ||
    setweight(to_tsvector('english', coalesce(NEW.summary, '')),           'C') ||
    setweight(to_tsvector('english', coalesce(NEW.extracted_text, '')),    'D') ||
    setweight(to_tsvector('english', coalesce(NEW.original_filename, '')), 'D') ||
    setweight(to_tsvector('english', coalesce(NEW.hsn_codes, '')),         'D');
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS documents_tsv_trigger ON documents;
CREATE TRIGGER documents_tsv_trigger
  BEFORE INSERT OR UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION documents_tsv_update();

CREATE INDEX IF NOT EXISTS documents_tsv_gin ON documents USING GIN (tsv);

-- Backfill existing rows (fires trigger for every current document):
UPDATE documents SET id = id;

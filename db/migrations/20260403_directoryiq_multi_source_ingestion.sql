BEGIN;

ALTER TABLE brain_source_items
  ADD COLUMN IF NOT EXISTS ingest_source_type TEXT;

ALTER TABLE brain_source_items
  ADD COLUMN IF NOT EXISTS content_hash TEXT;

ALTER TABLE brain_source_items
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'brain_source_items_ingest_source_type_check'
  ) THEN
    ALTER TABLE brain_source_items
      ADD CONSTRAINT brain_source_items_ingest_source_type_check
      CHECK (
        ingest_source_type IS NULL
        OR ingest_source_type IN ('web_search', 'website_url', 'document_upload', 'youtube')
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_brain_source_items_ingest_source_type
  ON brain_source_items(brain_id, ingest_source_type);

CREATE INDEX IF NOT EXISTS idx_brain_source_items_last_seen
  ON brain_source_items(brain_id, last_seen_at DESC);

COMMIT;

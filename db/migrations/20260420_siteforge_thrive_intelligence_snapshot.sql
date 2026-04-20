BEGIN;

ALTER TABLE siteforge_snapshots
  ADD COLUMN IF NOT EXISTS thrive_intelligence JSONB;

COMMIT;

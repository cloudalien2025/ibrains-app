-- FileIQ reconciled canonical supplier catalogs
-- Target connection: ECOMMERCE_DATABASE_URL only
-- Depends on: 20260603_fileiq_source_registry.sql, 20260604_fileiq_extraction_jobs.sql

CREATE TABLE IF NOT EXISTS fileiq_reconciled_catalogs (
  id TEXT PRIMARY KEY,
  supplier_id TEXT NOT NULL,
  source_bundle_id TEXT NULL REFERENCES fileiq_source_bundles(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'completed',
  schema_version TEXT NOT NULL DEFAULT '1.1',
  catalog JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fileiq_reconciled_catalogs_supplier_id
  ON fileiq_reconciled_catalogs (supplier_id);

CREATE INDEX IF NOT EXISTS idx_fileiq_reconciled_catalogs_created_at
  ON fileiq_reconciled_catalogs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_fileiq_reconciled_catalogs_supplier_created_at
  ON fileiq_reconciled_catalogs (supplier_id, created_at DESC);

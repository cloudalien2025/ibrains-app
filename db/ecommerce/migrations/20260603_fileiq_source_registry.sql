-- FileIQ Source Registry (Phase 1.1)
-- Target connection: ECOMMERCE_DATABASE_URL only
-- Tables: fileiq_source_bundles, fileiq_source_files

CREATE TABLE IF NOT EXISTS fileiq_source_bundles (
  id TEXT PRIMARY KEY,
  supplier_id TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_by TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS fileiq_source_files (
  id TEXT PRIMARY KEY,
  bundle_id TEXT NOT NULL REFERENCES fileiq_source_bundles(id) ON DELETE CASCADE,
  supplier_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  source_role TEXT NOT NULL,
  storage_uri TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'registered',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (bundle_id, content_hash)
);

CREATE INDEX IF NOT EXISTS idx_fileiq_source_bundles_supplier_id
  ON fileiq_source_bundles (supplier_id);

CREATE INDEX IF NOT EXISTS idx_fileiq_source_bundles_status
  ON fileiq_source_bundles (status);

CREATE INDEX IF NOT EXISTS idx_fileiq_source_files_bundle_id
  ON fileiq_source_files (bundle_id);

CREATE INDEX IF NOT EXISTS idx_fileiq_source_files_supplier_id
  ON fileiq_source_files (supplier_id);

CREATE INDEX IF NOT EXISTS idx_fileiq_source_files_content_hash
  ON fileiq_source_files (content_hash);

CREATE INDEX IF NOT EXISTS idx_fileiq_source_files_file_type
  ON fileiq_source_files (file_type);

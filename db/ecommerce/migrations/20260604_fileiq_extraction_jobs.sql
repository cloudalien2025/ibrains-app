-- FileIQ Extraction Jobs + Raw Extractions (Phase 1.2)
-- Sprint: feat/fileiq-phase-1-2-extraction-jobs
-- Target connection: ECOMMERCE_DATABASE_URL only
-- Depends on: 20260603_fileiq_source_registry.sql

CREATE TABLE IF NOT EXISTS fileiq_extraction_jobs (
  id TEXT PRIMARY KEY,
  bundle_id TEXT NOT NULL REFERENCES fileiq_source_bundles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  extractor_type TEXT NOT NULL DEFAULT 'claude_agent',
  agent_session_id TEXT NULL,
  started_at TIMESTAMPTZ NULL,
  completed_at TIMESTAMPTZ NULL,
  error_code TEXT NULL,
  error_message TEXT NULL,
  summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS fileiq_raw_extractions (
  id TEXT PRIMARY KEY,
  extraction_job_id TEXT NOT NULL REFERENCES fileiq_extraction_jobs(id) ON DELETE CASCADE,
  source_file_id TEXT NULL REFERENCES fileiq_source_files(id) ON DELETE SET NULL,
  artifact_type TEXT NOT NULL DEFAULT 'agent_result',
  storage_uri TEXT NOT NULL DEFAULT 'inline:payload',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fileiq_extraction_jobs_bundle_id
  ON fileiq_extraction_jobs (bundle_id);

CREATE INDEX IF NOT EXISTS idx_fileiq_extraction_jobs_status
  ON fileiq_extraction_jobs (status);

CREATE INDEX IF NOT EXISTS idx_fileiq_extraction_jobs_created_at
  ON fileiq_extraction_jobs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_fileiq_raw_extractions_job_id
  ON fileiq_raw_extractions (extraction_job_id);

CREATE INDEX IF NOT EXISTS idx_fileiq_raw_extractions_source_file_id
  ON fileiq_raw_extractions (source_file_id);

BEGIN;

ALTER TABLE siteforge_projects
  ADD COLUMN IF NOT EXISTS slug TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS site_type TEXT,
  ADD COLUMN IF NOT EXISTS primary_prompt TEXT,
  ADD COLUMN IF NOT EXISTS current_state TEXT NOT NULL DEFAULT 'workspace',
  ADD COLUMN IF NOT EXISTS homepage_strategy TEXT NOT NULL DEFAULT 'use_existing',
  ADD COLUMN IF NOT EXISTS last_opened_at TIMESTAMPTZ;

UPDATE siteforge_projects
SET slug = regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g')
WHERE slug IS NULL;

ALTER TABLE siteforge_projects
  ALTER COLUMN slug SET NOT NULL;

ALTER TABLE siteforge_projects
  ADD CONSTRAINT IF NOT EXISTS siteforge_projects_status_check
    CHECK (status IN ('draft', 'active', 'archived'));

ALTER TABLE siteforge_projects
  ADD CONSTRAINT IF NOT EXISTS siteforge_projects_homepage_strategy_check
    CHECK (homepage_strategy IN ('use_existing', 'replace_existing', 'create_new', 'draft_only'));

ALTER TABLE siteforge_sessions
  ADD COLUMN IF NOT EXISTS connection_id TEXT,
  ADD COLUMN IF NOT EXISTS session_type TEXT NOT NULL DEFAULT 'generate',
  ADD COLUMN IF NOT EXISTS trigger_source TEXT NOT NULL DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS error_summary TEXT,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

ALTER TABLE siteforge_sessions
  ADD CONSTRAINT IF NOT EXISTS siteforge_sessions_type_check
    CHECK (session_type IN ('generate', 'refine'));

ALTER TABLE siteforge_sessions
  ADD CONSTRAINT IF NOT EXISTS siteforge_sessions_trigger_source_check
    CHECK (trigger_source IN ('user', 'resume', 'system'));

CREATE TABLE IF NOT EXISTS siteforge_connections (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL UNIQUE REFERENCES siteforge_projects(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  wordpress_url TEXT NOT NULL,
  username TEXT NOT NULL,
  auth_type TEXT NOT NULL DEFAULT 'application_password',
  secret_ref TEXT,
  secret_ciphertext TEXT,
  thrive_detected BOOLEAN NOT NULL DEFAULT false,
  write_access BOOLEAN NOT NULL DEFAULT false,
  last_validated_at TIMESTAMPTZ,
  last_validation_status TEXT NOT NULL DEFAULT 'not_validated',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT siteforge_connections_validation_status_check
    CHECK (last_validation_status IN ('not_validated', 'valid', 'invalid'))
);

CREATE INDEX IF NOT EXISTS idx_siteforge_connections_project
  ON siteforge_connections(project_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS siteforge_run_logs (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES siteforge_sessions(id) ON DELETE CASCADE,
  stage TEXT NOT NULL,
  message TEXT NOT NULL,
  level TEXT NOT NULL,
  happened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT siteforge_run_logs_level_check CHECK (level IN ('info', 'warning', 'error'))
);

CREATE INDEX IF NOT EXISTS idx_siteforge_run_logs_session
  ON siteforge_run_logs(session_id, happened_at DESC);

CREATE TABLE IF NOT EXISTS siteforge_snapshots (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL UNIQUE REFERENCES siteforge_projects(id) ON DELETE CASCADE,
  connection_id TEXT REFERENCES siteforge_connections(id) ON DELETE SET NULL,
  current_homepage_id BIGINT,
  current_homepage_title TEXT,
  current_homepage_source TEXT NOT NULL DEFAULT 'unknown',
  known_pages JSONB NOT NULL DEFAULT '[]'::jsonb,
  known_menus JSONB NOT NULL DEFAULT '[]'::jsonb,
  thrive_detected BOOLEAN NOT NULL DEFAULT false,
  homepage_strategy TEXT NOT NULL DEFAULT 'use_existing',
  last_run_summary TEXT,
  last_run_status TEXT,
  pages_affected INT NOT NULL DEFAULT 0,
  last_synced_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT siteforge_snapshots_homepage_source_check
    CHECK (current_homepage_source IN ('wordpress', 'thrive', 'unknown')),
  CONSTRAINT siteforge_snapshots_homepage_strategy_check
    CHECK (homepage_strategy IN ('use_existing', 'replace_existing', 'create_new', 'draft_only')),
  CONSTRAINT siteforge_snapshots_last_run_status_check
    CHECK (last_run_status IS NULL OR last_run_status IN ('queued', 'running', 'completed', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_siteforge_snapshots_project
  ON siteforge_snapshots(project_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS siteforge_user_workspace_state (
  user_id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES siteforge_projects(id) ON DELETE CASCADE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMIT;

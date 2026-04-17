BEGIN;

CREATE TABLE IF NOT EXISTS siteforge_projects (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  latest_session_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_siteforge_projects_user
  ON siteforge_projects(user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS siteforge_sessions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES siteforge_projects(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  prompt TEXT NOT NULL,
  connection_profile JSONB,
  status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'completed', 'failed')),
  run_state JSONB NOT NULL,
  site_plan JSONB,
  content_package JSONB,
  build_spec JSONB,
  qa_result JSONB,
  execution_result JSONB,
  revision_history JSONB NOT NULL DEFAULT '[]'::jsonb,
  started_at TIMESTAMPTZ NOT NULL,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_siteforge_sessions_project
  ON siteforge_sessions(project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_siteforge_sessions_status
  ON siteforge_sessions(status, updated_at DESC);

CREATE TABLE IF NOT EXISTS siteforge_failures (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES siteforge_sessions(id) ON DELETE CASCADE,
  happened_at TIMESTAMPTZ NOT NULL,
  message TEXT NOT NULL,
  retryable BOOLEAN NOT NULL,
  reason TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_siteforge_failures_session
  ON siteforge_failures(session_id, happened_at DESC);

COMMIT;

BEGIN;

ALTER TABLE siteforge_projects
  ADD COLUMN IF NOT EXISTS website_brief JSONB,
  ADD COLUMN IF NOT EXISTS ai_provider TEXT,
  ADD COLUMN IF NOT EXISTS ai_model TEXT,
  ADD COLUMN IF NOT EXISTS ai_secret_ref TEXT,
  ADD COLUMN IF NOT EXISTS has_saved_ai_secret BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE siteforge_projects
  ADD CONSTRAINT IF NOT EXISTS siteforge_projects_ai_provider_check
    CHECK (ai_provider IS NULL OR ai_provider IN ('openai'));

CREATE TABLE IF NOT EXISTS siteforge_project_ai_configs (
  project_id TEXT PRIMARY KEY REFERENCES siteforge_projects(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  secret_ref TEXT,
  secret_ciphertext TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT siteforge_project_ai_configs_provider_check
    CHECK (provider IN ('openai'))
);

ALTER TABLE siteforge_sessions
  ADD COLUMN IF NOT EXISTS website_brief JSONB,
  ADD COLUMN IF NOT EXISTS generation_source TEXT NOT NULL DEFAULT 'deterministic_fallback',
  ADD COLUMN IF NOT EXISTS ai_model TEXT;

ALTER TABLE siteforge_sessions
  ADD CONSTRAINT IF NOT EXISTS siteforge_sessions_generation_source_check
    CHECK (generation_source IN ('user_key', 'platform_key', 'deterministic_fallback'));

COMMIT;

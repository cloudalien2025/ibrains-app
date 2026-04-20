BEGIN;

ALTER TABLE siteforge_projects
  ADD COLUMN IF NOT EXISTS serpapi_provider TEXT,
  ADD COLUMN IF NOT EXISTS serpapi_secret_ref TEXT,
  ADD COLUMN IF NOT EXISTS has_saved_serpapi_secret BOOLEAN NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'siteforge_projects_serpapi_provider_check'
  ) THEN
    ALTER TABLE siteforge_projects
      ADD CONSTRAINT siteforge_projects_serpapi_provider_check
      CHECK (serpapi_provider IS NULL OR serpapi_provider IN ('serpapi'));
  END IF;
END $$;

ALTER TABLE siteforge_project_ai_configs
  DROP CONSTRAINT IF EXISTS siteforge_project_ai_configs_provider_check;

ALTER TABLE siteforge_project_ai_configs
  ADD CONSTRAINT siteforge_project_ai_configs_provider_check
    CHECK (provider IN ('openai', 'serpapi'));

ALTER TABLE siteforge_project_ai_configs
  DROP CONSTRAINT IF EXISTS siteforge_project_ai_configs_pkey;

ALTER TABLE siteforge_project_ai_configs
  ADD CONSTRAINT siteforge_project_ai_configs_pkey PRIMARY KEY (project_id, provider);

ALTER TABLE siteforge_sessions
  ADD COLUMN IF NOT EXISTS market_intelligence JSONB;

ALTER TABLE siteforge_snapshots
  ADD COLUMN IF NOT EXISTS market_intelligence JSONB;

COMMIT;

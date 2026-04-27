CREATE TABLE IF NOT EXISTS casahud_projects (
  id text PRIMARY KEY,
  user_id uuid NOT NULL,
  name text NOT NULL,
  selected_title text NOT NULL,
  video_type text NOT NULL CHECK (
    video_type IN (
      'single_property',
      'roundup',
      'niche',
      'location_category',
      'lifestyle_relocation',
      'search_opportunity'
    )
  ),
  status text NOT NULL,
  provider_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS casahud_projects_user_updated_idx
  ON casahud_projects (user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS casahud_generation_runs (
  id text PRIMARY KEY,
  user_id uuid NOT NULL,
  project_id text REFERENCES casahud_projects(id) ON DELETE SET NULL,
  status text NOT NULL,
  objective text NOT NULL,
  current_stage text NOT NULL,
  error_message text,
  retry_count integer NOT NULL DEFAULT 0,
  provider_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS casahud_generation_runs_user_created_idx
  ON casahud_generation_runs (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS casahud_run_stage_outputs (
  run_id text NOT NULL REFERENCES casahud_generation_runs(id) ON DELETE CASCADE,
  stage_name text NOT NULL,
  status text NOT NULL,
  output_json jsonb,
  error_message text,
  retryable boolean NOT NULL DEFAULT false,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  PRIMARY KEY (run_id, stage_name)
);

CREATE TABLE IF NOT EXISTS casahud_youtube_research_results (
  run_id text PRIMARY KEY REFERENCES casahud_generation_runs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  provider text NOT NULL,
  status text NOT NULL,
  query text NOT NULL,
  result_json jsonb NOT NULL,
  external_ids jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS casahud_title_candidates (
  id text PRIMARY KEY,
  run_id text NOT NULL REFERENCES casahud_generation_runs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  title text NOT NULL,
  score integer NOT NULL,
  selected boolean NOT NULL DEFAULT false,
  scoring_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS casahud_title_candidates_run_selected_idx
  ON casahud_title_candidates (run_id, selected DESC, score DESC);

CREATE TABLE IF NOT EXISTS casahud_content_strategies (
  run_id text PRIMARY KEY REFERENCES casahud_generation_runs(id) ON DELETE CASCADE,
  project_id text NOT NULL REFERENCES casahud_projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  video_type text NOT NULL,
  strategy_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS casahud_listing_discovery_results (
  run_id text PRIMARY KEY REFERENCES casahud_generation_runs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  status text NOT NULL,
  provider text NOT NULL,
  result_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS casahud_imported_listings (
  id text PRIMARY KEY,
  run_id text NOT NULL REFERENCES casahud_generation_runs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  provider text NOT NULL,
  source_url text,
  source_attribution text,
  external_id text,
  listing_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS casahud_imported_listings_run_idx
  ON casahud_imported_listings (run_id);

CREATE TABLE IF NOT EXISTS casahud_listing_media_assets (
  id text PRIMARY KEY,
  run_id text NOT NULL REFERENCES casahud_generation_runs(id) ON DELETE CASCADE,
  listing_id text REFERENCES casahud_imported_listings(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  asset_url text NOT NULL,
  asset_kind text NOT NULL,
  provider_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS casahud_listing_validation_results (
  id text PRIMARY KEY,
  run_id text NOT NULL REFERENCES casahud_generation_runs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  listing_title text NOT NULL,
  valid boolean NOT NULL,
  score integer NOT NULL,
  validation_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS casahud_location_enrichments (
  id text PRIMARY KEY,
  run_id text NOT NULL REFERENCES casahud_generation_runs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  listing_title text NOT NULL,
  provider text NOT NULL,
  enrichment_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS casahud_script_outputs (
  run_id text PRIMARY KEY REFERENCES casahud_generation_runs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  title text NOT NULL,
  script_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS casahud_storyboards (
  run_id text PRIMARY KEY REFERENCES casahud_generation_runs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  storyboard_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS casahud_render_plans (
  id text PRIMARY KEY,
  run_id text NOT NULL REFERENCES casahud_generation_runs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  render_plan_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS casahud_render_jobs (
  id text PRIMARY KEY,
  run_id text NOT NULL REFERENCES casahud_generation_runs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  status text NOT NULL,
  render_plan_id text REFERENCES casahud_render_plans(id) ON DELETE SET NULL,
  job_json jsonb NOT NULL,
  output_url text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS casahud_rendered_video_outputs (
  id text PRIMARY KEY,
  run_id text NOT NULL REFERENCES casahud_generation_runs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  render_job_id text REFERENCES casahud_render_jobs(id) ON DELETE SET NULL,
  output_url text NOT NULL,
  output_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS casahud_youtube_packages (
  run_id text PRIMARY KEY REFERENCES casahud_generation_runs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  title text NOT NULL,
  package_json jsonb NOT NULL,
  thumbnail_asset_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS casahud_review_states (
  run_id text PRIMARY KEY REFERENCES casahud_generation_runs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  status text NOT NULL,
  approved_by text,
  approved_at timestamptz,
  review_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS casahud_publish_jobs (
  id text PRIMARY KEY,
  run_id text NOT NULL REFERENCES casahud_generation_runs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  status text NOT NULL,
  provider text NOT NULL DEFAULT 'youtube_data_api',
  mode text NOT NULL,
  scheduled_at timestamptz,
  external_video_id text,
  result_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS casahud_integration_status_snapshots (
  id text PRIMARY KEY,
  run_id text REFERENCES casahud_generation_runs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  provider text NOT NULL,
  configured boolean NOT NULL,
  status text NOT NULL,
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS ssc_prompt_packs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_name TEXT NOT NULL,
  version TEXT NOT NULL,
  build_date DATE NOT NULL,
  sha256 TEXT NOT NULL,
  canonicalization_rules JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(pack_name, version, sha256)
);

CREATE TABLE IF NOT EXISTS ssc_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id UUID NOT NULL REFERENCES ssc_prompt_packs(id) ON DELETE CASCADE,
  dimension TEXT NOT NULL,
  system_prompt TEXT NOT NULL,
  user_prompt TEXT NOT NULL,
  flags_vocabulary JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(pack_id, dimension)
);

CREATE TABLE IF NOT EXISTS ssc_prompt_pack_active (
  pack_name TEXT PRIMARY KEY,
  active_pack_id UUID NOT NULL REFERENCES ssc_prompt_packs(id) ON DELETE CASCADE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ssc_storyboard_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  url TEXT NOT NULL,
  screenshot_full_key TEXT NOT NULL,
  visible_text_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ssc_storyboard_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES ssc_storyboard_runs(id) ON DELETE CASCADE,
  dimension TEXT NOT NULL,
  score_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(run_id, dimension)
);

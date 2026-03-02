CREATE TABLE IF NOT EXISTS directoryiq_settings (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  vertical_override TEXT,
  risk_tier_overrides_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  image_style_preference TEXT NOT NULL DEFAULT 'editorial clean',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS directoryiq_authority_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  listing_source_id TEXT NOT NULL,
  slot_index INTEGER NOT NULL CHECK (slot_index >= 1 AND slot_index <= 4),
  post_type TEXT NOT NULL,
  focus_topic TEXT NOT NULL DEFAULT '',
  title TEXT,
  status TEXT NOT NULL DEFAULT 'not_created',
  draft_markdown TEXT,
  draft_html TEXT,
  featured_image_prompt TEXT,
  featured_image_url TEXT,
  published_post_id TEXT,
  published_url TEXT,
  blog_to_listing_link_status TEXT NOT NULL DEFAULT 'missing',
  listing_to_blog_link_status TEXT NOT NULL DEFAULT 'missing',
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, listing_source_id, slot_index)
);

CREATE INDEX IF NOT EXISTS idx_directoryiq_authority_posts_listing
  ON directoryiq_authority_posts(user_id, listing_source_id);

CREATE TABLE IF NOT EXISTS directoryiq_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  listing_source_id TEXT NOT NULL,
  authority_post_id UUID REFERENCES directoryiq_authority_posts(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL,
  version_label TEXT NOT NULL,
  score_snapshot_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  content_delta_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  link_delta_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_directoryiq_versions_user_created
  ON directoryiq_versions(user_id, created_at DESC);

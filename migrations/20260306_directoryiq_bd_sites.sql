-- DirectoryIQ multi-site BD support

CREATE TABLE IF NOT EXISTS directoryiq_bd_sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label TEXT,
  base_url TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  listings_data_id INTEGER,
  blog_posts_data_id INTEGER,
  listings_path TEXT NOT NULL DEFAULT '/api/v2/users_portfolio_groups/search',
  blog_posts_path TEXT,
  ingest_checkpoint_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  secret_ciphertext TEXT,
  secret_last4 TEXT,
  secret_length INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, base_url)
);

CREATE INDEX IF NOT EXISTS idx_directoryiq_bd_sites_user_id
  ON directoryiq_bd_sites(user_id);

ALTER TABLE directoryiq_nodes
  ADD COLUMN IF NOT EXISTS bd_site_id UUID;

CREATE INDEX IF NOT EXISTS idx_directoryiq_nodes_site
  ON directoryiq_nodes(user_id, bd_site_id, source_type);

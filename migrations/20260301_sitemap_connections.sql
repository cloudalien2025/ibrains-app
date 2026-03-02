CREATE TABLE IF NOT EXISTS connected_sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  brain_id TEXT NOT NULL,
  connection_type TEXT NOT NULL,
  base_url TEXT NOT NULL,
  sitemap_url_used TEXT,
  robots_txt_url TEXT,
  status TEXT NOT NULL DEFAULT 'connected',
  use_decodo BOOLEAN NOT NULL DEFAULT false,
  respect_robots BOOLEAN NOT NULL DEFAULT true,
  progress_stage TEXT NOT NULL DEFAULT 'idle',
  counts_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_error TEXT,
  last_analyzed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_connected_sites_user_brain_updated
  ON connected_sites(user_id, brain_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS surfaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  brain_id TEXT NOT NULL,
  connected_site_id UUID NOT NULL REFERENCES connected_sites(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  url_hash TEXT NOT NULL,
  canonical_url TEXT,
  type TEXT NOT NULL DEFAULT 'unknown',
  lastmod TIMESTAMPTZ,
  http_status INTEGER,
  title TEXT,
  meta_description TEXT,
  h1 TEXT,
  extracted_text TEXT,
  jsonld_blobs JSONB,
  outbound_internal_links JSONB,
  fetched_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, brain_id, url_hash)
);

CREATE INDEX IF NOT EXISTS idx_surfaces_site_type
  ON surfaces(connected_site_id, type);

CREATE TABLE IF NOT EXISTS serp_competitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  brain_id TEXT NOT NULL,
  connected_site_id UUID NOT NULL REFERENCES connected_sites(id) ON DELETE CASCADE,
  query TEXT NOT NULL,
  results_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_serp_competitors_site
  ON serp_competitors(connected_site_id, created_at DESC);

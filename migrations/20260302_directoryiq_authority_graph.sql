DO $$ BEGIN
  CREATE TYPE content_node_type AS ENUM ('listing', 'blog_post', 'support_post', 'hub_post');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE content_source_type AS ENUM ('bd', 'site_crawl', 'generated');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE content_edge_type AS ENUM ('explicit_link', 'implied_mention', 'thematic_association', 'category_association');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE mention_resolution_method AS ENUM ('exact', 'alias', 'fuzzy', 'ai');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS listing_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  listing_node_id UUID NOT NULL,
  alias TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, listing_node_id, alias)
);

CREATE TABLE IF NOT EXISTS content_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  node_type content_node_type NOT NULL,
  external_id TEXT,
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  excerpt TEXT,
  clean_text TEXT NOT NULL DEFAULT '',
  raw_html TEXT,
  headings_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  images_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  published_at TIMESTAMPTZ,
  author TEXT,
  source content_source_type NOT NULL,
  content_hash TEXT NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, node_type, url)
);

CREATE INDEX IF NOT EXISTS idx_content_nodes_tenant_type
  ON content_nodes(tenant_id, node_type, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_content_nodes_tenant_slug
  ON content_nodes(tenant_id, slug);

CREATE TABLE IF NOT EXISTS content_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  from_node_id UUID NOT NULL REFERENCES content_nodes(id) ON DELETE CASCADE,
  to_node_id UUID NOT NULL REFERENCES content_nodes(id) ON DELETE CASCADE,
  edge_type content_edge_type NOT NULL,
  anchor_text TEXT,
  evidence_snippet TEXT,
  strength_score NUMERIC NOT NULL DEFAULT 0.5,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (strength_score >= 0 AND strength_score <= 1),
  UNIQUE (tenant_id, from_node_id, to_node_id, edge_type, COALESCE(anchor_text, ''))
);

CREATE INDEX IF NOT EXISTS idx_content_edges_tenant_type
  ON content_edges(tenant_id, edge_type, last_seen_at DESC);

CREATE TABLE IF NOT EXISTS entity_mentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blog_node_id UUID NOT NULL REFERENCES content_nodes(id) ON DELETE CASCADE,
  mention_text TEXT NOT NULL,
  mention_type TEXT NOT NULL,
  evidence_snippet TEXT,
  confidence NUMERIC NOT NULL DEFAULT 0.5,
  resolved_listing_node_id UUID REFERENCES content_nodes(id) ON DELETE SET NULL,
  resolution_method mention_resolution_method,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (confidence >= 0 AND confidence <= 1)
);

CREATE INDEX IF NOT EXISTS idx_entity_mentions_blog
  ON entity_mentions(tenant_id, blog_node_id, created_at DESC);

CREATE TABLE IF NOT EXISTS serp_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  query TEXT NOT NULL,
  results_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ttl_expires_at TIMESTAMPTZ NOT NULL,
  UNIQUE (tenant_id, query)
);

CREATE TABLE IF NOT EXISTS authority_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  target_node_id UUID REFERENCES content_nodes(id) ON DELETE SET NULL,
  status TEXT NOT NULL,
  details_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_authority_actions_tenant_created
  ON authority_actions(tenant_id, created_at DESC);

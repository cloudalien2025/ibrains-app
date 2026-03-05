CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS directoryiq_listing_backlinks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'default',
  listing_id TEXT NOT NULL,
  blog_node_id UUID REFERENCES authority_graph_nodes(id) ON DELETE SET NULL,
  blog_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'unknown',
  last_checked_at TIMESTAMPTZ,
  evidence_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT directoryiq_listing_backlinks_unique UNIQUE (tenant_id, listing_id, blog_url)
);

CREATE INDEX IF NOT EXISTS idx_directoryiq_listing_backlinks_tenant_listing
  ON directoryiq_listing_backlinks (tenant_id, listing_id);

CREATE INDEX IF NOT EXISTS idx_directoryiq_listing_backlinks_tenant_blog
  ON directoryiq_listing_backlinks (tenant_id, blog_url);

CREATE TABLE IF NOT EXISTS directoryiq_anchor_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'default',
  listing_id TEXT NOT NULL,
  blog_url TEXT NOT NULL,
  anchor_text TEXT NOT NULL,
  anchor_hash TEXT NOT NULL,
  anchor_type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT directoryiq_anchor_ledger_unique UNIQUE (tenant_id, listing_id, blog_url, anchor_hash)
);

CREATE INDEX IF NOT EXISTS idx_directoryiq_anchor_ledger_tenant_listing_type
  ON directoryiq_anchor_ledger (tenant_id, listing_id, anchor_type);

CREATE TABLE IF NOT EXISTS directoryiq_hubs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'default',
  hub_key TEXT NOT NULL,
  category_slug TEXT NOT NULL,
  geo_slug TEXT NOT NULL,
  topic_slug TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'hidden',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT directoryiq_hubs_unique UNIQUE (tenant_id, hub_key)
);

CREATE TABLE IF NOT EXISTS directoryiq_hub_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'default',
  hub_id UUID NOT NULL REFERENCES directoryiq_hubs(id) ON DELETE CASCADE,
  member_type TEXT NOT NULL,
  member_id TEXT NOT NULL,
  member_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT directoryiq_hub_members_unique UNIQUE (tenant_id, hub_id, member_type, member_id)
);

CREATE TABLE IF NOT EXISTS directoryiq_integrity_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'default',
  subject_type TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  metrics_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT directoryiq_integrity_metrics_unique UNIQUE (tenant_id, subject_type, subject_id)
);

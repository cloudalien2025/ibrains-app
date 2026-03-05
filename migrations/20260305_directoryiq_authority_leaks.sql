CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS directoryiq_authority_leaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'default',
  blog_node_id UUID REFERENCES authority_graph_nodes(id) ON DELETE SET NULL,
  listing_node_id UUID REFERENCES authority_graph_nodes(id) ON DELETE SET NULL,
  leak_type TEXT NOT NULL,
  severity INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  evidence_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  dedupe_key TEXT NOT NULL,
  first_detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT directoryiq_authority_leaks_unique UNIQUE (tenant_id, dedupe_key)
);

CREATE INDEX IF NOT EXISTS idx_directoryiq_authority_leaks_tenant_status
  ON directoryiq_authority_leaks (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_directoryiq_authority_leaks_tenant_type
  ON directoryiq_authority_leaks (tenant_id, leak_type);

CREATE INDEX IF NOT EXISTS idx_directoryiq_authority_leaks_tenant_listing
  ON directoryiq_authority_leaks (tenant_id, listing_node_id);

CREATE INDEX IF NOT EXISTS idx_directoryiq_authority_leaks_tenant_blog
  ON directoryiq_authority_leaks (tenant_id, blog_node_id);

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS authority_graph_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'default',
  node_type TEXT NOT NULL,
  external_id TEXT NOT NULL,
  canonical_url TEXT,
  title TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT authority_graph_nodes_unique UNIQUE (tenant_id, node_type, external_id)
);

CREATE INDEX IF NOT EXISTS idx_authority_graph_nodes_tenant_type
  ON authority_graph_nodes (tenant_id, node_type);

CREATE INDEX IF NOT EXISTS idx_authority_graph_nodes_tenant_canonical_url
  ON authority_graph_nodes (tenant_id, canonical_url);

CREATE TABLE IF NOT EXISTS authority_graph_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'default',
  from_node_id UUID NOT NULL REFERENCES authority_graph_nodes(id) ON DELETE CASCADE,
  to_node_id UUID NOT NULL REFERENCES authority_graph_nodes(id) ON DELETE CASCADE,
  edge_type TEXT NOT NULL,
  strength INTEGER NOT NULL DEFAULT 50,
  confidence INTEGER NOT NULL DEFAULT 80,
  status TEXT NOT NULL DEFAULT 'active',
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT authority_graph_edges_unique UNIQUE (tenant_id, from_node_id, to_node_id, edge_type)
);

CREATE INDEX IF NOT EXISTS idx_authority_graph_edges_tenant_type
  ON authority_graph_edges (tenant_id, edge_type);

CREATE INDEX IF NOT EXISTS idx_authority_graph_edges_tenant_from
  ON authority_graph_edges (tenant_id, from_node_id);

CREATE INDEX IF NOT EXISTS idx_authority_graph_edges_tenant_to
  ON authority_graph_edges (tenant_id, to_node_id);

CREATE TABLE IF NOT EXISTS authority_graph_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'default',
  edge_id UUID NOT NULL REFERENCES authority_graph_edges(id) ON DELETE CASCADE,
  source_url TEXT NOT NULL,
  target_url TEXT,
  anchor_text TEXT,
  context_snippet TEXT,
  dom_path TEXT,
  location_hint TEXT,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_authority_graph_evidence_tenant_edge
  ON authority_graph_evidence (tenant_id, edge_id);

CREATE INDEX IF NOT EXISTS idx_authority_graph_evidence_tenant_source_url
  ON authority_graph_evidence (tenant_id, source_url);

CREATE TABLE IF NOT EXISTS authority_graph_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'default',
  run_type TEXT NOT NULL,
  status TEXT NOT NULL,
  stats JSONB NOT NULL DEFAULT '{}'::jsonb,
  error TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_authority_graph_runs_tenant_started_desc
  ON authority_graph_runs (tenant_id, started_at DESC);

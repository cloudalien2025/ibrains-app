-- Continuous brain learning foundation
-- Postgres-first schema for watches, source ledger, ingest runs, normalized knowledge, taxonomy, and freshness.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS brains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  brain_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS brain_source_watches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brain_id UUID NOT NULL REFERENCES brains(id) ON DELETE CASCADE,
  source_kind TEXT NOT NULL CHECK (
    source_kind IN ('youtube_channel', 'youtube_playlist', 'youtube_keyword', 'web_domain', 'web_feed')
  ),
  external_ref TEXT NOT NULL,
  canonical_ref TEXT NOT NULL,
  discovery_query TEXT,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  priority SMALLINT NOT NULL DEFAULT 100,
  last_checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (brain_id, source_kind, canonical_ref)
);

CREATE TABLE IF NOT EXISTS brain_source_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brain_id UUID NOT NULL REFERENCES brains(id) ON DELETE CASCADE,
  source_watch_id UUID REFERENCES brain_source_watches(id) ON DELETE SET NULL,
  source_kind TEXT NOT NULL CHECK (
    source_kind IN ('youtube_video', 'web_doc', 'podcast_episode', 'other')
  ),
  source_item_id TEXT NOT NULL,
  canonical_identity TEXT NOT NULL,
  source_url TEXT,
  title TEXT,
  publisher_name TEXT,
  language_code TEXT,
  published_at TIMESTAMPTZ,
  discovered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_payload_hash TEXT,
  transcript_hash TEXT,
  latest_ingest_run_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (brain_id, source_kind, canonical_identity)
);

CREATE TABLE IF NOT EXISTS brain_ingest_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brain_id UUID NOT NULL REFERENCES brains(id) ON DELETE CASCADE,
  source_item_id UUID NOT NULL REFERENCES brain_source_items(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (
    status IN (
      'discovered',
      'queued',
      'processing',
      'completed',
      'failed',
      'skipped_duplicate',
      'superseded',
      'reingest_requested'
    )
  ),
  trigger_type TEXT NOT NULL CHECK (
    trigger_type IN ('watch_poll', 'manual', 'backfill', 'reingest', 'system')
  ),
  ingest_reason TEXT,
  attempt_no INTEGER NOT NULL DEFAULT 1,
  worker_run_id TEXT,
  queued_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  error_code TEXT,
  error_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  reingest_of_run_id UUID REFERENCES brain_ingest_runs(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source_item_id, attempt_no)
);

ALTER TABLE brain_source_items
  ADD CONSTRAINT brain_source_items_latest_ingest_run_id_fkey
  FOREIGN KEY (latest_ingest_run_id) REFERENCES brain_ingest_runs(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS brain_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brain_id UUID NOT NULL REFERENCES brains(id) ON DELETE CASCADE,
  source_item_id UUID NOT NULL REFERENCES brain_source_items(id) ON DELETE CASCADE,
  ingest_run_id UUID NOT NULL REFERENCES brain_ingest_runs(id) ON DELETE CASCADE,
  document_kind TEXT NOT NULL CHECK (
    document_kind IN ('transcript', 'source_text', 'normalized_markdown', 'extraction_json', 'other')
  ),
  language_code TEXT,
  content_text TEXT,
  content_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  token_count INTEGER,
  content_sha256 TEXT,
  version_no INTEGER NOT NULL DEFAULT 1,
  freshness_score NUMERIC(6,4) NOT NULL DEFAULT 1.0000,
  is_current BOOLEAN NOT NULL DEFAULT TRUE,
  supersedes_document_id UUID REFERENCES brain_documents(id) ON DELETE SET NULL,
  superseded_by_document_id UUID REFERENCES brain_documents(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source_item_id, document_kind, version_no)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_brain_documents_current_per_kind
  ON brain_documents(source_item_id, document_kind)
  WHERE is_current;

CREATE TABLE IF NOT EXISTS brain_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brain_id UUID NOT NULL REFERENCES brains(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES brain_documents(id) ON DELETE CASCADE,
  source_item_id UUID NOT NULL REFERENCES brain_source_items(id) ON DELETE CASCADE,
  ingest_run_id UUID NOT NULL REFERENCES brain_ingest_runs(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  start_ms INTEGER,
  end_ms INTEGER,
  start_token INTEGER,
  end_token INTEGER,
  content_text TEXT NOT NULL,
  content_sha256 TEXT,
  taxonomy_hint TEXT,
  embedding_model TEXT,
  embedding_status TEXT NOT NULL DEFAULT 'pending' CHECK (
    embedding_status IN ('pending', 'ready', 'failed', 'skipped')
  ),
  embedding_generated_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (document_id, chunk_index)
);

CREATE TABLE IF NOT EXISTS brain_taxonomy_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brain_id UUID NOT NULL REFERENCES brains(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  label TEXT NOT NULL,
  description TEXT,
  parent_node_id UUID REFERENCES brain_taxonomy_nodes(id) ON DELETE SET NULL,
  node_path TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (brain_id, key)
);

CREATE TABLE IF NOT EXISTS brain_chunk_taxonomy_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brain_id UUID NOT NULL REFERENCES brains(id) ON DELETE CASCADE,
  chunk_id UUID NOT NULL REFERENCES brain_chunks(id) ON DELETE CASCADE,
  taxonomy_node_id UUID NOT NULL REFERENCES brain_taxonomy_nodes(id) ON DELETE CASCADE,
  ingest_run_id UUID REFERENCES brain_ingest_runs(id) ON DELETE SET NULL,
  confidence NUMERIC(6,4),
  assigned_by TEXT NOT NULL DEFAULT 'llm' CHECK (
    assigned_by IN ('rule', 'llm', 'human', 'import')
  ),
  rationale JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (chunk_id, taxonomy_node_id)
);

CREATE INDEX IF NOT EXISTS idx_brain_source_watches_active
  ON brain_source_watches(brain_id, is_active, priority);

CREATE INDEX IF NOT EXISTS idx_brain_source_items_lookup
  ON brain_source_items(brain_id, source_kind, canonical_identity);

CREATE INDEX IF NOT EXISTS idx_brain_ingest_runs_status
  ON brain_ingest_runs(brain_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_brain_ingest_runs_source_item
  ON brain_ingest_runs(source_item_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_brain_documents_freshness
  ON brain_documents(brain_id, is_current, freshness_score DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_brain_chunks_source_item
  ON brain_chunks(source_item_id, chunk_index);

CREATE INDEX IF NOT EXISTS idx_brain_chunk_taxonomy_node
  ON brain_chunk_taxonomy_assignments(taxonomy_node_id, confidence DESC);

COMMIT;

BEGIN;

CREATE TABLE IF NOT EXISTS walmart_drafts (
  user_id TEXT NOT NULL,
  draft_id TEXT NOT NULL,
  sku TEXT NOT NULL,
  status TEXT NOT NULL,
  publish_status TEXT NOT NULL,
  draft_record JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (user_id, draft_id)
);

CREATE INDEX IF NOT EXISTS idx_walmart_drafts_user_updated
  ON walmart_drafts(user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_walmart_drafts_user_sku
  ON walmart_drafts(user_id, sku);

COMMIT;

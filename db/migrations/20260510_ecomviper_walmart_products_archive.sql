BEGIN;

ALTER TABLE walmart_products
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS idx_walmart_products_user_archived_updated
  ON walmart_products(user_id, archived_at, updated_at DESC);

COMMIT;

-- Durable per-user Walmart product persistence.

CREATE TABLE IF NOT EXISTS walmart_products (
  user_id TEXT NOT NULL,
  sku TEXT NOT NULL,
  product_payload JSONB NOT NULL,
  imported_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, sku)
);

CREATE INDEX IF NOT EXISTS idx_walmart_products_user_updated
  ON walmart_products(user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS walmart_product_import_state (
  user_id TEXT PRIMARY KEY,
  last_import_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

BEGIN;

CREATE TABLE IF NOT EXISTS shopify_products (
  user_id TEXT NOT NULL,
  shopify_product_id TEXT NOT NULL,
  product_payload JSONB NOT NULL,
  imported_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, shopify_product_id)
);

CREATE INDEX IF NOT EXISTS idx_shopify_products_user_updated
  ON shopify_products(user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS shopify_product_import_state (
  user_id TEXT PRIMARY KEY,
  last_import_at TIMESTAMPTZ NULL,
  last_import_status TEXT NOT NULL DEFAULT 'unknown',
  last_import_message TEXT NULL,
  product_count INTEGER NOT NULL DEFAULT 0,
  image_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMIT;

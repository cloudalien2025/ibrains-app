BEGIN;

CREATE TABLE IF NOT EXISTS shopify_pdp_intelligence (
  user_id TEXT NOT NULL,
  shopify_product_id TEXT NOT NULL,
  product_handle TEXT NULL,
  intelligence_payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, shopify_product_id)
);

CREATE INDEX IF NOT EXISTS idx_shopify_pdp_intelligence_user_handle
  ON shopify_pdp_intelligence(user_id, lower(product_handle));

CREATE INDEX IF NOT EXISTS idx_shopify_pdp_intelligence_user_updated
  ON shopify_pdp_intelligence(user_id, updated_at DESC);

COMMIT;

-- EcomViper Supplier Normalized Intelligence Persistence
-- Sprint: stabilization-009-6-supplier-data-pipeline-normalized-sku-intelligence

CREATE TABLE IF NOT EXISTS supplier_products_normalized (
  user_id TEXT NOT NULL,
  supplier_id TEXT NOT NULL,
  sku TEXT NOT NULL,
  product_name TEXT NOT NULL,
  category TEXT NULL,
  label_size TEXT NULL,
  container_size TEXT NULL,
  product_weight TEXT NULL,
  product_form TEXT NULL,
  supplement_facts_raw TEXT NULL,
  supplement_facts_text TEXT NULL,
  serving_size TEXT NULL,
  servings_per_container TEXT NULL,
  active_ingredients JSONB NOT NULL DEFAULT '[]'::jsonb,
  amount_per_serving TEXT NULL,
  other_ingredients TEXT NULL,
  ingredient_highlights_source JSONB NOT NULL DEFAULT '[]'::jsonb,
  key_product_features JSONB NOT NULL DEFAULT '[]'::jsonb,
  dietary_attributes JSONB NOT NULL DEFAULT '[]'::jsonb,
  manufacturing_claims JSONB NOT NULL DEFAULT '[]'::jsonb,
  certifications JSONB NOT NULL DEFAULT '[]'::jsonb,
  warnings TEXT NULL,
  suggested_use TEXT NULL,
  coa_url TEXT NULL,
  coa_status TEXT NULL,
  coa_extraction_status TEXT NULL,
  coa_extraction_error TEXT NULL,
  label_template_url TEXT NULL,
  mockup_url TEXT NULL,
  source_catalog_page INTEGER NULL,
  source_version TEXT NULL,
  extraction_status TEXT NULL,
  extraction_errors JSONB NOT NULL DEFAULT '[]'::jsonb,
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, supplier_id, sku)
);

CREATE TABLE IF NOT EXISTS supplier_inventory_normalized (
  user_id TEXT NOT NULL,
  supplier_id TEXT NOT NULL,
  sku TEXT NOT NULL,
  inventory_status_raw TEXT NULL,
  inventory_status_normalized TEXT NOT NULL DEFAULT 'unknown',
  availability_display TEXT NOT NULL DEFAULT 'Availability Unknown',
  source_report TEXT NULL,
  source_updated_at TIMESTAMPTZ NULL,
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  extraction_status TEXT NULL,
  extraction_errors JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, supplier_id, sku)
);

CREATE TABLE IF NOT EXISTS supplier_pricing_normalized (
  user_id TEXT NOT NULL,
  supplier_id TEXT NOT NULL,
  sku TEXT NOT NULL,
  product_name TEXT NULL,
  category TEXT NULL,
  detected_membership_tiers JSONB NOT NULL DEFAULT '[]'::jsonb,
  costs_by_membership_tier JSONB NOT NULL DEFAULT '{}'::jsonb,
  msrp NUMERIC NULL,
  source_sheet TEXT NULL,
  source_tab TEXT NULL,
  source_row INTEGER NULL,
  source_version TEXT NULL,
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  extraction_status TEXT NULL,
  extraction_errors JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, supplier_id, sku)
);

CREATE TABLE IF NOT EXISTS supplier_assets_normalized (
  user_id TEXT NOT NULL,
  supplier_id TEXT NOT NULL,
  sku TEXT NOT NULL,
  label_template_url TEXT NULL,
  mockup_url TEXT NULL,
  supplement_facts_asset_url TEXT NULL,
  coa_url TEXT NULL,
  asset_status TEXT NOT NULL DEFAULT 'unknown',
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  extraction_status TEXT NULL,
  extraction_errors JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, supplier_id, sku)
);

CREATE TABLE IF NOT EXISTS supplier_source_sync_status (
  user_id TEXT NOT NULL,
  supplier_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  source_label TEXT NOT NULL,
  configured BOOLEAN NOT NULL DEFAULT false,
  fetchable BOOLEAN NOT NULL DEFAULT false,
  parsed BOOLEAN NOT NULL DEFAULT false,
  record_count INTEGER NOT NULL DEFAULT 0,
  sync_status TEXT NOT NULL DEFAULT 'never_synced',
  source_url TEXT NULL,
  fetch_url TEXT NULL,
  last_checked_at TIMESTAMPTZ NULL,
  last_successful_sync_at TIMESTAMPTZ NULL,
  last_error TEXT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, supplier_id, source_id)
);

CREATE TABLE IF NOT EXISTS supplier_source_sync_runs (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  supplier_id TEXT NOT NULL,
  requested_by TEXT NULL,
  trigger_kind TEXT NOT NULL DEFAULT 'manual',
  sync_status TEXT NOT NULL DEFAULT 'never_synced',
  products_parsed_count INTEGER NOT NULL DEFAULT 0,
  inventory_records_parsed_count INTEGER NOT NULL DEFAULT 0,
  pricing_records_parsed_count INTEGER NOT NULL DEFAULT 0,
  asset_records_parsed_count INTEGER NOT NULL DEFAULT 0,
  source_diagnostics JSONB NOT NULL DEFAULT '[]'::jsonb,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ NULL,
  last_error TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS supplier_source_sync_locks (
  user_id TEXT NOT NULL,
  supplier_id TEXT NOT NULL,
  lock_token TEXT NOT NULL,
  acquired_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (user_id, supplier_id)
);

CREATE INDEX IF NOT EXISTS idx_supplier_products_normalized_user_supplier_updated
  ON supplier_products_normalized(user_id, supplier_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_supplier_inventory_normalized_user_supplier_updated
  ON supplier_inventory_normalized(user_id, supplier_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_supplier_pricing_normalized_user_supplier_updated
  ON supplier_pricing_normalized(user_id, supplier_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_supplier_assets_normalized_user_supplier_updated
  ON supplier_assets_normalized(user_id, supplier_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_supplier_source_sync_runs_user_supplier_attempted
  ON supplier_source_sync_runs(user_id, supplier_id, attempted_at DESC);

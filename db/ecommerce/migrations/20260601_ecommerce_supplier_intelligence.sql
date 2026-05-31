-- Shared Ecommerce Supplier Intelligence Schema (Phase 4)
-- Target connection: ECOMMERCE_DATABASE_URL only

CREATE TABLE IF NOT EXISTS ecommerce_schema_migrations (
  id BIGSERIAL PRIMARY KEY,
  migration_name TEXT NOT NULL UNIQUE,
  migration_checksum TEXT NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ecommerce_suppliers (
  id TEXT PRIMARY KEY,
  supplier_slug TEXT NOT NULL UNIQUE,
  supplier_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  source_registry JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ecommerce_supplier_package_imports (
  id TEXT PRIMARY KEY,
  supplier_id TEXT NOT NULL REFERENCES ecommerce_suppliers(id) ON DELETE CASCADE,
  supplier_slug TEXT NOT NULL,
  package_policy_version TEXT,
  package_status TEXT NOT NULL,
  package_generated_at TIMESTAMPTZ NULL,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source_git_sha TEXT NULL,
  total_skus_discovered INTEGER NOT NULL DEFAULT 0,
  total_skus_validated INTEGER NOT NULL DEFAULT 0,
  usable_count INTEGER NOT NULL DEFAULT 0,
  usable_with_warnings_count INTEGER NOT NULL DEFAULT 0,
  blocked_count INTEGER NOT NULL DEFAULT 0,
  extraction_error_count INTEGER NOT NULL DEFAULT 0,
  ai_text_facts_coverage JSONB NOT NULL DEFAULT '{}'::jsonb,
  ocr_facts_coverage JSONB NOT NULL DEFAULT '{}'::jsonb,
  asset_coverage JSONB NOT NULL DEFAULT '{}'::jsonb,
  validation_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  artifact_manifest JSONB NOT NULL DEFAULT '{}'::jsonb,
  import_status TEXT NOT NULL DEFAULT 'completed',
  import_errors JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (supplier_slug, package_generated_at, package_policy_version)
);

CREATE TABLE IF NOT EXISTS ecommerce_supplier_products (
  id TEXT PRIMARY KEY,
  supplier_id TEXT NOT NULL REFERENCES ecommerce_suppliers(id) ON DELETE CASCADE,
  supplier_slug TEXT NOT NULL,
  sku TEXT NOT NULL,
  product_name TEXT NULL,
  category TEXT NULL,
  product_type TEXT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  validation_status TEXT NOT NULL,
  readiness JSONB NOT NULL DEFAULT '{}'::jsonb,
  missing_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  blocking_defects JSONB NOT NULL DEFAULT '[]'::jsonb,
  warning_defects JSONB NOT NULL DEFAULT '[]'::jsonb,
  source_notes JSONB NOT NULL DEFAULT '[]'::jsonb,
  package_import_id TEXT NOT NULL REFERENCES ecommerce_supplier_package_imports(id) ON DELETE RESTRICT,
  source_facts JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (supplier_slug, sku)
);

CREATE TABLE IF NOT EXISTS ecommerce_supplier_product_facts (
  id TEXT PRIMARY KEY,
  supplier_product_id TEXT NOT NULL REFERENCES ecommerce_supplier_products(id) ON DELETE CASCADE,
  supplier_slug TEXT NOT NULL,
  sku TEXT NOT NULL,
  product_name TEXT NULL,
  label_size TEXT NULL,
  container_size TEXT NULL,
  product_weight TEXT NULL,
  key_features JSONB NOT NULL DEFAULT '[]'::jsonb,
  dietary_attributes JSONB NOT NULL DEFAULT '[]'::jsonb,
  certifications JSONB NOT NULL DEFAULT '[]'::jsonb,
  manufacturing_claims JSONB NOT NULL DEFAULT '[]'::jsonb,
  supplement_facts JSONB NOT NULL DEFAULT '{}'::jsonb,
  directions TEXT NULL,
  warnings TEXT NULL,
  storage TEXT NULL,
  source_evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  extraction_methods JSONB NOT NULL DEFAULT '[]'::jsonb,
  needs_review BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (supplier_slug, sku)
);

CREATE TABLE IF NOT EXISTS ecommerce_supplier_pricing (
  id TEXT PRIMARY KEY,
  supplier_product_id TEXT NOT NULL REFERENCES ecommerce_supplier_products(id) ON DELETE CASCADE,
  supplier_slug TEXT NOT NULL,
  sku TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  pricing JSONB NOT NULL DEFAULT '{}'::jsonb,
  tiers JSONB NOT NULL DEFAULT '{}'::jsonb,
  moq INTEGER NULL,
  source_evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (supplier_slug, sku)
);

CREATE TABLE IF NOT EXISTS ecommerce_supplier_inventory (
  id TEXT PRIMARY KEY,
  supplier_product_id TEXT NOT NULL REFERENCES ecommerce_supplier_products(id) ON DELETE CASCADE,
  supplier_slug TEXT NOT NULL,
  sku TEXT NOT NULL,
  inventory_status TEXT NULL,
  inventory_raw TEXT NULL,
  replenishment_eta TEXT NULL,
  comments TEXT NULL,
  source_evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by_supplier_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (supplier_slug, sku)
);

CREATE TABLE IF NOT EXISTS ecommerce_supplier_assets (
  id TEXT PRIMARY KEY,
  supplier_product_id TEXT NOT NULL REFERENCES ecommerce_supplier_products(id) ON DELETE CASCADE,
  supplier_slug TEXT NOT NULL,
  sku TEXT NOT NULL,
  coa_url TEXT NULL,
  catalog_template_url TEXT NULL,
  label_template_ai_url TEXT NULL,
  mockup_template_tif_url TEXT NULL,
  assets JSONB NOT NULL DEFAULT '[]'::jsonb,
  asset_readiness JSONB NOT NULL DEFAULT '{}'::jsonb,
  remote_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ai_label_text_evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  ocr_evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  ready_for_optipixel BOOLEAN NOT NULL DEFAULT false,
  ready_for_channel_image_generation BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (supplier_slug, sku)
);

CREATE TABLE IF NOT EXISTS ecommerce_supplier_validation_results (
  id TEXT PRIMARY KEY,
  supplier_product_id TEXT NOT NULL REFERENCES ecommerce_supplier_products(id) ON DELETE CASCADE,
  supplier_slug TEXT NOT NULL,
  sku TEXT NOT NULL,
  validation_policy_version TEXT NULL,
  validation_status TEXT NOT NULL,
  package_status_at_import TEXT NOT NULL,
  blocking_defects JSONB NOT NULL DEFAULT '[]'::jsonb,
  warning_defects JSONB NOT NULL DEFAULT '[]'::jsonb,
  not_applicable_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  readiness JSONB NOT NULL DEFAULT '{}'::jsonb,
  coverage JSONB NOT NULL DEFAULT '{}'::jsonb,
  needs_review BOOLEAN NOT NULL DEFAULT false,
  validation_result JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (supplier_slug, sku)
);

CREATE INDEX IF NOT EXISTS idx_ecommerce_supplier_package_imports_supplier_slug
  ON ecommerce_supplier_package_imports (supplier_slug);

CREATE INDEX IF NOT EXISTS idx_ecommerce_supplier_products_supplier_slug
  ON ecommerce_supplier_products (supplier_slug);

CREATE INDEX IF NOT EXISTS idx_ecommerce_supplier_products_sku
  ON ecommerce_supplier_products (sku);

CREATE INDEX IF NOT EXISTS idx_ecommerce_supplier_products_validation_status
  ON ecommerce_supplier_products (validation_status);

CREATE INDEX IF NOT EXISTS idx_ecommerce_supplier_products_package_import_id
  ON ecommerce_supplier_products (package_import_id);

CREATE INDEX IF NOT EXISTS idx_ecommerce_supplier_assets_supplier_slug
  ON ecommerce_supplier_assets (supplier_slug);

CREATE INDEX IF NOT EXISTS idx_ecommerce_supplier_assets_ready_for_optipixel
  ON ecommerce_supplier_assets (ready_for_optipixel);

CREATE INDEX IF NOT EXISTS idx_ecommerce_supplier_assets_ready_for_channel_image_generation
  ON ecommerce_supplier_assets (ready_for_channel_image_generation);

CREATE INDEX IF NOT EXISTS idx_ecommerce_supplier_validation_results_supplier_slug
  ON ecommerce_supplier_validation_results (supplier_slug);

CREATE INDEX IF NOT EXISTS idx_ecommerce_supplier_validation_results_validation_status
  ON ecommerce_supplier_validation_results (validation_status);

CREATE INDEX IF NOT EXISTS idx_ecommerce_supplier_product_facts_source_evidence_gin
  ON ecommerce_supplier_product_facts USING gin (source_evidence);

CREATE INDEX IF NOT EXISTS idx_ecommerce_supplier_assets_remote_metadata_gin
  ON ecommerce_supplier_assets USING gin (remote_metadata);

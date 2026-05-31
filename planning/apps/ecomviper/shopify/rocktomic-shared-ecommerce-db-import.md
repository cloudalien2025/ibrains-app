# Rocktomic Shared Ecommerce DB Import (Phase 4)

Last updated: 2026-05-31 (UTC)

## Purpose

Phase 4 introduces the first shared ecommerce supplier-intelligence schema and imports the generated Rocktomic offline package into the shared ecommerce DB.

Target database:

- `ibrains-ecommerce-prod-postgres`
- connection: `ECOMMERCE_DATABASE_URL` only

## Scope Boundary (Phase 4)

Included:

- shared ecommerce supplier schema (`ecommerce_supplier_*`)
- ecommerce-only migration runner
- Rocktomic package importer with idempotent upserts
- read-only verification script for counts/status parity
- persistence of validation status, readiness, defects, and evidence payloads

Not included:

- Product Editor runtime binding changes
- Generate Intelligence runtime binding changes
- OptiPixel runtime UI
- admin write/import buttons
- runtime route extraction/fetch/sync side effects
- use of `ecomviper-prod-postgres`

## Schema

Migration root:

- `db/ecommerce/migrations/`

Primary migration:

- `db/ecommerce/migrations/20260601_ecommerce_supplier_intelligence.sql`

Tables:

- `ecommerce_suppliers`
- `ecommerce_supplier_package_imports`
- `ecommerce_supplier_products`
- `ecommerce_supplier_product_facts`
- `ecommerce_supplier_pricing`
- `ecommerce_supplier_inventory`
- `ecommerce_supplier_assets`
- `ecommerce_supplier_validation_results`

## Import Inputs

Artifacts read from:

- `data/ecomviper/suppliers/rocktomic/sources.json`
- `data/ecomviper/suppliers/rocktomic/latest/sourceFacts.json`
- `data/ecomviper/suppliers/rocktomic/latest/pricing.json`
- `data/ecomviper/suppliers/rocktomic/latest/inventory.json`
- `data/ecomviper/suppliers/rocktomic/latest/assets.json`
- `data/ecomviper/suppliers/rocktomic/latest/validation-report.json`
- `data/ecomviper/suppliers/rocktomic/latest/catalog-link-evidence.json`
- `data/ecomviper/suppliers/rocktomic/latest/template-asset-evidence.json`
- `data/ecomviper/suppliers/rocktomic/latest/ai-label-text-evidence.json`
- `data/ecomviper/suppliers/rocktomic/latest/ocr-evidence.json`

Import behavior:

- imports all SKUs, including `blocked` and `extraction_error`
- preserves per-SKU validation status/readiness/defects
- preserves package-level status/counters and artifact manifest
- preserves AI/OCR evidence payloads and remote asset metadata
- stores remote `.ai`/`.tif` URLs/metadata only (no large binary storage)

## Scripts

Migration:

- `scripts/ecommerce/migrate.ts`
- command: `npm run ecommerce:migrate`

Import:

- `scripts/ecomviper/import_rocktomic_supplier_package.ts`
- command: `npm run ecomviper:import-rocktomic-supplier-package`

Verify:

- `scripts/ecommerce/verify_rocktomic_supplier_import.ts`
- command: `npm run ecommerce:verify-rocktomic-import`

## Idempotency and Safety

- Migrations are tracked by `ecommerce_schema_migrations` and checksum-validated.
- Import uses upserts and stable deterministic row IDs.
- Verification is read-only.
- No fallback to `DATABASE_URL`.
- No route-level execution from app/admin render.

## Downstream Guardrail

Blocked SKUs are persisted for audit/review and future workflow control, but they are not to be consumed as usable by downstream apps in this phase.

## Forward Phases

- Phase 5: bind Product Editor read-only supplier facts from shared ecommerce DB.
- Phase 6: bind Generate Intelligence to shared supplier intelligence.
- Future OptiPixel phase: consume `ecommerce_supplier_assets` + remote asset metadata for image intelligence workflows.

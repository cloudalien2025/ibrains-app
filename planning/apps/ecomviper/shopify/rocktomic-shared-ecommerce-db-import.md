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

## Phase 4.1 Operational Closure (2026-05-31 UTC)

Live execution status:

- deployment health confirmed before DB work:
  - `/api/meta/release`: `git_sha=022a10e09c294b0a288d78375d77f26d90866246`, `build_id=2565676178`
  - `/api/health`: `200`
  - `RUN_DETAILED_SMOKE=1 scripts/production_smoke_check.sh app.ibrains.ai`: pass

Target DB safety checks:

- `ECOMMERCE_DATABASE_URL` confirmed present in operator env and masked target resolved to:
  - `ibrains-ecommerce-prod-postgres-do-user-...g.db.ondigitalocean.com`
- explicit checks confirmed:
  - contains `ibrains-ecommerce`: `true`
  - contains `ecomviper-prod-postgres`: `false`
  - contains `ibrains-postgres`: `false`
- `npm run ecommerce:check-db` required an SSL compatibility query param in this runtime:
  - `&uselibpqcompat=true`
  - result: connection success

Backup/restore safety note:

- direct DigitalOcean backup tooling (`doctl`) was not available in this runner.
- pre-migration DB inventory showed `public` table count `0` (new/empty schema state), so migration/import proceeded as low-risk initialization.

Migration/import/verify results (live):

1. `npm run ecommerce:migrate`:
   - first run: `applied=1` (`20260601_ecommerce_supplier_intelligence.sql`)
   - subsequent run: `applied=0`, `skipped=1` (idempotent)
2. `npm run ecomviper:import-rocktomic-supplier-package`:
   - import id: `eimp_a246e1869b30f19a3abf6424`
   - package status: `fail`
   - skus: `164`
   - usable: `60`
   - usable_with_warnings: `5`
   - blocked: `99`
   - extraction_error: `0`
   - rows: `product_facts=164 pricing=164 inventory=164 assets=164 validation=164 skipped=0 errored=0`
3. `npm run ecommerce:verify-rocktomic-import`:
   - expected counts matched actual counts
   - blocked/usable/usable_with_warnings statuses distinguished correctly
   - coverage query summary: `ai_label_text_evidence=147`, `ocr_evidence=0`, `ready_for_optipixel=147`

Idempotency check:

- import re-run completed with stable row counts.
- duplicate checks by `COUNT(*)` vs `COUNT(DISTINCT sku)` for each supplier table matched (`164` each).
- `ecommerce_supplier_package_imports` remained `1` row for `rocktomic` under the unique package key.

Live defect discovered/fixed during Phase 4.1:

- first live import attempt failed with `unsupported Unicode escape sequence` from payload content.
- narrow fix applied:
  - sanitize null-byte characters in mapped strings (`lib/ecommerce/rocktomic-package-import.ts`)
  - sanitize JSONB payloads recursively before insert/upsert (`lib/ecommerce/rocktomic-import-runner.ts`)
  - regression test added: `tests/ecommerce_phase4_null_byte_sanitization.test.ts`

Offline package rebuild timeout follow-up:

- rerun with extended timeout:
  - `timeout 600 npm run ecomviper:build-rocktomic-supplier-data`
  - still timed out at `600.01s` after source enumeration stage
- closure proceeded using existing latest artifacts generated at `2026-05-31T18:42:26Z` and matching expected Phase 3.6 counts/policy.

## Phase 4.2 Reliability Dependency

Phase 4.2 does not change DB schema/import contracts. It hardens the upstream offline package build lane so future refresh imports are reliable.

Key dependency updates:

- builder now emits `latest/build-timing-report.json` and `latest/build-cache-summary.json`
- failed builds keep diagnostics under `data/ecomviper/suppliers/rocktomic/builds/<buildId>/` without overwriting `latest`
- incremental AI extraction reuses unchanged metadata/evidence to reduce refresh time before re-import

Import boundary is unchanged:

- `ECOMMERCE_DATABASE_URL` only for migrate/import/verify
- no runtime route import/extraction
- no Product Editor/Generate Intelligence binding in this phase

## Phase 4.3 Compatibility Update

Phase 4.3 updates package readiness semantics and importer payload content without changing table families.

Import now preserves calibrated readiness JSON that includes use-case-specific statuses:

- `ingredientMatchingReadiness`
- `productEditorFactsReadiness`
- `complianceEvidenceReadiness`
- `optiPixelAssetReadiness`
- channel and downstream readiness dimensions

Operational note:

- missing COA is persisted as warning/compliance-evidence defect and does not block ingredient-matching readiness by itself.
- blocked SKUs remain persisted for review and are still non-usable for downstream runtime binding until Phase 5+ gates.

## Phase 5 Runtime Read Binding Note

Phase 5 is the first merchant-facing read path that consumes these imported rows in Shopify Product Editor.

Usage constraints:

- read-only shared DB queries only
- no import/sync/migration triggers from Product Editor route
- Product Editor uses readiness dimensions from imported JSON payloads:
  - `ingredientMatchingReadiness`
  - `productEditorFactsReadiness`
  - `complianceEvidenceReadiness`

Operational semantics:

- missing COA remains compliance warning and does not block ingredient matching in Product Editor
- missing pricing remains pricing readiness warning and does not block ingredient matching in Product Editor

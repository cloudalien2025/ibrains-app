# EcomViper Supplier Ingestion Architecture (Stabilization)

Last updated: 2026-06-01 (UTC)

## Objective

Keep supplier ingestion as internal/background intelligence only and prevent origin saturation or route blocking.

## Ingestion Safety Rules

1. Shopify remains listing source of truth.
2. Supplier ingestion is supplemental and internal-only.
3. Normal route loads must use cached/stale-safe snapshots.
4. Cold-cache request paths can return seed fallback diagnostics instead of blocking.
5. Fetch timeouts are mandatory.
6. Payload-size limits are mandatory.
7. Errors must be redacted and bounded.
8. Duplicate in-flight refreshes must be deduped.

## Current Runtime Protections

### Timeouts
- Source fetch timeout: `12_000ms`.

### Payload Limits
- Max text payload (CSV/export): `4MB`.
- Max binary payload (default): `8MB`.
- Trusted Rocktomic catalog PDF (`https://rocktomicplatform.blob.core.windows.net/client-resources/Supplement-&-Apparel-Catalog.pdf`) sync cap: `32MB`.
- Oversize payloads are rejected with safe diagnostics.

### Dedupe / Anti-Storm
- Per-cache-key single-flight (`inFlightByCacheKey`).
- Per-URL fetch dedupe during a refresh pass.

### Stale Safety
- Fresh cache returns immediately.
- Stale cache returns immediately and can refresh in background.
- Cache-only mode returns without synchronous refresh.

### No-Source Fallback
- When refresh is disabled and cache is absent:
  - return seed fallback snapshot,
  - mark diagnostics as deferred/scheduled,
  - keep route render non-blocking.

## Diagnostics Contract

Snapshot includes route-facing diagnostics fields:

- `cacheState`: `fresh | stale | seed_fallback`
- `refreshState`: `idle | refreshing`
- per-source:
  - `configured`
  - `fetchable`
  - `parsed`
  - `recordCount`
  - `lastError` (redacted)

## Background Refresh Policy

Use background refresh only from explicit operator refresh or background job paths, not normal dashboard navigation.
Product editor, PDP generation, settings diagnostics, and Rocktomic diagnostics route run in cache-only mode by default.

Current expected modes:

1. `/ecomviper`, `/ecomviper/settings`, `/ecomviper/dropshipping/rocktomic`, PDP generation, product editor:
   - `allowRefresh: false`
   - `triggerBackgroundRefresh: false`

## Data Integrity Constraints

1. Unknown fields remain unknown (no invented values).
2. Inventory quantity is never fabricated.
3. Membership pricing is source-derived only.
4. COA and supplement facts remain source-backed only.
5. SKU mapping rules must be generic and deterministic across all synced SKUs; no SKU-specific branching.

## Stabilization 009.6 Normalized Pipeline

Supplier ingestion now has an explicit durable pipeline:

1. Source sync trigger (`POST /api/ecomviper/supplier-sources/sync` or `scripts/ecomviper_sync_supplier_sources.sh`)
2. Bounded fetch + parse during sync only
3. Normalization/persistence in:
   - `supplier_products_normalized`
   - `supplier_inventory_normalized`
   - `supplier_pricing_normalized`
   - `supplier_assets_normalized`
4. Route reads from normalized snapshot only (`allowRefresh: false`, `triggerBackgroundRefresh: false`)
5. Product Editor + PDP generation consume normalized facts and show explicit sync-required diagnostics when missing

`/ecomviper`, `/ecomviper/settings`, `/ecomviper/dropshipping/rocktomic`, Product Editor, and PDP generation remain forbidden from triggering live source downloads/parsing during page render.

## Hotfix 009.8 Global Supplier Data Boundary

Normalized supplier intelligence is platform-managed global data. The durable normalized tables still carry the legacy `user_id` scope column, but supplier sync and route reads treat `__global__` as the only valid platform supplier scope for Rocktomic records.

Global supplier data:

- `supplier_products_normalized`
- `supplier_inventory_normalized`
- `supplier_pricing_normalized`
- `supplier_assets_normalized`
- `supplier_source_sync_status`
- `supplier_source_sync_runs`
- `supplier_source_sync_locks`

Merchant/workspace data remains signed-in-user scoped:

- Shopify connection and imported Shopify products
- selected supplier membership tier
- saved PDP intelligence
- marketplace/buy-now/publish settings

Repository boundary:

- global supplier reads use `lib/ecomviper/suppliers/global-supplier-data.ts`
- merchant tier settings use `getMerchantSupplierMembershipTier` / `setMerchantSupplierMembershipTier`
- normal page render uses normalized records only and passes `includeSeedFallbackProducts: false` where SKU matching is product-facing
- product-facing cache-only reads prefer the persisted normalized snapshot before any process-local in-memory supplier snapshot, so Product Editor and Generate Intelligence do not serve stale supplier facts after a sync

Authenticated merchants may view global supplier diagnostics after auth, but supplier records are not public. Source sync runs as a platform/global sync and persists under `__global__`; it no longer creates merchant-specific supplier rows for normal operation.

Hotfix 009.9 COA + extraction policy:

- Per-SKU COA URL extraction from catalog row hyperlink is the active required path.
- COA repository feed is optional and not in the critical path for Product Editor/PDP binding.
- Missing text-layer supplement facts on a matched SKU should resolve to `ocr_required` state, not generic `unknown`.

## Admin Foundation V1 Boundary (2026-05-31)

Internal supplier operations now have a dedicated admin route family under `/admin/ecomviper/...`.

Admin render paths are read-only and may query normalized tables/status rows only. They must not trigger:

- source sync execution
- source downloads
- OCR/extraction
- OpenAI calls
- long-running parsing during request render

If normalized rows are missing, admin should show missing/partial diagnostics instead of running extraction live.

## Rocktomic Offline Package Phase 1 (All-SKU Audit)

Phase 1 introduces an offline-only supplier package builder and does not alter runtime app behavior.

Offline package root:

- `data/ecomviper/suppliers/rocktomic/`
  - `sources.json`
  - `latest/sourceFacts.json`
  - `latest/pricing.json`
  - `latest/inventory.json`
  - `latest/assets.json`
  - `latest/audit.csv`
  - `latest/validation-report.json`

Builder entrypoint:

- `scripts/ecomviper/build_rocktomic_supplier_data.ts`
- manual run command: `npm run ecomviper:build-rocktomic-supplier-data`

Phase 1 rules:

1. Source fetching/parsing is CLI-only and must not run from app routes/components.
2. Package output is review-oriented and includes explicit missing/defect fields per SKU.
3. Missing source values must not be silently collapsed into final `Unknown` source facts.
4. `validation-report.json` is informational in Phase 1 (coverage + defects), not a blocking production gate.
5. No Product Editor, Generate Intelligence, admin UI, background worker, sync-button, or DB-import behavior changes are introduced in this phase.

## Shared Ecommerce Database Foundation (Phase 1.5)

- Supplier ingestion persistence is ecommerce-platform data and is intended to converge on `ECOMMERCE_DATABASE_URL` via explicit future migration/binding phases.
- `DATABASE_URL` remains the core iBrains platform DB boundary and is not replaced in this phase.
- `ibrains-ecommerce-prod-postgres` is the target shared ecommerce database.
- `ecomviper-prod-postgres` is legacy/deprecated and ignored for forward architecture unless future explicit recovery scope says otherwise.
- Phase 1.5 performs no production data migration, no schema migration, and no runtime supplier-ingestion DB switch.

## Rocktomic Validation Policy (Phase 2)

Phase 2 upgrades the offline package from informational defects to a formal validation contract.

Policy outputs now include:

- blocking vs warning defect classification
- SKU status (`usable`, `usable_with_warnings`, `blocked`, `not_applicable`, `extraction_error`)
- package status (`pass`, `pass_with_warnings`, `fail`)
- downstream readiness flags in offline artifacts only

Phase 2 still does not:

- import supplier data into shared ecommerce DB
- change Product Editor / Generate Intelligence runtime behavior
- add admin validation UI, sync buttons, or workers
- execute validation in render paths or app startup

Detailed policy contract:

- `planning/apps/ecomviper/shopify/rocktomic-validation-policy.md`

## Rocktomic Admin Audit Visibility (Phase 3)

Phase 3 adds a read-only operator surface for the offline package and validation artifacts:

- route: `/admin/ecomviper/suppliers/rocktomic/audit`
- reader: `lib/ecomviper/suppliers/rocktomic-admin-audit.ts`

Phase 3 guarantees:

1. no source download/parsing during admin render
2. no extraction/validation execution side effect in render path
3. no DB import/migration
4. no Product Editor/Generate Intelligence binding changes
5. no sync button/worker additions

Detailed Phase 3 contract:

- `planning/apps/ecomviper/shopify/rocktomic-admin-audit-visibility.md`

## Rocktomic Asset + OCR Remediation (Phase 3.5)

Phase 3.5 extends the offline builder only and keeps runtime ingestion boundaries unchanged.

Added offline extraction layers:

1. Catalog PDF annotation evidence extraction (page/rect/URL/near-text classification).
2. Templates-page per-SKU `.ai` and `.tif` extraction.
3. OCR evidence parsing contract for supplement-facts panels (fixture-safe parser + confidence/review flags).

New offline artifacts:

- `latest/catalog-link-evidence.json`
- `latest/template-asset-evidence.json`
- `latest/ocr-evidence.json`

Phase 3.5 guarantees:

- no render-path extraction/OCR
- no admin-triggered extraction side effects
- no DB import/migration
- no Product Editor/Generate Intelligence/channel runtime behavior switch

Detailed Phase 3.5 contract:

- `planning/apps/ecomviper/shopify/rocktomic-asset-ocr-remediation.md`

## Rocktomic AI Label Text Extraction (Phase 3.6)

Phase 3.6 keeps ingestion runtime boundaries unchanged and upgrades only offline package extraction:

1. `.ai` label templates are primary supplement-facts extraction source when PDF-compatible.
2. OCR is fallback-only when AI extraction is unavailable/fails.
3. Remote metadata (`ETag`, `Last-Modified`, `Content-Length`, `Content-Type`, template-page `Last Updated`) is tracked for freshness/change detection.
4. Large `.ai`/`.tif` binaries are never persisted in repo/runtime storage; only derived evidence/facts/metadata are stored.

New artifact:

- `latest/ai-label-text-evidence.json`

## Firecrawl Supplier Intelligence Extractor Foundation (Phase 6.3)

Phase 6.3 establishes Firecrawl-backed supplier-source acquisition as the upstream foundation for normalized supplier facts.

Architecture path:

1. Rocktomic supplier source manifest (`data/ecomviper/suppliers/rocktomic/sources.json`)
2. Firecrawl wrapper (`lib/ecomviper/suppliers/firecrawl/firecrawl-client.ts`) in fixture/cache/live modes
3. Rocktomic normalized extractor (`lib/ecomviper/suppliers/rocktomic/firecrawl-supplier-intelligence.ts`)
4. normalized package + validation artifacts (candidate directory writes only)
5. downstream read-model consumers (Product Editor + Generate Intelligence)

Phase 6.3 guardrails:

- `FIRECRAWL_API_KEY` is env-driven only
- deterministic local cache key: `url + mode + schema hash`
- tests run without a live Firecrawl key via fixture mode
- no unbounded crawling, no render-path extraction, no DB writes/imports
- no default OCR path; OCR remains fallback-only outside this foundation scope

Output boundaries:

- generated package remains candidate-only (`data/ecomviper/suppliers/rocktomic/candidates/<timestamp>/`)
- no promotion to `latest/` in this phase
- no Product Editor auto-save/publish behavior change
- no duplicate `/ecomviper/shopify/products/[productId-or-handle]` route restoration

## Product Editor Shared DB Read Binding (Phase 5)

Phase 5 adds read-only supplier facts visibility in Shopify Product Editor from shared ecommerce DB rows.

Route contract after Phase 5.1 cleanup:

- canonical merchant-facing Product Editor route for all products/SKUs:
  - `/ecomviper/products/[productId-or-handle]`
- removed mistaken duplicate route family:
  - `/ecomviper/shopify/products/[productId-or-handle]`

Runtime constraints remain strict:

- Product Editor render must not fetch supplier source URLs.
- Product Editor render must not run extraction/OCR/AI label extraction.
- Product Editor render must not run supplier import/migration logic.
- Product Editor supplier facts should degrade to unavailable-state UI on DB/env/query failure.

Readiness semantics in Product Editor:

- ingredient matching uses `ingredientMatchingReadiness`
- source-facts quality uses `productEditorFactsReadiness`
- missing COA remains compliance warning, not ingredient blocker
- missing pricing remains pricing warning, not ingredient blocker

Phase 3.6 guarantees:

- no render-path extraction/OCR
- no admin render extraction side effects
- no DB import/migration
- no runtime Product Editor/Generate Intelligence/channel behavior switch

Detailed Phase 3.6 contract:

- `planning/apps/ecomviper/shopify/rocktomic-ai-label-text-extraction.md`

## Shared Ecommerce DB Import (Phase 4)

Phase 4 adds an explicit offline-to-DB import lane for Rocktomic supplier package artifacts.

Scope:

1. Apply ecommerce schema migrations using `ECOMMERCE_DATABASE_URL` only.
2. Import package artifacts from `data/ecomviper/suppliers/rocktomic/latest/*` into `ecommerce_supplier_*` tables.
3. Preserve SKU validation status/readiness/defects for all SKUs, including blocked SKUs.
4. Verify import/readback counts and status parity against `validation-report.json`.

Safety:

- import is explicit CLI/script execution only
- no route-render import/extraction side effects
- no Product Editor/Generate Intelligence runtime binding switch in this phase
- no admin-triggered import action in this phase

Detailed Phase 4 contract:

- `planning/apps/ecomviper/shopify/rocktomic-shared-ecommerce-db-import.md`

## Phase 4.2 Offline Builder Reliability Layer

Before Phase 5 binding work, the offline Rocktomic package builder is hardened for deterministic operator execution:

1. stage-level timing with machine-readable report (`latest/build-timing-report.json`)
2. configurable stage/total/network timeout budgets
3. bounded remote concurrency (`ROCKTOMIC_BUILD_ASSET_CONCURRENCY`)
4. incremental freshness reuse for unchanged AI/template evidence
5. atomic promote from `builds/<buildId>` to `latest/`
6. failure diagnostics preserved without corrupting current `latest` package

Control flags:

- `ROCKTOMIC_BUILD_AI_EXTRACTION_MODE=incremental|force|skip`
- `ROCKTOMIC_BUILD_FORCE_REFRESH=1`
- `ROCKTOMIC_BUILD_SKIP_AI_EXTRACTION=1`
- `ROCKTOMIC_BUILD_DRY_RUN=1`

Runtime boundaries remain unchanged: no route-render extraction/fetch, no sync workers, no Product Editor/Generate Intelligence runtime switch in Phase 4.2.

## Rocktomic Validation Calibration (Phase 4.3)

Phase 4.3 refines how package validation maps to downstream readiness:

1. Missing COA is a compliance-evidence warning/defect, not an ingredient-matching global blocker.
2. Ingredient matching readiness is driven by identity + usable supplement/ingredient facts.
3. Product Editor facts readiness is separated from compliance evidence readiness.
4. OptiPixel asset readiness remains independent from ingredient matching readiness.

Phase 4.3 remains offline/admin/import-lane only:

- no runtime route extraction/sync changes
- no Product Editor/Generate Intelligence runtime switch
- no admin-triggered build/import actions

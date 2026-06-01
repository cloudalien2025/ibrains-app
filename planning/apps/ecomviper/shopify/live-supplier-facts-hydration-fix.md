# Live Supplier Facts Hydration Fix (Phase 6.2.2-D)

Last updated: 2026-06-01 (UTC)

## Status

- State: `IMPLEMENTED_ONLY`
- Branch: `sprint-6-2-2-d-live-supplier-facts-hydration`
- Scope: live Generate Intelligence supplier-facts hydration correctness (server route path)

## Root Cause Found

Live Generate Intelligence requests could still degrade to `image_only` when structured facts were available because the live route accepted degraded editor-state facts without a mandatory server-side supplier-facts rehydration step.

In this degraded path:

- snapshot lane (`supplierContext.product`) could remain matched but only image/`ocr_required` level facts
- DB-backed structured facts were not always re-applied before copywriting input build
- trace could show matched SKU + `image_only` + zero ingredient counts

## Hydration Gap

The gap was in the live route input preparation path:

- route built copywriting input from editor state as-is
- no explicit DB-by-SKU rehydration fallback gate before generation
- no explicit read-source diagnostics (`db`/`artifact`/`none`/`failed`) in route trace metadata

## Layers Changed

- `app/api/ecomviper/pdp-intelligence/route.ts`
  - added server-side supplier facts hydration call before input build
  - added compact trace diagnostics:
    - `supplierFactsReadSource`
    - `supplierFactsReadFound`
    - `supplierFactsReadErrorCode`
  - removed `userId` from input trace payload
- `lib/ecomviper/copywriting-agent/live-supplier-facts-hydration.ts` (new)
  - DB-first SKU rehydration (`ecommerce_supplier_*`)
  - read-only artifact fallback (`data/ecomviper/suppliers/rocktomic/latest/*`)
  - merges hydrated structured facts into supplier panel projection used by live input builder
- `lib/ecommerce/supplier-facts-read.ts`
  - added snake_case supplement-facts key support (`active_ingredients`, `amount_per_serving`, `serving_size`, `servings_per_container`, `other_ingredients`)
- `scripts/ecomviper/live_supplier_facts_parity_check.ts` (new)
  - CLI parity check comparing offline prepare input vs simulated degraded live-route builder path (no OpenAI call)
- `tests/ecomviper_live_supplier_facts_hydration.test.ts` (new)
- updated tests:
  - `tests/ecomviper_generate_intelligence_copywriting_action.test.ts`
  - `tests/ecommerce_supplier_facts_read.test.ts`

## Trace Before/After (ROC123, Local Route Path)

### Before (baseline from production traces)

- `supplementFactsSource=image_only`
- `structuredSupplementFactsPresent=false`
- `counts.activeIngredients=0`
- `counts.ingredientAmounts=0`
- `missingData.ingredientFactsMissing=true`
- `missingData.ingredientAmountsMissing=true`
- `missingData.supplementFactsImageOnly=true`

### After (local route tests + parity checker)

- server hydration executes before input build
- route diagnostics now emit read source/found/error code
- in DB-hydrated route test fixture:
  - `supplementFactsSource=db`
  - `structuredSupplementFactsPresent=true`
  - `counts.activeIngredients>0`
  - `counts.ingredientAmounts>0`
  - `missingData.ingredientFactsMissing=false`
  - `missingData.ingredientAmountsMissing=false`
  - `missingData.supplementFactsImageOnly=false`

## All-Product Dry-Run Validation

- `npm run ecomviper:copywriting-agent:prepare -- --all --dry-run`
  - `supplementFactsMissing=16`
  - `coaMissing=40`
  - `pricingMissing=22`
  - `inventoryMissing=38`
- `npm run ecomviper:copywriting-agent:evaluate -- --all --dry-run`
  - no regressions to historical `supplementFactsMissing=164`

## Safety Boundary Confirmation

- no auto-save
- no auto-publish
- no model call during page render
- no DB schema migrations
- no supplier table writes/import
- no OCR run
- no `.ai` extraction run
- no live source fetching during Product Editor generation
- no duplicate `/ecomviper/shopify/products/[productId-or-handle]` route restoration
- no ROC123 hardcoding

## QA / Deployment State

- Local implementation + focused tests complete.
- Production merge/deploy, signed-in browser QA, and production trace verification are still pending in this branch checkpoint.

## Phase 6.2.2-E Addendum (Per-SKU Hydration + Compliance)

- state: `IMPLEMENTED_ONLY`
- branch: `sprint-6-2-2-e-hydration-compliance-fix`

Hydration-focused updates:

- added explicit hydration read diagnostics in `live-supplier-facts-hydration.ts`:
  - `readDiagnostics.db.{attempted,found,errorCode}`
  - `readDiagnostics.artifact.{attempted,found,errorCode}`
- expanded artifact AI label evidence loader compatibility:
  - supports both `{ records: [...] }` and raw array payload shapes
- updated live input `sourceFactsUsed` projection to effective merged fact state (`present/missing`) so traces do not misreport stale `ocr_required` statuses after hydration
- parity CLI now reports:
  - DB/artifact read status
  - AI label text status
  - facts image status
  - serving/servings presence
  - explicit `imageOnlyReason` when applicable
  - compare mode: `--compare-sku`

Local parity snapshot (no production DB in this runner):

- ROC123: DB not found, artifact found, structured facts present, ingredient amounts present, serving fields missing.
- ROC948: DB not found, artifact found, structured facts present, ingredient amounts present, serving fields present.

Boundary confirmation remains unchanged:

- no auto-save/publish
- no model call during page render
- no supplier writes/import/migrations
- no OCR/.ai extraction/live-source fetch in Product Editor generate path
- no duplicate route restoration

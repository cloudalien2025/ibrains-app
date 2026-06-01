# Per-SKU Hydration and Compliance Fix (Phase 6.2.2-E)

Last updated: 2026-06-01 (UTC)

## Status

- State: `IMPLEMENTED_ONLY`
- Branch: `sprint-6-2-2-e-hydration-compliance-fix`
- MR/deploy/signed-in production QA: pending

## Scope

Fix two live failure classes found after Phase 6.2.2-D:

1. per-SKU supplier-facts hydration parity gaps (ROC123 class),
2. compliance false blocks for source-backed ingredient highlights (ROC948 class).

## Root Cause Summary

### ROC123 image-only/hydration gap class

- Live trace interpretation was obscured by stale status projection (`sourceFactsUsed` could stay `ocr_required` even when hydrated facts were present).
- Hydration read-source diagnostics were too coarse for parity triage.
- Artifact AI label evidence format tolerance was narrow (`records[]` only), increasing fallback fragility across package/runtime shape differences.

### ROC948 compliance false-block class

- `invented ingredient highlight` validation used naive full-string matching against raw supplement arrays.
- It did not robustly normalize ingredient names/amounts.
- It did not accept ingredient evidence from product title/supplier product name.
- This could block safe source-backed lines (for example title-backed L-Arginine/Citrulline phrasing).

## Layers Changed

- `lib/ecomviper/copywriting-agent/copywriting-agent-evals.ts`
  - added normalized ingredient highlight evidence matching
  - added amount token validation for dosage claims
  - added `removeUnsupportedIngredientHighlights(...)` repair helper
- `lib/ecomviper/copywriting-agent/copywriting-agent-runner.ts`
  - repairs/removes unsupported ingredient highlights before final evaluation response
  - keeps strict blocking for prohibited disease/treatment/cure/drug-comparison and fake-fact patterns
- `lib/ecomviper/copywriting-agent/copywriting-agent-input-builder.ts`
  - `sourceFactsUsed` now summarizes effective merged facts state (present/missing) instead of stale source status tags
  - supplement-facts source inference now uses evidence/source-method-aware mapping
- `lib/ecomviper/copywriting-agent/live-supplier-facts-hydration.ts`
  - added `readDiagnostics` (db/artifact attempted/found/errorCode) in hydration result
  - artifact AI label cache loader now supports both `{ records: [...] }` and raw array payload shapes
- `scripts/ecomviper/live_supplier_facts_parity_check.ts`
  - added expanded parity output:
    - DB/artifact read status
    - AI label text status
    - facts image status
    - serving presence flags
    - explicit `imageOnlyReason`
  - added compare mode: `--compare-sku`
- `package.json`
  - added `ecomviper:live-supplier-facts:compare`

## Local Before/After (Parity CLI)

Commands:

- `npm run ecomviper:live-supplier-facts:parity -- --sku ROC123`
- `npm run ecomviper:live-supplier-facts:parity -- --sku ROC948`
- `npm run ecomviper:live-supplier-facts:compare -- --sku ROC123 --compare-sku ROC948`

Observed local outcome:

- ROC123:
  - `supplementFactsSource=ai_label_text`
  - `structuredSupplementFactsPresent=true`
  - `activeIngredients=1`, `ingredientAmounts=4`
  - `servingSizePresent=false`, `servingsPerContainerPresent=false`
  - `dbReadStatus: attempted=true, found=false`
  - `artifactReadStatus: attempted=true, found=true`
- ROC948:
  - `supplementFactsSource=ai_label_text`
  - `structuredSupplementFactsPresent=true`
  - `activeIngredients=4`, `ingredientAmounts=3`
  - `servingSizePresent=true`, `servingsPerContainerPresent=true`
  - `dbReadStatus: attempted=true, found=false`
  - `artifactReadStatus: attempted=true, found=true`

## Compliance Outcome (Local)

Validated with focused runner/eval tests:

- source-backed title/supplement ingredient highlights are accepted
- unsupported ingredient/dosage highlights are repaired/removed (proposal can still succeed)
- prohibited disease/treatment/cure/drug-comparison language still blocks
- fake COA/pricing/inventory/supplier-match claims still block

## Dry-Run Coverage

- `npm run ecomviper:copywriting-agent:prepare -- --fixtures --dry-run`:
  - `coaMissing=3`, `pricingMissing=1`, `supplementFactsMissing=1`
- `npm run ecomviper:copywriting-agent:evaluate -- --fixtures --dry-run`:
  - `evaluated=2`, `passed=2`, `failed=0`
- `npm run ecomviper:copywriting-agent:prepare -- --all --dry-run`:
  - `coaMissing=40`, `pricingMissing=22`, `inventoryMissing=38`, `supplementFactsMissing=16`
- `npm run ecomviper:copywriting-agent:evaluate -- --all --dry-run`:
  - `selected=164`, `missingOutput=164` (expected harness behavior when no generated outputs are provided in dry-run)

## Safety/Boundary Confirmation

- no auto-save
- no auto-publish
- no model call during page render
- no supplier DB writes/import/migrations
- no OCR run / no `.ai` extraction run / no live source fetch in Product Editor generation
- no SKU/handle hardcoding
- no duplicate `/ecomviper/shopify/products/[productId-or-handle]` route restoration

## Remaining Required Verification

Production delivery and browser QA remain pending:

- merge + green MR pipeline
- main deploy verification (`/api/meta/release`, `/api/health`)
- signed-in browser Generate Intelligence checks for ROC123 + ROC948 routes
- production log trace confirmation that ROC123 and ROC948 meet expected live trace outcomes

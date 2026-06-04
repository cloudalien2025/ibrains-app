# Product Editor Supplier Facts Binding (Phase 5)

Last updated: 2026-06-01 (UTC)

## Purpose

Phase 5 binds Shopify Product Editor to shared ecommerce supplier facts as a read-only surface.

Target runtime surface:

- `/ecomviper/products/[productId-or-handle]` (canonical merchant-facing Product Editor route for all products/SKUs)

Data source:

- shared ecommerce DB (`ecommerce_supplier_*`) through `ECOMMERCE_DATABASE_URL`

## Scope Boundary

Included:

- server-only supplier facts read model for Product Editor
- deterministic supplier matching (SKU-first, conservative candidate fallback)
- read-only Supplier Source Facts panel in Shopify Product Editor
- use-case readiness mapping in Product Editor UI

Not included:

- Generate Intelligence binding
- OptiPixel UI
- supplier import/sync/build controls in Product Editor
- supplier data writeback to Shopify
- route render extraction/OCR/AI-label processing

## Matching Contract

Matching priority:

1. exact SKU match
2. normalized SKU match
3. conservative candidate matching (title/ingredient overlap)

Confidence labels:

- `exact_sku`
- `normalized_sku`
- `strong_title`
- `ingredient_signature`
- `weak_candidate`
- `no_match`

Only exact/normalized SKU are treated as validated match in Product Editor. Lower-confidence candidates are displayed as review candidates, not source truth.

## Readiness Gating Contract

Product Editor now uses calibrated readiness dimensions instead of global status alone.

Primary gates:

- matching eligibility: `ingredientMatchingReadiness`
- read-only facts quality: `productEditorFactsReadiness`

Secondary informational readiness:

- `complianceEvidenceReadiness`
- pricing/inventory availability
- `optiPixelAssetReadiness`

Policy semantics preserved:

- missing COA is compliance warning/defect, not ingredient-matching blocker
- missing pricing is pricing readiness issue, not ingredient-matching blocker
- OptiPixel asset readiness is informational and separate from ingredient matching

## Runtime Safety

Phase 5 preserves runtime boundaries:

- no supplier source fetching from Product Editor render
- no extraction/OCR/AI-label processing in render path
- no import/migration/write actions from Product Editor
- no fallback to `DATABASE_URL` for supplier facts reads
- Product Editor remains functional when `ECOMMERCE_DATABASE_URL` is unavailable (panel shows unavailable state)

## Phase 5.1 Route Reconciliation (2026-06-01 UTC)

Phase 5 introduced an incorrect duplicate merchant-facing route family:

- `/ecomviper/shopify/products/[productId-or-handle]`

Phase 5.1 removes that duplicate route family globally. Product workflow routing is now single-path:

- `/ecomviper/products/[productId-or-handle]` for all products and all SKUs.

Phase 5.1 preserves reusable supplier-facts backend/read-model logic for future integration:

- `lib/ecommerce/supplier-facts-read.ts`
- `lib/ecommerce/supplier-facts-types.ts`
- `lib/ecommerce/supplier-product-match.ts`

Phase 5.1 boundary confirmation:

- no ROC948 hardcoding or SKU special-casing
- no Generate Intelligence binding changes
- no Product Editor layout polish/redesign changes
- no supplier write/import/sync/extraction/OCR/AI-label behavior added

## Forward Path

- Phase 6: bind Generate Intelligence to shared supplier facts.
- Future OptiPixel phase: consume `ecommerce_supplier_assets`/remote metadata for image workflows.

## Phase 5 Closure (2026-05-31 UTC)

Delivery closure status:

- Phase 5 MR merged: `!291`
- merge SHA: `7f40e11984d54842527ca76f816dd7e7d057bc8b`
- deploy pipeline: success (`2565788605`)
- release verified at `/api/meta/release` with:
  - `git_sha=7f40e11984d54842527ca76f816dd7e7d057bc8b`
  - `build_id=2565788605`

Behavior confirmation:

- Product Editor Supplier Source Facts panel is read-only.
- Product Editor matching/display uses readiness dimensions (not global status alone):
  - `ingredientMatchingReadiness`
  - `productEditorFactsReadiness`
  - `complianceEvidenceReadiness`
  - `optiPixelAssetReadiness`
- Missing COA is shown as compliance warning, not ingredient blocker.
- Missing pricing is shown as pricing warning/unavailable state, not ingredient blocker.
- No Generate Intelligence binding was introduced in Phase 5.
- No Product Editor supplier writes/import/sync/extraction/OCR/AI-label processing was introduced.

Operational verification notes:

- Shared ecommerce DB verify/check passed using production connection with compatibility suffix (`&uselibpqcompat=true`):
  - `npm run ecommerce:check-db`
  - `npm run ecommerce:verify-rocktomic-import`
- Signed-out route protections remained intact for admin and Product Editor routes.
- Signed-in Product Editor manual verification was not executed in this CLI-only closure run (no authenticated browser session in runner).

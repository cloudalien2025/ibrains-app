# Product Editor Route Reconciliation (Phase 5.1)

Last updated: 2026-06-01 (UTC)

## Purpose

Remove the mistaken duplicate Shopify Product Editor route family introduced in Phase 5 and restore a single canonical merchant-facing product workflow route.

## Canonical Route Contract

Canonical Product Editor route for all products/SKUs:

- `/ecomviper/products/[productId-or-handle]`

Removed duplicate route family (global removal):

- `/ecomviper/shopify/products/[productId-or-handle]`

No SKU/product special-casing is allowed for this route contract.

## Removed Files

- `app/ecomviper/shopify/products/[productId-or-handle]/page.tsx`
- `app/ecomviper/shopify/products/[productId-or-handle]/shopify-product-editor-client.tsx`

## Preserved Backend Supplier-Facts Components

Route-agnostic reusable modules preserved:

- `lib/ecommerce/supplier-facts-read.ts`
- `lib/ecommerce/supplier-facts-types.ts`
- `lib/ecommerce/supplier-product-match.ts`

Semantics preserved:

- SKU-first matching with conservative candidate handling
- readiness-dimension consumption (`ingredientMatchingReadiness`, `productEditorFactsReadiness`, compliance/pricing/inventory dimensions)
- missing COA remains compliance warning only
- missing pricing remains pricing warning only
- `ECOMMERCE_DATABASE_URL` only (no `DATABASE_URL` fallback in supplier-facts read path)

## Explicit Non-Goals For Phase 5.1

- No Generate Intelligence binding changes
- No Product Editor layout redesign/polish
- No supplier import/sync/extraction/OCR/AI-label execution from Product Editor render
- No supplier data writeback from Product Editor
- No DB schema or migration changes

## Validation Targets

- All product table/editor links resolve to `/ecomviper/products/[productId-or-handle]`
- No merchant-facing route remains under `/ecomviper/shopify/products/*`
- Canonical Product Editor workflow remains intact

## Phase 5.2 Follow-On Guardrail (Default Image Selection)

Canonical Product Editor image-default behavior is implemented only in the canonical route workflow:

- `/ecomviper/products/[productId-or-handle]`

Behavior scope:

- Product Gallery default selection now resolves to best front/primary/featured image with deterministic global logic.
- Logic is generic across all products/SKUs (no ROC123/ROC948/handle-specific branches).
- Thumbnail click behavior remains intact.

Non-goals preserved:

- no duplicate `/ecomviper/shopify/products/[productId-or-handle]` route restoration
- no Product Editor layout redesign
- no Generate Intelligence behavior changes

## Phase 6.1 Guardrail (AI Copywriting Contract Foundation)

Phase 6.1 contract/eval harness work is route-agnostic and must not alter route topology:

- canonical Product Editor workflow remains `/ecomviper/products/[productId-or-handle]`
- no duplicate `/ecomviper/shopify/products/[productId-or-handle]` route restoration
- no Product Editor UI layout redesign
- no live Generate Intelligence runtime behavior changes in this phase

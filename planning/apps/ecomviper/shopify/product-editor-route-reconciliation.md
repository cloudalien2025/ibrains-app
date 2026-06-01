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

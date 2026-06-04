# Sprint 006 Blueprint

Status: In progress
Date: 2026-05-29 (UTC)

## Strategy

1. Rebuild `/ecomviper` as a Shopify-first inventory workspace shell using existing secure Shopify connection + import data sources.
2. Introduce a small inventory-row mapping contract with deterministic scoring and inventory status derivation.
3. Introduce Rocktomic SKU match helper contract for future dropshipping intelligence expansion.
4. Add new `/ecomviper/products/[productId-or-handle]` PDP shell route that reuses existing Shopify product resolution.
5. Keep existing `/ecomviper/shopify` workspace intact.

## Planned Change Areas

- `app/ecomviper/page.tsx`
- `app/ecomviper/ecomviper-dashboard-client.tsx`
- `app/ecomviper/products/[productId-or-handle]/page.tsx`
- `app/ecomviper/products/[productId-or-handle]/product-editor-client.tsx`
- `lib/ecomviper/shopify/shopify-inventory-foundation.ts`
- `lib/ecomviper/dropshipping/rocktomic-supplier-intelligence.ts`
- tests for sidebar IA, product table behavior, PDP routing contract, and helper models

## Guardrails

1. Use masked/status-only connection details in UI.
2. Keep Shopify import and credentials server-side.
3. Mark pending modules clearly (Image Studio generation, public publishing, agent endpoints).
4. Do not treat Hub as a separate app concept in Sprint 006 `/ecomviper` IA.

# Sprint 007 Blueprint

Status: In progress
Date: 2026-05-29 (UTC)

## Strategy

1. Extend Rocktomic models from placeholder to typed supplier intelligence contract.
2. Keep ingestion safe by using seeded/normalized representative data with source traceability.
3. Integrate SKU-match signals into inventory rows and PDP supplier panel.
4. Add a dedicated Dropshipping -> Rocktomic route for platform-managed supplier intelligence controls.
5. Preserve existing Shopify-first `/ecomviper` and auth/workspace isolation behavior.

## Planned Change Areas

- `lib/ecomviper/dropshipping/rocktomic-supplier-intelligence.ts`
- `lib/ecomviper/dropshipping/rocktomic-source-config.ts`
- `lib/ecomviper/shopify/shopify-inventory-foundation.ts`
- `app/ecomviper/ecomviper-dashboard-client.tsx`
- `app/ecomviper/products/[productId-or-handle]/product-editor-client.tsx`
- `app/ecomviper/dropshipping/rocktomic/page.tsx`
- tests for SKU normalization/lookup/matching/model shape, PDP supplier panel contract, and Rocktomic route shell

## Guardrails

1. Do not expose supplier/private tokens or credentials.
2. Keep source references/status summaries safe and non-secret in UI.
3. Keep AI PDP execution explicitly placeholder-only.
4. Keep Hub out of Sprint 007 `/ecomviper` IA decisions.

# Sprint 008 Blueprint

Status: In progress
Date: 2026-05-29 (UTC)

## Strategy

1. Reuse existing Shopify product-editor route and signed-in user guardrails.
2. Add a typed PDP intelligence contract and compliance evaluator under `lib/ecomviper/shopify`.
3. Add server-side generation + persistence route (`/api/ecomviper/pdp-intelligence`).
4. Keep persistence scoped by user + Shopify product id with server-side DB table creation guard.
5. Keep UI simple: generate -> edit -> save -> reopen.

## Planned Change Areas

- `app/ecomviper/products/[productId-or-handle]/product-editor-client.tsx`
- `app/api/ecomviper/pdp-intelligence/route.ts`
- `lib/ecomviper/shopify/shopify-pdp-intelligence.ts`
- `lib/ecomviper/shopify/shopify-pdp-intelligence-compliance.ts`
- `lib/ecomviper/shopify/shopify-pdp-intelligence-generator.ts`
- `lib/ecomviper/shopify/shopify-pdp-intelligence-repository.ts`
- `lib/ecomviper/shopify/shopify-product-editor-state.ts`
- `db/migrations/20260529_ecomviper_shopify_pdp_intelligence.sql`

## Guardrails

1. OpenAI calls must remain server-side only.
2. Never expose Shopify/OpenAI credentials in UI or logs.
3. Keep Shopify as product source of truth.
4. Keep Rocktomic as supplier intelligence source via SKU matching.
5. Keep Image Studio execution out of this sprint.

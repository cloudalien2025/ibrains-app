# Generate Intelligence Production Hotfix (Phase 6.2.1)

Last updated: 2026-06-01 (UTC)

## Purpose

Fix signed-in production Generate Intelligence failures introduced after Phase 6.2 rollout.

## Root Cause Summary

Primary failure path included middleware/proxy handling for:

- `/api/ecomviper/pdp-intelligence`

This path could invoke Clerk middleware proxy behavior that produced internal self-proxy attempts to:

- `https://localhost:3001/api/ecomviper/pdp-intelligence`

Production Next.js internal service runs plain HTTP loopback, so HTTPS loopback caused TLS failures (`wrong version number`) before request completion.

## Hotfix Scope (Phase 6.2.1)

1. Keep Product Editor Generate Intelligence client request relative:
   - `POST /api/ecomviper/pdp-intelligence`
2. Keep PDP intelligence API route out of Clerk proxy context in `proxy.ts` ecomviper API branch.
3. Preserve signed-in route protection without localhost HTTPS self-proxy rewrites.
4. Improve user-safe generation error mapping:
   - unavailable: `AI generation is unavailable right now.`
   - timeout: `AI generation timed out. Try again.`
   - validation error: `Generated response could not be validated.`
5. Preserve missing-data notices and semantics:
   - `Supplier match not found.` does not block Shopify-only generation
   - `COA missing.` does not block generation
   - `Pricing missing.` does not block generation
   - `Supplement Facts missing.` prevents ingredient-backed highlights
6. Fix Product Editor failed-attempt UX so stale prior proposal is labeled as previous output and not shown as latest attempt result.
7. Preserve review-only behavior:
   - no auto-save
   - no auto-publish
   - no model call during page render

## Runtime Env Contract

Server-side generation credential resolution:

1. user-scoped stored Shopify OpenAI credential (when configured)
2. runtime fallback: `OPENAI_API_KEY`

Optional runtime knobs remain:

- `ECOMVIPER_COPYWRITING_OPENAI_MODEL`
- `ECOMVIPER_COPYWRITING_OPENAI_TIMEOUT_MS`

Tests/build must not require `OPENAI_API_KEY`; missing key is handled only at explicit Generate action runtime with plain unavailable messaging.

## Explicit Non-Goals (Unchanged)

- no Product Editor layout redesign
- no scoring UI additions
- no supplier writes/import/sync/extraction/OCR from Generate action
- no duplicate `/ecomviper/shopify/products/[productId-or-handle]` route restoration
- no auto-save or auto-publish behavior changes

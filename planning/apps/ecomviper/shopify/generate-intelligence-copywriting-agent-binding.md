# Generate Intelligence Copywriting Agent Binding (Phase 6.2)

Last updated: 2026-06-01 (UTC)

## Purpose

Wire canonical Product Editor `Generate Intelligence` to the all-product AI copywriting agent contract in review-only mode.

## Canonical Route Scope

In-scope Product Editor route:

- `/ecomviper/products/[productId-or-handle]`

Out-of-scope route family remains removed:

- `/ecomviper/shopify/products/[productId-or-handle]`

## Runtime Binding

Generate action path:

1. merchant clicks `Generate Intelligence`
2. server builds `ProductCopywritingInput` from current Product Editor state
3. server invokes copywriting runner (explicit action only)
4. runner requests structured JSON output
5. output is schema-validated and safety-evaluated
6. proposal is returned for review-only rendering

No model call occurs during Product Editor page render.

## Review-Only Contract

- generated proposal is review-only
- no auto-apply to listing fields
- no auto-save
- no auto-publish
- Save/Publish remain explicit merchant actions

## Missing Data Behavior

Plain notices are surfaced in proposal results when applicable:

- `COA missing.`
- `Pricing missing.`
- `Supplement Facts missing.`
- `Supplier match not found.`

Policy semantics:

- missing COA does not block generation
- missing pricing does not block generation
- missing Supplement Facts prevents ingredient-backed highlights
- no invented ingredients/dosages/COA/pricing/inventory/certifications

## Safety/Boundary Guarantees

Phase 6.2 does not introduce:

- Product Editor layout redesign
- supplier writes/import/sync/extraction/OCR
- ecommerce supplier table writes from Generate action
- model calls in page render path
- duplicate route restoration

`ECOMMERCE_DATABASE_URL` supplier-facts read boundary remains unchanged.

## Implementation Modules

- runner: `lib/ecomviper/copywriting-agent/copywriting-agent-runner.ts`
- input builder: `lib/ecomviper/copywriting-agent/copywriting-agent-input-builder.ts`
- prompt contract: `lib/ecomviper/copywriting-agent/copywriting-agent-prompt.ts`
- output schema: `lib/ecomviper/copywriting-agent/copywriting-agent-types.ts`
- eval guard: `lib/ecomviper/copywriting-agent/copywriting-agent-evals.ts`
- action route: `app/api/ecomviper/pdp-intelligence/route.ts`
- Product Editor client binding: `app/ecomviper/products/[productId-or-handle]/product-editor-client.tsx`

## Future Phases

- Phase 6.3 may add model-backed agentic visibility scoring/improvement loop.

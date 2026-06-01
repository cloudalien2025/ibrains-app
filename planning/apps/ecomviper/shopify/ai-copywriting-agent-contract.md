# AI Copywriting Agent Contract (Phase 6.1 / 6.2)

Last updated: 2026-06-01 (UTC)

## Purpose

Define a single all-product contract for copywriting input/output so Generate Intelligence can be wired to a deterministic, validated, source-grounded agent path in later phases.

## Scope

Phase 6.1 establishes foundation contracts for all products from day one:

- supplier-backed supplement
- supplier-backed non-supplement
- Shopify-only supplement
- Shopify-only non-supplement
- missing-data / limited-source products
- no supplier-match products
- future suppliers beyond Rocktomic
- future channel targets: Shopify, OptiBay, OptiWal, OptiZon

Golden products/fixtures are representative regression artifacts only. They are not the architecture scope.

## Input Contract

Canonical input type:

- `ProductCopywritingInput`
- file: `lib/ecomviper/copywriting-agent/copywriting-agent-types.ts`

Input includes:

- product identity
- current listing content
- variants and commercial fields
- images and primary-image context
- optional supplier context/readiness
- supplement facts when available
- source evidence
- plain missing-data flags
- brand voice
- compliance profile
- agentic visibility profile
- channel output targets

Builder:

- `buildProductCopywritingInput(...)`
- `buildProductCopywritingInputFromShopifyEditorState(...)`
- file: `lib/ecomviper/copywriting-agent/copywriting-agent-input-builder.ts`

Builder constraints:

- deterministic and server-safe
- no OpenAI calls
- no source fetching
- no supplier DB writes/imports/sync
- no Product Editor render coupling

## Output Contract

Canonical output type:

- `ProductCopywritingOutput`
- file: `lib/ecomviper/copywriting-agent/copywriting-agent-types.ts`

Validation:

- `validateProductCopywritingOutput(...)`
- `parseProductCopywritingOutput(...)`
- JSON-schema-compatible object: `PRODUCT_COPYWRITING_OUTPUT_JSON_SCHEMA`

Output contract is compatible with future structured-output model generation, but Phase 6.1 does not perform model calls.

## Prompt / Source-Facts Contract

Prompt contract module:

- file: `lib/ecomviper/copywriting-agent/copywriting-agent-prompt.ts`

Contract defines:

- system instruction
- source-facts summary
- compliance constraints
- agentic visibility goals
- strict JSON output instruction bound to output schema

Prompt safety constraints explicitly prohibit:

- invented ingredients/dosages/serving facts
- invented COA/certifications/pricing/inventory/supplier status
- disease/treatment/cure/drug-comparison claims

Missing facts must be represented via plain `missingDataNotices`.

## Phase Boundaries

Phase 6.1 does not change live Product Editor or Generate Intelligence behavior:

- no Product Editor UI/layout changes
- no live Generate Intelligence workflow change
- no auto-apply/publish
- no model calls from product page render
- no duplicate route restoration
- no source fetching/OCR/import/supplier writes

Canonical Product Editor route remains:

- `/ecomviper/products/[productId-or-handle]`

## Phase 6.2 Runtime Binding Notes

- Generate Intelligence now invokes this contract through an explicit server action/API call only.
- Product page render remains model-call-free.
- Runner path enforces:
  - strict output schema validation
  - compliance/factual safety guard checks
  - plain missing-data notices for missing facts
- Generate output is review-only in Phase 6.2:
  - no auto-save
  - no auto-publish
  - no supplier writes/import/sync/extraction/OCR side effects

## Phase 6.2.1 Production Hotfix Notes

- Runtime OpenAI credential resolution for explicit Generate calls supports:
  - persisted user-scoped Shopify OpenAI credential when configured
  - fallback server runtime `OPENAI_API_KEY`
- Missing key and model/runtime failures return plain user-safe messages only:
  - `AI generation is unavailable right now.`
  - `AI generation timed out. Try again.`
  - `Generated response could not be validated.`
- Contract boundaries remain unchanged:
  - no auto-save/publish
  - no model call during Product Editor render
  - no duplicate route restoration

# Sprint 005 Blueprint

Status: Planned

# Sprint 005
Shopify Guarded Publish Execution

## Intent

Sprint 004 established deterministic Step 3 dry-run review contracts and client-side audit events. Sprint 005 introduces the first constrained server-side publish execution path for Shopify product editor drafts.

## Current Baseline Findings (Step 3)

- Step 3 publish evaluation is local-only (`evaluateShopifyStep3PublishDryRun`) and always blocks live execution.
- Product editor Step 3 currently tracks audit timeline events in client state only.
- There is no Shopify Step 3 publish API route under `app/api/ecomviper/shopify/*`.
- Existing diff model already marks API-pushable vs recommendation-only changes.

## Implementation Strategy

1. Preserve existing dry-run contract and UI semantics from Sprint 004.
2. Add a server-side publish endpoint for Shopify Step 3 (`dry_run` + guarded `execute`).
3. Introduce explicit mutation allowlist translator from draft/diff to Shopify mutation input.
4. Require confirmation-bound publish token and idempotency key for `execute`.
5. Add optimistic concurrency/stale listing guard before executing Shopify mutation.
6. Add structured publish attempt repository + migration (Shopify-only) following existing repository patterns.
7. Add focused Shopify-only tests for route, service, guardrails, idempotency, stale protection, and persistence behavior.

## Proposed Change Areas

- `app/api/ecomviper/shopify/products/publish/route.ts` (new)
  - authenticated publish route with strict payload validation.
  - route modes: `dry_run` and `execute`.
- `lib/ecomviper/shopify/shopify-product-editor-publish-workflow.ts`
  - preserve current dry-run behavior; extend shared contracts/codes for server execution outcomes.
- `lib/ecomviper/shopify/shopify-product-publish-service.ts` (new)
  - orchestrate validation, allowlist mapping, stale guard, scope checks, execution, and result shaping.
- `lib/ecomviper/shopify/shopify-product-publish-repository.ts` (new)
  - persist attempt/audit records with DB + test fallback-store pattern.
- `db/migrations/<new>_ecomviper_shopify_publish_attempts.sql` (new)
  - Shopify publish attempt persistence table/indexes.
- Shopify tests only:
  - `tests/ecomviper_shopify_product_editor_publish_workflow.test.ts`
  - new Shopify publish service/route/repository tests.

## Guarded Execution Design

1. Field scope guard:
   - Build mutation payload only from explicit allowlisted Step 3 fields.
   - Non-allowlisted fields remain dry-run/recommendation-only and cannot execute.
2. Confirmation-bound token:
   - `dry_run` returns/validates a short-lived token bound to user + product + deterministic diff fingerprint.
   - `execute` requires this token plus explicit confirmation.
3. Idempotency:
   - `execute` requires caller-provided idempotency key.
   - repeated key returns deterministic prior result and must not re-run mutation.
4. Stale listing guard:
   - before mutation, compare current product freshness/fingerprint against review baseline.
   - on mismatch, block with stale-listing code and recovery guidance.
5. Scope and connectivity checks:
   - require connected Shopify credentials and required write scope before execution.
6. Attempt/audit records:
   - persist request metadata, guard decisions, outcome code, and request ids where available.

## Design Guardrails

- Do not mutate outside explicit Shopify allowlist fields.
- Do not remove or weaken Sprint 004 dry-run behavior.
- Keep changes Shopify-only (Shopify modules, Shopify routes, Shopify tests, Shopify planning docs, Shopify DB migration).
- Do not modify Walmart files.

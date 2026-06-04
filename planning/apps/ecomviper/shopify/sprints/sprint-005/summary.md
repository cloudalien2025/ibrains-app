# Sprint 005 Summary

Status: Completed
Date: 2026-05-18 (UTC)

# Sprint 005
Shopify Guarded Publish Execution

## Scope Delivered

- Added Shopify-only server publish route:
  - `POST /api/ecomviper/shopify/products/publish`
  - supports `dry_run` and guarded `execute` modes.
- Preserved Sprint 004 dry-run behavior while moving guardrails server-side.
- Added strict Step 3 publish field allowlist:
  - `title`
  - `descriptionHtml`
  - `seoTitle`
  - `seoDescription`
  - `tags`
  - `productType`
- Added confirmation-bound publish token flow:
  - issued in `dry_run`
  - required and validated in `execute`.
- Added idempotency-key requirement and replay behavior for execute requests.
- Added stale-listing optimistic-concurrency guard using baseline vs current Shopify `updatedAt`.
- Added execute scaffold guardrail:
  - live mutation path is disabled unless `ECOMVIPER_SHOPIFY_PUBLISH_EXECUTE_ENABLED=1`.
- Added lightweight Shopify publish-attempt persistence pattern (best-effort in Sprint 005).

## Files Changed

- `app/api/ecomviper/shopify/products/publish/route.ts`
- `lib/ecomviper/shopify/shopify-product-publish-service.ts`
- `lib/ecomviper/shopify/shopify-product-publish-repository.ts`
- `tests/ecomviper_shopify_publish_service.test.ts`
- `tests/ecomviper_shopify_publish_route.test.ts`
- `planning/apps/ecomviper/shopify/sprints/sprint-005/requirements.md`
- `planning/apps/ecomviper/shopify/sprints/sprint-005/blueprint.md`
- `planning/apps/ecomviper/shopify/sprints/sprint-005/acceptance-criteria.md`
- `planning/apps/ecomviper/shopify/sprints/sprint-005/handoff-prompt.md`
- `planning/state.md`

## Tests Run

- `npx vitest run tests/ecomviper_shopify_publish_service.test.ts tests/ecomviper_shopify_publish_route.test.ts tests/ecomviper_shopify_product_editor_publish_workflow.test.ts tests/ecomviper_shopify_product_editor_workflow.test.tsx`
- Result: `4 files passed, 17 tests passed`.

## Remaining Risks

- Step 3 UI is not yet connected to the new publish route.
- Publish-attempt persistence is lightweight/best-effort and not yet backed by a formal migration rollout policy.
- Execute mode remains flag-gated and requires controlled rollout validation in production-like environments.

## Recommended Sprint 006

1. Wire Step 3 UI to server route (`dry_run` token issuance and guarded `execute`).
2. Formalize `shopify_publish_attempts` migration and retention/governance policy.
3. Add execute-path integration coverage with feature-flag-on scenarios and mutation error handling.

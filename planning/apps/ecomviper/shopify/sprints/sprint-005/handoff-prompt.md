# Sprint 005 Builder Handoff Prompt
# Shopify Guarded Publish Execution

You are the Builder for the iBrains EcomViper Shopify app.

Implement Sprint 005 only.

## Read First

1. `README.md`
2. `planning/state.md`
3. `planning/decisions.md`
4. `planning/risks.md`
5. `planning/apps/ecomviper/shopify/overview.md`
6. `planning/apps/ecomviper/shopify/product-intent.md`
7. `planning/apps/ecomviper/shopify/sprints/sprint-004/requirements.md`
8. `planning/apps/ecomviper/shopify/sprints/sprint-004/blueprint.md`
9. `planning/apps/ecomviper/shopify/sprints/sprint-004/acceptance-criteria.md`
10. `planning/apps/ecomviper/shopify/sprints/sprint-005/requirements.md`
11. `planning/apps/ecomviper/shopify/sprints/sprint-005/blueprint.md`
12. `planning/apps/ecomviper/shopify/sprints/sprint-005/acceptance-criteria.md`

Note: `planning/apps/ecomviper/shopify/sprints/sprint-004/summary.md` is not present in this repo snapshot.

## Background

Sprint 004 added Step 3 dry-run publish foundations and intentionally blocked live execution.

Sprint 005 must add the first safe server-side Shopify publish execution path while preserving Sprint 004 dry-run behavior.

## Scope Guard

- Use Walmart code only as reference pattern if needed.
- Do not modify Walmart files.
- Sprint 005 must only change Shopify-related code, Shopify tests, and Shopify planning docs unless explicitly approved otherwise.

## Task

Before coding:

1. Inspect current Shopify Step 3 publish workflow implementation.
2. Identify local-only behavior and current dry-run contract.
3. Present a concise Sprint 005 implementation plan.
4. Wait for explicit approval before implementing code changes.

After approval, implement:

- server-side Shopify Step 3 publish route (`dry_run` + guarded `execute`),
- explicit allowlisted field mutation mapping (no broad mutations),
- confirmation-bound publish token requirement,
- idempotency key requirement for execute path,
- stale listing (optimistic concurrency) guard,
- publish attempt persistence/structured audit records via Shopify repository pattern,
- focused Shopify-only regression tests.

## Preserve

- existing Shopify product editor 3-step flow,
- existing Sprint 004 dry-run behavior and messaging intent,
- existing Shopify workspace hydration/capability behavior.

## Do Not

- do not implement broad Shopify mutation behavior,
- do not modify Walmart files,
- do not perform unrelated refactors.

## Deliverables

Return:

- files changed,
- guarded execution strategy used,
- allowlist/idempotency/stale-guard behavior added,
- publish attempt persistence approach used,
- tests run,
- remaining risks,
- recommended Sprint 006 follow-up.

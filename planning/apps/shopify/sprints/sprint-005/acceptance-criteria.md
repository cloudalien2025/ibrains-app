# Sprint 005 Acceptance Criteria

Status: Planned

# Sprint 005
Shopify Guarded Publish Execution

## Functional Acceptance

1. Shopify Step 3 has a server-side publish route supporting `dry_run` and guarded `execute` modes.
2. Dry-run behavior from Sprint 004 remains intact and non-mutating.
3. Execution path mutates only explicitly allowlisted Shopify fields.
4. Execution requires confirmation-bound publish token and idempotency key.
5. Execution blocks when listing baseline is stale (optimistic concurrency guard).
6. Execution blocks cleanly when write scope/connection requirements are not satisfied.
7. Publish outcomes expose machine-readable result and audit codes for blocked/failed/success states.
8. Shopify publish attempt/audit records are persisted or deterministically structured using existing repository patterns.

## Safety Acceptance

1. No broad Shopify product mutation paths are introduced.
2. Non-allowlisted fields never reach live mutation payload.
3. `dry_run` never performs Shopify writes.
4. Duplicate execute requests with same idempotency key do not perform duplicate writes.
5. Stale-listing guard prevents applying edits against outdated listing baseline.

## Regression Acceptance

1. Existing Shopify product editor Step 3 workflow tests continue to pass.
2. Existing Shopify live hydration/capability tests continue to pass.
3. New Shopify-focused tests pass for:
   - allowlist enforcement,
   - confirmation token requirements,
   - idempotency behavior,
   - stale listing guard,
   - publish attempt persistence/structuring,
   - dry-run compatibility with Sprint 004 behavior.

## Scope Enforcement

1. Sprint 005 changes are limited to Shopify-related code/tests/planning artifacts (plus Shopify migration as needed).
2. Walmart files are not modified.
3. No unrelated workspace redesign or marketplace feature additions are introduced.

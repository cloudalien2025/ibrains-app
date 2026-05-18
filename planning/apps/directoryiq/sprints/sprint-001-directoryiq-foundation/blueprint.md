# Sprint 001 Blueprint

Status: Planned

# Sprint 001
DirectoryIQ Foundation

## Intent

Execute the first implementation sprint after the DirectoryIQ product-intent baseline by reinforcing existing foundation behavior rather than introducing broad new features.

## Current Baseline Findings (from product intent)

- Dashboard/readiness and listing workflow surfaces are implemented and operator-facing.
- Ingestion + readiness + authority workflows exist but include mixed runtime ownership patterns.
- Step 2 and Step 3 guarded execution contracts exist and are partially covered by focused tests.
- Some route families remain split between local-first and proxy-only behavior.

## Implementation Strategy

1. Select a narrow set of existing DirectoryIQ route/workflow contracts that are foundational to operator flow continuity.
2. Align touched behavior with current implementation intent (not net-new requirements).
3. Improve deterministic empty-state and readiness-state handling in already implemented surfaces when discrepancies are found.
4. Add/update focused DirectoryIQ tests for touched contracts.
5. Document implementation pointers and rationale in sprint summary for traceability.

## Proposed Change Areas (likely)

Application/UI:
- `app/apps/directoryiq/page.tsx`
- `app/apps/directoryiq/directoryiq-dashboard-client.tsx`
- `app/apps/directoryiq/listings/directoryiq-listings-client.tsx`
- `app/apps/directoryiq/listings/[listingId]/listing-optimization-client.tsx`

API:
- `app/api/directoryiq/dashboard/route.ts`
- `app/api/directoryiq/listings/route.ts`
- `app/api/directoryiq/listings/[listingId]/*`
- `app/api/directoryiq/_utils/*`

Library/service/repository:
- `lib/directoryiq/*`
- `src/directoryiq/services/*`
- `src/directoryiq/repositories/*`

Tests:
- `tests/directoryiq_*`

The exact touched subset should remain minimal and tied to confirmed foundation gaps.

## Delivery and Validation Plan

1. Start from clean `main` and create sprint branch (`sprint-001-directoryiq-foundation`).
2. Confirm source-of-truth behavior from:
- `planning/apps/directoryiq/product-intent.md`
- touched implementation files
- existing DirectoryIQ tests
3. Implement only approved foundation scope.
4. Run focused tests/checks for touched DirectoryIQ contracts.
5. Push, open MR, wait for green pipeline, fix only failing sprint-relevant checks.
6. Merge, delete branch, and return local repo to clean `main`.

## Design Guardrails

- Do not invent requirements beyond observed implementation and planning source files.
- Do not expand into broad runtime ownership refactors unless explicitly required by scoped acceptance criteria.
- Do not change schema unless a small, directly justified fix is required and approved in sprint scope.
- Keep changes DirectoryIQ-scoped.

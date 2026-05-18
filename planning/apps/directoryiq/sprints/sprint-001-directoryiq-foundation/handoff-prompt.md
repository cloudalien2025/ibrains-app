# Sprint 001 Builder Handoff Prompt
# DirectoryIQ Foundation

You are the Builder for the iBrains DirectoryIQ app.

Implement `sprint-001-directoryiq-foundation` only.

## Read First

1. `AGENTS.md`
2. `planning/state.md`
3. `planning/apps/directoryiq/overview.md`
4. `planning/apps/directoryiq/product-intent.md`
5. `planning/apps/directoryiq/sprints/sprint-001-directoryiq-foundation/requirements.md`
6. `planning/apps/directoryiq/sprints/sprint-001-directoryiq-foundation/blueprint.md`
7. `planning/apps/directoryiq/sprints/sprint-001-directoryiq-foundation/acceptance-criteria.md`

## Scope

Focus on reinforcing existing DirectoryIQ foundation behavior from implementation evidence:

- dashboard/readiness baseline consistency,
- listing workflow contract consistency,
- API/schema parity confidence for touched routes,
- deterministic empty-state and guardrail-state handling,
- focused DirectoryIQ test coverage for touched contracts.

## Source-of-Truth Constraint

Do not invent requirements.

All changes must be grounded in:
- `planning/apps/directoryiq/product-intent.md`, and
- observed implementation under `app/apps/directoryiq`, `app/api/directoryiq`, `lib/directoryiq`, `src/directoryiq`, and `tests/directoryiq_*`.

If implementation intent is unclear, mark it as unclear and keep scope minimal.

## Do Not

- Do not add broad new DirectoryIQ features.
- Do not perform cross-app changes.
- Do not redesign schema or runtime architecture in this sprint.
- Do not expand beyond the approved foundation scope.

## Delivery Flow (Mandatory)

Follow `AGENTS.md` mandatory GitLab sprint flow end-to-end:

1. Start from clean `main`.
2. Create branch `sprint-001-directoryiq-foundation`.
3. Implement approved scope only.
4. Run focused tests/checks.
5. Commit/push, open MR.
6. Wait for pipeline; fix only failing sprint-relevant checks.
7. Merge when green.
8. Delete remote and local sprint branches.
9. Return local repo to clean `main`.

## Expected Return

Report:

- files changed,
- contracts/workflows reinforced,
- tests/checks run,
- remaining risks,
- recommended next sprint.

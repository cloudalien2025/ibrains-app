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

- Create missing DirectoryIQ architecture/builder planning files.
- Align DirectoryIQ app shell to a left-sidebar/right-workspace structure.
- Preserve existing DirectoryIQ behavior and API semantics.
- Add focused shell contract test coverage.

## Source-of-Truth Constraint

Do not invent requirements.

Ground all work in:

- `planning/apps/directoryiq/product-intent.md`
- implementation under `app/apps/directoryiq`, `app/api/directoryiq`, `lib/directoryiq`, `src/directoryiq`, and `tests/directoryiq_*`.

## Do Not

- Do not add broad new DirectoryIQ features.
- Do not alter API behavior.
- Do not modify schema.
- Do not perform cross-app refactors.

## Delivery Flow (Mandatory)

Follow `AGENTS.md` GitLab sprint flow end-to-end:

1. clean `main`
2. sprint branch
3. scoped implementation
4. focused checks
5. commit/push/MR
6. green pipeline only merge
7. branch cleanup
8. clean `main`

## Expected Return

Report:

- planning files created/updated
- shell files changed
- tests/checks run
- MR + pipeline + merge results
- final clean local git status

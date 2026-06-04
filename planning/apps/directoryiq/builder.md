# DirectoryIQ Builder Guide

Last updated: 2026-05-18 (UTC)

## Purpose

Define how builders execute DirectoryIQ sprint work without requirement drift.

## Required Reading Order

1. `AGENTS.md`
2. `README.md`
3. `planning/state.md`
4. `planning/decisions.md`
5. `planning/risks.md`
6. `planning/questions.md`
7. `planning/apps/directoryiq/overview.md`
8. `planning/apps/directoryiq/product-intent.md`
9. Active sprint pack under `planning/apps/directoryiq/sprints/*`

## Source-of-Truth Rule

- Do not invent requirements.
- Derive decisions from DirectoryIQ implementation evidence:
  - `app/directoryiq/*`
  - `app/api/directoryiq/*`
  - `lib/directoryiq/*`
  - `src/directoryiq/*`
  - `tests/directoryiq_*`

If behavior is ambiguous, mark it as unclear and keep scope narrow.

## Sprint Delivery Flow (Mandatory)

1. Start from clean `main` (`git switch main`, `git pull --ff-only`, `git status`).
2. Create scoped sprint branch.
3. Implement approved scope only.
4. Run focused checks for touched contracts.
5. Commit with clear message.
6. Push branch and create GitLab MR.
7. Wait for pipeline and fix only failing sprint-relevant checks.
8. Merge only after green pipeline.
9. Delete remote/local sprint branch.
10. Return local repo to clean `main`.

## DirectoryIQ Scope Guardrails

- Keep changes tied to current DirectoryIQ product intent and existing behavior.
- Preserve API and data semantics unless sprint scope explicitly covers contract changes.
- Avoid broad cross-app refactors.
- Do not introduce fake business data.
- Keep placeholder copy explicit when capability is planned but not implemented.

## Focused Validation Baseline

Run the smallest relevant set first:

- `bash scripts/check_route_signatures.sh`
- `npm test -- --run tests/directoryiq*`
- additional shared tests only when shared code is touched

## Planning Update Rule

When scope changes, update DirectoryIQ planning docs in the same sprint:

- `overview.md`
- relevant sprint pack files
- `planning/state.md` sprint context/completion entries

# Agent Operating Instructions

Last updated: 2026-05-18 (UTC)

## Repository Operating Model

This repository follows a strict operating model:

Architect -> Builder -> GitLab Delivery -> Clean Main

- Architect defines scoped sprint intent and constraints.
- Builder executes only approved scope from branch through merge.
- Delivery is complete only after MR + green pipeline + merge + branch cleanup.
- Local repository must end on clean `main` before next sprint starts.

## Required Builder Read Order

Before changing code or docs for any sprint, read in this order:

1. `AGENTS.md`
2. `README.md`
3. `planning/state.md`
4. `planning/decisions.md`
5. `planning/risks.md`
6. `planning/questions.md`
7. Relevant app planning docs under `planning/apps/**`:
   - app `overview.md`
   - app `product-intent.md`
   - relevant sprint pack docs (`requirements.md`, `blueprint.md`, `acceptance-criteria.md`, `handoff-prompt.md`) when present

Do not rely on old chat history as source of truth when repo planning files exist.

## Planning Source Of Truth

Planning lives in-repo and mirrors the iBrains app launcher structure:

- `planning/apps/ecomviper/`
  - `shopify/`
  - `walmart/`
  - `ebay/`
  - `amazon/`
- `planning/apps/studio/`
  - `casaflix/`
  - `uap-forge/`
  - `future-studio-apps/`
- `planning/apps/siteforge/`
- `planning/apps/directoryiq/`

EcomViper is the parent family for channel commerce work (Shopify/Walmart/eBay/Amazon).

## Requirements Discipline

- Do not invent requirements.
- Derive product intent and sprint scope from implementation evidence where applicable.
- Product intent should be established before broad infrastructure or feature expansion.
- Keep each sprint scoped and reversible.

## Sprint Delivery Flow (Mandatory)

Every sprint must follow this end-to-end flow:

1. Start from clean `main`:
   - `git switch main`
   - `git pull`
   - `git status` must be clean
2. Create sprint branch (`sprint-###-short-description` when applicable).
3. Implement only approved sprint scope.
4. Run focused tests/checks.
5. Commit with clear message.
6. Push branch.
7. Create Merge Request.
8. Wait for pipeline/check completion.
9. If checks fail: inspect failure, fix only failure family, rerun focused checks, push to same branch.
10. Merge only after green checks.
11. Delete remote source branch.
12. Delete local sprint branch.
13. Reset local repo to clean `main`:
   - `git switch main`
   - `git pull`
   - `git status` must be clean
14. Update `planning/state.md` with sprint completion details.

## Sprint Completion Definition (Mandatory)

A sprint is not complete when:

- the branch is pushed, or
- an MR URL is returned.

A sprint is complete only after all of the following are done:

1. MR created.
2. Pipeline/checks succeeded.
3. Any failed checks fixed on same branch.
4. MR merged into `main`.
5. Remote branch deleted.
6. Local branch deleted.
7. Local repository reset to `main`.
8. `git status` confirms clean `main`.
9. `planning/state.md` updated with:
   - sprint number/title
   - MR number/link
   - pipeline result
   - merge commit SHA
   - branch deletion status
   - final local branch/status
   - recommended next sprint

## Sprint Pack Pattern (Recommended)

For major implementation sprints, prefer a four-file sprint pack:

- `requirements.md`
- `blueprint.md`
- `acceptance-criteria.md`
- `handoff-prompt.md`

Use this pattern where it adds clarity; keep smaller sprints lightweight when appropriate.

## Tooling And Context Notes

Tool-specific files and prompts are adapters for execution context; they are not the whole project brain.

Canonical planning and architecture truth should remain in repo docs listed above.

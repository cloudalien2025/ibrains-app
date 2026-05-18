# Agent Operating Instructions

Last updated: 2026-05-18 (UTC)

## Mandatory Sprint Delivery Flow (GitLab)

Every sprint must follow this GitLab flow:

1. Start from clean main
   - `git switch main`
   - `git pull`
   - `git status` must be clean
2. Create a sprint branch
   - Branch name format: `sprint-###-short-description`
3. Implement only the approved sprint scope
4. Run focused tests and relevant checks
5. Commit changes with a clear sprint commit message
6. Push branch to GitLab
7. Create a Merge Request
8. Wait for GitLab checks/pipeline to complete
9. If checks fail:
   - Inspect failed job
   - Fix only the failure
   - Rerun tests/checks
   - Push fix to same branch
10. When checks are green:
   - Merge the MR
11. Delete the branch
12. Reset local repo to main
   - `git switch main`
   - `git pull`
   - `git status` must be clean
13. Update `planning/state.md` with:
   - Sprint completed
   - MR number
   - Commit SHA if available
   - Tests/checks result
   - Next recommended sprint

Important: Do not start the next sprint until the current sprint MR is merged and local `main` is clean.

## Sprint Completion Definition (Mandatory)

A sprint is **not complete** when the branch is pushed or when an MR URL is returned.

A sprint is complete only when all steps below are finished:

1. The Merge Request is created.
2. GitLab pipeline/checks finish successfully.
3. Any failed checks are fixed on the same branch.
4. The MR is merged into `main`.
5. The remote source branch is deleted.
6. The local sprint branch is deleted.
7. Local repo is reset to `main`:
   - `git switch main`
   - `git pull`
   - `git status`
8. `git status` confirms clean `main`.
9. `planning/state.md` is updated with:
   - sprint number/title
   - MR number/link
   - pipeline result
   - merge commit SHA
   - branch deletion status
   - final local branch/status
   - recommended next sprint

Warning:

- Do not stop after pushing the branch.
- Do not stop after returning the MR URL.
- Continue the GitLab flow until merge and clean `main` unless blocked by permissions or a failing check that requires human input.

## Planning App Structure (Source of Truth)

Planning should mirror the iBrains launcher app structure:

- `planning/apps/ecomviper/`
  - child apps: `shopify/`, `walmart/`, `ebay/`, `amazon/`
- `planning/apps/studio/`
  - child apps: `casaflix/`, `uap-forge/`, `future-studio-apps/`
- `planning/apps/siteforge/`
- `planning/apps/directoryiq/`

When updating planning documents, use these paths and avoid introducing legacy standalone Shopify planning roots.

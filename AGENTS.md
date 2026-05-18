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

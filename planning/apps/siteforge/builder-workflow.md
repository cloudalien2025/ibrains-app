# SiteForge Builder Workflow

Last updated: 2026-05-18 (UTC)

## Purpose

Define how builders execute SiteForge sprints with implementation-grounded scope and GitLab closure discipline.

## Required Read Order

1. `AGENTS.md`
2. `README.md`
3. `planning/state.md`
4. `planning/decisions.md`
5. `planning/risks.md`
6. `planning/questions.md`
7. `planning/apps/siteforge/overview.md`
8. `planning/apps/siteforge/product-intent.md`
9. active SiteForge sprint docs (when present)

## Source-of-Truth Rule

- Do not invent requirements.
- Derive scope from observed SiteForge implementation and tests.
- If behavior is unclear, mark uncertainty in planning docs and keep changes reversible.

Evidence roots:

- `app/apps/siteforge/*`
- `app/api/siteforge/*`
- `lib/siteforge/*`
- `tests/siteforge*`

## Mandatory Delivery Flow

1. clean `main` (`git switch main`, `git pull --ff-only`, `git status`)
2. create sprint branch
3. implement approved scope only
4. run focused checks
5. commit + push
6. open GitLab MR
7. wait for green pipeline
8. fix only sprint-related failures if needed
9. merge after green
10. delete remote/local sprint branch
11. return local repo to clean `main`

## Scope Guardrails

- preserve existing SiteForge route behavior
- preserve API semantics unless sprint explicitly targets API contracts
- avoid broad refactors while adding shell/layout improvements
- avoid fake production capabilities in UI copy
- keep route links restricted to existing routes

## Focused Validation Baseline

- `bash scripts/check_route_signatures.sh`
- `npm test -- --run tests/siteforge*`
- targeted shared-route regressions when shared shell/framework files are touched
- `git diff --check`

## Planning Update Expectations

Each SiteForge sprint should update:

- `planning/state.md`
- relevant SiteForge planning docs touched by the sprint
- source-of-truth file pointers for changed behavior

# Planning State

Last updated: 2026-05-18 (UTC)

## Program Status

- Track: `EcomViper Shopify Agentic Workspace`.
- Sprint 001: Completed (stabilization scope).
- Sprint 002: Completed (capability detection + telemetry scope).
- Sprint 003: Completed (deterministic extraction precedence + extraction-source metadata + stable warning codes).
- Sprint 004: Planned (typed warning/telemetry code contract).
- Sprint 005: Completed (Shopify guarded publish execution scaffold).
- Walmart planning sprint: Completed (`walmart-product-intent` docs baseline).
- Walmart Sprint 001: Completed (`walmart-command-center-foundation` docs baseline).

## Planning App Map

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

## Mandatory Sprint Delivery Flow (GitLab)

Every sprint must follow this flow:

1. Start from clean `main`
   - `git switch main`
   - `git pull`
   - `git status` must be clean
2. Create sprint branch format: `sprint-###-short-description`
3. Implement only approved sprint scope
4. Run focused tests and relevant checks
5. Commit with a clear sprint commit message
6. Push branch to GitLab
7. Create Merge Request
8. Wait for GitLab checks/pipeline completion
9. If checks fail: inspect failed job, fix only failure, rerun tests/checks, push fix to same branch
10. When checks are green: merge MR
11. Delete branch
12. Reset local repo to `main`
   - `git switch main`
   - `git pull`
   - `git status` must be clean
13. Update this file with:
   - Sprint completed
   - MR number
   - Commit SHA if available
   - Tests/checks result
   - Next recommended sprint

Important: Do not start the next sprint until the current sprint MR is merged and local `main` is clean.

### End-to-End Completion Rule (Mandatory)

A sprint is **not complete** when:

- the branch is pushed, or
- the MR URL is returned.

A sprint is complete only when all items below are done:

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
9. This file is updated with:
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

### Sprint Completion Update Template

- Sprint: `Sprint ###` - `Completed`
- Title: `<sprint title>`
- MR: `!<number> (<link>)`
- Pipeline/checks result: `<passed/failed + summary>`
- Merge commit SHA: `<merge sha>`
- Branch deletion status: `<remote deleted yes/no, local deleted yes/no>`
- Final local branch/status: `<branch + git status summary>`
- Next recommended sprint: `<short recommendation>`

## Current Implemented Baseline (from code in repo)

- Live hydration remains split into `core`, `policy`, and `content` requests so policy failures do not block core catalog hydration.
- Policy-field capability detection remains cached in memory by `storeDomain + apiVersion` with 15-minute TTL.
- Unsupported policy field extraction now has deterministic precedence: `error.path` before `error.message` fallback.
- Extraction-source metadata is implemented: `none`, `path`, `message`, `mixed`.
- Hydration telemetry now includes probe/runtime extraction source and machine-readable warning codes.
- Existing Shopify workspace behavior remains preserved (`live_shopify`, `demo`, `unavailable`) including fallback snapshot behavior.

## Evidence Files

- `lib/ecomviper/shopify/shopify-policy-capabilities.ts`
- `lib/ecomviper/shopify/shopify-live-hydrator.ts`
- `tests/ecomviper_shopify_live_workspace.test.ts`
- `tests/ecomviper_shopify_policy_capabilities.test.ts`

## Next Milestone

- Execute Sprint 004 to define and apply a typed warning/telemetry code contract shared across Shopify capability and hydration consumers.

## Sprint Completion Updates

- Sprint: `Sprint 005` - `Completed`
- MR: `n/a`
- Commit SHA: `n/a`
- Tests/checks: `passed - 4 files passed, 17 tests passed`
- Next recommended sprint: `Sprint 006 - wire Step 3 UI to guarded route, formalize publish-attempt migration/governance, and add execute-path integration coverage`

### Sprint 005 Files Changed

- `app/api/ecomviper/shopify/products/publish/route.ts`
- `lib/ecomviper/shopify/shopify-product-publish-service.ts`
- `lib/ecomviper/shopify/shopify-product-publish-repository.ts`
- `tests/ecomviper_shopify_publish_service.test.ts`
- `tests/ecomviper_shopify_publish_route.test.ts`
- `planning/apps/ecomviper/shopify/sprints/sprint-005/requirements.md`
- `planning/apps/ecomviper/shopify/sprints/sprint-005/blueprint.md`
- `planning/apps/ecomviper/shopify/sprints/sprint-005/acceptance-criteria.md`
- `planning/apps/ecomviper/shopify/sprints/sprint-005/handoff-prompt.md`
- `planning/apps/ecomviper/shopify/sprints/sprint-005/summary.md`

### Sprint 005 Remaining Risks

- Product editor Step 3 UI is not yet wired to server publish route; workflow remains client-local unless API is called directly.
- Publish-attempt persistence is lightweight/best-effort in Sprint 005; formal migration governance/retention is pending.
- Live execute is scaffolded and feature-flag gated (`ECOMVIPER_SHOPIFY_PUBLISH_EXECUTE_ENABLED`) and needs controlled rollout/testing.

- Sprint: `Walmart Planning Sprint` - `Completed`
- Title: `Walmart Product Intent Baseline from Implementation`
- MR: `n/a`
- Commit SHA: `n/a`
- Pipeline/checks result: `n/a`
- Merge commit SHA: `n/a`
- Branch deletion status: `n/a`
- Final local branch/status: `n/a`
- Next recommended sprint: `Walmart Sprint 001 - align lane semantics, formalize live-write governance, and persist non-durable operational stores`

### Walmart Planning Sprint Files Changed

- `planning/apps/ecomviper/walmart/product-intent.md`
- `planning/state.md`

- Sprint: `Sprint 001` - `Completed`
- Title: `Walmart Command Center Foundation`
- MR: `pending`
- Commit SHA: `pending`
- Pipeline/checks result: `pending`
- Merge commit SHA: `pending`
- Branch deletion status: `pending`
- Final local branch/status: `pending`
- Next recommended sprint: `Sprint 002 - wire a single guarded execute path from command-center triage to publish status feedback, preserving current write protections`

### Sprint 001 Files Changed

- `planning/apps/ecomviper/walmart/command-center-foundation.md`
- `planning/apps/ecomviper/walmart/overview.md`
- `planning/apps/ecomviper/walmart/product-intent.md`
- `planning/state.md`

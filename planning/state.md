# Planning State

Last updated: 2026-05-18 (UTC)

## Program Status

- Track: `iBrains multi-app planning architecture and scoped sprint delivery`.
- Sprint 001: Completed (stabilization scope).
- Sprint 002: Completed (capability detection + telemetry scope).
- Sprint 003: Completed (deterministic extraction precedence + extraction-source metadata + stable warning codes).
- Sprint 004: Planned (typed warning/telemetry code contract).
- Sprint 005: Completed (Shopify guarded publish execution scaffold).
- Walmart planning sprint: Completed and merged (`walmart-product-intent` docs baseline).
- Walmart Sprint 001: Completed and merged (`walmart-command-center-foundation` docs baseline).
- Walmart Sprint 003: Completed and merged (`sprint-003-walmart-ai-visibility`, docs/planning AI visibility workflow foundation).
- Walmart Sprint 004: Completed and merged (`sprint-004-walmart-score-contract`, docs/planning canonical AI visibility score contract).
- Studio product intent sprint: Completed (`studio-product-intent`, MR `!180`).
- Studio Sprint 001: Completed (`sprint-001-studio-planning-naming-alignment`, docs/planning naming drift cleanup from legacy Domara/CasaHUD references to CasaFlix-first planning language).
- DirectoryIQ product-intent sprint: Completed (`directoryiq-product-intent`, MR `!179`, pipeline `2532737593` success, merged to `main`).
- eBay product-intent sprint: Completed (`ebay-product-intent`, MR `!183`, pipeline `2532820975` success, merged to `main`).
- eBay Sprint 001: In progress (`sprint-001-ebay-command-center-foundation`, command-center planning foundation + lightweight app-shell alignment).
- Current recommended sprint: `Walmart Sprint 005 - Prompt Match score workflow alignment` (recommended).

## Current Operating Reminder

- Do not begin a new sprint unless local repository is clean on `main`.
- Required baseline before any sprint:
  - `git switch main`
  - `git pull`
  - `git status` must be clean

## Studio Naming Alignment Notes

- MR `!180` established the implementation-derived Studio product intent baseline.
- This sprint is scoped to docs/planning naming cleanup for Studio/CasaFlix.
- No application behavior changes are included; only planning-language alignment and legacy-name clarifications.

## DirectoryIQ Planning Continuity

- DirectoryIQ product intent is now the planning source of truth and was updated from implementation analysis in MR `!179`.
- MR `!179` pipeline/check evidence: pipeline `2532737593` passed (`verify_frontdoor_integrity`), then merged into `main`.
- Post-merge state for `directoryiq-product-intent`: remote and local branch deleted; local repository reset to clean `main`.
- Next active DirectoryIQ planning/implementation direction: `sprint-001-directoryiq-foundation`.
- Future DirectoryIQ sprint requirements must stay grounded in:
  - `planning/apps/directoryiq/product-intent.md`, and
  - observed implementation evidence under app/API/lib/tests.
- Do not invent requirements outside source-of-truth implementation and planning files.

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

## Active Sprint Context

- Active sprint branch: `sprint-001-ebay-command-center-foundation`
- Sprint goal: `establish eBay command-center foundation planning and align eBay app shell to EcomViper workspace conventions`
- Scope guard: planning + lightweight shell alignment only; no live execution or marketplace write-path implementation.

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
- MR: `merged (number not recorded in this file at time of merge)`
- Commit SHA: `n/a`
- Pipeline/checks result: `passed`
- Merge commit SHA: `n/a`
- Branch deletion status: `completed`
- Final local branch/status: `main clean after merge`
- Next recommended sprint: `Walmart Sprint 001 - align lane semantics, formalize live-write governance, and persist non-durable operational stores`

### Walmart Planning Sprint Files Changed

- `planning/apps/ecomviper/walmart/product-intent.md`
- `planning/state.md`

- Sprint: `Sprint 001` - `Completed`
- Title: `Walmart Command Center Foundation`
- MR: `merged (number not recorded in this file at time of merge)`
- Commit SHA: `n/a`
- Pipeline/checks result: `passed`
- Merge commit SHA: `n/a`
- Branch deletion status: `completed`
- Final local branch/status: `main clean after merge`
- Next recommended sprint: `Sprint 002 - wire a single guarded execute path from command-center triage to publish status feedback, preserving current write protections`

### Sprint 001 Files Changed

- `planning/apps/ecomviper/walmart/command-center-foundation.md`
- `planning/apps/ecomviper/walmart/overview.md`
- `planning/apps/ecomviper/walmart/product-intent.md`
- `planning/state.md`

- Sprint: `eBay Product-Intent Sprint` - `Completed`
- Title: `eBay Product Intent Baseline from Implementation`
- MR: `!183 (https://gitlab.com/cloudalien-technologies/ibrains-app/-/merge_requests/183)`
- Commit SHA: `a61b3dcda1f324e339347794d8c84c4e18a90d32`
- Pipeline/checks result: `passed (pipeline 2532820975)`
- Merge commit SHA: `1ca90aaffaa7d664fda469dc9bfd5293db71e8d3`
- Branch deletion status: `remote deleted yes, local deleted yes`
- Final local branch/status: `main clean`
- Next recommended sprint: `eBay Sprint 001 - establish read-only API boundary + persistence baseline for listing intelligence before guarded execution scope`

### eBay Product-Intent Sprint Files Changed

- `planning/apps/ecomviper/ebay/product-intent.md`
- `planning/apps/ecomviper/ebay/overview.md`
- `planning/state.md`

- Sprint: `Sprint 002` - `In Progress`
- Title: `Planning Architecture Alignment`
- MR: `pending`
- Commit SHA: `pending`
- Pipeline/checks result: `pending`
- Merge commit SHA: `pending`
- Branch deletion status: `pending`
- Final local branch/status: `pending`
- Next recommended sprint: `Walmart AI visibility planning sprint or remaining app planning alignment (recommended, not committed)`

### Sprint 002 Planned Files Changed

- `AGENTS.md`
- `README.md`
- `planning/state.md`
- `planning/decisions.md`
- `planning/risks.md`
- `planning/questions.md`
- `planning/apps/ecomviper/overview.md`
- `planning/apps/ecomviper/product-intent.md`
- `planning/apps/ecomviper/walmart/overview.md`
- `planning/apps/ecomviper/walmart/product-intent.md`

- Sprint: `Walmart Sprint 003` - `Completed`
- Title: `Walmart AI Visibility Workflow Foundation`
- MR: `!185 (https://gitlab.com/cloudalien-technologies/ibrains-app/-/merge_requests/185)`
- Commit SHA: `70b2f21d8f4962185f0cd21df0eb792fedb95292`
- Pipeline/checks result: `passed`
- Merge commit SHA: `f17a954e18d934063029c649efbd3d4351281cbe`
- Branch deletion status: `remote deleted yes, local deleted yes`
- Final local branch/status: `main clean`
- Next recommended sprint: `Walmart Sprint 004 - define canonical score contract to prevent AI visibility terminology/score drift`

### Walmart Sprint 003 Files Changed

- `planning/apps/ecomviper/walmart/ai-visibility.md`
- `planning/apps/ecomviper/walmart/overview.md`
- `planning/apps/ecomviper/walmart/product-intent.md`
- `planning/questions.md`
- `planning/risks.md`
- `planning/state.md`

- Sprint: `Walmart Sprint 004` - `Completed`
- Title: `Walmart Score Contract`
- MR: `!186 (https://gitlab.com/cloudalien-technologies/ibrains-app/-/merge_requests/186)`
- Commit SHA: `0b1483b325f191bdae6cb1fcee140cd2b33f8bc2`
- Pipeline/checks result: `passed (pipeline 2534341247)`
- Merge commit SHA: `554abb4b33b3808aa78db3fda79ae66f71a297f5`
- Branch deletion status: `remote deleted yes, local deleted yes`
- Final local branch/status: `main clean`
- Next recommended sprint: `Walmart Sprint 005 - Prompt Match workflow alignment and typed prompt-match coverage payload`

### Walmart Sprint 004 Files Changed

- `planning/apps/ecomviper/walmart/score-contract.md`
- `planning/apps/ecomviper/walmart/overview.md`
- `planning/apps/ecomviper/walmart/product-intent.md`
- `planning/apps/ecomviper/walmart/ai-visibility.md`
- `planning/questions.md`
- `planning/risks.md`
- `planning/state.md`

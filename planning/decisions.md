# Planning Decisions

Last updated: 2026-05-28 (UTC)

## D-001 Keep Shopify Workspace Shape Stable

- Status: Accepted
- Decision: Stabilization work is constrained to hydration/capability internals and tests; no workspace redesign.
- Rationale: Existing workspace lanes and user flows are already covered by tests and should remain stable while backend resilience improves.

## D-002 Isolate Optional Policy Hydration from Core Hydration

- Status: Accepted
- Decision: Fetch core store/product data independently from policy data.
- Rationale: Unsupported policy schema fields (for example `privacyPolicy` on some stores/versions) must not fail core workspace hydration.

## D-003 Add Capability Detection with Cache Keyed by Store + API Version

- Status: Accepted
- Decision: Persist policy capability snapshot in memory with TTL and key format `normalizedStoreDomain:normalizedApiVersion`.
- Rationale: Reduces repeated probe calls and keeps behavior deterministic per store/version combination.

## D-004 Degrade to Warnings for Policy Capability/Hydration Failures

- Status: Accepted
- Decision: Policy probe/hydration failures append warnings and telemetry instead of throwing, unless core hydration has no usable data.
- Rationale: Preserves workspace availability and aligns with non-blocking policy enrichment.

## D-005 Preserve Snapshot Fallback Behavior

- Status: Accepted
- Decision: If live hydration throws, return fallback state when imported Shopify products are available.
- Rationale: Maintains existing workspace continuity and avoids regressions for partially connected environments.

## D-006 Track Capability Outcomes via Structured Telemetry Fields

- Status: Accepted
- Decision: Return `policyCapabilities` telemetry including detection source, probe status, hydration status, fallback usage, and event list.
- Rationale: Supports debugging and future instrumentation without changing workspace UI behavior.

## D-007 Enforce GitLab Sprint Delivery Flow for All Future Sprints

- Status: Accepted
- Decision: Every sprint must follow a strict GitLab delivery flow and can only proceed to the next sprint after MR merge and clean local `main`.
- Required flow:
  1. Start from clean main:
     - `git switch main`
     - `git pull`
     - `git status` must be clean
  2. Create sprint branch with format `sprint-###-short-description`
  3. Implement only approved sprint scope
  4. Run focused tests and relevant checks
  5. Commit with a clear sprint commit message
  6. Push branch to GitLab
  7. Create Merge Request
  8. Wait for GitLab checks/pipeline completion
  9. If checks fail: inspect failed job, fix only failure, rerun checks/tests, push fix to same branch
  10. When checks are green: merge MR
  11. Delete branch
  12. Reset local repo to main:
      - `git switch main`
      - `git pull`
      - `git status` must be clean
  13. Update `planning/state.md` with:
      - Sprint completed
      - MR number
      - Commit SHA if available
      - Tests/checks result
      - Next recommended sprint
- Rationale: Standardizes delivery quality gates, keeps sprint scope controlled, and ensures planning state stays synchronized with GitLab outcomes.

## D-008 Define End-to-End Sprint Completion Criteria (No Early Stop)

- Status: Accepted
- Decision: A sprint is not complete when code is pushed or when an MR URL is returned. Completion requires full end-to-end GitLab flow closure.
- Mandatory completion checklist:
  1. Merge Request is created.
  2. GitLab pipeline/checks complete successfully.
  3. Any failed checks are fixed on the same branch.
  4. MR is merged into `main`.
  5. Remote source branch is deleted.
  6. Local sprint branch is deleted.
  7. Local repository is reset:
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
- Warning:
  - Do not stop after pushing the branch.
  - Do not stop after returning the MR URL.
  - Continue until merge and clean `main` unless blocked by permissions or a failing check requiring human input.
- Rationale: Prevents partial handoffs and ensures each sprint is operationally closed, auditable, and ready for the next sprint.

## D-009 Mirror Planning Hierarchy to iBrains Launcher App Structure

- Status: Accepted
- Decision: Planning paths must mirror the actual top-level iBrains launcher structure and app-family nesting.
- Required hierarchy:
  - `planning/apps/ecomviper/` with `shopify/`, `walmart/`, `ebay/`, `amazon/`
  - `planning/apps/studio/` with `casaflix/`, `uap-forge/`, `future-studio-apps/`
  - `planning/apps/siteforge/`
  - `planning/apps/directoryiq/`
- Migration rule: legacy Shopify planning references must use `planning/apps/ecomviper/shopify/`; do not use legacy standalone Shopify planning roots.
- Rationale: Keeps planning discoverable, consistent with launcher navigation, and reduces cross-app documentation drift.

## D-010 Keep Planning As In-Repo Source Of Truth

- Status: Accepted
- Decision: Primary planning and sprint continuity live inside this repository.
- Rationale: Builders and operators need cold-start continuity without relying on external chat history.

## D-011 Use AGENTS As Builder Router And README As Human Overview

- Status: Accepted
- Decision:
  - `AGENTS.md` is the builder execution router and workflow contract.
  - `README.md` is the human-facing repo entrypoint.
- Rationale: Separates execution policy from high-level orientation and reduces onboarding ambiguity.

## D-012 Product Intent Precedes Major Infrastructure Or Feature Expansion

- Status: Accepted
- Decision: Product intent must be established from implementation evidence before broad infrastructure or feature work.
- Rationale: Prevents speculative architecture work and reduces rework from invented requirements.

## D-013 Derive Requirements From Implementation Where Applicable

- Status: Accepted
- Decision: Builders must not invent requirements when source-of-truth code/UI/tests are available.
- Rationale: Keeps planning and delivery grounded in real system behavior.

## D-014 Enforce Branch -> MR -> Green Pipeline -> Merge -> Cleanup -> Clean Main

- Status: Accepted
- Decision: All sprints must complete full GitLab delivery closure before new sprint work begins.
- Rationale: Prevents partial handoffs and preserves operational reliability.

## D-015 Use Four-File Sprint Packs For Major Sprints

- Status: Accepted
- Decision: For major scoped sprints, prefer:
  - `requirements.md`
  - `blueprint.md`
  - `acceptance-criteria.md`
  - `handoff-prompt.md`
- Rationale: Improves Architect-to-Builder handoff quality and reduces scope drift during implementation.

## D-016 Adopt Standalone Top-Level Brain Routes And Remove Legacy /apps

- Status: Accepted
- Decision:
  - Authenticated product workspaces are mounted as standalone top-level brain routes:
    - `/ecomviper`
    - `/optibay`
    - `/optiwal`
    - `/optizon`
    - `/directoryiq`
    - `/casaflix`
    - `/pagebolt`
    - `/reelify`
    - `/ipetzo`
  - Core authenticated workspace routes are:
    - `/dashboard`
    - `/brains`
    - `/tasks`
    - `/reports`
    - `/add-brain`
    - `/settings`
    - `/billing`
  - Legacy `/apps` and `/apps/*` routes are removed and are not redirected.
  - OptiBay, OptiWal, and OptiZon are independent brain routes and are not nested under EcomViper.
- Rationale: Eliminates route/naming drift, aligns product identity to brain workspaces, and reduces compatibility complexity.

## D-017 Make /brains The Canonical My Brains Index

- Status: Accepted
- Decision:
  - `/brains` is the canonical authenticated "My Brains" index.
  - The index must list the standalone brain inventory and link each brain to its top-level workspace route:
    - `/ecomviper`
    - `/optibay`
    - `/optiwal`
    - `/optizon`
    - `/directoryiq`
    - `/casaflix`
    - `/pagebolt`
    - `/reelify`
    - `/ipetzo`
  - `/brains` must not depend on legacy `/apps` inventory semantics.
  - Legacy `/apps/*`, `/studio`, `/siteforge`, and `/uapforge` remain removed with no redirects and must return `404`.
- Rationale: Keeps the main launcher stable, removes coupling to deprecated route models, and prevents regressions caused by legacy inventory assumptions.

## D-018 Enforce Non-Blocking /brains SSR And Clean Protected API Auth Responses

- Status: Accepted
- Decision:
  - `/brains` server render must use canonical local inventory only and never block on protected `/api/brains/*` calls.
  - Brain stats are optional client-side enrichment and must fail gracefully without breaking index rendering.
  - Signed-out protected `/api/brains/*` requests must return a clean non-500 auth response (for example `401`), not internal errors caused by middleware proxy loops.
  - Root frontdoor signed-in action composition must render a single primary `Open Brains` CTA.
- Rationale: Prevents index regressions from auth/API middleware coupling, preserves secure route behavior, and keeps launcher UX deterministic.

## D-019 Enforce Clerk Route-Contract Fallback Safety And Root/Auth Middleware Context

- Status: Accepted
- Decision:
  - Clerk fallback redirect routes must default to `/brains` for sign-in and sign-up flows.
  - Env-provided Clerk fallback redirects targeting deprecated legacy routes (`/apps*`, `/studio*`, `/siteforge*`, `/uapforge*`) must be sanitized to `/brains`.
  - Public routes (`/`, `/sign-in`, `/sign-up`) must bypass Clerk frontend API proxy middleware to prevent signed-out localhost rewrite failures (`x-middleware-rewrite: https://localhost:3001/...`).
- Rationale: Prevents legacy-route post-auth redirects, avoids Clerk proxy-induced public-route `500` regressions, and keeps the standalone-brain route model enforced by contract.

## D-020 Disable Clerk Frontend API Proxying For app.ibrains.ai Allowed-Subdomain Auth

- Status: Accepted
- Decision:
  - `app.ibrains.ai` uses Clerk as an allowed subdomain under the primary `ibrains.ai` production domain.
  - The authenticated workspace should use direct Clerk frontend/auth requests for this topology.
  - `proxy.ts` must not enable Clerk `frontendApiProxy` for the current production topology.
  - `ConfiguredClerkProvider` must not pass `proxyUrl` from stale `NEXT_PUBLIC_CLERK_PROXY_URL` values.
  - `/brains` remains protected by Clerk middleware and shell auth, but its page render stays local-inventory-first and non-blocking on protected `/api/brains/*`.
- Rationale: A half-enabled frontend proxy makes Clerk derive `app.ibrains.ai/__clerk` as a proxy URL while the browser/provider can still load Clerk directly, producing inconsistent host attribution and `host_invalid`/signed-in refresh failures.

## D-021 Exclude /__clerk From All Proxy Middleware Matchers

- Status: Accepted
- Decision:
  - `proxy.ts` must exclude `/__clerk/**` from all middleware matcher patterns, including the broad non-static matcher.
  - The API matcher remains `/(api|trpc)(.*)` and must not include `__clerk`.
  - No `/__clerk` runtime route support is provided by the app.
- Rationale: Removing `__clerk` from only one matcher is insufficient if another broad matcher still captures `/__clerk/**`. When captured, Clerk middleware can still rewrite stale proxy-mode requests and produce `500` cascades instead of a clean `404`.

## D-022 Keep Signed-In Shell Routes Out Of Clerk Middleware Proxy Rewrites

- Status: Accepted
- Decision:
  - Protected shell page routes (for example `/brains`, `/runs`, and standalone brain routes) must use cookie-gated middleware pass-through and not call `clerkMiddleware` request handling.
  - Signed-out shell requests still redirect to `/sign-in` with `redirect_url` preserved.
  - Shell auth remains fail-closed in `app/(shell)/layout.tsx` via `auth()` + verified `__session` fallback.
  - Clerk middleware/proxy logic remains disabled for `frontendApiProxy` mode and `/__clerk` routes.
- Rationale: In production behind reverse proxy, signed-in shell requests handled by Clerk middleware can trigger self-rewrites to `https://localhost:3001/...`, which Next.js then tries to proxy over TLS, causing `EPROTO` and user-facing `500` responses.

## D-023 Standardize Standalone Brain Console Back Link And Shell Pattern

- Status: Accepted
- Decision:
  - Every standalone brain console route must expose `← Back to Brains` linking to `/brains`.
  - OptiBay, OptiWal, and OptiZon are standalone brains and must not show EcomViper-parent back-link copy.
  - EcomViper and iPetzo should render with the standard brain console structure:
    - top/back area
    - left sidebar
    - right workspace/dashboard region
  - Deprecated route language (`Apps`, `Back to Apps`, `Open App`) stays excluded from standalone brain console surfaces.
- Rationale: Enforces a consistent standalone brain model across authenticated routes and removes residual parent-child launcher language from legacy commerce UI shells.

# Planning State

Last updated: 2026-05-29 (UTC)

## Program Status

- Track: `iBrains multi-app planning architecture and scoped sprint delivery`.
- Sprint 001: Completed (stabilization scope).
- Sprint 002: Completed (capability detection + telemetry scope).
- Sprint 003: Completed (deterministic extraction precedence + extraction-source metadata + stable warning codes).
- Sprint 004: Planned (typed warning/telemetry code contract).
- Sprint 005: Completed (Shopify guarded publish execution scaffold).
- Shopify Sprint 006: In progress (`sprint-006-shopify-inventory-foundation`, `/ecomviper` Shopify-first inventory/listings foundation + PDP optimizer shell).
- Walmart planning sprint: Completed and merged (`walmart-product-intent` docs baseline).
- Walmart Sprint 001: Completed and merged (`walmart-command-center-foundation` docs baseline).
- Walmart Sprint 003: Completed and merged (`sprint-003-walmart-ai-visibility`, docs/planning AI visibility workflow foundation).
- Walmart Sprint 004: Completed and merged (`sprint-004-walmart-score-contract`, docs/planning canonical AI visibility score contract).
- Walmart Sprint 005: Completed and merged (`sprint-005-walmart-ai-visibility-api-boundary`, docs/planning first canonical `ai_visibility_score` API payload boundary).
- Walmart Sprint 006: Completed and merged (`sprint-006-walmart-ai-visibility-payload-fixture`, canonical payload fixture/type contract + additive health-route payload field).
- Walmart Sprint 007: Completed and merged (`sprint-007-walmart-command-center-score-rollup`, command-center rollup alignment to canonical `ai_visibility_score` semantics).
- Walmart Sprint 008: In progress (`sprint-008-walmart-product-editor-score-alignment`, product editor/product-level score diagnostics alignment to canonical `WalmartAiVisibilityScore` semantics).
- Studio product intent sprint: Completed (`studio-product-intent`, MR `!180`).
- Studio Sprint 001: Completed (`sprint-001-studio-planning-naming-alignment`, docs/planning naming drift cleanup from legacy Domara/CasaHUD references to CasaFlix-first planning language).
- DirectoryIQ product-intent sprint: Completed (`directoryiq-product-intent`, MR `!179`, pipeline `2532737593` success, merged to `main`).
- DirectoryIQ Sprint 001: In progress (`sprint-001-directoryiq-foundation`, architecture/builder planning foundation + workspace shell alignment).
- PageBolt Sprint 001: In progress (`sprint-001-siteforge-command-center-foundation`, architecture/builder planning foundation + command-center shell alignment).
- PageBolt Sprint 002: In progress (`sprint-002-siteforge-shell-render-fix`, shell render integration fix so `/pagebolt` visibly renders command-center sidebar + workspace).
- eBay product-intent sprint: Completed (`ebay-product-intent`, MR `!183`, pipeline `2532820975` success, merged to `main`).
- eBay Sprint 001: In progress (`sprint-001-ebay-command-center-foundation`, command-center planning foundation + lightweight app-shell alignment).
- Hub Sprint 004: In progress (`sprint-004-ecomviper-hub-public-surface-architecture`, planning-only public/private surface and domain/infrastructure architecture update).
- Current recommended sprint: `Shopify Sprint 006 - Inventory foundation + PDP optimizer shell` (active in current branch).

## Sprint Completion Log: EcomViper Commerce Brain Decoupling

- Sprint: `sprint-022-decouple-ecomviper-commerce-brains` (completed).
- MR: `!222` (`https://gitlab.com/cloudalien-technologies/ibrains-app/-/merge_requests/222`).
- Pipeline: `2560656899` (status: `success`).
- Merge commit SHA: `b57265f65d690fc7323b963ed0d25c279d0c275f`.
- Root-cause summary:
  - Sprint 021 standardized `← Back to Brains` but left parent-launcher UX in `app/ecomviper/page.tsx` (`Open OptiWal/Open OptiBay/Open OptiZon` links and corresponding cards).
  - This contradicted the standalone commerce-brain contract (`/ecomviper`, `/optibay`, `/optiwal`, `/optizon` are peers).
- Implementation summary:
  - `/ecomviper` sidebar removed direct OptiBay/OptiWal/OptiZon launch links.
  - `/ecomviper` workspace removed OptiBay/OptiWal/OptiZon launcher cards.
  - EcomViper console now focuses on EcomViper-owned sections (Products, Shopify Source, Hub, Product Intelligence, Feed Operations, Drafts, Settings) while preserving standard shell.
  - Cross-brain guidance points to `/brains` only.
- Validation summary:
  - `npm test -- tests/ecomviper_walmart_route_contract.test.tsx tests/brain_console_ui_contract.test.ts tests/brains_index_contract.test.ts` passed.
  - `bash scripts/check_route_signatures.sh` passed.
  - `npm run build` passed.
  - `git diff --check` passed.
  - `npm test` remains red on existing unrelated baseline failure families outside Sprint 022 scope.
- Source branch deletion:
  - Remote: deleted (merged with source-branch removal).
  - Local: deleted.
- Final local repository state after merge:
  - branch: `main`
  - status: clean (`git status` with no changes)
- Production/browser verification status:
  - deploy pipeline for this sprint was green at merge gate.
  - `/api/meta/release` currently reports missing release metadata (`git_sha/build_id` null), so SHA-based production stamp confirmation remains unavailable through that endpoint.
  - manual browser verification is required post-deploy for `/ecomviper`, `/optibay`, `/optiwal`, `/optizon`, `/brains`, and deprecated-route `404` checks.
- Recommended next sprint: `Walmart Sprint 008 - Product Editor score diagnostics alignment` (continue active scope).

## Sprint Completion Log: Standalone Brain Routes

- Sprint: `route-cleanup-standalone-brains` (legacy `/apps` removal and standalone top-level brain route migration).
- MR: `!203` (`https://gitlab.com/cloudalien-technologies/ibrains-app/-/merge_requests/203`).
- Pipeline: `2559611297` (status: `success`, finished `2026-05-28T16:51:12Z` UTC).
- Merge commit SHA: `13c71e8d42685512208f82b58a7a68dae63dd31e`.
- Source branch deletion:
  - Remote: deleted (`route-cleanup-standalone-brains` no longer present on origin).
  - Local: deleted.
- Final local repository state after merge:
  - branch: `main`
  - status: clean (`git status` with no changes)
- Recommended next sprint: `Walmart Sprint 008 - Product Editor score diagnostics alignment` (continue active scope).

## Sprint Completion Log: Brains API/Auth Regression Hardening

- Sprint: `sprint-010-fix-brains-api-auth-500` (completed).
- MR: `!207` (`https://gitlab.com/cloudalien-technologies/ibrains-app/-/merge_requests/207`).
- Pipeline:
  - branch pipeline `2559793364` (status: `success`)
  - MR pipeline `2559794578` (status: `success`, finished `2026-05-28T18:22:27Z` UTC)
- Root-cause summary:
  - `/brains` performed protected `/api/brains/*` stats fetches during server render.
  - signed-out protected `/api/brains*` requests still flowed through Clerk proxy path and could surface as `500`.
  - root frontdoor rendered duplicate signed-in `Open Brains` CTAs.
- Implementation summary:
  - `/brains` SSR now renders from canonical local standalone brain inventory only.
  - brain stats moved to optional client-side hydration with graceful fallback.
  - route-level `requireSignedInUser()` auth added to `GET /api/brains`, `GET /api/brains/[id]`, `GET /api/brains/[id]/stats`, and `GET /api/brains/[id]/runs`.
  - `proxy.ts` bypasses Clerk middleware for `/api/brains*` so route auth controls signed-out responses cleanly.
  - duplicate signed-in root `Open Brains` CTA removed.
- Validation summary:
  - `npm run build` passed.
  - `bash scripts/check_route_signatures.sh` passed.
  - `git diff --check` passed.
  - focused regression suite passed:
    - `tests/brains_api_auth_contract.test.ts`
    - `tests/brains_table_hydration_resilience.test.tsx`
    - `tests/brains_index_contract.test.ts`
    - `tests/frontdoor_header_actions_auth_state.test.tsx`
    - `tests/proxy_trusted_ingest_bypass.test.ts`
    - `tests/proxy_apps_auth_protection.test.ts`
    - `tests/apps_layout_auth_contract.test.tsx`
  - `npm test` remains red on existing repository baseline failures outside this sprint scope.
- Merge commit SHA: `3e1eabcf10e41b5f3cf8ce8d10a6202bbbf3fd53`.
- Source branch deletion:
  - Remote: deleted.
  - Local: deleted.
- Final local repository state after merge:
  - branch: `main`
  - status: clean (`git status` with no changes)
- Recommended next sprint: `Walmart Sprint 008 - Product Editor score diagnostics alignment` (continue active scope).

## Sprint Completion Log: Brains Auth 401 Follow-up

- Sprint: `sprint-011-fix-brains-auth-unavailable-401` (completed).
- MR: `!208` (`https://gitlab.com/cloudalien-technologies/ibrains-app/-/merge_requests/208`).
- Pipeline: `2559833620` (status: `success`, finished during MR merge gate).
- Root-cause summary:
  - Signed-out `/api/brains*` returned `503 AUTH_UNAVAILABLE` after Sprint 010 because Clerk middleware-detection errors were treated as generic auth-unavailable in `requireSignedInUser()`.
- Implementation summary:
  - `requireSignedInUser()` now maps Clerk middleware-context detection errors to canonical `401 UNAUTHORIZED` (`Sign-in required`).
  - existing `503 AUTH_UNAVAILABLE` behavior remains for generic/unclassified auth-unavailable failures.
  - regression test added for middleware-context error -> `401`.
- Validation summary:
  - focused route/auth tests passed, including updated `tests/require_signed_in_user_auth_unavailable.test.ts`.
  - `npm run build` passed.
  - `bash scripts/check_route_signatures.sh` passed.
  - `git diff --check` passed.
  - `npm test` remains red on existing repository baseline failures outside sprint scope.
- Merge commit SHA: `c81c2b86d20f77f2f30e7d5983be65f03ded2688`.
- Source branch deletion:
  - Remote: deleted.
  - Local: deleted.
- Final local repository state after merge:
  - branch: `main`
  - status: clean (`git status` with no changes)
- Recommended next sprint: `Walmart Sprint 008 - Product Editor score diagnostics alignment` (continue active scope).

## Sprint Completion Log: Auth Workspace End-Goal Stabilization

- Sprint: `sprint-012-stabilize-auth-workspace-end-goal` (completed).
- MR: `!209` (`https://gitlab.com/cloudalien-technologies/ibrains-app/-/merge_requests/209`).
- Pipeline:
  - branch pipeline `2559958620` (status: `success`)
  - MR pipeline `2559959368` (status: `success`)
- Merge commit SHA: `3bd40f13304ed8fde446912838eaf13161fb4959`.
- Root-cause summary:
  - Clerk fallback redirect contract still allowed legacy `/apps*` values in production.
  - `ConfiguredClerkProvider` fallback wiring was not fully route-contract driven.
  - Public-route middleware changes introduced follow-up production proxy rewrite risk, handled in Sprint 013.
- Implementation summary:
  - fallback redirect sanitization to `/brains` for deprecated legacy targets.
  - Clerk provider fallback values wired from shared route contract.
  - regression tests added/updated for route contract and signed-out/signed-in browser flows.
- Validation summary:
  - targeted auth/brains regression suites passed.
  - `npm run build` passed.
  - `bash scripts/check_route_signatures.sh` passed.
  - `git diff --check` passed.
  - `npm test` remains red on known baseline failure families outside sprint scope.

## Sprint Completion Log: Clerk Public Route Proxy 500 Hotfix

- Sprint: `sprint-013-fix-clerk-public-route-proxy-500` (completed).
- MR: `!210` (`https://gitlab.com/cloudalien-technologies/ibrains-app/-/merge_requests/210`).
- Pipeline:
  - branch pipeline `2559999437` (status: `success`)
  - MR pipeline `2559999675` (status: `success`)
- Merge commit SHA: `456ffb0f21867f710dabaf5e9eb8f58e18d6a67f`.
- Root-cause summary:
  - after Sprint 012 deploy, signed-out `/`, `/sign-in`, and `/sign-up` returned `500` with `x-middleware-rewrite: https://localhost:3001/...`.
  - public routes were routed through Clerk frontend proxy middleware, which rewrote signed-out public traffic to localhost.
- Implementation summary:
  - restored explicit passthrough for `/`, `/sign-in`, and `/sign-up`.
  - retained protected-route auth behavior, `/brains` standalone model, and deprecated-route hard 404 policy.
- Validation summary:
  - focused proxy/auth/browser regression checks passed.
  - `npm run build` passed.
  - `bash scripts/check_route_signatures.sh` passed.
  - `git diff --check` passed.
  - `npm test` remains red on known baseline failure families outside sprint scope.
- Production verification status:
  - post-merge deployment verification remains pending at the time of this update; `/api/meta/release` temporarily reports missing release metadata and production still showed pre-hotfix proxy-rewrite behavior during immediate post-merge checks.

## Active Sprint Log: Shell Auth Fail-Closed Hardening

- Sprint: `sprint-015-shell-auth-fail-closed` (in progress).
- Incident context:
  - signed-in users could still observe server errors on `/brains` when shell auth resolution threw during server render.
- Root cause:
  - protected shell layout called `auth()` without local error handling, allowing Clerk runtime/auth-context exceptions to bubble as `500`.
- Implementation:
  - shell layout now catches `auth()` failures and falls back to verified Clerk session token lookup before redirecting.
  - when no recoverable user is available, layout redirects to `/sign-in` (fail-closed) instead of throwing.
  - regression tests added for both recover and redirect paths.

## Active Sprint Log: Signed-In /brains Stability Hardening

- Sprint: `sprint-016-shell-stability-signed-in-brains` (in progress).
- Incident context:
  - users can still hit `/brains` internal server errors after successful sign-in redirect.
- Mitigation scope:
  - remove hard-throw path in protected shell layout for production Clerk config mismatch; fail-closed to sign-in instead.
  - remove server-render dependency on Clerk `UserButton` in shell header to reduce signed-in SSR crash surface.
  - add `app/(shell)/error.tsx` boundary so unexpected shell errors render recoverable UI rather than generic 500.
  - add regression coverage for production config fail-closed behavior.

## Sprint Completion Log: Clerk Host Attribution /brains 500 Fix

- Sprint: `sprint-017-fix-clerk-host-brains-500` (completed).
- MR: `!214` (`https://gitlab.com/cloudalien-technologies/ibrains-app/-/merge_requests/214`).
- MR pipeline: `2560243494` (status: `success`, finished `2026-05-28T21:20:01Z` UTC).
- Default-branch deploy pipeline: `2560249506` (status: `success`, finished `2026-05-28T21:28:51Z` UTC).
- Merge commit SHA: `2ff62822afaf8f41c7de645c7fc1f666f6e36c39`.
- Deployed production SHA: `2ff62822afaf8f41c7de645c7fc1f666f6e36c39`.
- Source branch deletion:
  - Remote: deleted by GitLab merge.
  - Local: pending final cleanup after this state closeout.
- Incident context:
  - A signed-in browser can still hit an Internal Server Error on `/brains` after redirect/refresh.
  - Refresh can surface Clerk `host_invalid`, even though `app.ibrains.ai` is an allowed subdomain under the primary `ibrains.ai` Clerk domain.
- Diagnosis:
  - Production is deployed from `af1145cc0e9ea7c7803547af6ebccd5654f8fead`.
  - Signed-out `/brains` redirects cleanly to `/sign-in`.
  - Signed-out `/api/brains` and `/api/brains/ecomviper/stats` return clean `401` responses.
  - Deprecated `/apps`, `/apps/*`, `/studio`, `/siteforge`, and `/uapforge` routes remain `404`.
  - The remaining unstable path is signed-in Clerk host/session attribution: `proxy.ts` enabled Clerk `frontendApiProxy`, while `ConfiguredClerkProvider` did not consistently run a matching frontend proxy contract.
- Implementation plan:
  - Remove Clerk frontend API proxying from middleware/provider for the current allowed-subdomain topology.
  - Preserve Clerk route protection, `/brains` local inventory rendering, clean protected API auth responses, and deprecated route hard-404 behavior.
  - Add regression tests and update auth architecture docs.
- Implementation summary:
  - `proxy.ts` no longer enables Clerk `frontendApiProxy`.
  - `ConfiguredClerkProvider` no longer passes stale `NEXT_PUBLIC_CLERK_PROXY_URL` values as `proxyUrl`.
  - CI now runs Clerk provider/proxy regression tests so the half-proxy topology is not reintroduced silently.
- Local validation:
  - focused auth/proxy/brains suites passed.
  - CI-targeted frontdoor/auth suite passed.
  - `npm run build` passed.
  - `bash scripts/check_route_signatures.sh` passed.
  - `npm run guard:next-origin` passed.
  - `git diff --check` passed.
  - Playwright local production-style smoke passed for `/sign-in`, `/brains`, and `Open Brains` flow with E2E mock auth.
  - `npm run lint` remains red on unrelated repository baseline lint failures outside this sprint scope.
  - `npm test` remains red on unrelated repository baseline failures outside this sprint scope; auth/proxy/brains-targeted coverage passed.
- Production verification:
  - `/api/meta/release` reported deployed SHA `2ff62822afaf8f41c7de645c7fc1f666f6e36c39` and build ID `2560249506`.
  - Signed-out `/` returned `200`.
  - Direct `/sign-in` and `/sign-up` rendered Clerk UI in browser automation with no `host_invalid`.
  - `/sign-in?redirect_url=https%3A%2F%2Fapp.ibrains.ai%2Fbrains` rendered Clerk UI in browser automation with no `host_invalid`.
  - Signed-out `/brains` returned `307` to `/sign-in?redirect_url=.../brains`.
  - Signed-out `/api/brains` and `/api/brains/ecomviper/stats` returned `401`.
  - `/apps`, `/apps/studio`, `/studio`, `/siteforge`, and `/uapforge` returned `404`.
  - Authenticated production browser verification still requires a real signed-in user session; no test credentials were invented or exposed.
- Recommended next sprint: resolve existing unrelated repo-wide test/lint baseline failures or continue `Walmart Sprint 008 - Product Editor score diagnostics alignment`.

## Sprint Completion Log: Clerk /__clerk Matcher Exclusion Follow-up

- Sprint: `sprint-019-exclude-clerk-matcher` (completed).
- MR: `!216` (`https://gitlab.com/cloudalien-technologies/ibrains-app/-/merge_requests/216`).
- Branch pipeline: `2560470792` (status: `success`).
- MR pipeline: `2560471133` (status: `success`).
- Default-branch deploy pipeline: `2560474244` (status: `success`).
- Merge commit SHA: `3901260ce72f769b7e05cce936b5ca59904e959e`.
- Deployed production SHA: `3901260ce72f769b7e05cce936b5ca59904e959e`.
- Deployed build ID: `2560474244`.
- Root cause:
  - Sprint 018 removed `__clerk` from `/(api|trpc|__clerk)(.*)`, but `proxy.ts` still had a broad non-static matcher that captured `/__clerk/**`.
  - Because middleware still ran for `/__clerk/**`, Clerk middleware could rewrite stale proxy-mode requests and trigger `500` responses.
- Fix summary:
  - `proxy.ts` now excludes `/__clerk/**` from the broad matcher (`(?!_next|__clerk|...)`) and keeps the API matcher as `/(api|trpc)(.*)`.
  - Clerk topology remains direct allowed-subdomain mode (`ibrains.ai` primary + `app.ibrains.ai` allowed subdomain), with no `frontendApiProxy` and no provider `proxyUrl`.
  - Auth and route contracts preserved: `/brains` signed-out redirect behavior, signed-out `/api/brains*` returning `401`, and deprecated routes staying hard `404`.
- Validation summary:
  - targeted auth/proxy regression suite passed:
    - `tests/proxy_clerk_env_guard_contract.test.ts`
    - `tests/clerk_auth_route_runtime.test.tsx`
    - `tests/proxy_apps_auth_protection.test.ts`
    - `tests/brains_api_auth_contract.test.ts`
    - `tests/brains_index_contract.test.ts`
  - `bash scripts/check_route_signatures.sh` passed.
  - `npm run build` passed.
  - `git diff --check` passed.
  - `npm test` remains red on existing unrelated repository baseline failure families outside Sprint 019 scope.
- Production verification summary:
  - `/api/meta/release` reports SHA `3901260ce72f769b7e05cce936b5ca59904e959e` and build ID `2560474244`.
  - `/__clerk/v1/client` returns `404` (no middleware localhost rewrite header present).
  - `/sign-in` returns `200` and renders Clerk UI.
  - `/sign-up` returns `200` and renders Clerk UI.
  - signed-out `/brains` returns `307` to `/sign-in?redirect_url=.../brains`.
  - signed-out `/api/brains` and `/api/brains/ecomviper/stats` return `401`.
  - `/apps`, `/apps/studio`, `/studio`, `/siteforge`, and `/uapforge` return `404`.
  - Signed-in browser verification still requires a real authenticated session; no credentials were invented or exposed.
- Operational note:
  - Users with stale proxy-mode Clerk sessions may need one-time cookie/session cleanup for:
    - `app.ibrains.ai`
    - `ibrains.ai`
    - `clerk.ibrains.ai`
- Source branch deletion:
  - Remote: deleted by GitLab merge (`sprint-019-exclude-clerk-matcher`).
  - Local: pending local branch cleanup during final sprint closure.
- Recommended next sprint: resolve existing unrelated repo-wide baseline test/lint failures or continue `Walmart Sprint 008 - Product Editor score diagnostics alignment`.

## Sprint Completion Log: Signed-In /brains 500 Reverse-Proxy Rewrite Fix

- Sprint: `sprint-020-fix-brains-signed-in-render-500` (completed).
- MR: `!218` (`https://gitlab.com/cloudalien-technologies/ibrains-app/-/merge_requests/218`).
- MR pipeline: `2560555090` (status: `success`).
- Default-branch deploy pipeline: `2560558341` (status: `success`).
- Merge commit SHA: `b9e4a77bc142bfb319675589be9e4aa8756486e0`.
- Deployed production SHA: `b9e4a77bc142bfb319675589be9e4aa8756486e0`.
- Deployed production build ID: `2560558341`.
- Source branch deletion:
  - Remote: deleted by GitLab merge.
  - Local: pending final local cleanup in sprint closeout flow.
- Incident context:
  - Production signed-out auth flows were healthy after Sprint 019, but signed-in `GET /brains` still returned `500 Internal Server Error`.
- Root cause:
  - Production server logs showed `Failed to proxy https://localhost:3001/brains ... EPROTO ... wrong version number` on signed-in shell requests.
  - The throw path is Next.js proxy handling of an upstream middleware rewrite target (`next/dist/server/lib/router-utils/proxy-request.js`).
  - Signed-in protected shell traffic was still reaching Clerk middleware handling, which allowed self-rewrite/proxy behavior on reverse-proxied production origin paths.
  - Prior assumption was incomplete: removing `/__clerk` matcher fixed stale proxy-mode cascades, but signed-in shell routes could still fail through a separate middleware rewrite path.
- Fix summary:
  - `proxy.ts` now short-circuits protected non-API shell routes:
    - no `__session` cookie: redirect to `/sign-in` with `redirect_url`.
    - with `__session` cookie: `NextResponse.next()` pass-through.
  - This bypasses Clerk middleware proxy handling for signed-in shell page requests while preserving fail-closed auth in shell layout.
  - Added regression coverage to assert signed-in `/brains` middleware pass-through without Clerk middleware invocation.
- Local validation:
  - Passed targeted suites:
    - `tests/proxy_apps_auth_protection.test.ts`
    - `tests/proxy_clerk_env_guard_contract.test.ts`
    - `tests/clerk_auth_route_runtime.test.tsx`
    - `tests/shell_layout_auth_fail_closed.test.tsx`
    - `tests/brains_api_auth_contract.test.ts`
    - `tests/brains_index_contract.test.ts`
    - `tests/brains_table_hydration_resilience.test.tsx`
  - `bash scripts/check_route_signatures.sh` passed.
  - `npm run build` passed.
  - `git diff --check` passed.
  - `npm test` remains red on unrelated baseline failure families outside this sprint scope (existing failures in Walmart/Studio/SiteForge/frontdoor suites).
- Production verification:
  - `/api/meta/release` reports SHA `b9e4a77bc142bfb319675589be9e4aa8756486e0` and build ID `2560558341`.
  - `/__clerk/v1/client` returns `404` (not `500`).
  - `/sign-in` returns `200` with Clerk UI markers.
  - `/sign-up` returns `200` with Clerk UI markers.
  - signed-out `/brains` returns `307` redirect to `/sign-in?redirect_url=.../brains`.
  - signed-out `/api/brains` and `/api/brains/ecomviper/stats` return `401`.
  - `/apps`, `/apps/studio`, `/studio`, `/siteforge`, and `/uapforge` return `404`.
  - `/` returns `200`.
  - Signed-in browser verification remains required with a real authenticated session to confirm My Brains renders all nine canonical brains and no Internal Server Error.
- Recommended next sprint:
  - run authenticated production browser verification for signed-in `/brains` and signed-in root CTA composition, then continue cleanup of unrelated baseline failure families.

## Sprint Completion Log: Standardize Standalone Brain Console UI

- Sprint: `sprint-021-standardize-brain-console-ui` (completed).
- MR: `!220` (`https://gitlab.com/cloudalien-technologies/ibrains-app/-/merge_requests/220`).
- MR pipeline: `2560603393` (status: `success`).
- Default-branch deploy pipeline: `2560606416` (status: `success`).
- Merge commit SHA: `4df0f76cbf48bd668da93698e371f5a5c2c9e5b9`.
- Deployed production SHA: `4df0f76cbf48bd668da93698e371f5a5c2c9e5b9`.
- Deployed production build ID: `2560606416`.
- Source branch deletion:
  - Remote: deleted by GitLab merge (`sprint-021-standardize-brain-console-ui`).
  - Local: pending final local cleanup in sprint closeout flow.
- User-visible issue:
  - Standalone brain routes had inconsistent or incorrect back-link behavior.
  - OptiBay/OptiWal/OptiZon still showed parent-style `Back to EcomViper` language.
  - EcomViper and iPetzo lacked the standard left-sidebar/right-workspace console shell.
- Implementation summary:
  - Added shared `components/brains/back-to-brains-link.tsx` with canonical `← Back to Brains` -> `/brains`.
  - Applied shared back-link behavior across standalone brain routes (`/ecomviper`, `/optibay`, `/optiwal`, `/optizon`, `/directoryiq`, `/casaflix`, `/pagebolt`, `/reelify`, `/ipetzo`).
  - Updated OptiBay and OptiWal layouts from `Back to EcomViper` to `Back to Brains`; OptiZon now includes canonical back-link shell framing.
  - Standardized EcomViper and iPetzo pages into explicit sidebar/workspace shell structure.
  - Reinforced OptiWal standalone identity by changing sidebar overline label from `ECOMVIPER` to `OPTIWAL`.
  - Added focused test coverage in `tests/brain_console_ui_contract.test.ts` and updated OptiBay shell expectations in `tests/ecomviper_ebay_command_center_shell.test.tsx`.
- Local validation summary:
  - targeted UI/route/auth suites passed:
    - `tests/brain_console_ui_contract.test.ts`
    - `tests/brains_index_contract.test.ts`
    - `tests/ecomviper_walmart_route_contract.test.tsx`
    - `tests/ecomviper_ebay_command_center_shell.test.tsx`
    - `tests/directoryiq_command_center_shell.test.tsx`
    - `tests/proxy_apps_auth_protection.test.ts`
  - `bash scripts/check_route_signatures.sh` passed.
  - `npm run build` passed.
  - `git diff --check` passed.
  - `npm test` remains red on unrelated baseline failure families outside Sprint 021 scope.
- Unrelated baseline `npm test` failure families:
  - `tests/ecomviper_walmart_products_persistence.test.ts`
  - `tests/studio_casahud_media_planning_engine.test.ts`
  - `tests/studio_casahud_youtube_package_engine.test.ts`
  - `tests/casahud_ai_channel_engine.test.ts`
  - `tests/siteforge_command_center_shell.test.tsx`
  - `tests/homepage_layout_contract.test.ts`
  - `tests/frontdoor_env_copy_contract.test.ts`
  - `tests/walmart/compliance.test.ts`
- Production verification summary:
  - `/api/meta/release` reports SHA `4df0f76cbf48bd668da93698e371f5a5c2c9e5b9` and build ID `2560606416`.
  - Signed-out standalone brain routes redirect to `/sign-in` with redirect targets preserved:
    - `/brains`
    - `/directoryiq`
    - `/optibay`
    - `/optiwal`
    - `/optizon`
    - `/ecomviper`
    - `/casaflix`
    - `/pagebolt`
    - `/reelify`
    - `/ipetzo`
  - Deprecated routes remain `404`:
    - `/apps`
    - `/apps/studio`
    - `/studio`
    - `/siteforge`
    - `/uapforge`
- Browser verification status:
  - Signed-in browser checks were not executable in this environment due to lack of authenticated session credentials.
  - Required manual production browser checks remain:
    - confirm `← Back to Brains` rendering/link target on all standalone brain routes.
    - confirm no `Back to EcomViper` on OptiBay/OptiWal/OptiZon.
    - confirm EcomViper and iPetzo sidebar/workspace shell rendering.
    - confirm no `/apps` links across brain consoles.
- Recommended next sprint:
  - run authenticated production browser verification checklist for standalone brain consoles and then continue unrelated baseline failure cleanup.

## Current Operating Reminder

- Do not begin a new sprint unless local repository is clean on `main`.
- Required baseline before any sprint:
  - `git switch main`
  - `git pull`
  - `git status` must be clean

## Authenticated Workspace Route Baseline

- Core routes:
  - `/dashboard`
  - `/brains`
  - `/tasks`
  - `/reports`
  - `/add-brain`
  - `/settings`
  - `/billing`
- Standalone brain routes:
  - `/ecomviper`
  - `/optibay`
  - `/optiwal`
  - `/optizon`
  - `/directoryiq`
  - `/casaflix`
  - `/pagebolt`
  - `/reelify`
  - `/ipetzo`
- Legacy `/apps` and `/apps/*` are removed with no redirect compatibility layer.
- Commerce relationship rule: OptiBay, OptiWal, and OptiZon are independent top-level brain routes and are not nested under EcomViper.

## Studio Naming Alignment Notes

- MR `!180` established the implementation-derived Studio product intent baseline.
- This sprint is scoped to docs/planning naming cleanup for Studio/CasaFlix.
- No application behavior changes are included; only planning-language alignment and legacy-name clarifications.

## DirectoryIQ Planning Continuity

- DirectoryIQ product intent is now the planning source of truth and was updated from implementation analysis in MR `!179`.
- MR `!179` pipeline/check evidence: pipeline `2532737593` passed (`verify_frontdoor_integrity`), then merged into `main`.
- Post-merge state for `directoryiq-product-intent`: remote and local branch deleted; local repository reset to clean `main`.
- Active DirectoryIQ planning/implementation direction: `sprint-001-directoryiq-foundation`.
- Current sprint focus: add architecture/builder planning files and align DirectoryIQ app to left-sidebar/right-workspace shell pattern without changing API/data behavior.
- Future DirectoryIQ sprint requirements must stay grounded in:
  - `planning/apps/directoryiq/product-intent.md`, and
  - observed implementation evidence under app/API/lib/tests.
- Do not invent requirements outside source-of-truth implementation and planning files.

## PageBolt Planning Continuity

- PageBolt now has a command-center foundation sprint active: `sprint-001-siteforge-command-center-foundation`.
- Follow-up render-fix sprint active: `sprint-002-siteforge-shell-render-fix`.
- Sprint scope is constrained to:
  - architecture/builder planning files under `planning/apps/siteforge/*`
  - lightweight shell alignment under `app/pagebolt/*` (sidebar + workspace frame)
  - focused shell contract tests
- Scope guard:
  - preserve existing PageBolt functionality and API semantics
  - no workflow rewrites, no data model changes, no dependency additions
- Render-fix diagnosis target:
  - shell files existed but route presentation still appeared standalone
  - verify and enforce layout ownership of shell framing so page content renders inside workspace region
- Source-of-truth evidence areas:
  - `app/pagebolt/*`
  - `app/api/siteforge/*`
  - `lib/siteforge/*`
  - `tests/siteforge*`

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

- Active sprint branch: `sprint-008-walmart-product-editor-score-alignment`
- Sprint goal: `align Walmart Product Editor/product-level score diagnostics to canonical WalmartAiVisibilityScore semantics`
- Scope guard: product-level adapter + product-editor consumer alignment + focused tests + planning updates only; no broad UI redesign, no scoring-service expansion.

## Sprint Completion Updates

- Sprint: `Walmart Sprint 006` - `Completed`
- Title: `Walmart AI Visibility Payload Fixture Contract`
- MR: `!197 (https://gitlab.com/cloudalien-technologies/ibrains-app/-/merge_requests/197)`
- Pipeline/checks result: `passed (pipeline 2534838600)`
- Merge commit SHA: `48487a3a843471e864b65654d4cdd1520485b1b6`
- Branch deletion status: `remote deleted yes, local deleted yes`
- Final local branch/status: `main clean`
- Next recommended sprint: `Walmart Sprint 007 - align Command Center rollup/readiness to canonical ai_visibility_score semantics`

- Sprint: `Walmart Sprint 007` - `Completed`
- Title: `Walmart Command Center Score Rollup Alignment`
- Outcome: `Command Center readiness/confidence rollups align to canonical ai_visibility_score semantics through walmart-command-center-score-rollup adapter boundary.`
- Next recommended sprint: `Walmart Sprint 008 - align Product Editor product-level diagnostics to canonical score semantics`

- Sprint: `Walmart Sprint 008` - `In Progress`
- Title: `Walmart Product Editor Score Alignment`
- Branch: `sprint-008-walmart-product-editor-score-alignment`
- Goal: `validate and harden Product Editor/product-level canonical WalmartAiVisibilityScore adapter-consumer contract coverage without broad UI/API changes`
- Current sprint delta files:
  - `tests/ecomviper_walmart_product_ai_visibility_score.test.ts`
  - `tests/ecomviper_walmart_product_editor_score_alignment.test.tsx`
  - `planning/apps/ecomviper/walmart/score-contract.md`
  - `planning/apps/ecomviper/walmart/ai-visibility-api-boundary.md`
  - `planning/apps/ecomviper/walmart/ai-visibility.md`
  - `planning/questions.md`
  - `planning/risks.md`
  - `planning/state.md`

- Sprint: `PageBolt Sprint 002` - `In Progress`
- Title: `PageBolt Shell Render Fix`
- Branch: `sprint-002-siteforge-shell-render-fix`
- Goal: `ensure /pagebolt visibly renders left sidebar + right workspace shell around existing workflow`
- Root-cause hypothesis under validation: `page-level standalone shell frame still dominated presentation; tests previously proved component existence but not route-shell ownership semantics`

- Sprint: `PageBolt Sprint 001` - `In Progress`
- Title: `PageBolt Command Center Foundation`
- Branch: `sprint-001-siteforge-command-center-foundation`
- Scope: `planning architecture/builder docs + lightweight PageBolt command-center shell`
- Files changed (planned in this sprint):
  - `planning/apps/siteforge/overview.md`
  - `planning/apps/siteforge/product-intent.md`
  - `planning/apps/siteforge/command-center-foundation.md`
  - `planning/apps/siteforge/architecture.md`
  - `planning/apps/siteforge/builder-workflow.md`
  - `planning/apps/siteforge/roadmap.md`
  - `app/pagebolt/layout.tsx`
  - `app/pagebolt/_components/siteforge-sidebar.tsx`
  - `lib/siteforge/siteforge-nav.ts`
  - `tests/siteforge_command_center_shell.test.tsx`
  - `planning/state.md`
- Validation executed:
  - `bash scripts/check_route_signatures.sh`
  - `npm test -- --run tests/siteforge*.test.ts tests/siteforge*.test.tsx`
  - `git diff --check`
- Functionality preservation statement: `PageBolt workflow/API behavior preserved; shell is presentation/layout-only.`

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

# Planning State

Last updated: 2026-05-30 (UTC)

## Program Status

- Track: `iBrains multi-app planning architecture and scoped sprint delivery`.
- Sprint 001: Completed (stabilization scope).
- Sprint 002: Completed (capability detection + telemetry scope).
- Sprint 003: Completed (deterministic extraction precedence + extraction-source metadata + stable warning codes).
- Sprint 004: Planned (typed warning/telemetry code contract).
- Sprint 005: Completed (Shopify guarded publish execution scaffold).
- Shopify Sprint 006: Completed and merged (`sprint-006-shopify-inventory-foundation`, Shopify-first `/ecomviper` inventory/listings foundation + PDP optimizer shell, production deployed).
- Shopify Sprint 007: Completed and merged (`sprint-007-rocktomic-supplier-intelligence`, Rocktomic supplier intelligence engine foundation + Dropshipping/Rocktomic route shell, production deployed).
- Shopify Sprint 008: Completed and merged (`sprint-008-ai-pdp-intelligence-engine`, AI PDP Intelligence Engine foundation for generate/edit/save/reopen in `/ecomviper` product editor, production deployed).
- Shopify Sprint 008.1: Completed and merged (`sprint-008-1-rocktomic-source-refresh`, Rocktomic source reference refresh before Sprint 009 Image Studio scope, production deployed).
- Shopify Sprint 008.2: Completed and merged (`sprint-008-2-brainos-rocktomic-integration-correction`, Rocktomic source-backed catalog/inventory ingestion correction + BrainOS `/ecomviper` dashboard standard + Shopify settings consolidation, production deployed).
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
- Shopify Sprint 009: Completed and merged (`sprint-009-source-grounded-product-editor`, source-grounded product intelligence + Product Editor redesign, production deployed).
- Shopify Hotfix Sprint 009.1: Completed and merged (`hotfix-009-1-brains-auth-redirect`, production auth redirect stall fix for `/brains` blank page, production deployed).
- Shopify Hotfix Sprint 009.2: Completed and merged (`hotfix-009-2-ibrains-dashboard-navigation`, restored `/brains` launcher and removed user-facing BrainOS branding, production deployed).
- Shopify Hotfix Sprint 009.3: Completed and merged (`hotfix-009-3-catalog-field-extraction-coa-mapping`, deterministic catalog field extraction + COA hyperlink mapping for Product Editor, production deployed).
- Shopify Hotfix Sprint 009.4: Completed and merged (`hotfix-009-4-universal-catalog-pricing-engine`, universal catalog extraction + membership pricing engine, production deployed).
- Shopify Hotfix Sprint 009.5: Completed and merged (`hotfix-009-5-production-504-proxy-timeout`, production 504 timeout diagnosis + middleware/public-route proxy loop fix, production proxy timeout guard shipped).
- Shopify Hotfix Sprint 009.6: Completed and merged (`hotfix-009-6-brains-open-brain-navigation`, launcher CTA navigation reliability fix for `/brains` Open Brain buttons).
- Shopify Hotfix Sprint 009.7: Completed and merged (`hotfix-009-7-frontdoor-auth-saturation-guard`, frontdoor anonymous auth saturation guard + production recovery deployment).
- Shopify Hotfix Sprint 009.8: Completed and merged (`hotfix-009-8-ecomviper-saturation-guard`, `/ecomviper` unauthenticated saturation guard + Rocktomic ingestion single-flight + protected-route malformed-session hardening, production deployed).
- Shopify Sprint 010: Completed and merged (`sprint-010-ecomviper-regression-hardening`, `/ecomviper` load-path optimization + CI verify guardrail expansion).
- Shopify Hotfix Sprint 010.1: Completed and merged (`hotfix-010-1-ecomviper-saturation-swr`, Rocktomic stale-while-revalidate cache + duplicate-source fetch dedupe + disconnected-workspace ingestion skip, production deployed).
- Shopify Stabilization Sprint 011: In progress (`stabilization-ecomviper-performance-architecture-audit`, end-to-end performance/architecture/production-safety audit and hardening).
- Current recommended sprint: `Shopify Sprint 011 planning` (next scoped execution after Sprint 010 closure).

## Active Sprint Note: Shopify Stabilization Sprint 011 (In Progress)

- Sprint/lane: `Shopify Stabilization Sprint 011` (`stabilization-ecomviper-performance-architecture-audit`) - in progress.
- Start date: `2026-05-30 (UTC)`.
- Objective:
  - harden EcomViper routes against blocking supplier ingestion,
  - enforce ingestion payload/timeout safety limits,
  - ensure Product Editor + PDP generation stay cache-only for supplier lookups,
  - verify auth/tenant/release safety contracts.
- Code hardening completed so far:
  - `lib/ecomviper/dropshipping/rocktomic-source-ingestion.ts`:
    - added strict payload ceilings for text/binary source fetches,
    - added cache-only mode with seed fallback snapshot behavior,
    - added runtime cache/refresh diagnostics (`cacheState`, `refreshState`).
  - `app/ecomviper/settings/page.tsx`:
    - Shopify status loads before supplier snapshot,
    - no supplier ingestion when Shopify disconnected,
    - cache-only supplier diagnostics mode.
  - `app/ecomviper/dropshipping/rocktomic/page.tsx`:
    - cache-only diagnostics mode and explicit cache/refresh visibility.
  - `lib/ecomviper/shopify/shopify-product-editor-state.ts`:
    - supplier abstraction lookup set to cache-only/no-background-refresh.
  - `app/api/ecomviper/pdp-intelligence/route.ts`:
    - supplier abstraction lookup set to cache-only/no-background-refresh.
  - `lib/ecomviper/shopify/shopify-pdp-intelligence-generator.ts`:
    - OpenAI request timeout added,
    - bounded fact context and completion token budget added.
- New/updated docs:
  - `planning/apps/ecomviper/shopify/performance-architecture.md`
  - `planning/apps/ecomviper/shopify/supplier-ingestion-architecture.md`
  - `planning/apps/ecomviper/shopify/production-safety.md`
- Focused validation completed:
  - `tests/ecomviper_dashboard_auth_guard.test.tsx`
  - `tests/ecomviper_settings_route_safety.test.tsx`
  - `tests/ecomviper_rocktomic_source_ingestion.test.ts`
  - `tests/ecomviper_pdp_intelligence_route.test.ts`
  - `tests/ecomviper_pdp_intelligence_generation.test.ts`
  - `tests/brains_route_redirect.test.ts`
  - `tests/ecomviper_shopify_route_consolidation.test.ts`
- Production observation during audit (`2026-05-30 UTC`):
  - bounded `curl --max-time 10` probes for `/api/health`, `/brains`, `/ecomviper`, `/ecomviper/settings`, `/ecomviper/dropshipping/rocktomic`, `/api/meta/release` all timed out (`code=000`, `~10s`), indicating current broad origin unavailability.

## Active Sprint Note: Emergency Stabilization Sprint (In Progress)

- Sprint/lane: `Emergency Stabilization Sprint` (`emergency-stabilization-production-runtime-client-crashes`) - in progress.
- Start date: `2026-05-30 (UTC)`.
- Objective:
  - stop repeated production runtime failures (`504`, route hangs, client crashes),
  - harden client/runtime fallbacks and route-level error boundaries,
  - strengthen release metadata reliability and deployment safety diagnostics.
- Code hardening completed so far:
  - added app/global + EcomViper route error boundaries:
    - `app/global-error.tsx`
    - `app/ecomviper/error.tsx`
    - `app/ecomviper/products/[productId-or-handle]/error.tsx`
  - added safe formatter helpers:
    - `lib/ui/safe-formatters.ts`
    - applied to dashboard/settings/rocktomic/product-editor client rendering.
  - hardened `/ecomviper` supplier snapshot call to cache-safe mode with async background refresh:
    - `allowRefresh: false`
    - `triggerBackgroundRefresh: true`
  - hardened `/api/meta/release` non-null fallback behavior + diagnostics.
  - switched release metadata writes to atomic script in CI/deploy:
    - `scripts/write_release_metadata.sh`
    - `.gitlab-ci.yml` updated to call script.
  - added production watchdog script:
    - `scripts/production_smoke_check.sh`.

## Sprint Completion Log: Shopify Hotfix Sprint 010.1 EcomViper Saturation SWR Guard

- Sprint/lane: `Shopify Hotfix Sprint 010.1` (`hotfix-010-1-ecomviper-saturation-swr`) - closed.
- Incident/diagnosis summary (`2026-05-30 15:18 UTC`):
  - production `https://app.ibrains.ai` timed out across `/`, `/sign-in`, `/ecomviper`, `/api/health`, `/api/meta/release`, indicating broad origin saturation rather than a single-route rendering failure.
  - `/ecomviper` still executed supplier ingestion work in disconnected-store scenarios.
  - Rocktomic source refresh could duplicate same-source fetch work inside a refresh pass and force synchronous refresh waits once cache expired.
- Chosen fix:
  - added stale-while-revalidate behavior to Rocktomic ingestion cache: stale snapshots are returned immediately while refresh continues in single-flight background mode.
  - deduplicated text/binary source fetches by URL within one refresh pass to avoid duplicate catalog downloads.
  - updated `/ecomviper` dashboard flow to skip supplier ingestion when Shopify is disconnected.
  - updated focused tests for disconnected ingestion skip and revised ingestion dedupe expectation.
- Files changed:
  - `app/ecomviper/page.tsx`
  - `lib/ecomviper/dropshipping/rocktomic-source-ingestion.ts`
  - `tests/ecomviper_dashboard_auth_guard.test.tsx`
  - `tests/ecomviper_rocktomic_source_ingestion.test.ts`
- Validation summary:
  - `npm test -- --run tests/ecomviper_dashboard_auth_guard.test.tsx tests/ecomviper_rocktomic_source_ingestion.test.ts tests/proxy_apps_auth_protection.test.ts tests/frontdoor_auth_state.test.ts tests/require_signed_in_user_auth_unavailable.test.ts`
  - `npm run build`
- MR: `!251` (`https://gitlab.com/cloudalien-technologies/ibrains-app/-/merge_requests/251`).
- MR pipeline: `2564074916` (status: `success`, `https://gitlab.com/cloudalien-technologies/ibrains-app/-/pipelines/2564074916`).
- Merge commit SHA: `29151518c92459ce6ec342be7c636e21e419bc9c`.
- Main/deploy pipeline: `2564077777` (status: `success`, includes `deploy_production`, `https://gitlab.com/cloudalien-technologies/ibrains-app/-/pipelines/2564077777`).
- Production/runtime verification (`2026-05-30 15:35 UTC`):
  - `GET https://app.ibrains.ai/` -> `200`.
  - `GET https://app.ibrains.ai/sign-in` -> `200`.
  - `GET https://app.ibrains.ai/ecomviper` -> `307` to sign-in (expected signed-out behavior).
  - `GET https://app.ibrains.ai/api/health` -> `200` (`ok: true`, `upstream_ok: true`).
  - `GET https://app.ibrains.ai/api/meta/release` -> `200` with `git_sha=29151518c92459ce6ec342be7c636e21e419bc9c`, `build_id=2564077777`.
- Branch deletion status:
  - remote: deleted on merge (`hotfix-010-1-ecomviper-saturation-swr` no longer present on `origin`).
  - local: deleted via `git branch -d hotfix-010-1-ecomviper-saturation-swr`.
- Final local branch/status:
  - `git switch main`
  - `git pull`
  - final status `## main...origin/main` (clean) before state closure update branch.
- Recommended next sprint: `Shopify Sprint 011 planning`.

## Sprint Completion Log: Shopify Sprint 010 EcomViper Regression Hardening

- Sprint/lane: `Shopify Sprint 010` (`sprint-010-ecomviper-regression-hardening`) - closed.
- Root cause:
  - signed-in `/ecomviper` server render fetched multiple dependencies sequentially, increasing stall risk under transient provider latency.
  - dashboard attempted Shopify product listing fetches even when Shopify connection was disconnected.
  - CI verify stage did not always enforce the newly added auth/saturation regression suites for `/ecomviper`.
- Chosen fix:
  - parallelized `/ecomviper` status fetches (Shopify connection/import/OpenAI + supplier diagnostics).
  - added soft timeout handling for Rocktomic diagnostics so dashboard render can proceed with explicit warning when supplier diagnostics are slow.
  - gated product listing fetch to run only when Shopify connection is active.
  - expanded GitLab `verify_frontdoor_integrity` test command to include focused frontdoor/auth and ecomviper/proxy saturation guard suites.
- Files changed:
  - `.gitlab-ci.yml`
  - `app/ecomviper/page.tsx`
  - `tests/ecomviper_dashboard_auth_guard.test.tsx`
- Validation summary:
  - `bash scripts/check_route_signatures.sh`
  - `npm test -- --run tests/ecomviper_dashboard_auth_guard.test.tsx tests/proxy_apps_auth_protection.test.ts tests/ecomviper_rocktomic_source_ingestion.test.ts tests/frontdoor_auth_state.test.ts tests/require_signed_in_user_auth_unavailable.test.ts`
  - `npm run build`
- MR: `!249` (`https://gitlab.com/cloudalien-technologies/ibrains-app/-/merge_requests/249`).
- MR pipeline: `2564052799` (status: `success`, `https://gitlab.com/cloudalien-technologies/ibrains-app/-/pipelines/2564052799`).
- Merge commit SHA: `84e241957dfa4fb10eb9f58934097d39c6b1683d`.
- Branch deletion status:
  - remote: deleted on merge (`sprint-010-ecomviper-regression-hardening` no longer present on `origin`).
  - local: deleted via `git branch -d sprint-010-ecomviper-regression-hardening`.
- Final local branch/status:
  - `git switch main`
  - `git pull`
  - final status `## main...origin/main` (clean) before state closure update branch.
- Recommended next sprint: `Shopify Sprint 011 planning`.

## Sprint Completion Log: Shopify Hotfix Sprint 009.8 EcomViper Saturation Guard

- Sprint/lane: `Shopify Hotfix Sprint 009.8` (`hotfix-009-8-ecomviper-saturation-guard`) - closed.
- Root cause:
  - unauthenticated or malformed-session requests could still execute heavy `/ecomviper` server work, including Rocktomic ingestion and external source processing.
  - concurrent refreshes of Rocktomic source ingestion did not dedupe in-flight execution per cache key, allowing refresh stampede behavior under burst traffic.
- Chosen fix:
  - `/ecomviper` page now redirects to `/sign-in` immediately when `requireSignedInUser()` is unauthorized/missing user id, before any ingestion or Shopify work starts.
  - Rocktomic ingestion now uses per-cache-key in-flight single-flight dedupe and clears in-flight state on completion/failure.
  - middleware protected-route pass-through now requires JWT-shaped `__session` cookies for `/ecomviper` API routes and protected shell routes.
  - added focused regression tests for auth short-circuit, proxy malformed cookie handling, and concurrent ingestion dedupe.
- Files changed:
  - `app/ecomviper/page.tsx`
  - `lib/ecomviper/dropshipping/rocktomic-source-ingestion.ts`
  - `proxy.ts`
  - `tests/ecomviper_dashboard_auth_guard.test.tsx`
  - `tests/ecomviper_rocktomic_source_ingestion.test.ts`
  - `tests/proxy_apps_auth_protection.test.ts`
  - `tests/ecomviper_walmart_route_contract.test.tsx`
- Validation summary:
  - `npm test -- tests/ecomviper_dashboard_auth_guard.test.tsx tests/proxy_apps_auth_protection.test.ts tests/ecomviper_rocktomic_source_ingestion.test.ts tests/ecomviper_walmart_route_contract.test.tsx`
  - `npm test -- tests/ecomviper_walmart_route_contract.test.tsx tests/require_signed_in_user_auth_unavailable.test.ts`
  - `npm run build`
- MR: `!247` (`https://gitlab.com/cloudalien-technologies/ibrains-app/-/merge_requests/247`).
- MR pipeline: `2564040489` (status: `success`, `https://gitlab.com/cloudalien-technologies/ibrains-app/-/pipelines/2564040489`).
- Merge commit SHA: `7f6992cea0d13d84aca87dea55b4edfdfd5b343b`.
- Branch deletion status:
  - remote: deleted on merge (`hotfix-009-8-ecomviper-saturation-guard` no longer present on `origin`).
  - local: deleted via `git branch -d hotfix-009-8-ecomviper-saturation-guard`.
- Final local branch/status:
  - `git switch main`
  - `git pull`
  - final status `## main...origin/main` (clean) before state closure update branch.
- Recommended next sprint: `Shopify Sprint 010 planning`.

## Sprint Completion Log: Shopify Hotfix Sprint 009.7 Frontdoor Auth Saturation Guard

- Sprint/lane: `Shopify Hotfix Sprint 009.7` (`hotfix-009-7-frontdoor-auth-saturation-guard`) - closed.
- Root cause:
  - public frontdoor auth state resolution attempted Clerk auth calls even for anonymous homepage requests.
  - during degraded external auth/runtime conditions, this path could amplify origin saturation and contribute to broad `504` behavior.
- Chosen fix:
  - short-circuited frontdoor auth state to `signed-out` when no `__session` cookie is present.
  - resolved signed-in frontdoor state from verified Clerk session cookie claims first, with Clerk auth as fallback only when needed.
  - reduced unnecessary Clerk dependency pressure for anonymous frontdoor traffic.
- Files changed:
  - `lib/auth/frontdoorAuthState.ts`
  - `tests/frontdoor_auth_state.test.ts`
- Validation summary:
  - `npm test -- tests/frontdoor_auth_state.test.ts tests/frontdoor_header_actions_auth_state.test.ts tests/frontdoor_public_route_auth_isolation.test.ts`
  - `npm test -- tests/clerk_env_contract_shared_logic.test.ts tests/clerk_layout_env_contract.test.ts tests/frontdoor_layout_chain_contract.test.ts tests/frontdoor_public_route_auth_isolation.test.ts tests/clerk_auth_routes_contract.test.ts tests/clerk_auth_route_runtime.test.tsx tests/proxy_clerk_env_guard_contract.test.ts tests/gitlab_deploy_pipeline_contract.test.ts`
  - `npm run build`
- MR: `!245` (`https://gitlab.com/cloudalien-technologies/ibrains-app/-/merge_requests/245`).
- MR pipeline: `2563902446` (status: `success`, `https://gitlab.com/cloudalien-technologies/ibrains-app/-/pipelines/2563902446`).
- Main/deploy pipeline: `2563909034` (status: `success`, includes `deploy_production`, `https://gitlab.com/cloudalien-technologies/ibrains-app/-/pipelines/2563909034`).
- Merge commit SHA: `26f191b776d298214612ffa50437449791b41a71`.
- Production/runtime status:
  - `GET https://app.ibrains.ai/` returned `200` (`2026-05-30 13:24 UTC`).
  - `GET https://app.ibrains.ai/sign-in` returned `200` (`2026-05-30 13:24 UTC`).
  - `GET https://app.ibrains.ai/api/meta/release` returned `200` with `git_sha=26f191b776d298214612ffa50437449791b41a71`, `build_id=2563909034`.
  - `GET https://app.ibrains.ai/api/health` returned `200` with `ok: true`, `upstream_ok: true`.
- Branch deletion status:
  - remote: deleted on merge (`hotfix-009-7-frontdoor-auth-saturation-guard` no longer present on `origin`).
  - local: deleted via `git branch -d hotfix-009-7-frontdoor-auth-saturation-guard`.
- Final local branch/status:
  - `git switch main`
  - `git pull`
  - final status `## main...origin/main` (clean) before state closure update branch.
- Recommended next sprint: `Shopify Sprint 010 planning`.

## Sprint Completion Log: Shopify Hotfix Sprint 009.6 Launcher Navigation Closure

- Sprint/lane: `Shopify Hotfix Sprint 009.6` (`hotfix-009-6-brains-open-brain-navigation`) - closed.
- Root cause:
  - `/brains` launcher cards used client-side Link navigation for `Open Brain`.
  - under degraded client transition/runtime conditions, clicks could appear no-op for operators.
- Chosen fix:
  - switched launcher CTA rendering in `components/brain-dock/BrainDockCard.tsx` from `next/link` to native anchor navigation.
  - preserved canonical target route resolution through existing `brainRoute(...)` mapping.
- Files changed:
  - `components/brain-dock/BrainDockCard.tsx`
- Validation summary:
  - passed focused launcher suites:
    - `tests/brains_index_contract.test.ts`
    - `tests/brains_table_hydration_resilience.test.tsx`
    - `tests/brain_views_contract.test.ts`
- MR: `!243` (`https://gitlab.com/cloudalien-technologies/ibrains-app/-/merge_requests/243`).
- MR pipeline: `2563809033` (status: `success`, `https://gitlab.com/cloudalien-technologies/ibrains-app/-/pipelines/2563809033`).
- Merge commit SHA: `1568e2d0a3e5c20fa645ccde30304e14add8bd42`.
- Branch deletion status:
  - remote: deleted on merge (`hotfix-009-6-brains-open-brain-navigation` no longer present on `origin`).
  - local: deleted via `git branch -d hotfix-009-6-brains-open-brain-navigation`.
- Final local branch/status:
  - `git switch main`
  - `git pull`
  - final status `## main...origin/main` (clean) before state closure update branch.
- Recommended next sprint: `Shopify Sprint 010 planning`.

## Sprint Completion Log: Shopify Hotfix Sprint 009.5 Production Closure

- Sprint/lane: `Shopify Hotfix Sprint 009.5` (`hotfix-009-5-production-504-proxy-timeout`) - closed.
- Initial incident timestamp: `2026-05-30 03:31 UTC` (first observed broad `504` in `app.ibrains.ai` nginx logs).
- Production diagnostics run:
  - `curl -I --max-time 10 http://127.0.0.1:3001/brains`
  - `curl -I --max-time 10 http://127.0.0.1:3001/ecomviper`
  - `curl --max-time 10 http://127.0.0.1:3001/api/health`
  - `curl --max-time 10 http://127.0.0.1:3001/api/meta/release`
  - `grep -R "localhost:3001\|127.0.0.1:3001\|https://localhost" -n /etc/nginx/sites-enabled /etc/nginx/conf.d`
  - `journalctl -u ibrains-app --since "30 minutes ago" --no-pager`
  - `tail -n 200 /var/log/ibrains-app/app.log`
  - `tail -n 200 /var/log/nginx/error.log`
  - `tail -n 200 /var/log/nginx/app.ibrains.ai.error.log`
  - `tail -n 200 /var/log/nginx/app.ibrains.ai.access.log`
  - `ss -tanp '( sport = :3001 )'`
  - `systemctl status ibrains-app --no-pager -l`
- Root cause (confirmed):
  - nginx upstream scheme/host is correct (`proxy_pass http://127.0.0.1:3001;`).
  - `/brains`, `/ecomviper`, `/api/health`, and `/api/meta/release` all timed out when the incident was active.
  - Trigger path reproduced locally on production host: `GET /robots.txt` hangs and logs `Failed to proxy https://localhost:3001/robots.txt ... EPROTO ... wrong version number`.
  - A single `robots.txt` hit can create runaway local self-connections on `127.0.0.1:3001`, spike `next-server` CPU, and saturate sockets, producing broad 504s for unrelated routes.
- Operational mitigation applied:
  - forced service recovery with `systemctl kill -s SIGKILL ibrains-app` + `systemctl start ibrains-app` after graceful stop hung in `deactivating (final-sigterm)`.
- Chosen fix:
  - `proxy.ts` now short-circuits non-protected routes (`if (!isProtectedRoute(req)) return NextResponse.next();`) before `clerkProxy` fallback.
  - explicit public passthrough routing now includes `/robots.txt`, `/sitemap.xml`, and `/llms.txt`.
  - added regression test ensuring `/robots.txt` stays public and does not invoke Clerk proxy middleware.
- MR: `!242` (`https://gitlab.com/cloudalien-technologies/ibrains-app/-/merge_requests/242`).
- MR pipeline: `2563658926` (status: `success`, `https://gitlab.com/cloudalien-technologies/ibrains-app/-/pipelines/2563658926`).
- Merge commit SHA: `56f75772de4a0cff4c667381d72b8c6fb3df5d9e`.
- Branch deletion status:
  - remote: deleted on merge (`hotfix-009-5-production-504-proxy-timeout` no longer present on `origin`).
  - local: deleted via `git branch -d hotfix-009-5-production-504-proxy-timeout`.
- Final local branch/status:
  - `git switch main`
  - `git pull`
  - final status `## main...origin/main` (clean).
- Recommended next sprint: `Shopify Sprint 010 planning`.

## Sprint Completion Log: Shopify Hotfix Sprint 009.4 Production Closure

- Sprint/lane: `Shopify Hotfix Sprint 009.4` (`hotfix-009-4-universal-catalog-pricing-engine`) - closed.
- Branch: `hotfix-009-4-universal-catalog-pricing-engine`.
- Root cause:
  - Catalog extraction still retained SKU-specific behavior from Hotfix 009.3 and did not provide universal deterministic field mapping for broader supplier SKU coverage.
  - Pricing/MSRP source existed but Product Editor did not support user-selected membership tier or selected-tier cost/profit/margin mapping.
  - Catalog PDF parsing order could run before catalog sheet parse, causing missing SKU-level COA/link diagnostics when hyperlinks were absent.
- Chosen fix:
  - implemented universal catalog extraction engine path (SKU detection, block extraction, field extraction, hyperlink association, deterministic diagnostics).
  - deferred PDF field mapping until after catalog sheet parse so SKU-aware diagnostics remain deterministic.
  - added supplier membership tier settings persistence + API + settings UI selector.
  - parsed membership-tier columns dynamically from PLDS/MSRP headers and mapped selected-tier wholesale cost into supplier intelligence.
  - updated Product Editor commerce/right-rail to show membership context, pricing status, and explicit no-tier prompt.
- Number of extracted catalog records (runtime):
  - source diagnostics now report parsed `catalog_pdf` record count as extracted SKU count (`catalogExtractedSkuCount`) instead of fixed seeded values.
- Files changed:
  - `lib/ecomviper/dropshipping/rocktomic-source-ingestion.ts`
  - `lib/ecomviper/dropshipping/rocktomic-supplier-intelligence.ts`
  - `lib/ecomviper/suppliers/supplier-intelligence.ts`
  - `lib/ecomviper/shopify/shopify-product-editor-state.ts`
  - `lib/ecomviper/settings/supplier-membership.ts`
  - `app/api/ecomviper/settings/supplier-membership/route.ts`
  - `app/api/ecomviper/pdp-intelligence/route.ts`
  - `app/ecomviper/settings/page.tsx`
  - `app/ecomviper/settings/supplier-membership-tier-form.tsx`
  - `app/ecomviper/page.tsx`
  - `app/ecomviper/products/[productId-or-handle]/product-editor-client.tsx`
  - `tests/ecomviper_rocktomic_source_ingestion.test.ts`
  - `tests/ecomviper_supplier_membership_route.test.ts`
  - `tests/ecomviper_settings_membership_ui_contract.test.ts`
  - `planning/design.md`
  - `planning/apps/ecomviper/shopify/architecture.md`
  - `planning/apps/ecomviper/shopify/product-editor-architecture.md`
  - `planning/apps/ecomviper/shopify/pdp-intelligence.md`
  - `planning/apps/ecomviper/shopify/inventory-architecture.md`
  - `planning/apps/ecomviper/shopify/coa-architecture.md`
  - `planning/apps/ecomviper/shopify/pricing-architecture.md`
  - `planning/state.md`
- Tests added/updated:
  - added:
    - `tests/ecomviper_supplier_membership_route.test.ts`
    - `tests/ecomviper_settings_membership_ui_contract.test.ts`
  - updated:
    - `tests/ecomviper_rocktomic_source_ingestion.test.ts`
    - `tests/ecomviper_product_editor_source_mapping.test.tsx`
    - `tests/ecomviper_pdp_intelligence_generation.test.ts`
- Validation summary:
  - focused hotfix suites passed:
    - `tests/ecomviper_rocktomic_source_ingestion.test.ts`
    - `tests/ecomviper_product_editor_source_mapping.test.tsx`
    - `tests/ecomviper_pdp_intelligence_generation.test.ts`
    - `tests/ecomviper_inventory_foundation_dashboard.test.tsx`
    - `tests/ecomviper_supplier_membership_route.test.ts`
    - `tests/ecomviper_settings_membership_ui_contract.test.ts`
  - `npm run build`: passed.
  - `git diff --check`: passed.
  - `npm test`: failed on unrelated existing baseline suites (observed families: Walmart product persistence, CasaFlix media planning/AI-channel contract); hotfix-focused suites passed.
- MR: `!240` (`https://gitlab.com/cloudalien-technologies/ibrains-app/-/merge_requests/240`).
- MR pipeline: `2563170056` (status: `success`, `https://gitlab.com/cloudalien-technologies/ibrains-app/-/pipelines/2563170056`).
- Main/deploy pipeline: `2563173861` (status: `success`, includes `build_release` + `deploy_production`, `https://gitlab.com/cloudalien-technologies/ibrains-app/-/pipelines/2563173861`).
- Merge commit SHA: `d5e28d3a594f56b23bb2b37861ae52c46e535ae4`.
- Production deployed commit SHA: `d5e28d3a594f56b23bb2b37861ae52c46e535ae4`.
- Production/runtime status:
  - `GET https://app.ibrains.ai/api/meta/release` reports `git_sha=d5e28d3a594f56b23bb2b37861ae52c46e535ae4`, `build_id=2563173861`.
  - `GET https://app.ibrains.ai/api/health` returned `200` with `ok: true`.
- Log inspection summary:
  - `journalctl -u ibrains-app` shows clean restart aligned with deploy window (`2026-05-30 03:12 UTC`).
  - nginx error log tail showed no new hotfix-specific auth/runtime faults during checks.
- Browser verification status:
  - signed-out checks (`2026-05-30 03:12 UTC`):
    - `https://app.ibrains.ai/brains` -> `307` to sign-in with preserved `redirect_url`.
    - `https://app.ibrains.ai/ecomviper` -> `307` to sign-in with preserved `redirect_url`.
    - `https://app.ibrains.ai/ecomviper/products/does-not-exist` -> `307` to sign-in with preserved `redirect_url`.
    - `https://app.ibrains.ai/ecomviper/settings` -> `307` to sign-in with preserved `redirect_url`.
  - authenticated browser verification remains follow-up for a signed-in session:
    - verify settings membership selector interaction and Product Editor Ingredients/Commerce/Assets mapped fields for matched SKU.
- Final status: closed (MR merged + green pipelines + production deploy + runtime/log checks + signed-out browser verification + closure metadata recorded).
- Risks/follow-ups:
  - universal PDF extraction is deterministic but constrained by text-layer quality; low-fidelity pages may still emit partial extraction diagnostics.
  - authenticated production walkthrough remains required for visual/no-console verification of tier pricing and SKU field hydration.

## Sprint Completion Log: Shopify Hotfix Sprint 009.3 Production Closure

- Sprint/lane: `Shopify Hotfix Sprint 009.3` (`hotfix-009-3-catalog-field-extraction-coa-mapping`) - closed.
- Branch: `hotfix-009-3-catalog-field-extraction-coa-mapping`.
- Root cause:
  - Rocktomic catalog PDF source was only fetch-checked; parsing was explicitly deferred in ingestion (`catalog_pdf` marked unparsed).
  - Product Editor and generator therefore consumed sparse seeded supplier records, leaving deterministic source fields as `Unknown` for matched SKU `ROC949`.
- Chosen fix:
  - added deterministic catalog PDF ingestion path with hyperlink parsing and SKU-field overlay for `ROC949`.
  - mapped required ingredient field model into supplier intelligence before AI generation.
  - extracted COA link from PDF hyperlink annotations; preserved deterministic diagnostics when hyperlink extraction fails.
  - wired Product Editor and PDP generation to consume mapped supplier fields directly.
- Files changed:
  - `lib/ecomviper/dropshipping/rocktomic-source-ingestion.ts`
  - `lib/ecomviper/dropshipping/rocktomic-supplier-intelligence.ts`
  - `lib/ecomviper/shopify/shopify-pdp-intelligence-generator.ts`
  - `app/ecomviper/products/[productId-or-handle]/product-editor-client.tsx`
  - `tests/ecomviper_rocktomic_source_ingestion.test.ts`
  - `tests/ecomviper_pdp_intelligence_generation.test.ts`
  - `tests/ecomviper_product_editor_source_mapping.test.tsx`
  - `planning/apps/ecomviper/shopify/product-editor-architecture.md`
  - `planning/apps/ecomviper/shopify/pdp-intelligence.md`
  - `planning/apps/ecomviper/shopify/coa-architecture.md`
  - `planning/apps/ecomviper/shopify/architecture.md`
  - `planning/state.md`
- Tests added/updated:
  - updated:
    - `tests/ecomviper_rocktomic_source_ingestion.test.ts`
    - `tests/ecomviper_pdp_intelligence_generation.test.ts`
  - added:
    - `tests/ecomviper_product_editor_source_mapping.test.tsx`
- Validation summary:
  - focused hotfix suites passed:
    - `tests/ecomviper_rocktomic_source_ingestion.test.ts`
    - `tests/ecomviper_pdp_intelligence_generation.test.ts`
    - `tests/ecomviper_product_editor_source_mapping.test.tsx`
  - `npm run build`: passed.
  - `git diff --check`: passed.
  - `npm test`: failed on unrelated existing baseline suites; hotfix-focused suites passed.
- MR: `!238` (`https://gitlab.com/cloudalien-technologies/ibrains-app/-/merge_requests/238`).
- MR pipeline: `2563133732` (status: `success`, `https://gitlab.com/cloudalien-technologies/ibrains-app/-/pipelines/2563133732`).
- Main/deploy pipeline: `2563136544` (status: `success`, includes `build_release` + `deploy_production`, `https://gitlab.com/cloudalien-technologies/ibrains-app/-/pipelines/2563136544`).
- Merge commit SHA: `4e7f609f32007f5a9a5ad7b6ed4c0c1dd2f4c60f`.
- Production deployed commit SHA: `4e7f609f32007f5a9a5ad7b6ed4c0c1dd2f4c60f`.
- Production/runtime status:
  - `GET https://app.ibrains.ai/api/meta/release` reports `git_sha=4e7f609f32007f5a9a5ad7b6ed4c0c1dd2f4c60f`, `build_id=2563136544`.
  - `GET https://app.ibrains.ai/api/health` returned `200` with `ok: true`.
  - `systemctl is-active ibrains-app` returned `active`.
- Log inspection summary:
  - `journalctl -u ibrains-app` shows clean restart aligned with deploy window (`2026-05-30 02:25 UTC`).
  - nginx error log tail showed no new hotfix-specific runtime/auth errors during post-deploy checks.
- Browser verification status:
  - signed-out checks (`2026-05-30 02:26 UTC`):
    - `https://app.ibrains.ai/brains` -> `307` to sign-in with preserved `redirect_url`.
    - `https://app.ibrains.ai/ecomviper` -> `307` to sign-in with preserved `redirect_url`.
    - `https://app.ibrains.ai/ecomviper/products/does-not-exist` -> `307` to sign-in with preserved `redirect_url`.
  - authenticated browser verification remains follow-up for a signed-in session:
    - confirm matched SKU (`ROC949`) Product Editor Ingredients/COA cards show extracted mapped fields in production session.
- Final status: closed (MR merged + green pipelines + production deploy + runtime/log checks + signed-out browser verification + closure metadata recorded).
- Risks/follow-ups:
  - deterministic ingredient facts currently include SKU field model overlay for `ROC949`; broader PDF table/OCR extraction can be expanded in Sprint 010+.
  - signed-in production browser walkthrough remains required for full visual/console verification.

## Sprint Completion Log: Shopify Hotfix Sprint 009.2 Production Closure

- Sprint/lane: `Shopify Hotfix Sprint 009.2` (`hotfix-009-2-ibrains-dashboard-navigation`) - closed.
- Branch: `hotfix-009-2-ibrains-dashboard-navigation`.
- Root cause:
  - Hotfix 009.1 temporarily redirected `/brains` to `/ecomviper`, which created a navigation loop when operators clicked the EcomViper back link to `/brains`.
  - User-facing naming still exposed `BrainOS` branding (`iBrains BrainOS Dashboard`) instead of the intended launcher name.
- Chosen fix:
  - restored `/brains` as a real launcher route with rendered app cards and no `/ecomviper` redirect.
  - standardized user-facing naming to `iBrains Dashboard` and updated back-link copy to `← iBrains Dashboard`.
  - replaced merchant-facing Rocktomic wording in primary EcomViper dashboard UI with supplier-neutral labels (`Supplier Feed`, `Supplier Records`, `Open supplier diagnostics`, `Matched`).
- Files changed:
  - `app/(shell)/brains/page.tsx`
  - `app/(shell)/brains/[id]/page.tsx`
  - `app/(shell)/error.tsx`
  - `app/ecomviper/ecomviper-dashboard-client.tsx`
  - `app/ecomviper/page.tsx`
  - `app/ecomviper/products/[productId-or-handle]/product-editor-client.tsx`
  - `components/brains/back-to-brains-link.tsx`
  - `lib/brains/brainCatalog.ts`
  - `docs/AUTH_CLERK_FOUNDATION.md`
  - `planning/design.md`
  - `planning/decisions.md`
  - tests listed below.
- Tests added/updated:
  - updated:
    - `tests/brains_route_redirect.test.ts`
    - `tests/brains_index_contract.test.ts`
    - `tests/brains_table_hydration_resilience.test.tsx`
    - `tests/brain_console_ui_contract.test.ts`
    - `tests/ecomviper_inventory_foundation_dashboard.test.tsx`
    - `tests/ecomviper_walmart_route_contract.test.tsx`
    - `tests/ecomviper_ebay_command_center_shell.test.tsx`
- Validation summary:
  - focused hotfix suites passed:
    - `tests/brains_index_contract.test.ts`
    - `tests/brains_route_redirect.test.ts`
    - `tests/brains_table_hydration_resilience.test.tsx`
    - `tests/brain_console_ui_contract.test.ts`
    - `tests/ecomviper_inventory_foundation_dashboard.test.tsx`
    - `tests/ecomviper_walmart_route_contract.test.tsx`
    - `tests/proxy_apps_auth_protection.test.ts`
  - `npm run build`: passed.
  - `git diff --check`: passed.
  - `npm test`: failed on unrelated pre-existing baseline suites outside hotfix scope (CasaFlix/SiteForge/Walmart/frontdoor baseline families); hotfix-focused suites passed.
- MR: `!236` (`https://gitlab.com/cloudalien-technologies/ibrains-app/-/merge_requests/236`).
- MR pipeline: `2563038331` (status: `success`, `https://gitlab.com/cloudalien-technologies/ibrains-app/-/pipelines/2563038331`).
- Main/deploy pipeline: `2563041020` (status: `success`, includes `build_release` + `deploy_production`, `https://gitlab.com/cloudalien-technologies/ibrains-app/-/pipelines/2563041020`).
- Merge commit SHA: `62e8242d47f4c06a670139c5bbb413cbc1426b34`.
- Production deployed commit SHA: `62e8242d47f4c06a670139c5bbb413cbc1426b34`.
- Production/runtime status:
  - `GET https://app.ibrains.ai/api/meta/release` reports `git_sha=62e8242d47f4c06a670139c5bbb413cbc1426b34`, `build_id=2563041020`.
  - `GET https://app.ibrains.ai/api/health` returned `200` with `ok: true`.
  - `systemctl is-active ibrains-app` returned `active`.
- Log inspection summary:
  - `journalctl -u ibrains-app` shows clean restart aligned with deploy window (`2026-05-30 00:40 UTC`).
  - app log tail shows normal `next start` startup and ready output.
  - nginx error log tail shows no new hotfix-specific auth/runtime faults.
- Browser verification status:
  - signed-out checks (`2026-05-30 00:41 UTC`):
    - `https://app.ibrains.ai/brains` -> `307` to sign-in with preserved `redirect_url`.
    - `https://app.ibrains.ai/ecomviper` -> `307` to sign-in with preserved `redirect_url`.
    - `https://app.ibrains.ai/ecomviper/products/does-not-exist` -> `307` to sign-in with preserved `redirect_url`.
  - authenticated browser verification remains follow-up for a signed-in session:
    - confirm `/brains` launcher renders cards and does not redirect to `/ecomviper`.
    - confirm `/ecomviper` back-link returns to `/brains` without loop.
    - confirm no browser console errors.
- Final status: closed (MR merged + green pipelines + production deploy + runtime/log checks + signed-out browser verification + closure metadata recorded).
- Risks/follow-ups:
  - signed-in production browser walkthrough remains required to capture visual/no-console-error verification of launcher and no-loop navigation.

## Sprint Completion Log: Shopify Hotfix Sprint 009.1 Production Closure

- Sprint/lane: `Shopify Hotfix Sprint 009.1` (`hotfix-009-1-brains-auth-redirect`) - closed.
- Branch: `hotfix-009-1-brains-auth-redirect`.
- MR: `!234` (`https://gitlab.com/cloudalien-technologies/ibrains-app/-/merge_requests/234`).
- MR pipeline: `2562998801` (status: `success`, `https://gitlab.com/cloudalien-technologies/ibrains-app/-/pipelines/2562998801`).
- Main/deploy pipeline: `2563001199` (status: `success`, includes `build_release` + `deploy_production`, `https://gitlab.com/cloudalien-technologies/ibrains-app/-/pipelines/2563001199`).
- Root cause:
  - `/brains` post-auth landing route was still configured as Clerk fallback but the launcher render path could intermittently stall into a blank shell during production auth handoff.
  - Result: users could complete sign-in and land on `/brains` with no actionable UI.
- Chosen route behavior:
  - implemented a production-safe server redirect at `/brains` to `/ecomviper` to eliminate blank launcher stalls before Sprint 010.
  - preserved existing protected-route auth behavior (`/brains` remains auth-gated, signed-out users still redirect to sign-in with preserved `redirect_url`).
- Files changed:
  - `app/(shell)/brains/page.tsx`
  - `tests/brains_index_contract.test.ts`
  - `tests/brains_route_redirect.test.ts`
- Tests added/updated:
  - added: `tests/brains_route_redirect.test.ts`
  - updated: `tests/brains_index_contract.test.ts`
- Validation summary:
  - focused hotfix route/auth/dashboard suites passed:
    - `tests/brains_index_contract.test.ts`
    - `tests/brains_route_redirect.test.ts`
    - `tests/proxy_apps_auth_protection.test.ts`
    - `tests/proxy_trusted_ingest_bypass.test.ts`
    - `tests/shell_layout_auth_fail_closed.test.tsx`
    - `tests/ecomviper_shopify_route_consolidation.test.ts`
    - `tests/ecomviper_inventory_foundation_dashboard.test.tsx`
  - `npm run build`: passed.
  - `git diff --check`: passed.
  - `npm test`: failed on unrelated pre-existing baseline suites outside hotfix scope (CasaFlix/SiteForge/Walmart/frontdoor baseline families); hotfix-focused suites passed.
- Merge commit SHA: `4d13d7250c7cda4968d96c64b49b745efa7c9f57`.
- Production deployed commit SHA: `4d13d7250c7cda4968d96c64b49b745efa7c9f57`.
- Production/runtime status:
  - `GET https://app.ibrains.ai/api/meta/release` reports `git_sha=4d13d7250c7cda4968d96c64b49b745efa7c9f57`, `build_id=2563001199`.
  - `GET https://app.ibrains.ai/api/health` returned `200` with `ok: true`.
  - `systemctl is-active ibrains-app` returned `active`.
- Log inspection summary:
  - `journalctl -u ibrains-app` shows clean restart aligned with deploy window (`2026-05-30 00:04 UTC`).
  - app log tail shows normal `next start` startup and ready output.
  - nginx error log tail shows no new hotfix-specific runtime/auth faults.
- Browser verification status:
  - signed-out checks (`2026-05-29 23:53 UTC`):
    - `https://app.ibrains.ai/brains` -> `307` to sign-in with preserved `redirect_url`.
    - `https://app.ibrains.ai/ecomviper` -> `307` to sign-in with preserved `redirect_url`.
    - `https://app.ibrains.ai/ecomviper/products/does-not-exist` -> `307` to sign-in with preserved `redirect_url`.
  - authenticated browser verification remains follow-up for a signed-in session.
- Final status: closed (MR merged + green MR/main pipelines + production deploy + runtime/log checks + signed-out browser verification + closure metadata recorded).
- Risks/follow-ups:
  - `/brains` launcher remains temporarily redirected to `/ecomviper`; restore a fully rendered BrainOS launcher in Sprint 010+ after deeper auth/launcher hardening.

## Sprint Completion Log: Shopify Sprint 009 Production Closure

- Sprint/lane: `Shopify Sprint 009` (`sprint-009-source-grounded-product-editor`) - closed.
- Branch: `sprint-009-source-grounded-product-editor`.
- MR: `!233` (`https://gitlab.com/cloudalien-technologies/ibrains-app/-/merge_requests/233`).
- MR pipeline: `2562951240` (status: `success`, `https://gitlab.com/cloudalien-technologies/ibrains-app/-/pipelines/2562951240`).
- Branch pipeline: `2562950962` (status: `success`, `https://gitlab.com/cloudalien-technologies/ibrains-app/-/pipelines/2562950962`).
- Main/deploy pipelines:
  - `2562957259` (status: `success`, merge commit deployment, `https://gitlab.com/cloudalien-technologies/ibrains-app/-/pipelines/2562957259`)
  - `2562967143` (status: `success`, planning/state closure metadata deployment, `https://gitlab.com/cloudalien-technologies/ibrains-app/-/pipelines/2562967143`)
- Merge commit SHA: `0e7edb00efb9d1e6420dc728807642f587ade690`.
- Production deployed commit SHA: `58443c2fbd1841caf575d8eebce37fd3caef93eb`.
- Root-cause and correction summary:
  - Product editor remained a long-scroll Sprint 008 foundation with limited source grounding and weak inventory/pricing/COA modeling.
  - Supplier matching and generation flows were Rocktomic-coupled and allowed supplier-facing wording to bleed into generated shopper-facing text.
  - Sprint 009 introduced supplier abstraction + source-grounded mapping enforcement + BrainOS tabbed editor redesign to keep critical commerce/trust facts above fold.
- Implementation summary:
  - supplier abstraction boundary added (`lib/ecomviper/suppliers/supplier-intelligence.ts`) and wired into product-editor state + PDP intelligence route.
  - Rocktomic source ingestion/config enriched for pricing/inventory/COA-aware supplier records and COA env-driven configured state.
  - PDP intelligence model expanded for source-grounded ingredient/trust/commerce/agentic/asset/schema fields.
  - PDP intelligence generator hardened to:
    - keep inventory quantity non-fabricated (status-only mapping)
    - force source-grounded ingredient/certification/inventory/pricing/COA mappings
    - sanitize shopper-facing outputs to avoid supplier platform disclosure.
  - Product Editor redesigned into BrainOS dense workspace:
    - compact header + status chips
    - left product rail
    - center tabs (`Overview`, `Ingredients`, `Trust & Compliance`, `Commerce`, `Agentic Visibility`, `Assets`, `SEO & Schema`)
    - right rail cards (`Commerce Intelligence`, `Shipping`, `COA`)
    - single sidebar navigation with brain icon identity.
- Documentation updates:
  - `planning/design.md` updated with Sprint 009 BrainOS product-editor extension and cross-brain scope.
  - added:
    - `planning/apps/ecomviper/shopify/architecture.md`
    - `planning/apps/ecomviper/shopify/pdp-intelligence.md`
    - `planning/apps/ecomviper/shopify/agentic-visibility.md`
    - `planning/apps/ecomviper/shopify/product-editor-architecture.md`
    - `planning/apps/ecomviper/shopify/inventory-architecture.md`
    - `planning/apps/ecomviper/shopify/coa-architecture.md`
- Validation summary:
  - focused Sprint 009/008.2/006-008 suites passed (Rocktomic ingestion/matching, inventory fallback, dashboard, PDP intelligence model/compliance/generation/route, product editor route contract).
  - `npm run build`: passed.
  - `git diff --check`: passed.
  - `npm test`: failed on unrelated pre-existing baseline suites outside Sprint 009 scope (CasaFlix/SiteForge/Walmart/frontdoor/homepage families), while Sprint 009-targeted suites passed.
- Source branch deletion:
  - Remote: deleted after merge.
  - Local: deleted.
- Final local repository state after sprint merge:
  - branch: `main`
  - status: clean (`git status` with no changes)
- Production/runtime status:
  - `GET https://app.ibrains.ai/api/meta/release` returns `git_sha=58443c2fbd1841caf575d8eebce37fd3caef93eb`, `build_id=2562967143`.
  - `GET https://app.ibrains.ai/api/health` returned `200` with `ok: true`.
  - `systemctl is-active ibrains-app` returned `active`.
- Log inspection summary:
  - `journalctl -u ibrains-app` shows clean restart/start at `2026-05-29 23:17 UTC` and `23:26 UTC` aligned with deployment pipelines.
  - nginx error log tail shows no new Sprint 009-specific runtime faults.
- Browser verification status:
  - verification date/time: `2026-05-29 23:18 UTC`.
  - checked via headless browser:
    - `https://app.ibrains.ai/ecomviper`
    - `https://app.ibrains.ai/ecomviper/dropshipping/rocktomic`
    - `https://app.ibrains.ai/ecomviper/shopify`
  - signed-out behavior: all protected routes redirect to sign-in with preserved `redirect_url`.
  - browser console error count: `0` during signed-out pass.
  - authenticated in-app visual verification (tabs/layout, live supplier matches) remains follow-up for a signed-in session.
- Final status: closed (merged + green MR/main pipelines + production deploy + runtime/log checks + signed-out browser verification + closure metadata recorded).
- Risks/follow-ups:
  - authenticated production UX verification required for final visual confirmation of source-grounded fields for real tenant data.

## Sprint Completion Log: Shopify Sprint 008.2 Production Closure

- Sprint/lane: `Shopify Sprint 008.2` (`sprint-008-2-brainos-rocktomic-integration-correction`) - closed.
- Branch: `sprint-008-2-brainos-rocktomic-integration-correction`.
- MR: `!231` (`https://gitlab.com/cloudalien-technologies/ibrains-app/-/merge_requests/231`).
- MR pipeline: `2562814083` (status: `success`, `https://gitlab.com/cloudalien-technologies/ibrains-app/-/pipelines/2562814083`).
- Main/deploy pipeline: `2562820126` (status: `success`, includes `build_release` + `deploy_production`, `https://gitlab.com/cloudalien-technologies/ibrains-app/-/pipelines/2562820126`).
- Merge commit SHA: `cbb08ca2923160f59ed7078533e34e723cea7959`.
- Production deployed commit SHA: `cbb08ca2923160f59ed7078533e34e723cea7959`.
- Root-cause summary (catalog/inventory ignored):
  - Rocktomic supplier intelligence was hardcoded to a static 6-product seed in `rocktomic-supplier-intelligence.ts`.
  - Source references were displayed/configured but had no fetch/parse/normalize ingestion boundary.
  - Inventory status in `/ecomviper` was derived from Shopify-only quantity logic and could not distinguish unknown/source-unavailable from out-of-stock.
- Implementation summary:
  - added `lib/ecomviper/dropshipping/rocktomic-source-ingestion.ts` with explicit source ingestion stages:
    - source config resolution
    - fetchability checks (including Google Sheets export URL conversion)
    - CSV parsing + SKU normalization
    - catalog and inventory record extraction
    - per-source diagnostics (`configured`, `fetchable`, `parsed`, `recordCount`, `lastCheckedAt`, redacted `lastError`)
  - updated `/ecomviper` inventory mapping to consume source-backed Rocktomic supplier products and inventory availability flags.
  - inventory status model now distinguishes:
    - `in_stock`
    - `low_stock`
    - `out_of_stock`
    - `unknown`
    - `inventory_source_unavailable`
  - corrected fallback semantics so unknown is no longer mislabeled as out-of-stock.
  - redesigned `/ecomviper` to BrainOS standard:
    - compact global iBrains header
    - one left sidebar nav
    - no duplicate horizontal module nav
    - compact workspace/status row
    - table-first workspace above fold
    - brain icon next to `EcomViper` name
  - consolidated Shopify workspace behavior:
    - `/ecomviper/shopify` now redirects to `/ecomviper/settings`
    - added `/ecomviper/settings` diagnostics view with Shopify/OpenAI/Rocktomic status
  - added design standard doc: `planning/design.md`.
- Files changed:
  - `app/ecomviper/page.tsx`
  - `app/ecomviper/ecomviper-dashboard-client.tsx`
  - `app/ecomviper/settings/page.tsx`
  - `app/ecomviper/shopify/page.tsx`
  - `app/ecomviper/dropshipping/rocktomic/page.tsx`
  - `lib/ecomviper/dropshipping/rocktomic-source-ingestion.ts`
  - `lib/ecomviper/dropshipping/rocktomic-supplier-intelligence.ts`
  - `lib/ecomviper/shopify/shopify-inventory-foundation.ts`
  - `lib/ecomviper/shopify/shopify-product-editor-state.ts`
  - `planning/design.md`
  - test updates/additions listed below.
- Tests added/updated:
  - added:
    - `tests/ecomviper_rocktomic_source_ingestion.test.ts`
    - `tests/ecomviper_inventory_status_fallback.test.ts`
    - `tests/ecomviper_shopify_route_consolidation.test.ts`
  - updated:
    - `tests/ecomviper_inventory_foundation_dashboard.test.tsx`
    - `tests/ecomviper_rocktomic_supplier_intelligence.test.ts`
    - `tests/ecomviper_rocktomic_route_shell.test.ts`
    - `tests/ecomviper_shopify_agentic_workspace.test.tsx`
    - `tests/ecomviper_walmart_route_contract.test.tsx`
- Validation summary:
  - focused Sprint 008.2 suites passed:
    - `tests/ecomviper_rocktomic_source_ingestion.test.ts`
    - `tests/ecomviper_rocktomic_supplier_intelligence.test.ts`
    - `tests/ecomviper_inventory_status_fallback.test.ts`
    - `tests/ecomviper_inventory_foundation_dashboard.test.tsx`
    - `tests/ecomviper_rocktomic_route_shell.test.ts`
    - `tests/ecomviper_shopify_agentic_workspace.test.tsx`
    - `tests/ecomviper_shopify_route_consolidation.test.ts`
    - `tests/ecomviper_rocktomic_source_config.test.ts`
  - Sprint 006/007/008 focused regressions passed:
    - `tests/ecomviper_product_editor_route_contract.test.ts`
    - `tests/ecomviper_pdp_intelligence_model.test.ts`
    - `tests/ecomviper_pdp_intelligence_compliance.test.ts`
    - `tests/ecomviper_pdp_intelligence_generation.test.ts`
    - `tests/ecomviper_pdp_intelligence_route.test.ts`
    - `tests/ecomviper_inventory_foundation_dashboard.test.tsx`
    - `tests/ecomviper_rocktomic_supplier_intelligence.test.ts`
    - `tests/ecomviper_rocktomic_route_shell.test.ts`
    - `tests/ecomviper_rocktomic_source_config.test.ts`
  - `npm run build`: passed.
  - `git diff --check`: passed.
  - `npm test`: failed on unrelated baseline suites outside Sprint 008.2 scope (including existing CasaFlix/SiteForge/Walmart baseline families).
- Source branch deletion:
  - Remote: deleted after merge.
  - Local: deleted.
- Final local repository state after sprint merge:
  - branch: `main`
  - status: clean (`git status` with no changes)
- Production/runtime status:
  - `GET https://app.ibrains.ai/api/meta/release` now reports `git_sha=cbb08ca2923160f59ed7078533e34e723cea7959`, `build_id=2562820126`.
  - `GET http://127.0.0.1:3001/api/health` returned `200` with `ok: true`.
  - `sudo systemctl is-active ibrains-app` returned `active`.
- Log inspection summary:
  - `journalctl -u ibrains-app` shows clean stop/start around deployment window (`2026-05-29 21:23 UTC`).
  - app log tail shows normal `next start` startup + ready lines; observed scanner-related proxy `EPROTO` noise remains unrelated baseline traffic.
  - nginx error log tail shows blocked scanner/dotfile/env probes (unrelated to sprint scope).
- Browser verification status:
  - verification date/time: `2026-05-29 21:26 UTC`.
  - checked via headless browser:
    - `https://app.ibrains.ai/ecomviper`
    - `https://app.ibrains.ai/ecomviper/dropshipping/rocktomic`
    - `https://app.ibrains.ai/ecomviper/shopify`
  - signed-out behavior: all protected routes redirect to sign-in with preserved `redirect_url`.
  - browser console error count: `0` during signed-out pass.
  - authenticated visual verification of in-app table layout and source diagnostics remains follow-up for a signed-in production session.
- Final status: closed (merged + green pipelines + production deploy + runtime/log checks + signed-out browser verification + planning closure recorded).
- Risks/follow-ups:
  - authenticated production UX pass still required for full signed-in layout validation (`/ecomviper`, `/ecomviper/settings`, `/ecomviper/dropshipping/rocktomic`).
  - COA repository source remains pending until source link is provided.

## Sprint Completion Log: Shopify Sprint 008.1 Production Closure

- Sprint/lane: `Shopify Sprint 008.1` (`sprint-008-1-rocktomic-source-refresh`) - closed.
- MR: `!229` (`https://gitlab.com/cloudalien-technologies/ibrains-app/-/merge_requests/229`).
- MR pipeline: `2562699028` (status: `success`, `https://gitlab.com/cloudalien-technologies/ibrains-app/-/pipelines/2562699028`).
- Merge commit SHA: `03a2471a6bdd3b9cd35dd0e6182d891581134110`.
- Production deploy pipeline: `2562705053` (status: `success`, includes `deploy_production`, `https://gitlab.com/cloudalien-technologies/ibrains-app/-/pipelines/2562705053`).
- Production deployed commit SHA: `03a2471a6bdd3b9cd35dd0e6182d891581134110`.
- Implementation summary:
  - refreshed Rocktomic configured source references to latest provided catalog/template/policy/sheet links.
  - switched MSRP + margins, PLDS catalog, and inventory report references to configured status.
  - preserved COA Repository as the only pending reference.
  - updated Dropshipping -> Rocktomic source table with direct source links.
  - updated Rocktomic source-config/route tests to assert configured vs pending counts.
- Validation summary:
  - focused Rocktomic suites passed:
    - `tests/ecomviper_rocktomic_source_config.test.ts`
    - `tests/ecomviper_rocktomic_route_shell.test.ts`
    - `tests/ecomviper_rocktomic_supplier_intelligence.test.ts`
  - `npm run build`: passed.
  - `git diff --check`: passed.
- Source branch deletion:
  - Remote: deleted (`sprint-008-1-rocktomic-source-refresh` removed on origin after merge).
  - Local: deleted.
- Final local repository state after sprint merge:
  - branch: `main`
  - status: clean (`git status` with no changes)
- Production/runtime status:
  - `GET https://app.ibrains.ai/api/meta/release` returns `git_sha=03a2471a6bdd3b9cd35dd0e6182d891581134110`, `build_id=2562705053`.
  - `GET http://127.0.0.1:3001/api/health` returned `200` with `ok: true`.
  - `sudo systemctl is-active ibrains-app` returned `active`.
- Log inspection summary:
  - `journalctl -u ibrains-app` shows clean stop/start at deploy window (`2026-05-29 20:11 UTC`).
  - app log tail shows normal `next start` startup + ready lines.
  - nginx error tail contains unrelated blocked scanner requests for dotfiles/env paths.
- Browser verification status:
  - verification date/time: `2026-05-29 20:11 UTC`.
  - checked `https://app.ibrains.ai/ecomviper/dropshipping/rocktomic` via headless browser.
  - route redirected to sign-in with preserved `redirect_url` (expected for signed-out protected route).
  - browser console error count: `0`.
- Follow-up risks/tasks:
  - COA repository source remains pending final link/click target from user.

## Sprint Completion Log: Shopify Sprint 008 Production Closure

- Sprint/lane: `Shopify Sprint 008` (`sprint-008-ai-pdp-intelligence-engine`) - closed.
- MR: `!227` (`https://gitlab.com/cloudalien-technologies/ibrains-app/-/merge_requests/227`).
- Pipeline: `2561367558` (status: `success`, `https://gitlab.com/cloudalien-technologies/ibrains-app/-/pipelines/2561367558`).
- Merge commit SHA: `a56ec4983bd43a6c914ab00cb3e6cabe565a329c`.
- Production deployment status: completed manually on production host per `docs/PRODUCTION_DEPLOYMENT.md`.
- Production deployed commit SHA: `a56ec4983bd43a6c914ab00cb3e6cabe565a329c`.
- Implementation summary:
  - added typed Shopify PDP intelligence record + FAQ schema fields.
  - added server-side generation/compliance/persistence modules and `/api/ecomviper/pdp-intelligence` route.
  - updated `/ecomviper` product editor with generate/edit/save/reopen AI PDP intelligence workflow.
  - preserved explicit placeholders for Buy Now links, Image Studio, and Publish controls.
  - added Sprint 008 sprint-pack docs and migration SQL for `shopify_pdp_intelligence`.
- Validation summary:
  - focused Sprint 008 tests passed:
    - `tests/ecomviper_pdp_intelligence_model.test.ts`
    - `tests/ecomviper_pdp_intelligence_compliance.test.ts`
    - `tests/ecomviper_pdp_intelligence_generation.test.ts`
    - `tests/ecomviper_pdp_intelligence_route.test.ts`
  - Sprint 006/007 regression checks passed:
    - `tests/ecomviper_product_editor_route_contract.test.ts`
    - `tests/ecomviper_inventory_foundation_dashboard.test.tsx`
    - `tests/ecomviper_rocktomic_supplier_intelligence.test.ts`
    - `tests/ecomviper_rocktomic_route_shell.test.ts`
    - `tests/ecomviper_rocktomic_source_config.test.ts`
  - `npm run build`: passed.
  - `git diff --check`: passed.
  - `npm test`: failed on known unrelated baseline suites outside Sprint 008 scope.
- Source branch deletion:
  - Remote: deleted (merged with source-branch removal).
  - Local: deleted.
- Final local repository state after sprint merge:
  - branch: `main`
  - status: clean (`git status` with no changes)
- Production/runtime status:
  - `GET http://127.0.0.1:3001/api/health` returned `200` with `ok: true`.
  - service restart status: `ibrains-app` active after `sudo systemctl restart ibrains-app`.
  - release metadata endpoint (`/api/meta/release`) still reports missing `git_sha/build_id`.
- Log inspection summary:
  - `journalctl -u ibrains-app` shows clean restart and active service state at deploy time.
  - app log tail shows normal `next start` startup/ready lines.
  - nginx error tail only shows unrelated blocked scanner request (`/.git/config`).
- Browser verification status:
  - verification date/time: `2026-05-29 09:34 UTC`.
  - checked `https://app.ibrains.ai/ecomviper`, `/ecomviper/products/does-not-exist`, and `/ecomviper/dropshipping/rocktomic`.
  - protected routes redirected to sign-in with preserved `redirect_url`.
  - no browser console runtime errors observed in signed-out verification.
  - authenticated in-app generation/save/reopen verification remains pending a real signed-in production session.
- Production issues found:
  - migration script step reported missing direct `DATABASE_URL` export in shell; runtime repository still auto-creates `shopify_pdp_intelligence` table as needed.
- Follow-up risks/tasks:
  - perform authenticated production pass for product table -> PDP editor -> generate/save/reopen.
  - restore release metadata stamping so `/api/meta/release` reports deployed commit/build identifiers.

## Sprint Completion Log: Shopify Sprint 007 Production Closure

- Sprint/lane: `Shopify Sprint 007` (`sprint-007-rocktomic-supplier-intelligence`) - closed.
- Recovery context:
  - droplet disconnect interrupted branch work before commit/MR.
  - resumed on `2026-05-29` by validating branch integrity and partial diff state before continuing.
- MR: `!225` (`https://gitlab.com/cloudalien-technologies/ibrains-app/-/merge_requests/225`).
- Pipeline: `2561293892` (status: `success`, `https://gitlab.com/cloudalien-technologies/ibrains-app/-/pipelines/2561293892`).
- Merge commit SHA: `1e94759c49cfa8fb711e64de3458122a998ce038`.
- Production deployment status: completed manually on production host per `docs/PRODUCTION_DEPLOYMENT.md`.
- Production deployed commit SHA: `1e94759c49cfa8fb711e64de3458122a998ce038`.
- Validation summary:
  - focused suites passed:
    - `npm test -- tests/ecomviper_rocktomic_supplier_intelligence.test.ts`
    - `npm test -- tests/ecomviper_rocktomic_route_shell.test.ts`
    - `npm test -- tests/ecomviper_rocktomic_source_config.test.ts`
    - `npm test -- tests/ecomviper_inventory_foundation_dashboard.test.tsx`
    - `npm test -- tests/ecomviper_product_editor_route_contract.test.ts`
  - `npm run build`: passed.
  - `git diff --check`: passed.
  - `npm test`: failed on existing unrelated baseline suites outside Sprint 007 scope.
- Source branch deletion:
  - Remote: deleted (merged with source-branch removal).
  - Local: deleted.
- Final local repository state after sprint merge:
  - branch: `main`
  - status: clean (`git status` with no changes)
- Production/runtime status:
  - local health endpoint after deploy: `GET http://127.0.0.1:3001/api/health` returned `200` with `ok: true`.
  - service restart status: `ibrains-app` active after `sudo systemctl restart ibrains-app`.
  - release metadata endpoint (`/api/meta/release`) currently reports `git_sha/build_id` as `null`, so commit confirmation used local deployed `HEAD` ancestry instead.
- Log inspection summary:
  - `journalctl -u ibrains-app` shows clean restart and active service state after deploy.
  - app log tail shows normal `next start` startup/ready lines.
  - nginx error tail only shows unrelated blocked scanner requests (`/.git/config`).
- Browser verification status:
  - verification date/time: `2026-05-29 09:06-09:07 UTC`.
  - checked `https://app.ibrains.ai/`, `/ecomviper`, `/ecomviper/dropshipping/rocktomic`, and `/ecomviper/products/does-not-exist` via headless browser.
  - protected `/ecomviper*` routes redirected to sign-in with preserved `redirect_url`.
  - no browser console runtime errors observed in this signed-out verification pass.
  - authenticated in-app workflow verification still requires a real signed-in production session.
- Production issues found: none blocking deployment or service health.
- Follow-up risks/tasks:
  - add/repair release metadata stamping so `/api/meta/release` returns deployed commit/build identifiers.
  - perform authenticated browser pass for `/ecomviper` dashboard and product-editor interactions.

## Sprint Completion Log: Shopify Sprint 006 Production Closure

- Sprint/lane: `Shopify Sprint 006` (`sprint-006-shopify-inventory-foundation`) - closed.
- MR: `!223` (`https://gitlab.com/cloudalien-technologies/ibrains-app/-/merge_requests/223`).
- Pipeline: `2561198984` (status: `success`, `https://gitlab.com/cloudalien-technologies/ibrains-app/-/pipelines/2561198984`).
- Merge commit SHA: `7d5e5ca5799b411cca1d85b93325f450612957c3`.
- Production deployment status: completed manually on production host per `docs/PRODUCTION_DEPLOYMENT.md`.
- Production deployed commit SHA: `7d5e5ca5799b411cca1d85b93325f450612957c3`.
- Production deployment summary:
  - SSH to production host, verified `/root/ibrains-app` on `main`.
  - `git fetch`, `git switch main`, `git pull --ff-only`.
  - verified Sprint 006 merge commit ancestry on deployed `HEAD`.
  - `npm ci`, `npm run build`, `bash scripts/apply_directoryiq_schema.sh`.
  - `sudo systemctl restart ibrains-app` and health/log checks.
- Service/runtime status:
  - `ibrains-app` systemd service active after restart.
  - `GET http://127.0.0.1:3001/api/health` returned `200` with `ok: true`.
  - `GET https://app.ibrains.ai/api/meta/release` reports `git_sha=7d5e5ca5799b411cca1d85b93325f450612957c3` and `build_id=2561205429`.
- Log inspection summary:
  - no new service-level errors in `journalctl -u ibrains-app` after restart.
  - no new post-ready app-log errors in `/var/log/ibrains-app/app.log`.
  - nginx error log tail only showed unrelated blocked scanner request.
- Browser verification status:
  - verification date/time: `2026-05-29 08:32-08:34 UTC`.
  - checked `https://app.ibrains.ai/ecomviper` and `/ecomviper/products/does-not-exist` via headless browser.
  - both routes loaded and correctly redirected to Clerk sign-in with preserved `redirect_url`.
  - no browser console runtime errors observed in this signed-out verification.
  - authenticated in-app IA/table/editor verification remains dependent on a real signed-in production session.
- Production issues found: none blocking deployment or service health.
- Follow-up risks/tasks:
  - perform authenticated browser pass for `/ecomviper` IA/table/row-to-editor UX using a real production user session to complete signed-in UX confirmation.
- Closure statement:
  - Sprint 006 is closed for merge, pipeline, deployment, runtime health, and signed-out browser verification; authenticated UX verification is tracked as a follow-up task, not a deployment blocker.

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

# Planning State

Last updated: 2026-06-04 (UTC) — FileIQ worker server-only crash-loop fix + maxTurns raise (DELIVERED)

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
- Shopify Stabilization Sprint 009.6: In progress (`stabilization-009-6-supplier-data-pipeline-normalized-sku-intelligence`, normalized supplier sync pipeline + SKU intelligence persistence hardening).
- Admin Foundation Sprint: In progress (`admin-foundation-ecomviper-supplier-intelligence`, internal `/admin` route foundation + EcomViper supplier intelligence console).
- Shopify Hotfix Sprint 009.8 Data Binding: Merged and production deployed (`hotfix-009-8-global-supplier-data-scope-product-editor-binding`, global supplier normalized data boundary + merchant membership/Product Editor binding correction); mandatory signed-in desktop/mobile verification is still blocked pending an authenticated browser session.
- Shopify Hotfix Sprint 009.9: In progress (`hotfix-009-9-all-sku-supplier-field-mapping-product-editor-binding`, deterministic all-SKU sourceFacts field mapping + Product Editor/Generate Intelligence binding + settings tier auth save reliability).
- Shopify Phase 5.1 Route Reconciliation: In progress (`sprint-5-1-remove-duplicate-shopify-product-route`, global removal of mistaken duplicate `/ecomviper/shopify/products/[productId-or-handle]` merchant route family).
- Shopify Phase 5.2 Product Editor Default Front Image: Completed and merged (`sprint-5-2-product-editor-default-front-image`, canonical Product Editor defaults main gallery image to best front/primary/featured candidate for all products).
- Shopify Phase 6.1 AI Copywriting Agent Contract + Eval Harness: Completed and merged (`sprint-6-1-ai-copywriting-agent-contract-evals`, all-product contract/schema/prompt/eval harness foundation with no live Product Editor or Generate Intelligence behavior change).
- Shopify Phase 6.2 Generate Intelligence Copywriting Agent Binding: Completed and merged (`sprint-6-2-generate-intelligence-copywriting-agent`, review-only Generate Intelligence model binding using all-product copywriting contract).
- Shopify Phase 6.2.1 Generate Intelligence Signed-In Production Hotfix: In progress (`sprint-6-2-1-generate-intelligence-prod-hotfix`, fix signed-in Generate Intelligence production failure caused by incorrect localhost HTTPS proxy behavior + safe error mapping/UI stale-state handling).
- Shopify Phase 6.2.2-C Live Source Facts + Merchant Output Fix: Completed and merged (`sprint-6-2-2-c-live-generate-intelligence-source-facts`, live Generate Intelligence source-facts parity + output sanitization + Product Editor merchant wording cleanup; production deployed; signed-in browser QA pending user verification).
- Shopify Phase 6.2.2-D Live Supplier Facts Hydration Fix: In progress (`sprint-6-2-2-d-live-supplier-facts-hydration`, live route supplier-facts rehydration by SKU + compact trace read-source diagnostics to prevent false `image_only` degradation when structured facts exist).
- Shopify Phase 6.2.2-E Per-SKU Hydration + Compliance False-Block Fix: In progress (`sprint-6-2-2-e-hydration-compliance-fix`, parity diagnostics expansion + ROC123/ROC948 class hydration/compliance hardening).
- Shopify Phase 6.3 Firecrawl Supplier Intelligence Extractor Foundation: Completed and merged (`sprint-6-3-firecrawl-supplier-intelligence-extractor`, Firecrawl-backed supplier extraction foundation + normalized package schema/provenance/validation and ROC948 fixture proof; MR `!308`, pipeline `2568207604` success).
- Shopify Phase 6.3.1 Rocktomic Live Source Parser (Firecrawl cache + PyMuPDF + CSV foundation): Completed and merged (`sprint-6-3-1-rocktomic-live-source-parser`, MR `!310`, pipeline `2568493491` success).
- Shopify Phase 6.3.2 Rocktomic Supplement Facts Panel Extraction: Completed and merged (`sprint-6-3-2-rocktomic-supplement-facts-panel-extraction`, MR `!312`, pipeline `2568627769` success, production release SHA verified).
- Shopify Phase 6.4 Rocktomic Master Package Builder: Completed and merged (`sprint-6-4-rocktomic-master-package-builder`, MR `!315`, pipeline `2570381373` success, merge SHA `c363135be8f521979e29af09a34b3632c60ec378`, production deployed and verified).
- Shopify Phase 6.5 Rocktomic Package Reader + EcomViper Wiring: Completed and merged (`sprint-6-5-ecomviper-rocktomic-package-reader`, merge SHA `659133488cd4034c3f516070e8e97fff2171f986`, build `2570565864`, production deployed and verified).
- Repo Cleanup Sprint: Zero-Risk Dead/Orphaned/Codex-Leftover Removal: Completed and merged (`chore/dead-code-zero-risk-cleanup`, MR `!317`, pipeline `2572377219` success, squash SHA `0541cf8a13933b072a50da27f0ecf64db0590390`, merge SHA `dffb1fc50d0b2d25d2a8a8ab8bac30039c70e9d2`, remote + local branch deleted).
- Repo Hygiene Sprint: Untrack Committed artifacts/ui-audit Output: Completed and merged (`chore/untrack-ui-audit-artifacts`, MR `!318`, pipeline `2572390860` success, squash SHA `2cd8a1f32023f406485de591b9252f5cce491d1e`, merge SHA `c8389fe1bd8b74e1cbbb4ab19443b9aad930bbc2`, remote + local branch deleted). `git rm --cached` on the 5 previously-tracked ui-audit markdown files so the existing `artifacts/` gitignore rule takes effect; on-disk copies restored locally from history as ignored files.
- Dead Export & Import Cleanup Sprint (EcomViper + Brains): QUEUED (planning-only, not started). Sprint pack at `planning/apps/ecomviper/sprints/sprint-dead-export-cleanup/`. Removal-only follow-up covering verified-unused exports/imports in live modules (`walmart-products`, `walmart-optimization-rules`, `serpapi-walmart-images`, `walmart-import-enrichment`, `shopify-live-hydrator`, `brainCatalog`) + 2 unused imports; all candidates verified zero-external-reference at queue time. Excludes test-only orphans and docs (separate tiers). Builder branch: `chore/ecomviper-dead-export-cleanup`.
- Test-Only Orphan Modules Sprint (EcomViper + Brains): QUEUED (planning-only, not started). Sprint pack at `planning/apps/ecomviper/sprints/sprint-test-only-orphans/`. Wire-or-remove decision for 8 modules imported only by their own test (3 Remove-lean: pdp-intelligence-generator, product-editor-publish-workflow, google-sheets-csv; 5 Decide: supplier-intelligence-read-model, templates-playwright, walmart-docket-diagnostics, answerOrchestration, youtubeWatchDiscovery). Requires per-module owner decision; not blind removal. Builder branch: `chore/ecomviper-test-only-orphan-cleanup`.
- Stale DirectoryIQ Docs Audit Sprint: QUEUED (planning-only, not started). Sprint pack at `planning/apps/directoryiq/sprints/sprint-stale-docs-audit/`. Docs-only audit-and-archive of 14 `directoryiq-*` migration/audit docs in `docs/`; default Archive (git mv to `planning/apps/directoryiq/history/`) over delete; requires ground-truth check that the migration shipped. Builder branch: `chore/directoryiq-stale-docs-audit`.
- FileIQ Phase 1.0 Internal Brain Foundation: Completed and merged (`feat-fileiq-internal-brain-foundation`, MR `!319`, merge SHA `ac330130`, production deployed and verified). Claude Agent SDK ingestion-brain foundation at `/fileiq` — Agent SDK backbone + UI shell + internal route protection + shared-DB type/schema/planning contracts; planning-only, no migrations/OCR/live parsing. Bundled `fix(ci)` for the `build_release` tar `public/` blocker. Post-deploy `/fileiq` 500 fixed by MR `!322` (merge SHA `c9c5efe`, production verified): explicit `app/not-found.tsx` + nav gating for unbuilt routes.
- FileIQ Phase 1.1 Source Registry + UI Overhaul: Completed and merged (merge SHA `61d2734`, production deploy pending). Bundled two sprints: (1) `feat-fileiq-source-registry-phase-1-1` — source registry DB migration (`fileiq_source_bundles`, `fileiq_source_files`), Source Bundles route shell, untracked-pull-conflict deploy guard; (2) `feat-fileiq-ui-overhaul` — iBrains global header (IbrainsWorkspaceShell + ConfiguredClerkProvider), FileIQ registered in brains catalog at `/brains`, sidebar cleaned to 2 ready items (no SOON badges), Command Center redesigned as ingestion workspace (drop zone + URL input + jobs table); `fix(smoke)` retry backoff for SHA/build_id comparison to eliminate every-deploy timing race.
- CI Split Deploy Pipeline: Completed and merged (`feat/ci-split-deploy-fast-path`, MR `!326`, merge SHA `8261ca0`, remote + local branch deleted). Split `deploy_production` into two mutually-exclusive jobs: `deploy_production_fast` (UI/config changes — SCP pre-built `.next` artifact, skip `npm ci` + `npm run build` on server, ~1–2 min) and `deploy_production` (dep/server changes — full `npm ci` + `npm run build`, ~9 min). Fast path triggered when none of `package.json`, `package-lock.json`, `lib/**`, `app/api/**`, `middleware.ts`, `next.config.mjs`, `tsconfig.json`, `tailwind.config.*`, `db/**` changed. Pipeline contract test extended with 4 new assertions; all tests green.
- FileIQ Phase 1.2 Extraction Jobs (Live Agent Sessions): Completed and merged (`feat/fileiq-phase-1-2-extraction-jobs`, merge SHA `84fc3995300ac98ccec19f2b8c123ce3532e30f1`, build `2574432444`, production deployed and verified). Live Claude Agent SDK extraction pipeline wired end-to-end: `POST /api/fileiq/ingest` registers source bundle + files/URLs in DB, creates extraction job, runs `runFileIqExtractionAgent`, writes raw extraction payload, updates job status; `GET /api/fileiq/jobs` returns recent jobs for Command Center table; migration `20260604_fileiq_extraction_jobs.sql` adds `fileiq_extraction_jobs` + `fileiq_raw_extractions` tables; `lib/fileiq/fileiq-db.ts` typed DB helpers; Extraction Jobs page (`/fileiq/extraction-jobs`) added; Command Center Ingest button live; `/api/fileiq(.*)` added to proxy `isProtectedRoute`; nav advances to 3 ready items; schema `migrationState` → `extraction_jobs`; 31/31 tests pass, 0 new TS errors. **Post-deploy action required: run `pnpm ecommerce:migrate` on production server to apply `20260604_fileiq_extraction_jobs.sql`.**
- FileIQ Phase 1.3 Canonical Product Schema v1.0 + Schema Badges: Completed (4 direct-to-main commits, HEAD `f0b7571`, production deployed). Wired `FileIqProductCatalogV1` TypeScript schema (`lib/fileiq/schema/product-catalog-v1.ts` + `index.ts`) with all nested interfaces and enums (`CURRENT_SCHEMA_VERSION = "1.0"`). Updated `buildExtractionPrompt` to detect product/catalog intent via 7 keywords and emit the full v1.0 JSON shape so the agent outputs `schemaType: "product_catalog"` / `schemaVersion: "1.0"`; non-product intents keep existing flexible format. POST handler detects and validates the catalog schema on parse; stamps `summary.schemaType` / `summary.schemaVersion` in the DB for downstream brain queries. Purple "Catalog v1.0" badge surfaces in both the Command Center job list (client) and the Extraction Jobs SSR page. Also added conversational intent field to Command Center (`21bd4ee`) and async ingest success state feedback. No DB schema changes; no frontend breaking changes.
- CI Fast-Path Deploy Fix + Concurrency Lock: Completed (direct-to-main, commit `049ce67`). Fixed `next: not found` (exit 127) on fast-path deploys by adding `npm ci --omit=dev` after artifact extraction so `node_modules/.bin/next` is present before service restart. Added `resource_group: production-deploy` to both `deploy_production_fast` and `deploy_production` to serialize concurrent pipeline deploys. Contract test extended with 2 new assertions; 4/4 tests green.
- FileIQ Worker Job Lifecycle Fix: Completed and merged (`fix/fileiq-worker-job-lifecycle`, merge SHA `d69b50d`, remote + local branch deleted). Replaced unreliable fire-and-forget with a dedicated `fileiq-worker` process. **Post-deploy action required: install `fileiq-worker.service` on production (see Sprint Closure below).**
- FileIQ Worker server-only crash-loop fix: Completed and merged (`fix/fileiq-worker-top-level-await`, merge SHA `c95bc5f`, remote + local branch deleted). Extracted `fileiq-db-core.ts` + `fileiq-agent-core.ts` (no `server-only`); wrapper files re-export for Next.js routes; worker imports from core modules; maxTurns raised 12→40 for large catalog jobs; 7 Node-importability regression tests added; 52/52 FileIQ tests pass. **Post-deploy action required: `systemctl restart fileiq-worker` on production server.**
- Current recommended sprint: Restart `fileiq-worker.service` on production (`systemctl restart fileiq-worker`) to pick up the new binaries, then `Dead Export & Import Cleanup (EcomViper + Brains)` — QUEUED and ready for a builder (see sprint pack above), then `Test-Only Orphan Modules` and `Stale DirectoryIQ Docs Audit`. Main is clean at `c95bc5f`.

## Sprint Closure Update: FileIQ Worker server-only Crash-Loop Fix + maxTurns Raise

- Branch: `fix/fileiq-worker-top-level-await`
- Date: `2026-06-04 (UTC)`
- Status: `DELIVERED` — merge SHA `c95bc5f`, remote + local branch deleted
- Root cause: `fileiq-worker.service` (standalone tsx) imported `lib/fileiq/fileiq-db.ts` and `lib/fileiq/agent/fileiq-agent.ts`, both of which have `import "server-only"` at the top. In a non-Next.js runtime the `server-only` guard throws immediately with `Error: This module cannot be imported from a Client Component module`, causing the service to crash-loop on every restart.
- Delivered scope:
  - `lib/fileiq/fileiq-db-core.ts`: new — all DB interfaces + helpers (`insertFileIqSourceBundle`, `insertFileIqSourceFile`, `insertFileIqExtractionJob`, `updateFileIqExtractionJob`, `insertFileIqRawExtraction`, `claimFileIqPendingJob`, `listRecentFileIqJobs`) with no `server-only` import; worker-safe
  - `lib/fileiq/fileiq-db.ts`: replaced with 2-line wrapper (`import "server-only"` + `export * from "./fileiq-db-core"`); Next.js app routes continue importing this and retain the server-only guard
  - `lib/fileiq/agent/fileiq-agent-core.ts`: new — all agent types + functions (`buildFileIqAgentOptions`, `resolveFileIqAgentApiKey`, `runFileIqExtractionAgent`, constants, interfaces) with no `server-only` import; worker-safe
  - `lib/fileiq/agent/fileiq-agent.ts`: replaced with 2-line wrapper (`import "server-only"` + `export * from "./fileiq-agent-core"`)
  - `scripts/fileiq-worker.ts`: imports updated from `fileiq-db` → `fileiq-db-core` and `fileiq-agent` → `fileiq-agent-core`; fallback `maxTurns` raised 12 → 40 for jobs created before this fix
  - `app/api/fileiq/ingest/route.ts`: `_worker.maxTurns` raised 12 → 40; new catalog ingest jobs now allow 40 agent turns (prior job hit `error_max_turns` at 13 turns on 5-file Rocktomic catalog)
  - `tests/fileiq_worker.test.ts`: mocks updated to target `*-core` module paths; `makeClaimedJob` fixture updated with `maxTurns: 40`; 7 new `Node importability regression` tests using `vi.importActual` verify the core modules export the expected functions without crashing
- Test result: 52/52 FileIQ tests pass
- Boundary confirmation:
  - no DB schema changes
  - no migrations
  - no EcomViper / Walmart / Shopify / DirectoryIQ code changes
  - no auto-save/publish
  - no model call during page render
  - FileIQ schema contract v1.1 unchanged
  - Next.js app routes (`ingest`, `jobs`, extraction-jobs page) continue importing from the `server-only` wrapper files — unchanged behavior
- **Post-deploy action required:** `systemctl restart fileiq-worker` on production server to load the new worker binary. After restart, the worker will immediately start processing new ingest jobs without crash-looping.

## Sprint Closure Update: FileIQ Worker Job Lifecycle Fix

- Branch: `fix/fileiq-worker-job-lifecycle`
- Date: `2026-06-04 (UTC)`
- Status: `DELIVERED` — merge SHA `d69b50d`, remote + local branch deleted
- Root cause: `void (async () => {...})()` fire-and-forget in `app/api/fileiq/ingest/route.ts` called the Claude Agent SDK's `query()`, which spawns a `claude` subprocess. The `ibrains-app.service` systemd PATH does not include `/home/ibrains/.local/bin` so the subprocess hung indefinitely — neither the success path nor the catch block ever reached `updateFileIqExtractionJob`. Every extraction job stayed stuck at `pending` forever.
- Delivered scope:
  - `app/api/fileiq/ingest/route.ts`: removed fire-and-forget; stores `_worker` context (agentPrompt, cwd, additionalDirectories, maxTurns) in job summary JSONB; adds `[fileiq:ingest]` console.log markers at start and queue; returns `{status:"pending"}` immediately
  - `lib/fileiq/fileiq-db.ts`: added `claimFileIqPendingJob()` using `FOR UPDATE SKIP LOCKED` for safe concurrent claiming; `listRecentFileIqJobs` strips `_worker` key from summary before sending to the client
  - `scripts/fileiq-worker.ts`: new poll loop (5s) — claims pending job → logs at each stage → runs `runFileIqExtractionAgent` → inserts raw extraction → updates job to `completed` or `failed`; gracefully handles missing `_worker` context (jobs created before this fix)
  - `fileiq-worker.service`: systemd unit with `PATH=/home/ibrains/.local/bin:...` prepended so `claude` CLI is resolved; logs to `/var/log/ibrains-app/fileiq-worker.log`; `Restart=always`
  - `package.json`: added `fileiq:worker` script (`npx --yes tsx scripts/fileiq-worker.ts`)
  - `tests/fileiq_phase_1_2_ingestion.test.ts`: updated — ingest now returns `{status:"pending"}`, does not call `runFileIqExtractionAgent` (worker's responsibility)
  - `tests/fileiq_worker.test.ts`: 13 new tests covering claim, success, product-catalog schema stamp, unavailable (missing API key), failed, and exception paths
- Test result: 44/44 FileIQ tests green (3 pre-existing source-registry failures are unrelated Phase 1.1 staleness)
- **Post-deploy action required — install worker service on production server:**
  ```bash
  cp /root/ibrains-app/fileiq-worker.service /etc/systemd/system/
  systemctl daemon-reload
  systemctl enable fileiq-worker
  systemctl start fileiq-worker
  journalctl -u fileiq-worker -f
  ```
  The worker will immediately claim the stuck `pending` job (b5d2e063). If that job predates this fix (no `_worker` in summary), it will be transitioned to `failed` with `errorCode: missing_worker_context`. New ingest requests will process correctly end-to-end.
- Boundary confirmation:
  - no DB schema changes
  - no migrations
  - no EcomViper / Walmart / Shopify / DirectoryIQ code changes
  - no auto-save/publish
  - no model call during page render
  - FileIQ schema contract v1.1 unchanged

## Sprint Closure Update: CI Fast-Path Deploy Fix + Concurrency Lock

- Branch: direct-to-main (no feature branch / no MR — 1 commit)
- Date: `2026-06-03 (UTC)`
- Status: `DELIVERED` — commit `049ce67`, pushed to `origin/main`
- Root cause: `deploy_production_fast` extracted the pre-built `.next` artifact but never installed `node_modules`, so the systemd service failed with `next: not found` (exit 127) on every fast-path deploy.
- Delivered scope:
  - `.gitlab-ci.yml` — `deploy_production_fast` script: added `npm ci --omit=dev` after `tar -xzf` artifact extraction and artifact cleanup, before `write_release_metadata.sh` and service stop/start. Comment updated to reflect that only `npm run build` is skipped (not `npm ci`).
  - `.gitlab-ci.yml` — added `resource_group: production-deploy` to both `deploy_production_fast` and `deploy_production` so GitLab queues a second concurrent deploy rather than racing.
  - `tests/gitlab_deploy_pipeline_contract.test.ts` — 2 new assertions: `npm ci --omit=dev` present in pipeline source; `resource_group: production-deploy` appears exactly twice.
- Test result: 4/4 contract tests green.
- Boundary confirmation:
  - no application code changes
  - no DB schema changes
  - full-path (`deploy_production`) unchanged

## Sprint Closure Update: FileIQ Phase 1.3 — Canonical Product Schema v1.0 + Schema Badges

- Branch: direct-to-main (no feature branch / no MR — 4 commits)
- Date: `2026-06-03 (UTC)`
- Status: `DELIVERED` — pushed to `origin/main`, production deployed
- Commits:
  - `21bd4ee` — `feat(fileiq): add conversational intent field to Command Center`
  - `ffcea17` — `feat(fileiq): wire canonical product catalog schema v1.0`
  - `dea5935` — `feat(fileiq): show schema badge in job list for product_catalog extractions`
  - `f0b7571` — `feat(fileiq): show schema badge in extraction jobs detail page` (HEAD)
- Delivered scope:
  - `lib/fileiq/schema/product-catalog-v1.ts`: full TypeScript type tree — `FileIqProductCatalogV1`, `FileIqProduct`, `FileIqInventory`, `FileIqPricing`, `FileIqWholesaleTiers`, `FileIqPhysical`, `FileIqDetails`, `FileIqSupplementFacts`, `FileIqIngredient`, `FileIqAssets`, `FileIqShipping`, `FileIqShippingRoute`, `FileIqAgenticVisibility`, `FileIqSeo`, `FileIqPolicy`, `FileIqExtraction`, `FileIqSupplier`; all enum types; `CURRENT_SCHEMA_VERSION = "1.0"`.
  - `lib/fileiq/schema/index.ts`: re-exports everything.
  - `app/api/fileiq/ingest/route.ts`: `isProductCatalogIntent()` keyword detector (extract / sku / product / catalog / supplement / pricing / inventory) checks intent + bundle name + file paths; `buildExtractionPrompt` branches — product intents embed full `CATALOG_SCHEMA_EXAMPLE` JSON and instruct agent to output `schemaType: "product_catalog"` / `schemaVersion: "1.0"` with user priority surfaced at the top; non-product intents keep existing flexible format. POST handler detects `schemaType === "product_catalog"` + validates `schemaVersion` (string) + `products` (array) → stamps `summary.schemaType` / `summary.schemaVersion` so downstream brains can query by schema type. Pre-existing TS error in catch block fixed (`agentSessionId: null` was missing).
  - `app/fileiq/_components/fileiq-workspace-shell.tsx`: `SchemaBadge` component + `"Schema"` column in Command Center job list; async ingest success feedback state (`ingestSuccess`) + button label updated to "Queuing…".
  - `app/fileiq/extraction-jobs/page.tsx`: `SchemaBadge` component + `"Schema"` column in Extraction Jobs SSR table.
- Boundary confirmation:
  - no DB schema changes
  - no migrations
  - no EcomViper Product Editor changes
  - no auto-save/publish
  - no model call during page render

## Sprint Checkpoint: FileIQ Phase 1.0 Internal Brain Foundation (Local Branch)

- Branch: `feat-fileiq-internal-brain-foundation` (cut from clean `main` at `2571dd4`)
- Date: `2026-06-03 (UTC)`
- Local checkpoint status: `IMPLEMENTED_ONLY` (MR/pipeline/deploy/verify pending)
- What FileIQ is: a Claude Agent SDK-powered internal ingestion brain at `app.ibrains.ai/fileiq` that extracts structured, provenance-tracked supplier facts and stores canonical data in the shared ecommerce DB for EcomViper / OptiBay / OptiZon / OptiWal / OptiPixel to consume.
- Scope implemented:
  - Agent SDK backbone (`lib/fileiq/agent/fileiq-agent.ts`, server-only):
    - `ClaudeAgentOptions` (alias of SDK `Options`), `FILEIQ_AGENT_TOOLS` (file reading / web fetch / bash / vision → `Read`/`WebFetch`/`Bash`), `buildFileIqAgentOptions` (pure), `resolveFileIqAgentApiKey`.
    - `runFileIqExtractionAgent` drives a single `query()` session, captures the agent `session_id`, and maps the terminal result to `completed`/`failed`/`unavailable`. Credential from `ANTHROPIC_API_KEY`; safe `unavailable` degradation when missing.
  - `FileIqExtractionJob` extended with `agentSessionId` (→ `fileiq_extraction_jobs.agent_session_id`).
  - UI shell matching the OptiBay brain pattern: `app/fileiq/layout.tsx`, `app/fileiq/page.tsx`, `app/fileiq/_components/fileiq-workspace-shell.tsx` (+ existing sidebar/header/dashboard-cards). Nav: Command Center, Source Bundles, Suppliers, Files, Extraction Jobs, Packages, Review Queue, Validation Reports, Brain Outputs, Settings.
  - Internal route protection: `/fileiq(.*)` added to the `proxy.ts` auth-protected matcher (+ assertion in `tests/proxy_apps_auth_protection.test.ts`).
  - Planning docs: `planning/apps/fileiq/{overview,architecture,database-contract,mvp-roadmap}.md`.
  - DB schema is planning/types only (`lib/fileiq/fileiq-schema.ts`): `fileiq_source_bundles`, `fileiq_source_files`, `fileiq_extraction_jobs` (with `agent_session_id`), `fileiq_raw_extractions`, `fileiq_canonical_products`, `fileiq_product_facts`, `fileiq_product_assets`, `fileiq_validation_reports`, `fileiq_review_items`, `fileiq_published_packages`, `fileiq_brain_outputs`.
  - Dependency: `@anthropic-ai/claude-agent-sdk@^0.3.161` added to `package.json`/`package-lock.json`.
- Tests added: `tests/fileiq_foundation.test.ts` (11 tests — nav contract, status guards, DB boundary, agent option contract, agent runner with mocked SDK). Proxy suite extended to 18 tests.
- Local validation:
  - `npx vitest run tests/fileiq_foundation.test.ts tests/proxy_apps_auth_protection.test.ts`: 29 passed.
  - `npx tsc --noEmit`: 155 errors (unchanged pre-existing baseline); zero FileIQ/proxy errors introduced.
  - `next build` not runnable locally (root-owned `.env.production.local`, EACCES) — validated by green CI pipeline per established repo practice.
  - Agent SDK confirmed out of all route bundles (no `app/` importer of `fileiq-agent.ts` or the SDK).
- Boundary confirmation (Phase 1.0 does NOT):
  - run migrations
  - add live file parsing or OCR
  - call OpenAI or Firecrawl
  - change EcomViper Product Editor behavior
  - add auto-save/publish
  - start any agent session during page render / module import

## Sprint Closure Update: FileIQ Phase 1.0 Internal Brain Foundation

- Sprint/branch: `feat-fileiq-internal-brain-foundation`
- Date: `2026-06-03 (UTC)`
- Status: `DELIVERED_WITH_DEPLOY_VERIFIED`
- MR / merge:
  - MR: `!319` (https://gitlab.com/cloudalien-technologies/ibrains-app/-/merge_requests/319)
  - merge commit SHA: `ac330130cd6bf6716f68d3e62d965d375e1d08fa` (short: `ac33013`)
- Pipeline / deploy:
  - First deploy attempt failed at `build_release`: `tar: public: Cannot stat: No such file or directory` — `public/` had no tracked files after cleanup MR `!317` removed the boilerplate SVGs, so it was absent in a fresh CI checkout. Fixed with `tar --ignore-failed-read` (`fix(ci)` commit `b154652`).
  - Second blocker (deploy stage): the original Codex FileIQ skeleton files existed as untracked files in the production checkout `/root/ibrains-app`, blocking `git pull --ff-only`. Cleared by deleting the 7 untracked files on the server (root), then retrying `deploy_production`.
  - Deploy pipeline `2572518753`: success; production restarted on `ac33013`.
- Production release verification:
  - `/api/meta/release`: `git_sha=ac330130cd6bf6716f68d3e62d965d375e1d08fa`, `build_id=2572518753`, `deployed_at=2026-06-03T07:11:04Z`, `release_metadata_complete=true`.
  - `/api/health`: `{"ok":true,"upstream_ok":true}` — HTTP 200.
  - `/fileiq` internal protection verified: `307 -> /sign-in?redirect_url=%2Ffileiq` (and `/fileiq/files` likewise) through the public edge.
- Post-deploy follow-up — FileIQ `/fileiq` 500 fix (MR `!322`, merge SHA `c9c5efefe589c1404589b362eed777e918c27758`, production deployed and verified):
  - Production smoke caught a `500` on `/fileiq` during the post-deploy cold-start window. Root cause: Next.js 16 (Turbopack) `InvariantError: client reference manifest for route "/_not-found" does not exist`, thrown on not-found render. Two triggers: (1) the FileIQ sidebar linked to 9 unbuilt subroutes (only the Command Center page exists in Phase 1.0), so signed-in navigation rendered the not-found boundary; (2) Turbopack did not reliably register the synthetic `/_not-found` manifest on first boot (12 InvariantErrors clustered between first boot and the next restart, then clean).
  - Fix: added explicit `app/not-found.tsx` (pure server component) so the `/_not-found` manifest is registered reliably; gated FileIQ nav with a `ready` flag so only the built Command Center route is a link and the other 9 render as non-navigable "Soon" placeholders.
  - Production verification post-restart (`07:43:51 UTC`, build `c9c5efe`): `/fileiq` returned `307` on 40/40 rapid cold-start requests; `0` `/_not-found` InvariantErrors after boot (vs 12 on the prior deploy); `/api/health` ok; not-found boundary returns clean `404`.
  - Note: `/api/meta/release` flips to the new SHA before the service restart (the deploy writes release metadata prior to `npm run build` + `systemctl restart`), so deploy verification must confirm the actual service restart, not just the release SHA.
- Branch cleanup: remote source branches deleted on merge; local `feat-fileiq-internal-brain-foundation` and `fix-fileiq-not-found-runtime-500` deleted; local `main` fast-forwarded to `c9c5efe`.
- Delivered scope: see the FileIQ Phase 1.0 checkpoint block above (Agent SDK backbone, UI shell, `/fileiq` internal route protection, planning/type/schema contracts, foundation tests).
- Boundary confirmation (held): no migrations, no live file parsing/OCR, no OpenAI/Firecrawl, no EcomViper Product Editor change, no auto-save/publish, no agent session at page render.
- Follow-up (deferred): the recurring class of "untracked files in `/root/ibrains-app` block deploy `git pull`" warrants a deploy-script guard (e.g. `git clean`/stash of untracked before `git pull --ff-only`); not in this sprint's scope.

## Sprint Closure Update: Repo Cleanup — Zero-Risk Dead/Orphaned/Codex-Leftover Removal

- Branch: `chore/dead-code-zero-risk-cleanup` (cut from clean `main`)
- Date: `2026-06-03 (UTC)`
- Status: `DELIVERED` — MR `!317` squash-merged to `main`; remote + local branch deleted.
- MR / pipeline / SHAs:
  - MR: `!317` (https://gitlab.com/cloudalien-technologies/ibrains-app/-/merge_requests/317)
  - Pipeline: `2572377219` (merge_request_event) success; branch pipeline `2572377757` success.
  - Squash commit SHA: `0541cf8a13933b072a50da27f0ecf64db0590390`
  - Merge commit SHA: `dffb1fc50d0b2d25d2a8a8ab8bac30039c70e9d2`
- Scope (26 files changed, 1903 deletions; all verified zero inbound references):
  - Codex experimentation leftovers: `.codex/config.toml`, `CODEX_FIX_NEXT16_ROUTE_HANDLERS.txt`, `scripts/codex_pipeline.sh`, `docs/AUTOMATION.md`, and the dead `codex:run` package.json script.
  - Orphaned `src/` DirectoryIQ modules: `src/directoryiq/domain/{gaps,pillars,scoring}.ts`, `src/directoryiq/services/blogService.ts`, `src/lib/images/normalizeListingImageUrl.ts`, `src/lib/prompts/directoryiq/listing_upgrade_v1.ts`.
  - Orphaned components + their now-dead-only deps: `components/{brains/BrainWorkspaceFrame,brains/LockedBrainView,directoryiq/ListingHero,signal-sources/SignalSourcesPanel,siteforge/AgencyPrimitives,snapshots/SnapshotStatusStrip,studio/domara-campaign-workflow-shell}`, plus `lib/copy/signalSourcesCatalog.ts` and `lib/siteforge/agencyWorkspace.ts`.
  - Other dead code: `lib/directoryiq/detailMetricState.ts` and the 5 create-next-app boilerplate SVGs in `public/`.
- Intentionally kept: `scripts/patch_next_route_types.mjs` (live in postinstall + CI), `scripts/guard-next-origin-config.mjs` (guard), and the `ecomviper:live-supplier-facts:compare` alias (documented in planning as a distinct `--compare-sku` entrypoint).
- Local verification (no regressions vs `main`): `tsc --noEmit` 155 errors on both branches (pre-existing test-env typing baseline); `vitest` 10 failures on both branches (pre-existing flaky/env-dependent suites); no broken-import errors introduced. `next build` not runnable locally (root-owned `.env.production.local`); validated by green CI pipeline.
- Follow-up candidates (deferred, not in this sprint): dead exports inside live Walmart/Shopify modules, test-only "production orphans" in `lib/brain-learning` and `lib/ecomviper`, stale `docs/directoryiq-*` migration docs, and `git rm --cached` of 5 tracked `artifacts/ui-audit/*` files.

## Sprint Checkpoint: Phase 6.5 Rocktomic Package Reader + EcomViper Wiring (Local Branch)

- Branch: `sprint-6-5-ecomviper-rocktomic-package-reader`
- Date: `2026-06-02 (UTC)`
- Local checkpoint status: `IMPLEMENTED_ONLY` (MR/pipeline/deploy pending)
- Scope implemented:
  - New module `lib/ecomviper/suppliers/rocktomic/rocktomic-package-source-facts.ts`:
    - `getRocktomicPackageFactsForSku(sku)` — reads master package, looks up SKU, returns `PackageSkuLookupResult` with diagnostics
    - `mapPackageProductToHydratedFacts(product)` — maps `RocktomicProductRecord` to `PackageHydratedFacts` with merchant-safe text
    - `supplementFactsStatusToMerchantText(status)` — converts `SupplementFactsStatus` to merchant-safe text; never emits OCR/debug language
    - `clearPackageCache()` — for test isolation
  - Updated `lib/ecomviper/copywriting-agent/live-supplier-facts-hydration.ts`:
    - Package is first-priority source in `hydrateLiveSupplierFactsForCopywriting`
    - `SupplierFactsReadSource` now includes `"package"`
    - `readDiagnostics` extended with `package.supplementFactsStatus`
    - `packageSupplementFactsStatus` field on `SupplierFactsHydrationResult`
  - Updated `lib/ecomviper/shopify/shopify-product-editor-state.ts`:
    - Package facts resolved per-SKU in `buildShopifyProductEditorStateForUser`
    - `buildSourceFacts` accepts `packageFacts: PackageHydratedFacts | null`
    - Supplement facts status driven by package (`structured/partial/visual_only/missing/not_applicable`)
    - Active ingredients, serving size, ingredient amounts, other ingredients resolved from package first
    - COA URL includes package `coaUrl` in priority chain
    - Package diagnostics in `diagnostics` array
    - `sourceStatusForScalar/Array` updated for merchant-safe package text; no OCR language when package has the SKU
  - Updated `app/api/ecomviper/pdp-intelligence/route.ts`:
    - Response diagnostics include `package_supplement_facts_status`, `package_read_attempted`, `package_sku_found`
- Tests added (47 new tests, 3 files):
  - `tests/ecomviper_rocktomic_package_source_facts.test.ts` (20 tests)
  - `tests/ecomviper_rocktomic_package_product_editor_binding.test.ts` (16 tests)
  - `tests/ecomviper_rocktomic_package_generate_intelligence_binding.test.ts` (11 tests)
  - `tests/ecomviper_live_supplier_facts_hydration.test.ts` — updated to mock package reader (isolates DB path)
- Build: pass
- `git diff --check`: pass
- `npm test`: 13 failing (all pre-existing baseline failures across casahud/walmart/siteforge/frontdoor suites); zero new failures from Phase 6.5
- Boundary confirmation:
  - no Product Editor auto-save/publish
  - no model call during page render
  - no DB writes/imports/migrations
  - no live Firecrawl/OpenAI/OCR in package reader runtime path
  - no duplicate `/ecomviper/shopify/products/[productId-or-handle]` route restoration
  - package reader reads local file artifact only (cached per process lifetime)

## Sprint Closure Update: Phase 6.5 Rocktomic Package Reader + EcomViper Wiring

- Sprint/branch: `sprint-6-5-ecomviper-rocktomic-package-reader`
- MR:
  - merge commit SHA: `659133488cd4034c3f516070e8e97fff2171f986` (short: `6591334`)
  - build_id: `2570565864`
- Branch cleanup:
  - remote source branch deletion: completed (pruned from origin on merge)
  - local source branch deletion: completed (`git branch -d sprint-6-5-ecomviper-rocktomic-package-reader`)
  - local repository reset: clean `main` fast-forwarded to `659133488cd4034c3f516070e8e97fff2171f986`
- Production release verification:
  - `/api/meta/release`:
    - `git_sha=659133488cd4034c3f516070e8e97fff2171f986`
    - `git_sha_short=6591334`
    - `build_id=2570565864`
    - `build_timestamp=2026-06-02T14:04:14Z`
    - `deployed_at=2026-06-02T14:04:14Z`
    - `release_metadata_complete=true`
  - `/api/health`: `{"ok":true,"upstream_ok":true}` — HTTP 200
  - production smoke (`RUN_DETAILED_SMOKE=1 scripts/production_smoke_check.sh app.ibrains.ai`):
    - all HTTP route checks passed (`/api/health 200`, `/api/meta/release 200`, `/brains 307`, `/ecomviper 307`, `/ecomviper/settings 307`, `/ecomviper/dropshipping/rocktomic 307`)
    - all static asset checks passed (JS/CSS bundles returned 200 with correct content-type)
    - 4 smoke FAIL lines are local Windows environment artifacts (no Python, no sudo/systemd/nginx) — not production failures
- Delivered behavior summary:
  - Rocktomic master package is now the first-priority supplier facts source for both Product Editor and Generate Intelligence
  - `structured` package facts → `extracted` status with ingredient/serving data populated
  - `partial` package facts → `partial` status with merchant text: "Some ingredient details are available; review before publishing."
  - `visual_only` package facts → `partial` status with merchant text: "Supplement Facts panel is available, but structured details are incomplete." (no OCR language)
  - `missing` package facts → `source_missing` status with merchant text: "Supplement Facts are not available in the current supplier package." (no OCR language)
  - `not_applicable` package facts → `not_applicable` status
  - PDP intelligence route diagnostics include `package_supplement_facts_status`, `package_read_attempted`, `package_sku_found`
  - 47 new tests added across 3 focused suites; zero new test failures
- Honest boundary confirmation:
  - no Product Editor auto-save/publish
  - no model call during page render
  - no DB writes/imports/migrations
  - no live Firecrawl/OpenAI/OCR in runtime path
  - no duplicate `/ecomviper/shopify/products/[productId-or-handle]` route restoration
  - package reader reads local file artifact only (process-lifetime cache)

## Sprint Checkpoint: Phase 6.4 Rocktomic Master Package Builder (Local Branch)

- Branch: `sprint-6-4-rocktomic-master-package-builder`
- Date: `2026-06-02 (UTC)`
- Local checkpoint status: `IMPLEMENTED_ONLY`
- Root cause diagnosed:
  - Existing `rocktomic-ingest.ts` / `build_rocktomic_supplier_data.ts` did not produce a canonical unified master package with field-level provenance, source identity validation, or RFC 4180 compliant CSV parsing.
  - Source URL #1 and #6 were both labeled the same Google Sheet ID; confirmed as duplicate: `plds_catalog` and `msrp_profit_margins_report` share the same Google Sheet ID (`15lZ6M5SqNby_uOIzZEhBYEn6rtLZYQmVUVF4yWzKIbU`).
  - Catalog PDF URL was already correctly set in `sources.json` (not the inventory sheet).
  - Legacy CSV parser in `google-sheets-csv.ts` splits on `\n` before handling quotes — fragile for embedded newlines.
- Scope implemented:
  - Source identity validator (`lib/ecomviper/suppliers/rocktomic/source-identity-validator.ts`): detects duplicate URLs, duplicate sheet IDs, type mismatches, mislabeled catalog-as-sheet
  - RFC 4180 state-machine CSV parser (`lib/ecomviper/suppliers/rocktomic/rocktomic-csv-parser.ts`): handles embedded newlines, escaped quotes, CRLF/LF
  - Sheet-specific parsers (`lib/ecomviper/suppliers/rocktomic/rocktomic-sheet-parsers.ts`): PLDS catalog, MSRP/pricing, inventory with row/column provenance
  - Canonical master package schema + runtime validation (`lib/ecomviper/suppliers/rocktomic/master-package-schema.ts`): all required product fields, supplement facts status enum, field-level provenance, missingData flags, validateProductRecord, validateMasterPackage
  - Master package builder (`lib/ecomviper/suppliers/rocktomic/master-package-builder.ts`): merges all sources by SKU, field-level provenance, does NOT default membershipAccess to "all"
  - Templates HTML parser (`lib/ecomviper/suppliers/rocktomic/templates-html-parser.ts`): static link extraction, per-SKU label/mockup URL map, graceful fallback for JS-driven pages
  - DOCX policy parser (`lib/ecomviper/suppliers/rocktomic/docx-policy-parser.ts`): mammoth-backed with graceful fallback when mammoth not installed
  - Master package reader helpers (`lib/ecomviper/suppliers/rocktomic/master-package-reader.ts`): readRocktomicSupplierPackage, getRocktomicProduct, resolvePrice, getMissingDataSummary
  - CLI script (`scripts/ecomviper/build_rocktomic_master_package.ts`): --dry-run, --write, --source-bundle, --live, --identity-only, --per-sku-files, --verbose
  - npm script: `ecomviper:rocktomic:package`
  - Updated `data/ecomviper/suppliers/rocktomic/sources.json` with `sourceManifestVersion=3` and sourceIdentityWarnings
  - Generated output: `rocktomic-supplier-package.json`, `source-identity-report.json`, `validation-report-master.json`, `audit-master.csv`
- Local dry-run result (against existing `latest/` artifacts):
  - `product_count=164`
  - `source_identity_valid=false` (1 duplicate URL, 1 duplicate sheet ID — correctly detected)
  - `supplement_facts_structured=68`, `partial=62`, `visual_only=15`, `missing=19`, `not_applicable=0`
  - `missing_productName=19`, `missing_pricing=22`, `missing_inventory=11`, `missing_coaUrl=40`
  - `validation_package_status=fail` (1 invalid SKU: string literal "UNDEFINED" correctly detected as invalid)
  - `validation_warning=163`, `validation_valid=0`, `validation_invalid=1`
- Focused tests added/passing (104 tests across 9 test files):
  - `tests/ecomviper_rocktomic_source_identity_validator.test.ts` (9 tests)
  - `tests/ecomviper_rocktomic_csv_parser.test.ts` (14 tests)
  - `tests/ecomviper_rocktomic_sheet_parsers.test.ts` (15 tests)
  - `tests/ecomviper_rocktomic_master_package_schema.test.ts` (15 tests)
  - `tests/ecomviper_rocktomic_master_package_builder.test.ts` (17 tests)
  - `tests/ecomviper_rocktomic_master_package_reader.test.ts` (14 tests)
  - `tests/ecomviper_rocktomic_templates_html_parser.test.ts` (8 tests)
  - `tests/ecomviper_rocktomic_docx_policy_parser.test.ts` (6 tests)
  - `tests/ecomviper_rocktomic_master_package_constraints.test.ts` (6 tests)
- `npm run build`: pass
- `git diff --check`: pass
- `npm test`: 15 failing tests, all pre-existing unrelated baseline failures; zero new failures from this sprint
- Boundary confirmation:
  - no Product Editor behavior change
  - no auto-save/publish
  - no model call during page render
  - no DB writes/imports/migrations
  - no live Firecrawl or OpenAI required in tests
  - no duplicate `/ecomviper/shopify/products/[productId-or-handle]` route restoration
  - no SKU-specific implementation logic

## Sprint Closure Update: Phase 6.4 Rocktomic Master Package Builder

- Sprint/branch: `sprint-6-4-rocktomic-master-package-builder`
- MR:
  - `!315`: `https://gitlab.com/cloudalien-technologies/ibrains-app/-/merge_requests/315`
  - merge commit SHA: `c363135be8f521979e29af09a34b3632c60ec378` (short: `c363135`)
  - MR pipeline `2570381373`: success
- Main/deploy pipeline:
  - pipeline `2570391704`: success
  - jobs green: `verify_frontdoor_integrity`, `build_release`, `deploy_production`
- Branch cleanup:
  - remote source branch deletion: completed via MR merge (`--remove-source-branch`)
  - local source branch deletion: completed (`git branch -d sprint-6-4-rocktomic-master-package-builder`)
  - local repository reset: clean `main` synced to `origin/main` (HEAD `c363135be8f521979e29af09a34b3632c60ec378`)
- Production release verification:
  - `/api/meta/release`:
    - `git_sha=c363135be8f521979e29af09a34b3632c60ec378`
    - `git_sha_short=c363135`
    - `build_id=2570391704`
    - `build_timestamp=2026-06-02T13:05:59Z`
    - `deployed_at=2026-06-02T13:05:59Z`
    - `release_metadata_complete=true`
  - `/api/health`: `{"ok":true,"upstream_ok":true}` — HTTP 200
  - production smoke (`RUN_DETAILED_SMOKE=1 scripts/production_smoke_check.sh app.ibrains.ai`):
    - all HTTP route checks passed (`/api/health 200`, `/api/meta/release 200`, `/brains 307`, `/ecomviper 307`, `/ecomviper/settings 307`, `/ecomviper/dropshipping/rocktomic 307`)
    - all static asset checks passed (JS/CSS bundles returned 200 with correct content-type)
    - `release build_id is non-null` ✓, `release git_sha is non-null` ✓
    - 6 smoke failures are local Windows environment artifacts (no Python, no sudo, no systemd/nginx service checks) — not production failures
- Validation summary from Phase 6.4 implementation:
  - `product_count=164`
  - `source_identity_valid=false` (1 duplicate URL, 1 duplicate sheet ID — correctly detected; `plds_catalog` + `msrp_report` confirmed same Google Sheet ID)
  - `supplement_facts_structured=68`, `partial=62`, `visual_only=15`, `missing=19`
  - `missing_productName=19`, `missing_pricing=22`, `missing_inventory=11`, `missing_coaUrl=40`
  - `validation_package_status=fail` (1 invalid SKU: string literal "UNDEFINED" correctly detected)
  - `validation_warning=163`, `validation_valid=0`, `validation_invalid=1`
  - 104 tests across 9 focused test files — all passing
- Boundary confirmation:
  - no Product Editor behavior change
  - no auto-save/publish
  - no model call during page render
  - no DB writes/imports/migrations
  - no duplicate `/ecomviper/shopify/products/[productId-or-handle]` route restoration

## Sprint Checkpoint: Phase 6.3.2 Rocktomic Supplement Facts Panel Extraction (Local Branch)

- Branch: `sprint-6-3-2-rocktomic-supplement-facts-panel-extraction`
- Date: `2026-06-01 (UTC)`
- Local checkpoint status: `IMPLEMENTED_ONLY`
- Scope implemented:
  - deterministic catalog PDF acquisition/cache metadata:
    - `lib/ecomviper/suppliers/rocktomic/pdf-source-cache.ts`
  - expanded PyMuPDF evidence JSON + optional render/panel crop:
    - `scripts/ecomviper/pdf_evidence_extract.py`
    - `lib/ecomviper/suppliers/rocktomic/pdf-evidence.ts`
  - deterministic supplement-facts parser + validator:
    - `lib/ecomviper/suppliers/rocktomic/supplement-facts-panel.ts`
  - optional/gated/cached OpenAI vision fallback contract:
    - `lib/ecomviper/suppliers/rocktomic/openai-vision-supplement-facts.ts`
  - extractor integration + source-status gating updates:
    - `lib/ecomviper/suppliers/rocktomic/firecrawl-supplier-intelligence.ts`
    - `lib/ecomviper/suppliers/rocktomic/supplier-intelligence-schema.ts`
  - CLI flags/candidate artifact controls:
    - `scripts/ecomviper/build_rocktomic_supplier_intelligence.ts`
- Local ROC948 cache proof:
  - `records_extracted=1`, `selected_sku=ROC948`
  - candidate page evidence resolved (`page-76`) with optional rendered artifact output
  - deterministic panel parser executes and records explicit validation failures when panel facts are incomplete
  - current local outcome remains `sourceStatus=needs_review` with no fabricated facts
- Focused tests added/passing:
  - `tests/ecomviper_rocktomic_pdf_source_cache.test.ts`
  - `tests/ecomviper_rocktomic_supplement_facts_panel.test.ts`
  - `tests/ecomviper_rocktomic_openai_vision_gating.test.ts`
  - `tests/ecomviper_rocktomic_supplier_intelligence_cli_flags.test.ts`
  - existing extractor/pdf/parser/schema suites updated and passing
- Boundaries preserved:
  - no Product Editor behavior change
  - no Product Editor auto-save/auto-publish
  - no model call during page render
  - no DB writes/imports/migrations
  - no duplicate `/ecomviper/shopify/products/[productId-or-handle]` route restoration

## Sprint Closure Update: Phase 6.3.2 Rocktomic Supplement Facts Panel Extraction

- Sprint/branch: `sprint-6-3-2-rocktomic-supplement-facts-panel-extraction`
- MR:
  - `!312`: `https://gitlab.com/cloudalien-technologies/ibrains-app/-/merge_requests/312`
  - source commit SHA: `d1902f38bb80917f41f5d3e3ffde03896c431474`
  - merge commit SHA: `1b7827c6a8dcff49fc515b7a221e6891e4c9cda4`
  - MR pipeline `2568627769`: success
- Branch cleanup:
  - remote source branch deletion: complete (`--remove-source-branch` on merge)
  - local source branch deletion: complete
  - local repository reset: clean `main` synced to `origin/main`
- Production verification:
  - `/api/meta/release` shows:
    - `git_sha=1b7827c6a8dcff49fc515b7a221e6891e4c9cda4`
    - `build_timestamp=2026-06-01T22:45:10+00:00`
  - `/api/health`: `200` with `ok=true`
- Scope result:
  - deterministic PDF acquisition/cache metadata + expanded PyMuPDF candidate evidence + panel render artifacts
  - deterministic panel parser + strict structured gating
  - optional OpenAI vision fallback contract is explicit, gated, and cached
  - ROC948 remains `needs_review` in current cache evidence path with explicit extraction failure reasons and candidate artifacts (no fabricated structured facts)

## Sprint Checkpoint: Phase 6.3 Firecrawl Supplier Intelligence Extractor Foundation (Local Branch)

- Branch: `sprint-6-3-firecrawl-supplier-intelligence-extractor`
- Date: `2026-06-01 (UTC)`
- Local checkpoint status: `DELIVERED` (MR merged + pipeline green + branch cleanup + clean local `main`)
- Foundation scope implemented:
  - Firecrawl wrapper with env-gated live mode + local cache + fixture mode:
    - `lib/ecomviper/suppliers/firecrawl/firecrawl-client.ts`
  - normalized supplier-intelligence schema/provenance/readiness contract:
    - `lib/ecomviper/suppliers/rocktomic/supplier-intelligence-schema.ts`
  - Rocktomic Firecrawl-backed extractor foundation + source-manifest loader:
    - `lib/ecomviper/suppliers/rocktomic/firecrawl-supplier-intelligence.ts`
  - package validator + audit CSV generation:
    - `lib/ecomviper/suppliers/rocktomic/supplier-intelligence-validation.ts`
  - read-model compatibility projection bridge:
    - `lib/ecomviper/suppliers/rocktomic/supplier-intelligence-read-model.ts`
  - new builder CLI with dry-run/fixture/firecrawl/cache/report/candidate-write modes:
    - `scripts/ecomviper/build_rocktomic_supplier_intelligence.ts`
    - `npm run ecomviper:rocktomic:supplier-intelligence`
  - source manifest extended for Firecrawl policy/modes:
    - `data/ecomviper/suppliers/rocktomic/sources.json`
  - ROC948 golden fixture baseline plus additional partial SKU fixture:
    - `data/ecomviper/suppliers/rocktomic/fixtures/supplier-intelligence-fixtures.json`
- Local validation snapshot:
  - focused suites added/passing:
    - `tests/ecomviper_firecrawl_supplier_client.test.ts`
    - `tests/ecomviper_rocktomic_supplier_intelligence_extractor.test.ts`
    - `tests/ecomviper_supplier_intelligence_schema.test.ts`
    - `tests/ecomviper_supplier_intelligence_validation.test.ts`
    - `tests/ecommerce_supplier_facts_read.test.ts` (extended compatibility checks)
- Boundaries preserved:
  - no Product Editor auto-save/auto-publish changes
  - no model call during page render
  - no production DB writes/imports/migrations in this phase
  - no default OCR extraction path in extractor foundation
  - no duplicate `/ecomviper/shopify/products/[productId-or-handle]` route restoration

## Sprint Closure Update: Phase 6.3 Firecrawl Supplier Intelligence Extractor Foundation

- Sprint/branch: `sprint-6-3-firecrawl-supplier-intelligence-extractor`
- MR:
  - `!308`: `https://gitlab.com/cloudalien-technologies/ibrains-app/-/merge_requests/308`
  - source branch commit SHA: `678ebb11260b26878408f7a0840d644e95cb2bb6`
  - merge commit SHA: `8652a73779c4750a34c2f703ab3962f4ec71c2b5`
  - MR pipeline `2568207604`: success
- Branch cleanup:
  - remote source branch deletion: completed via MR merge (`--remove-source-branch`)
  - local source branch deletion: completed (`git branch -d sprint-6-3-firecrawl-supplier-intelligence-extractor`)
  - local repository reset: clean `main` synced to `origin/main` before closure metadata branch
- Delivered behavior summary:
  - Firecrawl wrapper foundation added with fixture/cache/live boundaries and env-only key usage.
  - normalized supplier intelligence schema + provenance + validation/audit outputs added.
  - ROC948 golden fixture baseline added as structured regression proof.
  - read-model compatibility projection tests added so Product Editor/Generate can consume normalized upstream facts.
- Runtime safety confirmation:
  - no Product Editor auto-save/publish
  - no model call during page render
  - no production supplier DB writes/imports/migrations in this phase
  - no default OCR path for extractor foundation
  - no duplicate `/ecomviper/shopify/products/[productId-or-handle]` route restoration

## Sprint Checkpoint: Phase 6.3.1 Rocktomic Live Source Parser (Local Branch)

- Branch: `sprint-6-3-1-rocktomic-live-source-parser`
- Date: `2026-06-01 (UTC)`
- Local checkpoint status: `IMPLEMENTED_ONLY`
- Root cause confirmed:
  - Firecrawl cache/live markdown contained ROC948, but extractor trusted only `scrape.json.records`; when JSON omitted ROC948, `records_extracted=0` was emitted.
- Implemented scope:
  - markdown fallback parser: `lib/ecomviper/suppliers/rocktomic/firecrawl-catalog-markdown-parser.ts`
  - Firecrawl merge + reason diagnostics + CLI summary hardening:
    - `lib/ecomviper/suppliers/rocktomic/firecrawl-supplier-intelligence.ts`
    - `scripts/ecomviper/build_rocktomic_supplier_intelligence.ts`
  - PyMuPDF evidence foundation:
    - `scripts/ecomviper/pdf_evidence_extract.py`
    - `lib/ecomviper/suppliers/rocktomic/pdf-evidence.ts`
  - Google Sheets CSV foundation:
    - `lib/ecomviper/suppliers/google-sheets-csv.ts`
  - Toolbelt doctor:
    - `lib/ecomviper/suppliers/supplier-toolbelt-doctor.ts`
    - `scripts/ecomviper/supplier_toolbelt_doctor.ts`
- Local ROC948 cache validation:
  - command: `npm run ecomviper:rocktomic:supplier-intelligence -- --sku ROC948 --use-firecrawl --cache --dry-run`
  - result: `records_extracted=1`, `productName=Premium Nitric Oxide Gummies`, `sourceStatus=needs_review`
- Boundary confirmation:
  - no Product Editor behavior change
  - no Product Editor auto-save/publish
  - no DB writes/imports/migrations
  - no OCR/vision default path
  - no duplicate `/ecomviper/shopify/products/[productId-or-handle]` route restoration

## Sprint Closure Update: Phase 6.3.1 Rocktomic Live Source Parser

- Sprint/branch: `sprint-6-3-1-rocktomic-live-source-parser`
- MR:
  - `!310`: `https://gitlab.com/cloudalien-technologies/ibrains-app/-/merge_requests/310`
  - source branch commit SHA: `823e5e4433b188520832c4e9c74b19797d33b2ad`
  - merge commit SHA: `652a0c8a024ec79fec3b323f87f39bafffcbb641`
  - MR pipeline `2568493491`: success
- Branch cleanup:
  - remote source branch deletion: completed via MR merge (`--remove-source-branch`)
  - local source branch deletion: completed (`git branch -d sprint-6-3-1-rocktomic-live-source-parser`)
  - local repository reset: clean `main` synced to `origin/main`
- Delivered behavior summary:
  - Firecrawl markdown fallback parser now emits SKU records when JSON extraction omits target SKU.
  - ROC948 cache/live proof now returns `records_extracted=1` with normalized metadata and provenance.
  - source-status policy now keeps incomplete supplement-facts records in `needs_review` (no fabricated structured facts).
  - PyMuPDF evidence helper + Google Sheets CSV helper + toolbelt doctor foundations are added with fixture-safe tests.


## Sprint Checkpoint: Phase 6.2.2-E Per-SKU Hydration + Compliance False-Block Fix (Local Branch)

- Branch: `sprint-6-2-2-e-hydration-compliance-fix`
- Date: `2026-06-01 (UTC)`
- Local checkpoint status: `IMPLEMENTED_ONLY` (MR/pipeline/deploy/signed-in production QA pending)
- Root causes confirmed:
  - hydration parity/trace ambiguity: live projection could continue showing stale `ocr_required`-style source summaries even after hydration, and fallback diagnostics were too coarse for per-SKU triage.
  - ROC948 compliance false block: ingredient highlight validation was too strict (full-string match) and did not properly normalize source-backed ingredient evidence across supplement facts + product title/supplier title cues.
- Implemented scope:
  - `copywriting-agent-evals.ts`: normalized ingredient/dosage grounding + title/supplier evidence support.
  - `copywriting-agent-runner.ts`: repair/remove unsupported ingredient highlights instead of blocking entire proposal when remaining output is safe.
  - `copywriting-agent-input-builder.ts`: source facts summary now reflects merged effective facts state (`present/missing`) for trace parity.
  - `live-supplier-facts-hydration.ts`: added db/artifact read diagnostics and AI label evidence shape compatibility (`records[]` or raw array).
  - `live_supplier_facts_parity_check.ts`: expanded parity output + compare mode (`--compare-sku`).
  - new npm alias: `ecomviper:live-supplier-facts:compare`.
- Local validation summary:
  - focused suites: pass
    - `tests/ecomviper_copywriting_agent_evals.test.ts`
    - `tests/ecomviper_copywriting_agent_runner.test.ts`
    - `tests/ecomviper_copywriting_agent_input_builder.test.ts`
    - `tests/ecomviper_live_supplier_facts_hydration.test.ts`
    - `tests/ecomviper_generate_intelligence_copywriting_action.test.ts`
    - `tests/ecomviper_pdp_intelligence_route.test.ts`
    - `tests/ecomviper_product_editor_source_mapping.test.tsx`
    - `tests/ecomviper_shopify_route_consolidation.test.ts`
    - `tests/ecomviper_product_image_selection.test.ts`
    - `tests/ecomviper_product_editor_generate_intelligence_review.test.tsx`
  - dry-run harness:
    - `prepare --all --dry-run`: `supplementFactsMissing=16`, `coaMissing=40`, `pricingMissing=22`, `inventoryMissing=38`
    - no regression to historical `supplementFactsMissing=164`
  - parity CLI:
    - ROC123 and ROC948 both report structured facts present locally with explicit DB/artifact read diagnostics
  - `npm run build`: pass
  - `git diff --check`: pass
  - `npm test`: fails in unrelated baseline suites outside this sprint scope (10 failing tests; none from modified ecomviper copywriting/hydration suites)
- Boundary confirmation:
  - no auto-save / no auto-publish
  - no model call during page render
  - no supplier DB writes/import/migrations
  - no OCR/.ai extraction/source fetch in Product Editor generate path
  - no duplicate `/ecomviper/shopify/products/[productId-or-handle]` route restoration

## Sprint Checkpoint: Phase 6.2.2-D Live Supplier Facts Hydration Fix (Local Branch)

- Branch: `sprint-6-2-2-d-live-supplier-facts-hydration`
- Date: `2026-06-01 (UTC)`
- Local checkpoint status: implementation + focused checks complete; MR/pipeline/deploy/signed-in production QA pending.
- Root cause confirmed:
  - live route input preparation lacked an explicit authoritative supplier-facts rehydration-by-SKU gate.
  - degraded snapshot/editor facts could still yield `supplementFactsSource=image_only` and zero ingredient counts.
- Implemented scope:
  - added server-side hydration module (`lib/ecomviper/copywriting-agent/live-supplier-facts-hydration.ts`) with DB-first + artifact fallback read-only flow.
  - route now hydrates before input build and logs safe compact read diagnostics:
    - `supplier_facts_read_source`
    - `supplier_facts_read_found`
    - `supplier_facts_read_error_code`
  - removed `userId` from input trace payload.
  - added snake_case structured-facts mapping fallback in supplier read model.
  - added parity CLI:
    - `npm run ecomviper:live-supplier-facts:parity -- --sku ROC123`
  - added focused tests:
    - `tests/ecomviper_live_supplier_facts_hydration.test.ts`
    - updated route action + supplier read tests for rehydration precedence.
- Local validation summary:
  - focused suites: pass
  - `npm run ecomviper:copywriting-agent:prepare -- --all --dry-run`: `supplementFactsMissing=16`, `coaMissing=40`, `pricingMissing=22`, `inventoryMissing=38`
  - `npm run ecomviper:copywriting-agent:evaluate -- --all --dry-run`: no regression in all-product coverage
  - `npm run build`: pass
  - `npm test`: fails in unrelated baseline suites outside this sprint scope (documented in branch handoff)
- Boundary confirmation:
  - no auto-save / no auto-publish
  - no model call during page render
  - no DB migration / no supplier writes/imports
  - no OCR / no `.ai` extraction run
  - no duplicate `/ecomviper/shopify/products/[productId-or-handle]` route restoration

## Sprint Closure Update: Phase 6.2.2-C Live Source Facts + Merchant Output Fix

- Sprint/branch: `sprint-6-2-2-c-live-generate-intelligence-source-facts`
- Root cause confirmed:
  - live Generate Intelligence input path underused shared ecommerce supplier read-model facts/evidence and could project stale/partial source states into copywriting input.
  - merchant proposal path surfaced internal/debug warning strings and OCR/dev wording.
- MR:
  - `!304`: `https://gitlab.com/cloudalien-technologies/ibrains-app/-/merge_requests/304`
  - source branch commit SHA: `702919f7d0f18fa73641a6f1b6c696f9bec64baf`
  - merge commit SHA: `de4b46c52be324a1ecc01c762de96b2a6c966f3c`
  - MR pipeline `2567442958`: success
- Main/deploy pipeline:
  - pipeline `2567454601`: success
- Branch cleanup:
  - remote source branch deletion: completed via merge (`--remove-source-branch`)
  - local source branch deletion: completed (`git branch -d sprint-6-2-2-c-live-generate-intelligence-source-facts`)
  - local repository reset: clean `main` synced to `origin/main` before closure metadata branch
- Production release verification:
  - `/api/meta/release`:
    - `git_sha=de4b46c52be324a1ecc01c762de96b2a6c966f3c`
    - `build_id=2567454601`
    - `deployed_at=2026-06-01T14:05:34Z`
    - `release_metadata_complete=true`
  - `/api/health`: `{"ok":true,...,"upstream_ok":true}`
- Production smoke and signed-out checks:
  - `RUN_DETAILED_SMOKE=1 scripts/production_smoke_check.sh app.ibrains.ai`: pass
  - `/admin` -> `307` to `/sign-in?redirect_url=%2Fadmin`
  - `/admin/ecomviper` -> `307` to `/sign-in?redirect_url=%2Fadmin%2Fecomviper`
  - `/admin/ecomviper/suppliers/rocktomic/audit` -> `307` to `/sign-in?redirect_url=%2Fadmin%2Fecomviper%2Fsuppliers%2Frocktomic%2Faudit`
  - `/ecomviper/products/opa-oxy-burn-thermogenic-support` -> `307` to sign-in with preserved redirect URL
- Production env presence (masked):
  - `ECOMMERCE_DATABASE_URL=SET`
  - `OPENAI_API_KEY=SET`
  - `ECOMVIPER_COPYWRITING_OPENAI_MODEL=SET`
  - `ECOMVIPER_COPYWRITING_OPENAI_TIMEOUT_MS=SET`
- Production log checks:
  - app log tail still contains historical pre-deploy `https://localhost:3001` / SSL `wrong version number` entries.
  - `journalctl -u ibrains-app --since \"2026-06-01 14:06:54\"` has no new `https://localhost:3001`, SSL wrong-version, or copywriting exception entries after this deployment.
- Delivered behavior summary:
  - supplier facts read model now exposes ingredient amount evidence to live consumers.
  - Product Editor source-facts projection now consumes supplier facts panel fields for structured facts/evidence precedence.
  - copywriting input builder now merges source facts + supplier facts panel + supplier snapshot for live parity.
  - runner sanitizes internal/debug warnings and drops contradictory missing-data notices.
  - Product Editor merchant text replaced dev-like `supplier intelligence update`/OCR directive wording with plain user-facing text.
  - safe server-side Generate trace logging added (`trace_id` + compact redacted summaries).
  - all-product dry-run counts remain improved: `supplementFactsMissing=16`, `coaMissing=40`, `pricingMissing=22`, `inventoryMissing=38`.
- Signed-in/manual QA status:
  - pending user browser verification (CLI run cannot complete authenticated Product Editor Generate Intelligence checks on Oxy-Burn + additional affected SKU).

## Sprint Checkpoint: Phase 6.2.1 Generate Intelligence Signed-In Production Hotfix (Local Branch)

- Branch: `sprint-6-2-1-generate-intelligence-prod-hotfix`
- Date: `2026-06-01 (UTC)`
- Local checkpoint status: implementation + focused tests/checks in progress; MR/pipeline/deploy verification pending.
- Root issue under active fix:
  - signed-in Generate Intelligence requests could hit middleware/proxy path that attempted `https://localhost:3001/api/ecomviper/pdp-intelligence`, causing TLS failure (`wrong version number`) against local HTTP service.
- Implemented hotfix scope on branch:
  - PDP intelligence API path removed from Clerk proxy-context requirement in `proxy.ts` to avoid localhost HTTPS self-proxy behavior.
  - Product Editor Generate Intelligence client path remains relative (`/api/ecomviper/pdp-intelligence`) with URL-contract test coverage.
  - runtime key resolution now supports server-side `OPENAI_API_KEY` fallback when user-scoped stored credential is unavailable.
  - plain user-safe message mapping tightened for unavailable/timeout/validation/model-error paths.
  - Product Editor latest-failure behavior now labels previous proposal explicitly after a failed attempt instead of presenting stale output as current.
- Boundary confirmation:
  - review-only proposal preserved
  - no auto-save/publish changes
  - no model call during Product Editor render
  - no duplicate `/ecomviper/shopify/products/[productId-or-handle]` route restoration
  - no supplier writes/import/sync/extraction/OCR changes

## Sprint Closure Update: Phase 6.2 Generate Intelligence Copywriting Agent Binding

- Sprint/branch: `sprint-6-2-generate-intelligence-copywriting-agent`
- MR:
  - `!299`: `https://gitlab.com/cloudalien-technologies/ibrains-app/-/merge_requests/299`
  - source branch commit SHA: `cfa41ba125c2cb78f48fbe5fb7442432b7d7d248`
  - merge commit SHA: `aa4a6b432c32ffd7ab9423e0dc305ae164f28ada`
  - MR pipeline `2566143247`: success
- Main/deploy pipeline:
  - pipeline `2566146095`: success
- Branch cleanup:
  - remote source branch deletion: completed via merge (`--remove-source-branch`)
  - local source branch deletion: completed (`git branch -d sprint-6-2-generate-intelligence-copywriting-agent`)
  - local repository reset: clean `main` synced to `origin/main` before closure metadata branch
- Production release verification:
  - `/api/meta/release`:
    - `git_sha=aa4a6b432c32ffd7ab9423e0dc305ae164f28ada`
    - `build_id=2566146095`
    - `deployed_at=2026-06-01T04:30:25Z`
    - `release_metadata_complete=true`
  - `/api/health`: `{"ok":true,...,"upstream_ok":true}`
- Signed-out route verification:
  - `/admin` -> `307` to `/sign-in?redirect_url=%2Fadmin`
  - `/admin/ecomviper` -> `307` to `/sign-in?redirect_url=%2Fadmin%2Fecomviper`
  - `/admin/ecomviper/suppliers/rocktomic/audit` -> `307` to `/sign-in?redirect_url=%2Fadmin%2Fecomviper%2Fsuppliers%2Frocktomic%2Faudit`
  - `/ecomviper/products/opa-oxy-burn-thermogenic-support` -> `307` to sign-in with preserved redirect URL
- Signed-in/manual QA status:
  - blocked in CLI-only run (no authenticated browser session available).
  - required checks remain: signed-in Oxy-Burn/Magnesium Generate Intelligence review-only verification and no auto-save/publish confirmation.
- Delivered behavior summary:
  - existing Generate Intelligence now calls Phase 6.1 all-product copywriting contract on explicit action only
  - model output is structured and validated against `ProductCopywritingOutput`
  - proposal is review-only; no auto-save/publish added
  - plain missing-data notices are shown without internal readiness labels
  - no Product Editor layout redesign
  - no model call during page render
  - no supplier writes/import/sync/extraction/OCR added
  - no duplicate `/ecomviper/shopify/products/[productId-or-handle]` route restoration

## Sprint Checkpoint: Phase 6.1 All-Product AI Copywriting Agent Contract + Eval Harness (Local Branch)

- Branch: `sprint-6-1-ai-copywriting-agent-contract-evals`
- Date: `2026-06-01 (UTC)`
- Local checkpoint status: implementation + focused tests/checks in progress; MR/pipeline/deploy verification pending.
- Scope implemented locally:
  - added all-product copywriting contracts/modules:
    - `lib/ecomviper/copywriting-agent/copywriting-agent-types.ts`
    - `lib/ecomviper/copywriting-agent/copywriting-agent-input-builder.ts`
    - `lib/ecomviper/copywriting-agent/copywriting-agent-prompt.ts`
    - `lib/ecomviper/copywriting-agent/copywriting-agent-evals.ts`
    - `lib/ecomviper/copywriting-agent/copywriting-agent-data.ts`
  - added all-product-ready CLI scripts:
    - `scripts/ecomviper/copywriting_agent_prepare.ts`
    - `scripts/ecomviper/copywriting_agent_evaluate.ts`
    - `npm` scripts: `ecomviper:copywriting-agent:prepare`, `ecomviper:copywriting-agent:evaluate`
  - added representative regression fixtures:
    - `data/ecomviper/copywriting-agent/fixtures/golden-products.json`
  - added focused tests:
    - `tests/ecomviper_copywriting_agent_types.test.ts`
    - `tests/ecomviper_copywriting_agent_input_builder.test.ts`
    - `tests/ecomviper_copywriting_agent_prompt.test.ts`
    - `tests/ecomviper_copywriting_agent_evals.test.ts`
    - `tests/ecomviper_copywriting_agent_scripts.test.ts`
- Boundary confirmation:
  - all products are in scope for contract/input builder; no SKU-specific architecture
  - golden fixtures are representative regression fixtures only
  - no live Generate Intelligence behavior change
  - no Product Editor UI/layout change
  - no model calls required for Phase 6.1 tests/scripts
  - no supplier writes/import/sync/extraction/OCR added
  - no duplicate `/ecomviper/shopify/products/[productId-or-handle]` route restoration

## Sprint Closure Update: Phase 6.1 All-Product AI Copywriting Agent Contract + Eval Harness

- Sprint/branch: `sprint-6-1-ai-copywriting-agent-contract-evals`
- MR:
  - `!297`: `https://gitlab.com/cloudalien-technologies/ibrains-app/-/merge_requests/297`
  - source branch commit SHA: `f8c3e08d1882467d1aec545645b6f5ac228b1489`
  - merge commit SHA: `4c2045a684e9d78c96d868b7de69435dabdf4344`
  - MR pipeline `2566089523`: success
- Main/deploy pipeline:
  - pipeline `2566092655`: success
- Branch cleanup:
  - remote source branch deletion: completed via merge (`--remove-source-branch`)
  - local source branch deletion: completed (`git branch -d sprint-6-1-ai-copywriting-agent-contract-evals`)
  - local repository reset: clean `main` synced to `origin/main` before closure metadata branch
- Production release verification:
  - `/api/meta/release`:
    - `git_sha=4c2045a684e9d78c96d868b7de69435dabdf4344`
    - `build_id=2566092655`
    - `deployed_at=2026-06-01T03:47:41Z`
    - `release_metadata_complete=true`
  - `/api/health`: `{"ok":true,...,"upstream_ok":true}`
- Signed-out route verification:
  - `/admin` -> `307` to `/sign-in?redirect_url=%2Fadmin`
  - `/admin/ecomviper` -> `307` to `/sign-in?redirect_url=%2Fadmin%2Fecomviper`
  - `/admin/ecomviper/suppliers/rocktomic/audit` -> `307` to `/sign-in?redirect_url=%2Fadmin%2Fecomviper%2Fsuppliers%2Frocktomic%2Faudit`
  - `/ecomviper/products/opa-oxy-burn-thermogenic-support` -> `307` to sign-in with preserved redirect URL
- Signed-in/manual QA status:
  - blocked in CLI-only run (no authenticated browser session available).
  - remaining checks: Oxy-Burn and Magnesium front-image default verification and Product Editor signed-in Generate Intelligence/no-yellow-error visual confirmation.
- Delivered behavior summary:
  - all-product `ProductCopywritingInput`/`ProductCopywritingOutput` contract foundation implemented
  - prompt/source-facts contract and eval harness added without live model calls
  - representative golden fixtures added for regression scoring only
  - no live Generate Intelligence runtime changes
  - no Product Editor UI/layout changes
  - no duplicate `/ecomviper/shopify/products/[productId-or-handle]` route restoration

## Sprint Checkpoint: Phase 5.2 Product Editor Default Front Image (Local Branch)

- Branch: `sprint-5-2-product-editor-default-front-image`
- Date: `2026-06-01 (UTC)`
- Local checkpoint status: implementation + focused tests/build checks in progress; MR/pipeline/deploy verification pending.
- Scope implemented locally:
  - Added deterministic default-image selector helper:
    - `lib/ecomviper/shopify/product-image-selection.ts`
  - Applied helper to canonical Product Editor only:
    - `app/ecomviper/products/[productId-or-handle]/product-editor-client.tsx`
    - `components/ecomviper/product-image-gallery.tsx`
  - Preserved canonical route-only workflow:
    - `/ecomviper/products/[productId-or-handle]`
    - no restored duplicate `/ecomviper/shopify/products/[productId-or-handle]` route files
  - Added focused tests:
    - `tests/ecomviper_product_image_selection.test.ts`
    - updated gallery/editor/route contract tests for default selection + no hardcoded SKU signals
  - Added planning contract doc:
    - `planning/apps/ecomviper/shopify/product-editor-image-selection.md`
- Boundary confirmation:
  - no SKU/product hardcoding
  - no Product Editor layout redesign
  - no Generate Intelligence behavior changes
  - no supplier write/import/sync/extraction/OCR/AI-label runtime behavior changes
  - no duplicate route restoration

## Sprint Closure Update: Phase 5.2 Product Editor Default Front Image

- Sprint/branch: `sprint-5-2-product-editor-default-front-image`
- MR:
  - `!295`: `https://gitlab.com/cloudalien-technologies/ibrains-app/-/merge_requests/295`
  - source branch commit SHA: `e0ec229cd298c32c0e86ff0fdae96ce900aa8724`
  - merge commit SHA: `e3c7bc8388a72a583fbe3613ac696e8764314071`
  - MR pipeline `2566005733`: success
- Main/deploy pipeline:
  - pipeline `2566010001`: success
- Branch cleanup:
  - remote source branch deletion: completed via merge (`--remove-source-branch`)
  - local source branch deletion: completed (`git branch -d sprint-5-2-product-editor-default-front-image`)
  - local repository reset: clean `main` synced to `origin/main` before closure metadata branch
- Production release verification:
  - `/api/meta/release`:
    - `git_sha=e3c7bc8388a72a583fbe3613ac696e8764314071`
    - `build_id=2566010001`
    - `deployed_at=2026-06-01T02:37:10Z`
    - `release_metadata_complete=true`
  - `/api/health`: `{"ok":true,...,"upstream_ok":true}`
  - smoke script: `RUN_DETAILED_SMOKE=1 scripts/production_smoke_check.sh app.ibrains.ai` passed
- Signed-out route verification:
  - `/admin` -> `307` to `/sign-in?redirect_url=%2Fadmin`
  - `/admin/ecomviper` -> `307` to `/sign-in?redirect_url=%2Fadmin%2Fecomviper`
  - `/admin/ecomviper/suppliers/rocktomic/audit` -> `307` to `/sign-in?redirect_url=%2Fadmin%2Fecomviper%2Fsuppliers%2Frocktomic%2Faudit`
  - `/ecomviper/products/opa-oxy-burn-thermogenic-support` -> `307` to sign-in with preserved redirect URL
- Signed-in/manual Product Editor QA status:
  - blocked in this CLI-only closure run (no authenticated browser session available).
  - required signed-in checks remain: Oxy-Burn and Magnesium default front-image verification, thumbnail interaction confirmation, and no yellow onlineStoreUrl error check.
- Delivered behavior summary:
  - canonical Product Editor route only (`/ecomviper/products/[productId-or-handle]`)
  - deterministic front/primary/featured default image selection helper is global (no SKU/handle hardcoding)
  - thumbnail click behavior preserved
  - no duplicate `/ecomviper/shopify/products/[productId-or-handle]` route restored
  - no Product Editor layout redesign
  - no Generate Intelligence behavior changes

## Sprint Checkpoint: Phase 1.5 Shared Ecommerce Database Foundation (Local Branch)

- Branch: `sprint-015-shared-ecommerce-db-foundation`
- Date: `2026-05-31 (UTC)`
- Local checkpoint status: implementation + focused tests/checks in progress; MR/deploy verification pending.
- Architecture boundary established:
  - `ibrains-ecommerce-prod-postgres` documented as the shared ecommerce platform database target.
  - `ecomviper-prod-postgres` documented as legacy/deprecated and ignored unless a future explicit recovery scope is approved.
  - `DATABASE_URL` documented as core iBrains platform DB scope.
  - `ECOMMERCE_DATABASE_URL` documented as ecommerce-platform DB scope.
- Foundation work implemented:
  - Added strict ecommerce DB utility: `lib/ecommerce/database.ts`.
  - Added explicit non-destructive ecommerce connection smoke script:
    - `scripts/ecommerce/check_database_connection.ts`
    - `npm run ecommerce:check-db`
  - Added planning inventory/move-target doc:
    - `planning/apps/ecomviper/ecommerce-database-foundation.md`
  - Updated boundary language in:
    - `planning/apps/ecomviper/overview.md`
    - `planning/apps/ecomviper/admin.md`
    - `planning/apps/ecomviper/shopify/supplier-ingestion-architecture.md`
- Guardrail confirmation for Phase 1.5:
  - no data migration performed
  - no production schema migration performed
  - no Rocktomic import performed
  - no runtime route/component behavior switch performed
  - no Product Editor/Generate Intelligence behavior changes performed
- Recommended next phase:
  - Phase 2 — Rocktomic validation rules and blocking/warning field policy.

## Sprint Checkpoint: Phase 2 Rocktomic Validation Policy (Local Branch)

- Branch: `sprint-016-rocktomic-validation-policy`
- Date: `2026-05-31 (UTC)`
- Local checkpoint status: implementation + focused tests in progress; MR/deploy verification pending.
- Scope implemented locally:
  - Added formal validation policy module:
    - `lib/ecomviper/suppliers/rocktomic-validation-policy.ts`
  - Upgraded offline package outputs to include:
    - formal SKU statuses (`usable`, `usable_with_warnings`, `blocked`, `not_applicable`, `extraction_error`)
    - package status (`pass`, `pass_with_warnings`, `fail`)
    - blocking/warning/not-applicable field handling
    - downstream readiness flags (offline output only)
  - Extended generated artifacts:
    - `data/ecomviper/suppliers/rocktomic/latest/validation-report.json`
    - `data/ecomviper/suppliers/rocktomic/latest/audit.csv`
  - Added focused tests for policy status and boundary behavior.
- Phase boundary confirmation:
  - no database import/migration performed
  - no runtime route/component behavior switch performed
  - no Product Editor / Generate Intelligence / Admin UI / Image Studio / OptiBay / OptiWal / Optizon behavior changes performed
- Recommended next phases:
  - Phase 3: Admin validation visibility
  - Phase 4: controlled validated data import/read path

## Sprint Closure Update: Phase 2 Rocktomic Validation Policy

- Sprint/branch: `sprint-016-rocktomic-validation-policy`
- MR:
  - `!279`: `https://gitlab.com/cloudalien-technologies/ibrains-app/-/merge_requests/279`
  - source branch commit SHA: `cd2602188be47f7e51290a111f8727da7525f44f`
  - merge commit SHA: `132ecbfaa30ee52b24163d8e230cfc4c01c7d39b`
  - MR pipeline `2565477636`: success
- Main/deploy pipeline:
  - pipeline `2565479581`: success
  - verify/build/deploy jobs: success
- Branch cleanup:
  - remote source branch deletion: completed via merge (`--remove-source-branch`)
  - local source branch deletion: pending local cleanup in active builder session
  - local repository reset target: clean `main` after closure metadata update merge
- Production release verification:
  - `/api/meta/release`:
    - `git_sha=132ecbfaa30ee52b24163d8e230cfc4c01c7d39b`
    - `build_id=2565479581`
    - `deployed_at=2026-05-31T15:17:29Z`
    - `release_metadata_complete=true`
  - smoke script: `RUN_DETAILED_SMOKE=1 scripts/production_smoke_check.sh app.ibrains.ai` passed
  - route timings:
    - `/api/health`: `200` in `0.088057s`
    - `/api/meta/release`: `200` in `0.076653s`
    - `/brains`: `307` in `0.072359s`
    - `/ecomviper`: `307` in `0.058738s`
    - `/ecomviper/settings`: `307` in `0.064732s`
    - `/ecomviper/dropshipping/rocktomic`: `307` in `0.063247s`
  - socket health: close-wait sockets `0` (pass)
- Generated validation summary:
  - supplier: `rocktomic`
  - validation policy: `rocktomic_phase2_v1`
  - package status: `fail`
  - SKU totals: `156`
  - usable: `0`
  - usable_with_warnings: `4`
  - blocked: `152`
  - extraction_error: `0`
- Honest boundary confirmation:
  - no data import to `ibrains-ecommerce-prod-postgres`
  - no production DB schema migration
  - no runtime Product Editor/Generate Intelligence/Admin/Image Studio/OptiBay/OptiWal/Optizon behavior switch
  - no render-path supplier fetch/extraction added
- Recommended next phase:
  - Phase 3 — Admin validation visibility and operator review surface for package status and SKU-level defect triage.

## Sprint Checkpoint: Phase 3 Rocktomic Admin Audit Visibility (Local Branch)

- Branch: `sprint-017-rocktomic-admin-audit-visibility`
- Date: `2026-05-31 (UTC)`
- Local checkpoint status: implementation + focused tests/checks in progress; MR/deploy verification pending.
- Scope implemented locally:
  - Added server-only offline package reader:
    - `lib/ecomviper/suppliers/rocktomic-admin-audit.ts`
  - Enhanced admin route:
    - `/admin/ecomviper/suppliers/rocktomic/audit`
    - file: `app/admin/ecomviper/suppliers/rocktomic/audit/page.tsx`
  - Added focused reader tests:
    - `tests/ecomviper_rocktomic_admin_audit_reader.test.ts`
  - Updated admin route contract tests for new Phase 3 audit visibility shape.
  - Added planning doc:
    - `planning/apps/ecomviper/shopify/rocktomic-admin-audit-visibility.md`
- Phase boundary confirmation:
  - no supplier data import into `ibrains-ecommerce-prod-postgres`
  - no production ecommerce schema migration
  - no Product Editor / Generate Intelligence / Image Studio / OptiBay / OptiWal / Optizon behavior switch
  - no runtime source fetching, OCR, extraction, or validation side effects from admin render
- Recommended next phases:
  - Phase 4: controlled validated supplier data import/read path for shared ecommerce DB
  - Phase 5: Product Editor read-only supplier facts binding
  - Phase 6: Generate Intelligence binding
  - Phase 7: shared ecommerce generalization across apps

## Sprint Closure Update: Phase 3 Rocktomic Admin Audit Visibility

- Sprint/branch: `sprint-017-rocktomic-admin-audit-visibility`
- MR:
  - `!281`: `https://gitlab.com/cloudalien-technologies/ibrains-app/-/merge_requests/281`
  - source branch commit SHA: `f95529c8e585663ac6458b8f8dca1ff399a74664`
  - merge commit SHA: `c36939a449226145f49b3606317bc1eea03beddc`
  - MR pipeline `2565507868`: success
- Main/deploy pipeline:
  - pipeline `2565510586`: success
  - verify/build/deploy jobs: success
- Branch cleanup:
  - remote source branch deletion: completed via merge (`--remove-source-branch`)
  - local source branch deletion: completed (`git branch -d sprint-017-rocktomic-admin-audit-visibility`)
  - local repository reset: clean `main` synced to `origin/main`
- Production release verification:
  - `/api/meta/release`:
    - `git_sha=c36939a449226145f49b3606317bc1eea03beddc`
    - `build_id=2565510586`
    - `deployed_at=2026-05-31T16:08:41Z`
    - `release_metadata_complete=true`
  - smoke script: `RUN_DETAILED_SMOKE=1 scripts/production_smoke_check.sh app.ibrains.ai` passed
  - route timings:
    - `/api/health`: `200` in `0.106687s`
    - `/api/meta/release`: `200` in `0.088246s`
    - `/brains`: `307` in `0.055688s`
    - `/ecomviper`: `307` in `0.068457s`
    - `/ecomviper/settings`: `307` in `0.054439s`
    - `/ecomviper/dropshipping/rocktomic`: `307` in `0.069999s`
  - socket health: close-wait sockets `0` (pass)
- Signed-out admin route verification:
  - `/admin` -> `307` to `/sign-in?redirect_url=%2Fadmin`
  - `/admin/ecomviper` -> `307` to `/sign-in?redirect_url=%2Fadmin%2Fecomviper`
  - `/admin/ecomviper/suppliers/rocktomic/audit` -> `307` to `/sign-in?redirect_url=%2Fadmin%2Fecomviper%2Fsuppliers%2Frocktomic%2Faudit`
- Signed-in/admin verification status:
  - manual signed-in admin UI verification remains session-dependent and was not executed in this CLI run.
- Honest boundary confirmation:
  - no data import to `ibrains-ecommerce-prod-postgres`
  - no production ecommerce schema migration

## Sprint Checkpoint: Phase 3.5 Rocktomic Asset/OCR Remediation (Local Branch)

- Branch: `sprint-018-rocktomic-asset-ocr-remediation`
- Date: `2026-05-31 (UTC)`
- Local checkpoint status: implementation + focused tests/checks in progress; MR/deploy verification pending.
- Scope implemented locally:
  - Added offline extraction modules:
    - `lib/ecomviper/suppliers/rocktomic-pdf-assets.ts`
    - `lib/ecomviper/suppliers/rocktomic-template-assets.ts`
    - `lib/ecomviper/suppliers/rocktomic-supplement-facts-ocr.ts`
  - Upgraded offline builder pipeline:
    - `scripts/ecomviper/build_rocktomic_supplier_data.ts`
    - emits additional artifacts:
      - `catalog-link-evidence.json`
      - `template-asset-evidence.json`
      - `ocr-evidence.json`
  - Enhanced package outputs and validation/readiness summaries:
    - `sourceFacts.json`, `assets.json`, `audit.csv`, `validation-report.json`
  - Extended read-only admin audit visibility for OCR/asset readiness counters.
  - Added focused tests for PDF link mapping, template extraction, OCR parsing, and runtime-boundary safety.
- Honest boundary confirmation:
  - no supplier data import into `ibrains-ecommerce-prod-postgres`
  - no ecommerce DB schema migration
  - no Product Editor / Generate Intelligence / OptiBay / OptiWal / OptiZon runtime behavior switch
  - no runtime source fetch/OCR/extraction side effects in admin render
- Recommended next phase:
  - Phase 4 — controlled import/read of validated supplier data into/from shared ecommerce database.
  - no Product Editor / Generate Intelligence / Image Studio / OptiBay / OptiWal / Optizon runtime behavior switch
  - no runtime source fetch/OCR/extraction/validation side effects added
- Recommended next phases:
  - Phase 4: controlled validated supplier data import/read path for shared ecommerce database
  - Phase 5: Product Editor read-only supplier facts binding
  - Phase 6: Generate Intelligence binding
  - Phase 7: shared ecommerce usage generalization across ecommerce apps

## Sprint Checkpoint: Phase 3.6 Rocktomic AI Label Text Extraction + OCR Fallback (Local Branch)

- Branch: `sprint-019-rocktomic-ai-label-text-extraction`
- Date: `2026-05-31 (UTC)`
- Local checkpoint status: implementation + focused tests/checks complete; MR/deploy verification pending.
- Scope implemented locally:
  - Added offline AI label extraction module:
    - `lib/ecomviper/suppliers/rocktomic-ai-label-text.ts`
  - Enhanced templates-page extraction to resolve per-SKU `.ai`/`.tif` assets via templates-page Azure listing metadata:
    - `lib/ecomviper/suppliers/rocktomic-template-assets.ts`
  - Updated offline builder pipeline:
    - `scripts/ecomviper/build_rocktomic_supplier_data.ts`
    - AI `.ai` extraction is primary for supplement facts
    - OCR is fallback-only for AI non-success cases
    - adds `ai-label-text-evidence.json`
  - Updated artifact contracts:
    - `sourceFacts.json` includes `ai_pdf_text` provenance/confidence/review flags
    - `assets.json` includes remote freshness metadata and AI extraction status
    - `validation-report.json` includes AI/OCR/total supplement facts coverage + AI extraction counters
    - `audit.csv` includes AI extraction status columns
  - Updated read-only admin audit visibility:
    - `/admin/ecomviper/suppliers/rocktomic/audit`
    - displays AI extraction coverage/status counters and `ai-label-text-evidence.json` presence
  - Added focused tests for:
    - AI compatibility and parsing
    - metadata/change-detection behavior
    - templates-page Azure listing extraction
    - validation/admin/runtime-boundary compatibility
- Generated offline summary from current local Phase 3.6 run:
  - SKUs discovered: `164`
  - COA coverage: `124`
  - labelTemplateAi coverage: `147`
  - mockupTemplateTif coverage: `147`
  - AI text extraction successes: `145/147`
  - AI non-PDF: `0`
  - AI no-extractable-text: `2`
  - OCR attempted fallback rows: `0` (no fixture + no fallback text rows for failed AI SKUs)
  - supplement facts total coverage: `136/141`
  - blocked SKUs: `99`
- Honest boundary confirmation:
  - no data import to `ibrains-ecommerce-prod-postgres`
  - no ecommerce DB schema migration
  - no Product Editor/Generate Intelligence runtime behavior switch
  - no extraction on user-facing routes or admin render
  - no permanent `.ai`/`.tif` binary storage in repo data artifacts
- Recommended next phase:
  - Phase 4 — controlled validated supplier data import/read path into/from shared ecommerce database.

## Sprint Checkpoint: Phase 4 Shared Ecommerce DB Supplier Package Import (Local Branch)

- Branch: `sprint-020-rocktomic-shared-ecommerce-db-import`
- Date: `2026-05-31 (UTC)`
- Local checkpoint status: implementation + focused tests/checks in progress; MR/deploy verification pending.
- Scope implemented locally:
  - Added shared ecommerce supplier-intelligence schema migration:
    - `db/ecommerce/migrations/20260601_ecommerce_supplier_intelligence.sql`
  - Added ecommerce-only migration runner:
    - `lib/ecommerce/migration-runner.ts`
    - `scripts/ecommerce/migrate.ts`
  - Added Rocktomic package import mapping and DB upsert runner:
    - `lib/ecommerce/rocktomic-package-import.ts`
    - `lib/ecommerce/rocktomic-import-runner.ts`
    - `scripts/ecomviper/import_rocktomic_supplier_package.ts`
  - Added read-only verification script:
    - `scripts/ecommerce/verify_rocktomic_supplier_import.ts`
  - Added npm commands:
    - `npm run ecommerce:migrate`
    - `npm run ecomviper:import-rocktomic-supplier-package`
    - `npm run ecommerce:verify-rocktomic-import`
  - Added Phase 4 focused tests for schema contract, migration idempotency, import mapping, script/runtime boundaries.
  - Added Phase 4 planning contract doc:
    - `planning/apps/ecomviper/shopify/rocktomic-shared-ecommerce-db-import.md`
- Honest boundary confirmation:
  - `DATABASE_URL` remains core iBrains DB boundary
  - `ECOMMERCE_DATABASE_URL` is used for Phase 4 migration/import/verify scripts
  - `ecomviper-prod-postgres` remains deprecated/ignored
  - no Product Editor / Generate Intelligence runtime behavior switch
  - no admin write/import trigger UI
  - no runtime source fetch/extraction/OCR side effects
  - no permanent `.ai` / `.tif` binary storage
- Recommended next phases:
  - Phase 5: Product Editor read-only supplier facts binding from shared ecommerce DB
  - Phase 6: Generate Intelligence binding
  - Future OptiPixel phase: runtime use of supplier asset metadata references and on-demand asset workflows

## Sprint Closure Update: Phase 4 Shared Ecommerce DB Supplier Package Import

- Sprint/branch: `sprint-020-rocktomic-shared-ecommerce-db-import`
- MR:
  - `!285`: `https://gitlab.com/cloudalien-technologies/ibrains-app/-/merge_requests/285`
  - source branch commit SHA: `792436951b0142d78f72314957034c6fcc3a7b5a`
  - merge commit SHA: `786bcfa4b8890db1ca1077dae8a22e3502b5edb5`
  - MR pipeline `2565671966`: success
- Branch cleanup:
  - remote source branch deletion: completed (`--remove-source-branch`)
  - local source branch deletion: completed (`git branch -d sprint-020-rocktomic-shared-ecommerce-db-import`)
  - local repository reset: `main` fast-forwarded to `origin/main` and clean
- Validation summary:
  - focused Phase 4 tests: passed
  - `npm run build`: passed
  - `git diff --check`: passed
  - `npm test`: failed due unrelated baseline suites (10 failing tests across non-Phase-4 areas)
  - `npm run ecomviper:build-rocktomic-supplier-data`: timed out in this CLI environment (`timeout 120 ...`, exit `124`) after source enumeration
- Import execution status:
  - `npm run ecommerce:migrate`: not run against live DB in this closure run
  - `npm run ecomviper:import-rocktomic-supplier-package`: not run against live DB in this closure run
  - `npm run ecommerce:verify-rocktomic-import`: not run against live DB in this closure run
  - reason: no explicit in-session approval to execute migration/import against target ecommerce environment
- Honest boundary confirmation:
  - `DATABASE_URL` boundary unchanged for core iBrains
  - `ECOMMERCE_DATABASE_URL` used for Phase 4 migration/import/verify tooling
  - no Product Editor / Generate Intelligence runtime behavior switch
  - no admin write/import trigger UI
  - no runtime extraction/OCR/source-fetch side effects
  - no permanent `.ai`/`.tif` binary storage introduced
- Recommended next phase:
  - Phase 5 — bind Product Editor read-only supplier facts to shared ecommerce DB with blocked-SKU safety gates.

## Sprint Checkpoint: Phase 4.1 Live Ecommerce DB Migration/Import/Verify Closure (Local Branch)

- Branch: `sprint-021-phase4-1-live-ecommerce-import-closure`
- Date: `2026-05-31 (UTC)`
- Local checkpoint status: live execution + closure metadata update in progress; MR/deploy verification pending.
- Scope executed:
  - verified deployment health before DB work:
    - `/api/meta/release`: `git_sha=022a10e09c294b0a288d78375d77f26d90866246`, `build_id=2565676178`
    - `/api/health`: `200`
    - production smoke: pass
  - validated target DB boundary and connection:
    - target host: `ibrains-ecommerce-prod-postgres-do-user-...g.db.ondigitalocean.com`
    - `ecomviper-prod-postgres`/`ibrains-postgres` not present in `ECOMMERCE_DATABASE_URL`
    - `npm run ecommerce:check-db`: success with `&uselibpqcompat=true` operator compatibility suffix
  - pre-migration safety check:
    - `public` table count was `0` before migration (new/empty state)
  - migration executed live:
    - `npm run ecommerce:migrate` first run: `applied=1` (`20260601_ecommerce_supplier_intelligence.sql`)
    - rerun: `applied=0`, `skipped=1` (idempotent)
  - import executed live:
    - `npm run ecomviper:import-rocktomic-supplier-package`
    - import id: `eimp_a246e1869b30f19a3abf6424`
    - package status: `fail`
    - skus: `164` (`usable=60`, `usable_with_warnings=5`, `blocked=99`, `extraction_error=0`)
    - rows: product facts/pricing/inventory/assets/validation all `164`
  - verify executed live:
    - `npm run ecommerce:verify-rocktomic-import`: pass
    - expected vs actual counts matched
    - table counts matched (`164` each for products/facts/pricing/inventory/assets/validation)
    - coverage summary queryable (`ai_label_text_evidence=147`, `ready_for_optipixel=147`)
  - idempotency execution:
    - import run a second time
    - verify rerun pass
    - distinct-SKU duplicate checks across supplier tables: no duplicates
    - `ecommerce_supplier_package_imports` rows for `rocktomic`: `1`
- Live defect discovered/fixed in this lane:
  - initial import failed with `unsupported Unicode escape sequence`
  - fix:
    - sanitize null-byte characters in mapped strings and JSONB payloads before upsert
    - regression test added: `tests/ecommerce_phase4_null_byte_sanitization.test.ts`
- Package rebuild timeout follow-up:
  - `timeout 600 npm run ecomviper:build-rocktomic-supplier-data` still timed out at `600.01s` after source enumeration
  - closure used valid existing package artifacts (`generatedAt=2026-05-31T18:38:32.479Z`, `policy=rocktomic_phase3_6_v1`, `164` SKUs)
- Boundary confirmation:
  - `DATABASE_URL` remains core iBrains boundary
  - ecommerce migration/import/verify executed via `ECOMMERCE_DATABASE_URL` only
  - no Product Editor / Generate Intelligence / runtime route behavior switch
  - no admin import UI/button
  - no runtime extraction/source fetching side effects
  - no permanent `.ai/.tif` binary storage
- Recommended next phase:
  - Phase 5 — Product Editor read-only supplier facts binding from shared ecommerce DB with blocked-SKU safety gates.

## Sprint Checkpoint: Rocktomic Supplier Data Package Phase 1 (Offline All-SKU Audit)

- Branch: `rocktomic-offline-all-sku-audit-phase1`
- Date: `2026-05-31 (UTC)`
- Local checkpoint status: implementation + focused tests complete; MR/deploy verification pending.
- Scope implemented locally:
  - Added canonical source registry at `data/ecomviper/suppliers/rocktomic/sources.json`.
  - Added offline-only build script: `scripts/ecomviper/build_rocktomic_supplier_data.ts`.
  - Added deterministic helper module: `lib/ecomviper/suppliers/rocktomic-offline-audit.ts`.
  - Added focused helper tests: `tests/ecomviper_rocktomic_offline_audit_helpers.test.ts`.
  - Added npm command: `npm run ecomviper:build-rocktomic-supplier-data`.
  - Generated package outputs under `data/ecomviper/suppliers/rocktomic/latest/`:
    - `sourceFacts.json`
    - `pricing.json`
    - `inventory.json`
    - `assets.json`
    - `audit.csv`
    - `validation-report.json`
- Phase boundary:
  - Offline extraction/audit only.
  - No Product Editor/Admin UI/Generate Intelligence changes.
  - No database import/background worker/sync-button work.
  - No runtime Rocktomic source fetching from app routes.

## Sprint Closure Update: Rocktomic Supplier Data Package Phase 1 (Offline All-SKU Audit)

- Sprint/branch: `rocktomic-offline-all-sku-audit-phase1`
- MR:
  - `!276`: `https://gitlab.com/cloudalien-technologies/ibrains-app/-/merge_requests/276`
  - MR pipeline `2565345718`: success
  - merge commit SHA: `06fd432d9b5c29e867b5e8a3bc999999d780131a`
- Main/deploy pipeline:
  - pipeline `2565349948`: success
  - deploy job `14620708303`: success
- Branch cleanup:
  - remote source branch deletion: completed via merge (`--remove-source-branch`)
  - local source branch deletion: completed (`git branch -d rocktomic-offline-all-sku-audit-phase1`)
  - local repository reset: `main` fast-forwarded to merge commit
- Production release verification:
  - `/api/meta/release`:
    - `git_sha=06fd432d9b5c29e867b5e8a3bc999999d780131a`
    - `build_id=2565349948`
    - `deployed_at=2026-05-31T14:07:15Z`
  - smoke script: `RUN_DETAILED_SMOKE=1 scripts/production_smoke_check.sh app.ibrains.ai` passed
  - route timings:
    - `/api/health`: `200` in `0.075809s`
    - `/api/meta/release`: `200` in `0.067814s`
    - `/brains`: `307` in `0.069414s`
    - `/ecomviper`: `307` in `0.062983s`
    - `/admin`: `307` in `0.052192s`
  - socket health: close-wait sockets `0` (pass)
- Honest verification status:
  - signed-in desktop/mobile verification is not applicable for this offline package scope and was not required to validate runtime UI behavior.
- Recommended next sprint:
  - Phase 2 Rocktomic validation gates + ingestion enforcement, still keeping extraction off render paths.

## Sprint Checkpoint: EcomViper Product Editor PDP Gallery Redesign (Local Branch)

- Branch: `ecomviper-product-editor-pdp-gallery-redesign`
- Date: `2026-05-31 (UTC)`
- Local checkpoint status: implementation + focused tests complete; MR/deploy verification pending.
- Scope implemented locally:
  - Product Editor hero redesign with top-of-page ecommerce gallery (main image + selectable thumbnails).
  - Deterministic image ordering helper for Shopify + hosted/generated assets (`front -> facts -> side -> 3-pack -> 6-pack -> lifestyle -> fallback`).
  - Product Summary card added beside gallery with SKU/vendor/type/status/COA/commerce/timestamp context.
  - Old Product Rail removed from primary Product Editor layout.
  - Tabs/actions preserved (`Preview PDP`, `Save Changes`, `Generate Intelligence`, all existing tabs).
- Merchant-facing summary surfaces avoid internal extraction/debug key language.
- Render path remains display-only (no supplier sync/OCR/PDF/OpenAI run triggered by render).

## Sprint Closure Update: EcomViper Product Editor PDP Gallery Redesign

- Sprint/branch: `ecomviper-product-editor-pdp-gallery-redesign`
- MR:
  - `!271`: `https://gitlab.com/cloudalien-technologies/ibrains-app/-/merge_requests/271`
  - MR pipeline `2565155760`: success
  - merge commit SHA: `865831ae25e13e3abf3feae30831c3373ef29242`
- Closure docs MR:
  - `!272`: `https://gitlab.com/cloudalien-technologies/ibrains-app/-/merge_requests/272`
  - MR pipeline `2565162073`: success
  - merge commit SHA: `91d7255eddd3203cc40d44d00b5cde0dc587fc2d`
- Main/deploy pipeline:
  - pipeline `2565157760`: success (feature merge deploy)
  - pipeline `2565163334`: success (closure docs merge deploy)
  - deploy jobs: `14619976605` and `14620004362` succeeded
- Branch cleanup:
  - remote source branch deletion: confirmed (no head ref on `origin`)
  - local source branch deletion: completed
  - local repository reset: `main` fast-forwarded and clean (`git status` clean)
- Production release verification:
  - `/api/meta/release`:
    - `git_sha=91d7255eddd3203cc40d44d00b5cde0dc587fc2d`
    - `build_id=2565163334`
    - `deployed_at=2026-05-31T12:09:18Z`
  - smoke script: `RUN_DETAILED_SMOKE=1 scripts/production_smoke_check.sh app.ibrains.ai` passed
  - signed-out route checks:
    - `/brains` -> `307` to sign-in
    - `/ecomviper` -> `307` to sign-in
    - `/ecomviper/settings` -> `307` to sign-in
    - `/ecomviper/dropshipping/rocktomic` -> `307` to sign-in
    - `/admin` -> `307` to sign-in
- Honest verification status:
  - signed-in desktop/mobile UX verification for Product Editor gallery interactions is still manual-session dependent and was not executed in this CLI run.
- Recommended next sprint:
  - complete signed-in desktop + mobile verification checklist for merged Product Editor gallery redesign and capture closure evidence.

## Global iBrains Shell + Dashboard Modernization Checkpoint (Local Branch)

- Branch: `global-ibrains-shell-dashboard-modernization`
- Date: `2026-05-31 (UTC)`
- Local checkpoint status: implementation + focused shell/layout/auth tests in progress; MR/deploy verification pending.
- Scope implemented locally:
  - shared global iBrains header with Clerk account controls and `/brains` logo link
  - shared brain workspace shell and EcomViper sidebar pattern for `/ecomviper/*`
  - shared admin workspace shell for `/admin/*` while preserving `requireAdmin` access guard
  - `/brains` launcher cleanup to remove duplicated hero identity sections
  - route-family migration of `/ecomviper`, Product Editor, Settings, and Rocktomic diagnostics into common shell
  - planning/docs updates for shell contract and future `/brain` + `/admin/brain` pattern

## Hotfix Implementation Checkpoint: Shopify Hotfix 009.9 (Local Branch)

- Branch: `hotfix-009-9-all-sku-supplier-field-mapping-product-editor-binding`
- Date: `2026-05-31 (UTC)`
- Local checkpoint status: implementation + focused tests complete; MR/deploy verification pending.
- Implemented locally:
  - deterministic Product Editor sourceFacts precedence for all SKUs (including source-owned key features/certifications/dietary/manufacturing/testing field families),
  - explicit OCR/source-sync/missing state messaging in sourceFacts display text,
  - low-stock mapping update to `Action Required: Mark Out of Stock`,
  - pricing effective-tier fallback labeling (`(default)`) without `Not selected` wording while computing default-tier costs,
  - COA card/assets wording aligned to per-SKU catalog hyperlink contract with non-blocking `COA Document Parsing: pending`,
  - Generate Intelligence diagnostics include `coa_link_status` and reuse sourceFacts-mapped compliance fields,
  - proxy path update for `/api/ecomviper/settings/*` and `/api/ecomviper/pdp-intelligence` to run through Clerk context for authenticated session resolution.
- Focused local validation (passed):
  - `tests/ecomviper_supplier_membership_route.test.ts`
  - `tests/ecomviper_product_editor_source_mapping.test.tsx`
  - `tests/ecomviper_pdp_intelligence_route.test.ts`
  - `tests/ecomviper_pdp_intelligence_generation.test.ts`
  - `tests/ecomviper_global_supplier_scope_binding.test.ts`
  - `tests/ecomviper_rocktomic_source_ingestion.test.ts`
  - `tests/proxy_apps_auth_protection.test.ts`
  - `tests/ecomviper_settings_membership_ui_contract.test.ts`
  - `tests/ecomviper_settings_route_safety.test.tsx`
  - `tests/ecomviper_route_render_sync_safety.test.ts`
  - `tests/ecomviper_product_editor_sync_required_message.test.tsx`
  - `tests/ecomviper_inventory_status_fallback.test.ts`

## Hotfix Closure Update: Shopify Hotfix 009.9 Deterministic All-SKU Supplier Mapping + Product Editor Binding

- Sprint/lane: `hotfix-009-9-all-sku-supplier-field-mapping-product-editor-binding`
- MR:
  - `!265`: `https://gitlab.com/cloudalien-technologies/ibrains-app/-/merge_requests/265`
  - source branch commit SHA: `c0ce66454d623966612dc1ead027822cabe9154e`
  - merge commit SHA: `30a1e1bcf5d1ec3362007dbf064755cd579b5c0d`
  - MR pipeline `2564619889`: success
  - main/deploy pipeline `2564623133`: success
  - deploy job `deploy_production`: success
- Branch cleanup:
  - remote source branch deletion: confirmed (branch ref absent on `origin`)
  - local source branch deletion: completed
  - local repository reset: `main` fast-forwarded and clean
- Production release verification:
  - `/api/meta/release`:
    - `git_sha=30a1e1bcf5d1ec3362007dbf064755cd579b5c0d`
    - `build_id=2564623133`
    - `deployed_at=2026-05-31T01:42:35Z`
    - `release_metadata_complete=true`
  - route timings:
    - `/api/health`: `200` in `0.159031s`
    - `/api/meta/release`: `200` in `0.075042s`
    - `/brains`: `307` in `0.049512s`
    - `/ecomviper`: `307` in `0.051380s`
    - `/ecomviper/settings`: `307` in `0.067177s`
    - `/ecomviper/dropshipping/rocktomic`: `307` in `0.054353s`
  - smoke script: `RUN_DETAILED_SMOKE=1 scripts/production_smoke_check.sh app.ibrains.ai` passed
  - socket health: `CLOSE-WAIT` not growing (`0` in smoke check)
  - nginx timeout scan: no new `504`/`upstream timed out` entries in recent tail
- Remaining blocker:
  - mandatory signed-in desktop/mobile browser verification for SKU-level UI flows is still manual-session dependent and was not completed in this CLI run.
- Recommended next sprint:
  - perform signed-in desktop/mobile verification closure pass for Hotfix 009.9, then resume `Shopify Stabilization Sprint 011`.

## Admin Foundation Checkpoint: EcomViper Supplier Intelligence Console (Local Branch)

- Branch: `admin-foundation-ecomviper-supplier-intelligence`
- Date: `2026-05-31 (UTC)`
- Local checkpoint status: implementation + focused admin/auth tests in progress; MR/deploy verification pending.
- Scope implemented locally:
  - protected `/admin` route family with server-side Clerk + env allowlist authorization guard,
  - internal admin shell and route hierarchy for EcomViper supplier operations,
  - Rocktomic supplier summary, all-SKU audit, and build-history read-only pages,
  - admin data readers constrained to global normalized tables + sync status/run records,
  - no runtime supplier extraction/sync execution in admin page renders.

## Hotfix Verification Update: Shopify Hotfix 009.8 Global Supplier Data Scope + Product Editor Binding

- Sprint/lane: `hotfix-009-8-global-supplier-data-scope-product-editor-binding` - merged and production deployed; not fully closed until signed-in browser verification is completed.
- Start date: `2026-05-30 (UTC)`.
- Code MR:
  - MR `!263`: `https://gitlab.com/cloudalien-technologies/ibrains-app/-/merge_requests/263`
  - branch commit: `8c1e89f09b243e003bedd118f65e5fef93eea3eb`
  - merge commit: `7b1898e511e16e26272bc2bf26178200c4ec6464`
  - MR pipeline `2564531093`: success
  - main/deploy pipeline `2564533266`: success
  - build job `14617340929`: success
  - deploy job `14617340930`: success
  - remote source branch deletion: requested by merge and confirmed absent from `origin`.
- Production database scope finding:
  - normalized supplier tables have `user_id` + `supplier_id` scope columns and no `workspace_id`/`tenant_id` columns.
  - records exist globally under `__global__` for products/pricing/inventory/assets (`145` each).
  - an additional merchant duplicate scope exists for `user_3CnqTBgyO2p8whGnWNezzuVBgHd` (`145` each), confirming the prior model could duplicate platform supplier data per user.
  - source runs include global run `2` under `__global__` and user run `3`; both parsed products/pricing/assets `145` and inventory source rows `153`.
  - sampled global SKUs `ROC720`, `ROC721`, `ROC801`, `ROC817`, `ROC948`, `ROC949`, `ROC507`, and `ROC920` all have product/pricing/inventory/assets rows; supplement facts are currently `ocr_required` for sampled rows.
- Root cause:
  - normalized records could be persisted under `__global__`, while Settings/Product Editor/status reads passed the signed-in merchant user id.
  - Product Editor seeded source-owned fields from saved generated PDP intelligence before normalized facts, allowing stale `Unknown` values to mask source records.
  - Settings gated supplier diagnostics behind Shopify connection state and read membership tiers from the scoped snapshot instead of global pricing rows.
- Implementation direction:
  - global supplier reads use `lib/ecomviper/suppliers/global-supplier-data.ts`.
  - source sync persists under `__global__` and matching paths disable seed fallback products.
  - product-facing cache-only supplier reads prefer persisted normalized records over process-local snapshots to avoid stale sourceFacts after sync.
  - merchant membership tier remains user-scoped through merchant setting wrappers.
  - Product Editor composes `sourceFacts` separately from saved/generated intelligence and flags stale generation.
- Fixes shipped:
  - global supplier data repository added for normalized product, pricing, inventory, assets, membership-tier, and sync-summary reads.
  - Settings reads global supplier diagnostics and global pricing tier options while saving the selected tier to merchant/user settings.
  - Product Editor binds Shopify product data to global normalized source facts by normalized SKU and keeps source facts separate from saved/generated PDP intelligence.
  - pricing messages distinguish no selected tier, missing SKU pricing, missing selected-tier cost, and explicit default-tier use.
  - inventory and assets/COA cards read normalized global rows and render qualitative statuses or precise pending/OCR/source-sync states.
  - Generate Intelligence uses the same Product Editor `sourceFacts` object and returns source-fact diagnostics, including stale-intelligence status and source version.
  - source sync and product-facing reads do not run live supplier source fetching/parsing during route render.
- Documentation updated:
  - `planning/state.md`
  - `planning/design.md`
  - `planning/apps/ecomviper/shopify/architecture.md`
  - `planning/apps/ecomviper/shopify/supplier-ingestion-architecture.md`
  - `planning/apps/ecomviper/shopify/product-editor-architecture.md`
  - `planning/apps/ecomviper/shopify/pdp-intelligence.md`
  - `planning/apps/ecomviper/shopify/pricing-architecture.md`
  - `planning/apps/ecomviper/shopify/inventory-architecture.md`
  - `planning/apps/ecomviper/shopify/coa-architecture.md`
  - `planning/apps/ecomviper/shopify/production-safety.md`
- Validation:
  - focused Hotfix 009.8 suite: passed (`21` files, `54` tests).
  - `npm run build`: passed.
  - `git diff --check`: passed.
  - full `npm test`: `297` files passed / `9` files failed; failures are pre-existing baseline suites outside this hotfix scope (`casahud_ai_channel_engine`, `ecomviper_walmart_products_persistence`, `frontdoor_env_copy_contract`, `homepage_layout_contract`, `siteforge_command_center_shell`, `studio_casahud_media_planning_engine`, `studio_casahud_youtube_package_engine`, `walmart/compliance`).
- Production deployment verification:
  - `/api/meta/release` after deploy:
    - `git_sha=7b1898e511e16e26272bc2bf26178200c4ec6464`
    - `build_id=2564533266`
    - `deployed_at=2026-05-30T23:59:12Z`
    - `release_metadata_complete=true`
  - route timings after deploy:
    - `/api/health`: `200` in `0.090722s`
    - `/api/meta/release`: `200` in `0.108576s`
    - `/brains`: `307` in `0.081919s`
    - `/ecomviper`: `307` in `0.070894s`
    - `/ecomviper/settings`: `307` in `0.054746s`
    - `/ecomviper/dropshipping/rocktomic`: `307` in `0.064915s`
  - `RUN_DETAILED_SMOKE=1 scripts/production_smoke_check.sh app.ibrains.ai`: passed.
  - service health: `ibrains-app` active, `nginx` active.
  - socket health: `CLOSE-WAIT` count `0`.
  - nginx error tail: no current timeout errors reported by smoke output after deploy.
  - systemd journal after deploy: deployment restart at `2026-05-31T00:00:22Z` deactivated and restarted service successfully.
- Mandatory signed-in browser verification:
  - desktop signed-in Settings/Product Editor/Generate Intelligence verification: blocked in this CLI because no authenticated browser session or app auth storage state is available.
  - mobile signed-in verification: blocked for the same reason.
  - manual verification still required for membership tier dropdown population/save, Product Editor normalized source diagnostics for `ROC948`, `ROC949`, and another SKU such as `ROC507` or `ROC817`, commerce values, qualitative inventory, Ingredients/Supplement Facts status messaging, Assets/COA status, Generate Intelligence source-facts diagnostics, and no console errors.
- Local repository closure status at this state update:
  - code MR source branch remote: deleted.
  - local cleanup to clean `main`: pending this docs-only closure MR merge.

## Hotfix Closure Update: Shopify Hotfix 009.7 Catalog Sync + Internal Auth Cleanup (`2026-05-30 UTC`)

- Sprint/lane:
  - `hotfix-009-7-catalog-pdf-sync-auth-cleanup`
  - follow-up `hotfix-009-7-catalog-pdf-sync-time-budget`
- Root causes addressed:
  1. `catalog_pdf` sync failed because default binary cap (`8MB`) blocked the configured `13,890,530` byte catalog PDF.
  2. `/api/ecomviper/supplier-sources/sync` internal bearer token path was still gated in proxy by JWT-shaped `__session` cookie checks for all `/api/ecomviper/*`.
  3. first-cap fix exposed a second issue: full text-layer extraction on large PDFs could exceed upstream timeout budgets (`504`) before route completion.
- Fixes shipped:
  - `lib/ecomviper/dropshipping/rocktomic-source-ingestion.ts`
    - added trusted-source binary cap override:
      - default binary cap remains `8MB`.
      - trusted Rocktomic catalog PDF source cap raised to `32MB`.
    - added bounded extraction guards:
      - raw fallback string scan capped and line count capped.
      - full text-layer extraction skipped for oversized PDFs (`>12MB`) while preserving link extraction + explicit diagnostics.
  - `proxy.ts`
    - added exact internal-token bypass for `POST /api/ecomviper/supplier-sources/sync` only.
    - no bypass for other `/api/ecomviper/*` routes.
  - tests:
    - `tests/ecomviper_rocktomic_source_ingestion_payload_caps.test.ts`
    - `tests/ecomviper_supplier_sync_route_auth.test.ts`
    - updated `tests/proxy_apps_auth_protection.test.ts`
  - docs:
    - `planning/apps/ecomviper/shopify/supplier-ingestion-architecture.md`
    - `planning/apps/ecomviper/shopify/production-safety.md`
- GitLab delivery chain:
  - MR `!259` (merged): `https://gitlab.com/cloudalien-technologies/ibrains-app/-/merge_requests/259`
    - merge SHA: `01e3671f6b9f1329b88f08d618bc1636db35c55e`
    - branch pipeline `2564383830`: success
    - main pipeline `2564386857`: success
  - MR `!260` (merged): `https://gitlab.com/cloudalien-technologies/ibrains-app/-/merge_requests/260`
    - merge SHA: `55380e29213acebcaaf20706f21c0bf583103bd4`
    - branch pipeline `2564399174`: success
    - main pipeline `2564400990`: failed (`deploy_production`) due local production `main` divergence.
  - MR `!261` (merged): `https://gitlab.com/cloudalien-technologies/ibrains-app/-/merge_requests/261`
    - merge SHA: `a4c1f6592f13e33ca0de36ba5326bfad8b37f4eb`
    - branch pipeline `2564410120`: success
    - main/deploy pipeline `2564411869`: success (final production deploy).
- Production deployment recovery note:
  - fixed failed deploy-family condition by backing up divergent local commit (`backup/main-diverged-92f7057`) and realigning production `main` to `origin/main`, then continued through green GitLab deploy pipeline.
- Final deployed release verification:
  - `/api/meta/release`:
    - `git_sha=a4c1f6592f13e33ca0de36ba5326bfad8b37f4eb`
    - `build_id=2564411869`
    - `deployed_at=2026-05-30T21:08:00Z`
    - `release_metadata_complete=true`
- Production source sync (token-only internal auth path):
  - command: `ECOMVIPER_SYNC_USER_ID=__global__ npm run ecomviper:sync-supplier-sources`
  - run start/end: `2026-05-30T21:13:29Z` -> `2026-05-30T21:13:32Z` (~`3s`)
  - persisted sync run id: `2`
  - run status: `synced`
  - run attempted/completed: `2026-05-30T21:13:30Z`
  - sync response duration: `1961ms`
  - parsed counts:
    - products parsed: `145`
    - pricing parsed: `145`
    - inventory parsed: `153`
    - assets parsed: `147`
  - normalized persisted counts:
    - products: `145`
    - pricing: `145`
    - inventory: `145`
    - assets: `145`
  - source statuses:
    - `catalog_pdf`: `synced`, `fetchable=true`, `parsed=true`, `recordCount=147`
    - `msrp_profit_margins_report`: `synced`, `recordCount=145`
    - `plds_catalog`: `synced`, `recordCount=145`
    - `inventory_report`: `synced`, `recordCount=153`
    - `label_mockup_templates`: `synced`, `recordCount=0`
    - `order_refund_policy`: `synced`, `recordCount=0`
    - `coa_repository`: `never_synced` / pending source
  - latest run error field: `Source pending.` (COA repository pending reference), not payload cap failure.
- Membership tiers detected:
  - `Basic Plan $97/mo`
  - `Launch Plan $157/mo`
  - `Non Member Pricing`
  - `Scale Plan $497/mo`
  - `"Standard & VIP Lifetime Memberships"`
  - `VIP PLUS Membership & Premium Pricing Membership`
- Inventory status distribution:
  - `in_stock: 118`
  - `low_stock: 4`
  - `out_of_stock: 22`
  - `unknown: 1`
- SKU verification:
  - `ROC948`: normalized product/pricing/inventory/assets present.
  - `ROC949`: normalized product/pricing/inventory/assets present.
- Route/runtime safety after final deploy + sync:
  - `/api/health`: `200` in `0.090244s`
  - `/api/meta/release`: `200` in `0.063385s`
  - `/brains`: `307` in `0.056842s`
  - `/ecomviper`: `307` in `0.080963s`
  - `/ecomviper/settings`: `307` in `0.057274s`
  - `/ecomviper/dropshipping/rocktomic`: `307` in `0.062124s`
  - `scripts/production_smoke_check.sh app.ibrains.ai`: passed.
  - service status: `active`.
  - socket states on `:3001` after cooldown: no sustained `CLOSE-WAIT` growth observed.
- Remaining operational blockers before full closure of signed-in verification requirements:
  - desktop signed-in Product Editor and Generate Intelligence browser verification not executable from this non-interactive CLI environment.
  - mobile signed-in browser verification not executable from this environment.
  - these checks still require manual authenticated browser execution and recording.

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
  - hardened `/ecomviper` supplier snapshot call to cache-only mode during navigation:
    - `allowRefresh: false`
    - `triggerBackgroundRefresh: false`
  - hardened `/api/meta/release` non-null fallback behavior + diagnostics.
  - switched release metadata writes to atomic script in CI/deploy:
    - `scripts/write_release_metadata.sh`
    - `.gitlab-ci.yml` updated to call script.
  - added production watchdog script:
    - `scripts/production_smoke_check.sh`.


## Emergency Auth Runtime Recovery Deployment Log

- Sprint/lane: `Emergency Auth Runtime Recovery` (`emergency-auth-runtime-recovery-no-feature-work`) - deployed; manual signed-in browser verification still required before operational closure.
- Date: `2026-05-30 (UTC)`.
- Incident/root cause findings:
  - `/brains` still imported a client `BrainsTable` that hydrated `/api/brains/*/stats` after render, violating the launcher-only route contract and adding protected API/client hydration risk to the post-auth path.
  - `/ecomviper` had top-level imports for DB-backed Shopify status/import/OpenAI modules and supplier ingestion diagnostics; production logs showed Turbopack runtime failures around missing external package alias `pg-587764f78a6c7a9c`, which could crash signed-in server render paths instead of rendering a safe fallback.
  - production logs also showed stale/partial Turbopack client manifest boundary errors; deploy builds were not explicitly cleaning `.next` before rebuild.
  - signed-out redirects were preserving absolute `redirect_url` values; recovery changed them to relative app paths such as `/brains` and `/ecomviper` to reduce host/loop drift.
- Fixes shipped:
  - made `/brains` a server-rendered static iBrains Dashboard launcher with no client hooks, stats fetch, storage access, supplier imports, EcomViper dashboard imports, or product editor imports.
  - added `/brains` route error boundary.
  - changed protected-route sign-in redirects to relative `redirect_url` values.
  - guarded `/ecomviper` Shopify/OpenAI/product imports and calls with soft timeouts and safe fallback warnings.
  - changed `/ecomviper` supplier diagnostics to cache-only during navigation (`allowRefresh: false`, `triggerBackgroundRefresh: false`).
  - added clean `.next` rebuild in GitLab build/deploy jobs.
  - strengthened `/api/meta/release` with `deployed_at` and git commit timestamp fallback, plus smoke checks for non-null `git_sha`/`build_id`.
  - updated auth, deployment, production hardening, launcher design, and supplier/performance docs.
- Files changed in MR:
  - `.gitlab-ci.yml`
  - `app/(shell)/brains/_components/BrainsTable.tsx`
  - `app/(shell)/brains/error.tsx`
  - `app/api/meta/release/route.ts`
  - `app/ecomviper/page.tsx`
  - `proxy.ts`
  - `scripts/prod_smoke.sh`
  - `scripts/production_smoke_check.sh`
  - docs/planning/tests listed in MR `!255`.
- Validation summary:
  - focused emergency suites: passed (`38` tests across brains/proxy/ecomviper/formatters/release/smoke/deploy contracts).
  - `npm run build`: passed.
  - `git diff --check`: passed.
  - `npm test`: run; failed in unrelated baseline suites outside emergency scope (`ecomviper_walmart_products_persistence`, `studio_casahud_media_planning_engine`, `casahud_ai_channel_engine`, `studio_casahud_youtube_package_engine`, `siteforge_command_center_shell`, `walmart/compliance`, `homepage_layout_contract`, `frontdoor_env_copy_contract`).
- MR: `!255` (`https://gitlab.com/cloudalien-technologies/ibrains-app/-/merge_requests/255`).
- MR pipeline: `2564194408` (status: `success`, `https://gitlab.com/cloudalien-technologies/ibrains-app/-/pipelines/2564194408`).
- Merge commit SHA: `f8c5a4d82a15f2b029ef23386b2a69d85d2dff2a`.
- Main/deploy pipeline: `2564196790` (status: `success`, includes `deploy_production`, `https://gitlab.com/cloudalien-technologies/ibrains-app/-/pipelines/2564196790`).
- Deployed SHA/build verification (`2026-05-30 18:31 UTC`):
  - `/api/meta/release` returned `git_sha=f8c5a4d82a15f2b029ef23386b2a69d85d2dff2a`, `build_id=2564196790`, `deployed_at=2026-05-30T18:29:22Z`, `release_metadata_complete=true`.
- Production route timings after deploy (`2026-05-30 18:31 UTC`):
  - `/` -> `200`, `0.089s`.
  - `/sign-in` -> `200`, `0.076s`.
  - `/api/health` -> `200`, `0.067s`.
  - `/api/meta/release` -> `200`, `0.071s`.
  - `/brains` -> `307` to `/sign-in?redirect_url=%2Fbrains`, `0.070s` signed-out.
  - `/ecomviper` -> `307` to `/sign-in?redirect_url=%2Fecomviper`, `0.068s` signed-out.
  - `/ecomviper/settings` -> `307`, `0.074s` signed-out.
  - `/ecomviper/dropshipping/rocktomic` -> `307`, `0.080s` signed-out.
- Production smoke/log/socket inspection after deploy:
  - `scripts/production_smoke_check.sh app.ibrains.ai` passed.
  - service active.
  - `CLOSE-WAIT=0`; socket states after route checks: `1 LISTEN`, `18 TIME-WAIT`, no CLOSE-WAIT growth.
  - app log after the post-deploy `next start` contained no new error matches.
  - journal since deploy showed clean stop/start.
  - nginx generic error log had no entries after deploy.
- Branch deletion status:
  - remote source branch: deleted by GitLab merge.
  - local source branch: deleted via `git branch -d emergency-auth-runtime-recovery-no-feature-work`.
- Final local branch/status before state-update branch:
  - `git switch main`
  - `git pull --ff-only`
  - `git status`: `## main...origin/main` clean.
- Browser verification status:
  - Desktop signed-in path `/sign-in -> /brains -> /ecomviper -> /brains`: pending manual verification; no production signed-in browser session is provisioned in this execution environment.
  - Mobile signed-in path: pending manual verification; no mobile Safari/Chrome access is available in this execution environment.
  - This emergency lane must not be considered operationally closed until those manual checks are recorded.
- Recommended next action:
  - complete and record signed-in desktop/mobile browser verification, then resume Shopify Sprint 011 planning/hardening.

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

## Admin Foundation Closure Update: Internal iBrains Admin + EcomViper Supplier Intelligence Console

- Sprint/lane: `admin-foundation-ecomviper-supplier-intelligence`
- MR:
  - `!267`: `https://gitlab.com/cloudalien-technologies/ibrains-app/-/merge_requests/267`
  - source branch commit SHA: `5a8bb2ee05669d35be1985406f3d8148410e3e72`
  - merge commit SHA: `085d550561917f4be32f1e99c35f141ed1a436e8`
  - MR pipeline `2564720323`: success
  - main/deploy pipeline `2564722663`: success
  - deploy job `14618100340`: success
- Branch cleanup:
  - remote source branch deletion: confirmed (branch ref absent on `origin`)
  - local source branch deletion: completed
  - local repository reset: `main` fast-forwarded and clean
- Production release verification:
  - `/api/meta/release`:
    - `git_sha=085d550561917f4be32f1e99c35f141ed1a436e8`
    - `build_id=2564722663`
    - `deployed_at=2026-05-31T03:40:48Z`
    - `release_metadata_complete=true`
  - route timings:
    - `/api/health`: `200` in `0.063806s`
    - `/api/meta/release`: `200` in `0.055915s`
    - `/brains`: `307` in `0.050549s`
    - `/ecomviper`: `307` in `0.051947s`
    - `/admin`: `307` in `0.068412s`
    - `/admin/ecomviper/suppliers/rocktomic/audit`: `307` in `0.065573s`
  - smoke script: `RUN_DETAILED_SMOKE=1 scripts/production_smoke_check.sh app.ibrains.ai` passed
  - socket health: `CLOSE-WAIT` count `0`; `:3001` socket states stable (`LISTEN` + expected `TIME-WAIT`)
  - nginx error tails: no new entries in `/var/log/nginx/app.ibrains.ai.error.log` and `/var/log/nginx/error.log`
- Signed-out verification:
  - `/admin` redirects to `/sign-in?redirect_url=%2Fadmin`
  - `/brains` redirects to `/sign-in?redirect_url=%2Fbrains`
  - `/ecomviper` redirects to `/sign-in?redirect_url=%2Fecomviper`
- Signed-in verification status:
  - allowlisted admin route verification (`/admin` and all `/admin/ecomviper/...` pages): blocked in this CLI run (no authenticated browser session)
  - signed-in non-admin denial verification: blocked in this CLI run (no authenticated browser session)
- Known log note:
  - historical app log tail still contains prior `Failed to proxy https://localhost:3001/... EPROTO` entries from earlier runs; no new nginx error-log growth observed in this closure run.
- Recommended next sprint:
  - run manual signed-in browser verification for allowlisted admin and non-admin denial paths, then continue stabilization backlog.

## Admin Foundation Closure Docs-Only Update

- Follow-up MR for closure metadata:
  - `!268`: `https://gitlab.com/cloudalien-technologies/ibrains-app/-/merge_requests/268`
  - merge commit SHA: `257fdba26b25c0cd4affc60d1d2a2beeb56f5c97`
  - MR pipeline `2564729470`: success
  - main/deploy pipeline `2564731421`: success
  - deploy job `14618133332`: success
- Final production release after docs-only deploy:
  - `/api/meta/release`:
    - `git_sha=257fdba26b25c0cd4affc60d1d2a2beeb56f5c97`
    - `build_id=2564731421`
    - `deployed_at=2026-05-31T03:52:41Z`
    - `release_metadata_complete=true`
- Final local repository closure state:
  - current branch: `main`
  - local status: clean

## Sprint Checkpoint: EcomViper Product Editor Final Layout + Gallery Add Images (Local Branch)

- Date: `2026-05-31`
- Branch: `ecomviper-product-editor-final-layout-gallery-add-images`
- Status: `implementation + focused tests complete locally; MR/pipeline/deploy pending`
- Scope completed locally:
  - Product Editor layout refactor to hero-first workspace (`Gallery` left, `Product Summary` right) with no oversized standalone header card.
  - Product title moved into Product Summary.
  - Shipping moved into Product Summary.
  - Standalone Shipping card removed.
  - Workspace Metadata removed from merchant Product Editor UI.
  - Full-width edit area below hero with action row order:
    - `Generate Intelligence`
    - `Save Changes`
    - `Publish` (placeholder-disabled semantics for public `ecomviper.com` publish backend).
  - Preview PDP removed from primary edit action row.
  - Product Gallery add-image workflow added:
    - upload from computer (`jpeg/png/webp`, size validation)
    - add from `https` URL
    - disabled Image Studio future hook entry.
- Focused local test evidence:
  - `tests/ecomviper_product_editor_layout.test.tsx`
  - `tests/ecomviper_product_image_gallery.test.tsx`
  - `tests/ecomviper_product_editor_route_contract.test.ts`
  - `tests/ecomviper_product_editor_sync_required_message.test.tsx`
  - `tests/ecomviper_product_image_ordering.test.ts`
  - `tests/ecomviper_route_render_sync_safety.test.ts`
  - `tests/ibrains_global_shell_contract.test.tsx`
  - `tests/ecomviper_dashboard_auth_guard.test.tsx`
  - `tests/proxy_apps_auth_protection.test.ts`
  - `tests/admin_layout_auth_contract.test.tsx`
  - `tests/admin_ecomviper_routes_contract.test.tsx`
- Pending closure work:
  - run `npm run build`, `git diff --check`, and full `npm test`
  - commit/push branch
  - open MR and verify green pipeline
  - merge + branch cleanup
  - production deploy verification and smoke/log checks

## Sprint Closure Update: EcomViper Product Editor Final Layout + Gallery Add Images

- Sprint/branch: `ecomviper-product-editor-final-layout-gallery-add-images`
- MR: `!274` (`https://gitlab.com/cloudalien-technologies/ibrains-app/-/merge_requests/274`)
- Source commit SHA: `915948ff3275f8537640a69fe622e63d83d29a88`
- Merge commit SHA: `47977abbee81d084b5833afcd3211ffd04f7864f`
- Pipeline/checks:
  - MR pipeline `2565279880` passed
  - branch pipeline `2565279687` passed
  - main deploy pipeline `2565287223` passed
- Branch deletion status:
  - remote source branch deleted on merge: yes
  - local source branch deleted: yes
- Final local repository state:
  - branch: `main`
  - status: clean
- Production release verification (`/api/meta/release`):
  - `git_sha=47977abbee81d084b5833afcd3211ffd04f7864f`
  - `build_id=2565287223`
  - `deployed_at=2026-05-31T13:14:38Z`
  - `release_metadata_complete=true`
- Production smoke summary:
  - `RUN_DETAILED_SMOKE=1 scripts/production_smoke_check.sh app.ibrains.ai` passed
  - `/api/health` and `/api/meta/release` returned `200`
  - protected routes returned expected `307` redirects while signed out
  - close-wait socket count: `0`
  - nginx/app/journal tails inspected (no new blocking deployment errors)
- Signed-in verification status:
  - signed-in desktop/mobile visual verification for Product Editor hero/gallery interactions remains blocked in this CLI run (no authenticated browser session).
- Recommended next sprint:
  - complete authenticated desktop/mobile verification evidence capture for Product Editor hero/gallery/add-image interactions and publish-placeholder UX, then continue publish backend wiring.

## Sprint Checkpoint: Phase 4.2 Rocktomic Offline Builder Reliability (Local Branch)

- Branch: `sprint-022-rocktomic-builder-reliability`
- Date: `2026-05-31 (UTC)`
- Local checkpoint status: implementation + focused tests/checks in progress; MR/deploy pending.

Scope implemented locally:

- added offline builder reliability runtime module:
  - `lib/ecomviper/suppliers/rocktomic-build-runtime.ts`
- upgraded builder command:
  - `scripts/ecomviper/build_rocktomic_supplier_data.ts`
  - stage timing + machine-readable timing report
  - stage/total/network timeout budgeting
  - atomic build-dir to latest promotion
  - incremental AI extraction reuse/caching controls
  - bounded remote concurrency + explicit mode flags
- tightened template asset extraction runtime controls:
  - `lib/ecomviper/suppliers/rocktomic-template-assets.ts`
- tightened AI label metadata/extraction freshness handling:
  - `lib/ecomviper/suppliers/rocktomic-ai-label-text.ts`

Artifact additions:

- `data/ecomviper/suppliers/rocktomic/latest/build-timing-report.json` (success path)
- `data/ecomviper/suppliers/rocktomic/latest/build-cache-summary.json`
- failure timing diagnostics written under:
  - `data/ecomviper/suppliers/rocktomic/builds/<buildId>/build-timing-report.json`

Focused tests added/updated:

- `tests/ecomviper_rocktomic_builder_reliability.test.ts`
- `tests/ecomviper_rocktomic_ai_label_text.test.ts`
- `tests/ecomviper_rocktomic_template_assets.test.ts`

Phase boundary confirmation:

- no Product Editor behavior changes
- no Generate Intelligence behavior changes
- no runtime route extraction/fetching
- no admin-triggered build/import UI
- no DB migration/import changes in this sprint
- no permanent `.ai`/`.tif` binary storage

Recommended next phase after Phase 4.2 closure:

- Phase 5 — Product Editor read-only shared ecommerce DB supplier-facts binding.

## Sprint Closure Update: Phase 4.2 Rocktomic Offline Builder Reliability

- Sprint/branch: `sprint-022-rocktomic-builder-reliability`
- MR:
  - `!288`: `https://gitlab.com/cloudalien-technologies/ibrains-app/-/merge_requests/288`
  - source branch commit SHA: `2e0928e3d2366736854d519aeefda741a1f72c9b`
  - merge commit SHA: `938a6ec98b066ec6c6b56058d9b4bc0cb3863d76`
  - pipeline `2565721360`: success
- Branch cleanup:
  - remote source branch deletion: completed via merge (`--remove-source-branch`)
  - local source branch deletion: completed
  - local repository reset target after this closure MR: clean `main`

Phase 4.2 runtime proof:

- First build run: `time npm run ecomviper:build-rocktomic-supplier-data`
  - duration: `6.756s`
  - status: success
- Second build run (incremental):
  - duration: `5.472s`
  - status: success
- Timing artifact: `data/ecomviper/suppliers/rocktomic/latest/build-timing-report.json`
  - status: `success`
  - totalDurationMs (second run): `3926`
  - slowest stage: `ai_label_text_extraction` (`1737ms`)
  - timeouts: `0`
  - errors: `0`
- Cache summary artifact: `data/ecomviper/suppliers/rocktomic/latest/build-cache-summary.json`
  - AI attempted: `147`
  - skipped because unchanged: `147`
  - refreshed because changed: `0`
  - refreshed because missing evidence: `0`

Validation/package summary after Phase 4.2 build:

- supplier: `rocktomic`
- validation policy: `rocktomic_phase3_6_v1`
- package status: `fail`
- SKUs discovered/validated: `164 / 164`
- usable: `60`
- usable_with_warnings: `5`
- blocked: `99`
- extraction_error: `0`
- supplement facts coverage total: `136/141`

Checks executed:

- focused tests: passed
  - `tests/ecomviper_rocktomic_builder_reliability.test.ts`
  - `tests/ecomviper_rocktomic_ai_label_text.test.ts`
  - `tests/ecomviper_rocktomic_template_assets.test.ts`
  - `tests/ecomviper_rocktomic_offline_runtime_boundary.test.ts`
- `npm run ecomviper:build-rocktomic-supplier-data`: passed (twice)
- `npm run build`: passed
- `git diff --check`: passed
- `npm test`: failed due unrelated baseline suites (not introduced by Phase 4.2):
  - `tests/casahud_ai_channel_engine.test.ts`
  - `tests/ecomviper_walmart_products_persistence.test.ts`
  - `tests/frontdoor_env_copy_contract.test.ts`
  - `tests/homepage_layout_contract.test.ts`
  - `tests/siteforge_command_center_shell.test.tsx`
  - `tests/studio_casahud_media_planning_engine.test.ts`
  - `tests/studio_casahud_youtube_package_engine.test.ts`
  - `tests/walmart/compliance.test.ts`

Architecture boundary confirmation:

- no Product Editor behavior changes
- no Generate Intelligence behavior changes
- no runtime source fetching/extraction/OCR added
- no background workers/sync buttons
- no `DATABASE_URL` replacement
- no `ecomviper-prod-postgres` usage
- no permanent `.ai`/`.tif` binary storage

Recommended next phase:

- Phase 5 — Product Editor read-only shared ecommerce DB supplier-facts binding.

## Sprint Checkpoint: Phase 4.3 Rocktomic Validation Policy Calibration (Local Branch)

- Branch: `sprint-023-rocktomic-validation-calibration`
- Date: `2026-05-31 (UTC)`
- Local checkpoint status: implementation + package rebuild + live import/verify complete; MR/pipeline/merge pending.
- Scope completed:
  - recalibrated validation policy with readiness dimensions and defect families:
    - `lib/ecomviper/suppliers/rocktomic-validation-policy.ts`
  - updated offline outputs:
    - `validation-report.json`
    - `audit.csv`
    - added `validation-policy-calibration-report.json`
  - updated read-only admin audit summaries:
    - `lib/ecomviper/suppliers/rocktomic-admin-audit.ts`
    - `app/admin/ecomviper/suppliers/rocktomic/audit/page.tsx`
  - updated DB verify script for readiness checks:
    - `scripts/ecommerce/verify_rocktomic_supplier_import.ts`
- Phase 4.3 rebuilt package summary:
  - policy version: `rocktomic_phase4_3_v1`
  - SKUs validated: `164`
  - global: `usable=8`, `usable_with_warnings=59`, `blocked=97`, `extraction_error=0`
  - ingredient matching readiness: `ready=63`, `ready_with_warnings=66`, `blocked=35`
  - product editor facts readiness: `ready=63`, `ready_with_warnings=7`, `blocked=94`
  - compliance evidence readiness: `ready=121`, `ready_with_warnings=24`, `blocked=19`
  - missing COA warning count: `40`
  - missing COA no-longer-global-block count: `2`
  - global blocked before/after: `99 -> 97`
- Live shared ecommerce DB import verification (using `ECOMMERCE_DATABASE_URL`):
  - target: `ibrains-ecommerce-prod-postgres`
  - note: local runtime required `&uselibpqcompat=true` appended at execution time for TLS compatibility
  - import command succeeded and was re-run idempotently
  - verify command succeeded after each import
  - stable DB counts after re-import:
    - products/facts/pricing/inventory/assets/validation rows all `164`
    - statuses: `usable=8`, `usable_with_warnings=59`, `blocked=97`, `extraction_error=0`
- Boundaries preserved:
  - no Product Editor runtime binding
  - no Generate Intelligence runtime binding
  - no admin write/sync/import UI
  - no runtime route extraction/fetch side effects
  - no `DATABASE_URL` fallback in ecommerce import/verify scripts

## Sprint Checkpoint: Phase 5 Product Editor Read-Only Supplier Facts Binding (Local Branch)

- Branch: `sprint-024-product-editor-supplier-facts-binding`
- Date: `2026-05-31 (UTC)`
- Local checkpoint status: implementation + focused tests/checks in progress; MR/deploy verification pending.
- Scope implemented locally:
  - Added server-only shared ecommerce DB read model:
    - `lib/ecommerce/supplier-facts-read.ts`
    - `lib/ecommerce/supplier-product-match.ts`
    - shared view-model types: `lib/ecommerce/supplier-facts-types.ts`
  - Integrated read-only supplier facts loading into Product Editor state:
    - `lib/ecomviper/shopify/shopify-product-editor-state.ts`
  - Added read-only `Supplier Source Facts` panel in Shopify Product Editor route:
    - `app/ecomviper/shopify/products/[productId-or-handle]/shopify-product-editor-client.tsx`
  - Added focused tests for:
    - deterministic supplier matching
    - shared ecommerce DB read model + env safety (`ECOMMERCE_DATABASE_URL` only)
    - Product Editor supplier facts panel rendering states
    - runtime route boundary guardrails
- Phase 5 readiness semantics implemented:
  - Product Editor matching gate uses `ingredientMatchingReadiness` (not global status alone)
  - Product Editor facts display quality uses `productEditorFactsReadiness`
  - missing COA surfaced as compliance warning, not ingredient blocker
  - missing pricing surfaced as pricing warning, not ingredient blocker
- Boundary confirmation:
  - no Generate Intelligence binding changes
  - no supplier write/import/sync/extract behavior from Product Editor
  - no route render OCR/AI-label extraction
  - no fallback to `DATABASE_URL` for supplier facts reads
  - no use of `ecomviper-prod-postgres`
- Recommended next phase:
  - Phase 6 — Generate Intelligence supplier facts binding from shared ecommerce DB.

## Sprint Closure Update: Phase 5 Product Editor Read-Only Supplier Facts Binding

- Sprint/branch:
  - implementation branch: `sprint-024-product-editor-supplier-facts-binding`
  - closure metadata branch: `sprint-024-1-phase5-closure-metadata`
- Phase 5 MR:
  - `!291`: `https://gitlab.com/cloudalien-technologies/ibrains-app/-/merge_requests/291`
  - source commit SHA: `048c4969870c4d8ef82b759c73d680a2b1daf119`
  - merge commit SHA: `7f40e11984d54842527ca76f816dd7e7d057bc8b`
- Pipeline status:
  - MR pipeline `2565781198`: success
  - branch pipeline `2565780245`: success
  - main/deploy pipeline `2565788605`: success
- Production release verification:
  - `/api/meta/release` reports:
    - `git_sha=7f40e11984d54842527ca76f816dd7e7d057bc8b`
    - `build_id=2565788605`
    - `deployed_at=2026-05-31T22:32:26Z`
    - `release_metadata_complete=true`
  - `/api/health`: `200`
  - smoke script: `RUN_DETAILED_SMOKE=1 scripts/production_smoke_check.sh app.ibrains.ai` passed
  - close-wait socket check: passed (`0`)
- Focused Phase 5 verification:
  - passed:
    - `tests/ecommerce_supplier_product_match.test.ts`
    - `tests/ecommerce_supplier_facts_read.test.ts`
    - `tests/ecomviper_shopify_supplier_facts_panel.test.tsx`
    - `tests/ecomviper_shopify_product_editor_workflow.test.tsx`
    - `tests/ecomviper_route_render_sync_safety.test.ts`
  - `npm run build`: passed
  - `git diff --check`: passed
- Full test run (`npm test`):
  - failed on known unrelated baseline suites only; Phase 5 focused suites remained green.
  - unrelated failures observed:
    1. `tests/casahud_ai_channel_engine.test.ts`
    2. `tests/ecomviper_walmart_products_persistence.test.ts`
    3. `tests/frontdoor_env_copy_contract.test.ts`
    4. `tests/homepage_layout_contract.test.ts`
    5. `tests/siteforge_command_center_shell.test.tsx`
    6. `tests/studio_casahud_media_planning_engine.test.ts`
    7. `tests/studio_casahud_youtube_package_engine.test.ts`
    8. `tests/walmart/compliance.test.ts`
- Shared ecommerce DB verification (correct env):
  - executed with production `ECOMMERCE_DATABASE_URL` and compatibility suffix `&uselibpqcompat=true`
  - `npm run ecommerce:check-db`: pass
  - `npm run ecommerce:verify-rocktomic-import`: pass
  - verify summary:
    - expected/actual SKUs: `164`
    - statuses: usable `8`, usable_with_warnings `59`, blocked `97`, extraction_error `0`
    - table counts: facts/pricing/inventory/assets/validation all `164`
    - readiness query present: ingredient matching ready `129` blocked `35`; product editor facts ready `70` blocked `94`
- Signed-out route checks:
  - `/admin`: `307` to `/sign-in?redirect_url=%2Fadmin`
  - `/admin/ecomviper`: `307` to `/sign-in?redirect_url=%2Fadmin%2Fecomviper`
  - `/admin/ecomviper/suppliers/rocktomic/audit`: `307` to `/sign-in?redirect_url=%2Fadmin%2Fecomviper%2Fsuppliers%2Frocktomic%2Faudit`
  - `/apps/ecomviper/shopify`: `404` (route not present under current conventions)
  - `/ecomviper/shopify/products/roc011`: `307` to `/sign-in?redirect_url=%2Fecomviper%2Fshopify%2Fproducts%2Froc011`
- Signed-in Product Editor verification status:
  - not executed in this CLI closure run due no authenticated browser session in runner.
- Scope/boundary confirmation:
  - Supplier Source Facts panel remains read-only.
  - Missing COA is compliance warning only; not an ingredient-matching blocker.
  - Missing pricing is pricing warning/unavailable only; not an ingredient-matching blocker.
  - No Generate Intelligence binding changes in Phase 5.
  - No supplier import/sync/extraction/OCR/AI-label runtime behavior added to Product Editor.
  - No `DATABASE_URL` fallback for supplier facts reads; ecommerce reads use `ECOMMERCE_DATABASE_URL`.
- Risks/follow-ups:
  - signed-in Product Editor scenario verification (exact match/no match/missing COA/missing pricing/ingredient blocked) should be completed with authenticated session and captured in next ops pass.
  - baseline unrelated test failures remain outside Phase 5 scope.

## Sprint Checkpoint: Phase 5.1 Duplicate Shopify Product Route Removal (Local Branch)

- Branch: `sprint-5-1-remove-duplicate-shopify-product-route`
- Date: `2026-06-01 (UTC)`
- Local checkpoint status: implementation + focused tests/checks in progress; MR/deploy verification pending.
- Scope implemented locally:
  - removed mistaken duplicate merchant route family:
    - deleted `app/ecomviper/shopify/products/[productId-or-handle]/page.tsx`
    - deleted `app/ecomviper/shopify/products/[productId-or-handle]/shopify-product-editor-client.tsx`
  - updated Shopify products table navigation to canonical route:
    - `app/ecomviper/shopify/shopify-workspace-client.tsx`
    - product links now route to `/ecomviper/products/[productId-or-handle]`
  - removed duplicate-route-only tests and updated route contract coverage:
    - deleted `tests/ecomviper_shopify_product_editor_workflow.test.tsx`
    - deleted `tests/ecomviper_shopify_supplier_facts_panel.test.tsx`
    - updated `tests/ecomviper_shopify_products_table_navigation.test.tsx`
    - updated `tests/ecomviper_product_editor_route_contract.test.ts`
    - updated `tests/ecomviper_route_render_sync_safety.test.ts`
- Architecture/boundary confirmation:
  - canonical Product Editor route remains `/ecomviper/products/[productId-or-handle]` for all products/SKUs.
  - no route-level SKU hardcoding or ROC948 special-casing introduced.
  - supplier-facts backend read/match modules remain preserved and route-agnostic:
    - `lib/ecommerce/supplier-facts-read.ts`
    - `lib/ecommerce/supplier-facts-types.ts`
    - `lib/ecommerce/supplier-product-match.ts`
  - no Generate Intelligence binding changes.
  - no Product Editor layout redesign/polish changes.
  - no supplier write/import/sync/extraction/OCR/AI-label behavior added.

## Sprint Closure Update: Phase 5.1 Duplicate Shopify Product Route Removal

- Sprint/branch: `sprint-5-1-remove-duplicate-shopify-product-route`
- MR:
  - `!293`: `https://gitlab.com/cloudalien-technologies/ibrains-app/-/merge_requests/293`
  - source commit SHA: `f0d9fcdd8790f145b371f2f87e003566728c009c`
  - merge commit SHA: `ab244f876dccc5b25b695b29fe867180bf7506dd`
- Pipeline status:
  - MR pipeline `2565898454`: success
  - branch pipeline `2565896356`: success
  - main/deploy pipeline `2565901191`: success
- Deployed release verification:
  - `/api/meta/release`:
    - `git_sha=ab244f876dccc5b25b695b29fe867180bf7506dd`
    - `build_id=2565901191`
    - `deployed_at=2026-06-01T00:45:05Z`
    - `release_metadata_complete=true`
  - `/api/health`: `200` with `ok=true`
- Signed-out checks:
  - `/admin`: `307` -> `/sign-in?redirect_url=%2Fadmin`
  - `/admin/ecomviper`: `307` -> `/sign-in?redirect_url=%2Fadmin%2Fecomviper`
  - `/admin/ecomviper/suppliers/rocktomic/audit`: `307` -> `/sign-in?redirect_url=%2Fadmin%2Fecomviper%2Fsuppliers%2Frocktomic%2Faudit`
  - `/ecomviper/products/opa-nitric-oxide-gummies-l-arginine-citrulline`: `307` -> `/sign-in?redirect_url=%2Fecomviper%2Fproducts%2Fopa-nitric-oxide-gummies-l-arginine-citrulline`
  - `/ecomviper/shopify/products/opa-nitric-oxide-gummies-l-arginine-citrulline`: `307` -> `/sign-in?redirect_url=%2Fecomviper%2Fshopify%2Fproducts%2Fopa-nitric-oxide-gummies-l-arginine-citrulline`
- Runtime/QA notes:
  - signed-in QA for canonical product pages was not executed in this CLI runner (no authenticated browser session).
  - duplicate merchant-facing route implementation files are removed from repository.
- Focused checks:
  - passed:
    - `tests/ecomviper_shopify_products_table_navigation.test.tsx`
    - `tests/ecomviper_product_editor_route_contract.test.ts`
    - `tests/ecomviper_route_render_sync_safety.test.ts`
    - `tests/ecomviper_product_editor_layout.test.tsx`
    - `tests/ecomviper_product_editor_source_mapping.test.tsx`
    - `tests/ecommerce_supplier_facts_read.test.ts`
    - `tests/ecommerce_supplier_product_match.test.ts`
  - `npm run build`: pass
  - `git diff --check`: pass
  - `npm run ecommerce:check-db`: fail in runner (missing `ECOMMERCE_DATABASE_URL`)
  - `npm run ecommerce:verify-rocktomic-import`: fail in runner (missing `ECOMMERCE_DATABASE_URL`)
  - `npm test`: fail on unrelated baseline suites; no new Phase 5.1 failures in focused coverage.
- Unrelated baseline `npm test` failures observed:
  1. `tests/casahud_ai_channel_engine.test.ts`
  2. `tests/ecomviper_walmart_products_persistence.test.ts`
  3. `tests/frontdoor_env_copy_contract.test.ts`
  4. `tests/homepage_layout_contract.test.ts`
  5. `tests/siteforge_command_center_shell.test.tsx`
  6. `tests/studio_casahud_media_planning_engine.test.ts`
  7. `tests/studio_casahud_youtube_package_engine.test.ts`
  8. `tests/walmart/compliance.test.ts`
- Branch cleanup:
  - remote source branch deletion: complete (merge removed source branch)
  - local source branch deletion: complete (`git branch -d sprint-5-1-remove-duplicate-shopify-product-route`)
- Final local state after merge cleanup:
  - checked out `main`
  - fast-forwarded to merge commit `ab244f876dccc5b25b695b29fe867180bf7506dd`
  - clean working tree confirmed
- Recommended next sprint:
  - complete authenticated signed-in QA pass for canonical Product Editor routes (at least two products) and then resume Shopify Sprint 011 stabilization planning.

## Sprint Checkpoint: Phase 6.2.2-B Supplement Facts Input Mapping Hotfix (Local Branch)

- Branch: `sprint-6-2-2-copywriting-input-facts-mapping`
- Date: `2026-06-01 (UTC)`
- Local checkpoint status: implementation + focused regression coverage complete; MR/deploy verification pending.
- Scope completed locally:
  - normalized all-product source mapping in `lib/ecomviper/copywriting-agent/copywriting-agent-data.ts`:
    - nested `sourceFacts.supplementFacts.*` shape mapping
    - top-level assets URL mapping (`coaUrl`, `labelTemplateUrl`, `labelTemplateAiUrl`, `mockupUrl`)
    - AI label-text evidence ingestion for source-evidence/missing-data decisions
  - refined input missing-data semantics in:
    - `lib/ecomviper/copywriting-agent/copywriting-agent-types.ts`
    - `lib/ecomviper/copywriting-agent/copywriting-agent-input-builder.ts`
  - updated plain notice mapping in:
    - `lib/ecomviper/copywriting-agent/copywriting-agent-runner.ts`
  - added/updated focused tests:
    - `tests/ecomviper_copywriting_agent_missing_data_mapping.test.ts`
    - `tests/ecomviper_copywriting_agent_input_builder.test.ts`
    - `tests/ecomviper_copywriting_agent_runner.test.ts`
    - `tests/ecomviper_generate_intelligence_copywriting_action.test.ts`
  - updated planning docs:
    - `planning/apps/ecomviper/shopify/supplement-facts-input-mapping-hotfix.md`
    - `planning/apps/ecomviper/shopify/supplement-facts-missing-data-audit.md`
    - `planning/apps/ecomviper/shopify/ai-copywriting-agent-contract.md`
    - `planning/apps/ecomviper/shopify/generate-intelligence-copywriting-agent-binding.md`
    - `planning/apps/ecomviper/shopify/generate-intelligence-eval-harness.md`
    - `planning/apps/ecomviper/overview.md`
- Root cause confirmation:
  - Phase 6.2.2-A audit showed pervasive false `supplementFactsMissing` due primarily to `read_model_to_copywriting_input_gap`.
  - fixed without SKU/handle hardcoding.
- Dry-run prep delta (`npm run ecomviper:copywriting-agent:prepare -- --all --dry-run`):
  - before: `supplementFactsMissing=164`, `coaMissing=164`, `pricingMissing=164`
  - after: `supplementFactsMissing=16`, `coaMissing=40`, `pricingMissing=22`
- ROC123 expected/verified mapping behavior after hotfix:
  - no blanket `Supplement Facts missing.` when structured active ingredients/amounts exist
  - serving-size/servings notices are emitted only when those fields are missing
- Guardrails preserved:
  - Generate Intelligence remains review-only.
  - no auto-save/publish.
  - no Product Editor layout changes.
  - no supplier import/OCR/.ai extraction/source fetch.
  - no DB migrations/writes required by this hotfix.
  - no duplicate `/ecomviper/shopify/products/[productId-or-handle]` route restoration.

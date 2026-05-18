# DirectoryIQ Product Intent

Last updated: 2026-05-18 (UTC)

This document reflects observed implementation in this repository. It does not define net-new requirements.

## Product Definition

DirectoryIQ is an operator workspace for improving listing-level AI visibility and authority signals for directory-backed websites (primarily Brilliant Directories), with guarded write paths.

From code and UI, it is designed to:

- connect external signal sources (BD, OpenAI, SerpAPI, GA4),
- ingest listing/blog data into DirectoryIQ-owned tables,
- score listing readiness across five pillars,
- run authority graph and leak diagnostics,
- guide operators through a 3-step listing workflow,
- and execute guarded listing/blog publish operations with approval tokens, versioning, and status jobs.

## Current Implementation Summary

Implemented and active:

- App shell and navigation for `Dashboard`, `Listings`, `Authority`, `Graph Integrity`, `Connections`, and `History`.
- Local-first API runtime with optional proxy mode to `directoryiq-api.ibrains.ai`.
- BD site configuration with auto-detection/verification of listings/blog post type IDs.
- Full ingest routes and persistence for listings/blog source rows in `directoryiq_nodes`.
- Dashboard readiness computation and listings table from local selection scoring.
- Listing optimization workspace with mission steps, Step 2 research/draft/image/preview/publish lanes, and Step 3 listing upgrade generate/preview/push lanes.
- Graph and leak workflows (scan, list, status updates) plus integrity metrics and optional dry-run/apply rebuild.

Partially implemented or split across runtimes:

- `settings` and `versions` routes are proxy-only wrappers in this repo.
- Some routes/services use local DB + local services, others depend on external API parity.
- Legacy file-based draft/SERP cache APIs still exist alongside DB-first flows.

## Operator Workflow

Observed main operator path:

1. Open `/apps/directoryiq` dashboard.
2. Go to `/apps/directoryiq/signal-sources` and configure connections.
3. Configure one or more BD sites under the same screen and run site tests.
4. Run ingestion (`/api/ingest/directoryiq/run`) and review recent ingest runs.
5. Use dashboard/listings to select a listing and open `/apps/directoryiq/listings/[listingId]`.
6. In listing optimization:
- Step 1 (`find-support`): review current support links/mentions, gaps, and flywheel recommendations; build mission plan selections.
- Step 2 (`create-support`): run research, generate draft/image per slot, preview, approve, publish each support asset with explicit guards.
- Step 3 (`optimize-listing`): generate listing upgrade draft, preview diff, approve, and push update to BD with approval token.
7. Use authority and graph-integrity surfaces to monitor leaks/orphans/anchor issues and run scans.

## Ingestion Architecture

Primary ingestion path in this repo:

- Site credentials and metadata are stored via `directoryiq_bd_sites` and connector credential stores.
- Full ingest route calls local ingest utility that:
  - fetches BD listings/blog records,
  - applies path/method fallback logic,
  - normalizes records and IDs,
  - upserts into `directoryiq_nodes`,
  - records `directoryiq_ingest_runs`.
- Blog-only ingest route exists for authority workflows and triggers graph rebuild.
- Ingest diagnostics include explicit classification for common BD config failures.

Secondary ingestion path (brain-learning contract) also exists:

- Multi-source ingest contracts for YouTube/web/document flows in `lib/directoryiq/ingestion/*` and migrations for brain learning tables.
- Covered by DirectoryIQ tests, but not the primary operator flow in current DirectoryIQ UI.

## Authority / Readiness Workflow

Readiness model:

- Readiness and pillar scoring (`structure`, `clarity`, `trust`, `authority`, `actionability`) are derived from listing + authority post signals.
- Dashboard and listings surfaces show these scores/statuses.

Authority workflow model:

- Step taxonomy is explicit in `missionControlContract`:
  - Step 1: support discovery/selection,
  - Step 2: support creation/publish,
  - Step 3: listing optimization using valid support.
- Step 3 unlock contract requires five valid support items.
- Step 2 research can resolve to `ready_grounded` or `ready_thin` fallback; failure states are explicit and retryable under constraints.
- Step 2 publish route enforces:
  - manual approval,
  - approved snapshot version match,
  - token validation,
  - reciprocal linking/identity checks before external publish.

## Trust, Citation, and Consistency Signals

Implemented trust/authority quality signals include:

- mention-without-link detection,
- weak-anchor detection,
- orphan listing detection,
- backlink compliance tracking,
- anchor diversity ledger and scoring,
- hub/member coverage metrics.

Graph integrity endpoints provide:

- tenant summary,
- listing-level and blog-level metrics,
- leak listing/filtering/status updates,
- scan runs with scope controls (`all`, `changed`, `single_blog`).

Feature flag/tenant gating is enforced for graph integrity routes.

## Directory Synchronization Lifecycle

Observed lifecycle:

1. Configure BD site and connector secrets.
2. Verify post type IDs/paths via site test.
3. Run ingest and persist listing/blog snapshots.
4. Recompute dashboard readiness from ingested data.
5. Use authority workflows to derive/support publish actions.
6. Run graph/leak scans to detect authority drift.
7. Recompute integrity deltas after write operations when integrity gate is enabled.

Runtime model:

- Local-first serving is default.
- Proxy mode can delegate to external DirectoryIQ API based on runtime env.

## API and Data Model Surface

Major route groups:

- Dashboard/readiness: `/api/directoryiq/dashboard`, `/api/directoryiq/listings`, `/api/directoryiq/listings/[listingId]`.
- Support/authority derivations: `support`, `gaps`, `actions`, `flywheel-links`, `intent-clusters`, `reinforcement-plan`, `content-structure`, `upgrade/multi-action`.
- Step 2 execution: `authority/research`, `authority/[slot]/draft|image|preview|publish`.
- Step 3 execution: `upgrade/generate|preview|push`, `listing-push`.
- Connections and BD site ops: `signal-sources`, `sites`, `integrations`.
- Graph/integrity: `graph/*`, `graph-integrity/*`, `authority/overview|blogs|listings`, `authority/ingest/blogs`.
- Job status polling: `/api/directoryiq/jobs/[jobId]`.

Primary observed tables:

- `directoryiq_nodes`
- `directoryiq_ingest_runs`
- `directoryiq_settings`
- `directoryiq_bd_sites`
- `directoryiq_signal_source_credentials`
- `directoryiq_authority_posts`
- `directoryiq_listing_upgrades`
- `directoryiq_versions`
- `directoryiq_jobs`
- `directoryiq_audit_events`
- `authority_graph_*` tables
- `directoryiq_authority_leaks`
- `directoryiq_listing_backlinks`
- `directoryiq_anchor_ledger`
- `directoryiq_integrity_metrics`
- `directoryiq_hubs` / `directoryiq_hub_members`

Schema/migration artifacts are present under `db/directoryiq/*.sql`, with additional foundational migrations under `db/migrations`.

## Existing Tests

DirectoryIQ-prefixed tests currently focus on:

- BD connector method/path/id auto-detect contracts.
- Signal-source persistence path (including canonical non-BD credential table behavior).
- Runtime stamp and schema parity checks.
- Step 2 research resilience and fallback contract behavior.
- Step 2 listing optimization fallback UX contract.
- Multi-source ingestion identity/dedupe contracts (including YouTube parity).
- Authority map layout contract.

Coverage emphasis is contract/unit behavior rather than full end-to-end operator journey across all screens/routes.

## Current Gaps

Observed gaps from code structure:

- Mixed runtime ownership: local implementations coexist with proxy-only routes, creating split source-of-truth risk.
- `settings` and `versions` in this repo currently proxy externally rather than using local service/repository paths.
- Persistence strategy is mixed (DB-first in core flows, file-backed stores in legacy draft/SERP paths, in-memory fallbacks in some repositories when DB is absent).
- Tenant scoping is often hardcoded to `default` in graph/integrity services.
- Two authority-support surfaces exist (`authority-support` and `graph-integrity`) with overlapping leak concepts.
- Some advanced listing intelligence routes rely on large client-composed payload chaining rather than a single server-side orchestration endpoint.

Unclear from implementation and pending architecture interview:

- Final intended long-term runtime split (local vs external API) per route family.
- Intended deprecation/retention plan for legacy draft/SERP file stores vs DB-backed flows.
- Final product boundary between legacy authority-support and graph-integrity v2 surfaces.

## Recommended Roadmap

Implementation-derived roadmap:

1. Normalize runtime ownership by route family:
- choose canonical local vs proxy path per capability and remove ambiguous dual paths.

2. Consolidate persistence:
- migrate remaining file/in-memory fallback paths to explicit DB-backed stores where required for operational continuity.

3. Promote one operator authority workflow:
- unify overlapping authority leak/integrity surfaces into a single primary path.

4. Increase end-to-end coverage on guarded execution flows:
- especially Step 2 publish and Step 3 push job lifecycle + approval/token/state guards.

5. Clarify tenant model in code:
- reduce hardcoded `default` assumptions in graph/integrity services.

## Source-of-Truth Files Reviewed

Planning inputs:

- `AGENTS.md`
- `planning/state.md`
- `planning/apps/directoryiq/overview.md`
- `planning/apps/directoryiq/product-intent.md`

UI/app surfaces:

- `app/apps/directoryiq/layout.tsx`
- `app/apps/directoryiq/page.tsx`
- `app/apps/directoryiq/directoryiq-dashboard-client.tsx`
- `app/apps/directoryiq/listings/directoryiq-listings-client.tsx`
- `app/apps/directoryiq/listings/[listingId]/listing-optimization-client.tsx`
- `app/apps/directoryiq/authority/*`
- `app/apps/directoryiq/graph-integrity/*`
- `app/apps/directoryiq/signal-sources/*`
- `app/apps/directoryiq/settings/*`
- `app/apps/directoryiq/versions/*`
- `app/apps/page.tsx`

API surfaces:

- `app/api/directoryiq/dashboard/route.ts`
- `app/api/directoryiq/listings/route.ts`
- `app/api/directoryiq/listings/[listingId]/*`
- `app/api/directoryiq/authority/*`
- `app/api/directoryiq/graph/*`
- `app/api/directoryiq/graph-integrity/*`
- `app/api/directoryiq/signal-sources/route.ts`
- `app/api/directoryiq/sites/*`
- `app/api/directoryiq/integrations/*`
- `app/api/directoryiq/ingest/runs/route.ts`
- `app/api/ingest/directoryiq/run/route.ts`
- `app/api/directoryiq/_utils/*`

Libraries/services/repositories:

- `lib/directoryiq/*`
- `src/directoryiq/graph/graphService.ts`
- `src/directoryiq/leaks/leakScanService.ts`
- `src/directoryiq/services/*`
- `src/directoryiq/repositories/*`

Data/schema artifacts:

- `db/directoryiq/000_directoryiq_ownership_introspection.sql`
- `db/directoryiq/001_directoryiq_schema_from_shared.sql`
- `db/directoryiq/002_directoryiq_data_copy_and_sequences.sql`
- `db/directoryiq/003_directoryiq_validation.sql`
- `db/migrations/20260403_directoryiq_multi_source_ingestion.sql`

Tests:

- `tests/directoryiq_*`

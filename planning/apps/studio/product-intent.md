# Studio Product Intent (Implementation-Derived)

Last reviewed: 2026-05-18 (UTC)

## Product Definition

Studio is implemented as an iBrains app family and launcher for media-focused operator workflows.

Current implementation shows:
- Standalone brain routes are `/casaflix` and `/reelify`; workspace dashboard route is `/dashboard`.
- One active Studio child app: CasaFlix.
- CasaFlix is a real-estate video command center that turns a campaign concept into a reviewed video package.
- Reelify is present in launcher/planning as "Coming Soon" and is not implemented in app/API paths yet.
- "Future Studio Apps" is a placeholder planning surface.

## Current Implementation Summary

Studio currently has two runtime surfaces:
- Brain shell surface (`/studio`): entitlement-gated Studio summary and signal-source UI.
- Top-level brain surfaces (`/casaflix` and `/reelify`) host the CasaFlix and Reelify workspaces.

CasaFlix runtime is a phase-driven command center with sections:
- Campaigns
- Viral Titles
- Properties
- Location
- Script
- Media
- Storyboard
- Review
- Publish
- Connections
- Settings

CasaFlix supports deterministic fallback behavior when live integrations are missing, and preserves workflow state in server-side campaign records.

## Naming Clarification

Current Studio sub-app identity is **CasaFlix**.

Legacy names still exist in implementation surfaces:
- `domara` appears in API/lib namespaces (`/api/studio/domara/*`, `lib/studio/domara/*`).
- `casahud` appears in backward-compatible routes, table names, and test/module identifiers.

In this document, CasaFlix is used as the current product/sub-app name. Legacy names are kept only when referencing exact implementation paths or historical compatibility behavior.

## Operator Workflow

Observed primary operator workflow:
1. Generate viral title opportunity (`POST /api/studio/domara/opportunity`).
2. Create campaign from selected title (`POST /api/studio/domara/campaigns`).
3. Add property evidence:
- discover listings (`POST /api/studio/domara/campaigns/:id/discover-listings`), and/or
- import listing URLs (`POST /api/studio/domara/campaigns/:id/import-listing-urls`), and/or
- browser-assisted import (`POST /api/studio/domara/campaigns/:id/browser-import`) plus manual listing edits (`PATCH /api/studio/domara/campaigns/:id/listing-candidates/:listingId`).
4. Validate/rank listings (`POST /api/studio/domara/campaigns/:id/validate-listings`).
5. Build location intelligence (`POST /api/studio/domara/campaigns/:id/location-intelligence`).
6. Generate script narrative (`POST /api/studio/domara/campaigns/:id/script`).
7. Build media plan (`POST /api/studio/domara/campaigns/:id/media-plan`).
8. Build YouTube review package/render plan (`POST /api/studio/domara/campaigns/:id/youtube-package`).
9. Execute render/publish/schedule endpoints:
- render (`POST /api/studio/domara/campaigns/:id/render`)
- publish (`POST /api/studio/domara/campaigns/:id/publish`)
- schedule (`POST /api/studio/domara/campaigns/:id/schedule`)

State transitions are guarded. Routes return explicit 409/400/503 errors if prerequisites are missing.

## Studio and Child-App Relationship

### Studio -> CasaFlix
- `/brains` is a launcher.
- `/casaflix` is the active CasaFlix workspace.
- `/reelify` is a backward-compatible legacy alias to the same CasaFlix workspace.
- `/casaflix/import` and `/reelify/import` share the browser import review client.

### Studio -> Reelify
- Launcher card exists but is disabled (`Coming Soon`).
- `app/reelify` is implemented as an independent top-level route shell.
- No `app/api/studio/uap-forge` or `lib/studio/uap-forge` runtime implementation found.

### Studio -> Future Studio Apps
- Planning placeholder exists.
- No runtime implementation found.

## Existing Content-Generation Pipeline

The implemented CasaFlix pipeline is campaign-centric and evidence-gated:
- Opportunity/title generation (YouTube-assisted if available, strategy fallback otherwise).
- Campaign persistence.
- Listing acquisition (provider discovery, URL import, browser-assisted import).
- Listing validation and ranking with title-support scoring.
- Location intelligence and POI/map narrative context.
- Script narrative generation (OpenAI if available, deterministic fallback otherwise).
- Media plan and scene-asset mapping.
- YouTube package/review/render-plan creation.
- Render/publish/schedule execution state updates.

A second orchestration path also exists (`/api/studio/domara/ai-channel/runs`, legacy namespace) with durable run-stage persistence; this path is implemented but not wired as the primary path used by the CasaFlix command-center client.

## AI Narrative Workflow

Current AI narrative flow combines live-provider and deterministic fallback behavior:
- Opportunity generation can use YouTube research provider or fallback heuristics.
- Script generation can use OpenAI chat completion JSON output; failed/low-quality output falls back to deterministic script composition and review checks.
- YouTube package generation builds title/description/tags/chapters/review findings/render plan from current validated campaign state.

Narrative consistency guards include:
- Stale-location guard before script generation.
- Script staleness detection when listings change.
- Review findings and blockers prior to publish/schedule path.

## Media and Render Workflow

Media/render behavior is scaffolded and guarded:
- Media plan creates visual asset graph, scene mapping, shot list, and coverage warnings.
- Render endpoint requires prepared package/render plan.
- If ffmpeg/local rendering is unavailable, system returns a preview-package style render output.
- Publish/schedule routes persist execution attempts/state but live YouTube upload/scheduling is not enabled.

## Asset Orchestration Workflow

Asset orchestration is implemented as campaign state:
- Listing images, map/POI/location context assets, and placeholders are assembled into scene mapping.
- Coverage status is tracked per scene/listing.
- Missing media warnings are surfaced in UI and persisted in campaign state.

Source attribution is retained for imported/browser-assisted listings via source URL, source label/host, canonical URL, extraction metadata, and review fields.

## API and Data Model Surface

### API surface (Studio)
All currently implemented Studio API routes use the legacy `domara` namespace.

- Campaign lifecycle: `/api/studio/domara/campaigns*`
- Opportunity: `/api/studio/domara/opportunity`
- Integrations: `/api/studio/domara/integrations*`
- Listing utility endpoints: `/api/studio/domara/listing/fetch`, `/api/studio/domara/listing/import-url`
- Browser importer installer: `/api/studio/domara/browser-import/bookmarklet`
- Generic render endpoint: `/api/studio/domara/render`
- AI channel run endpoint: `/api/studio/domara/ai-channel/runs`

### Data model and persistence
- Campaign-centric persistence via `casahud_projects` (legacy table name) with rich JSON metadata (`provider_metadata`).
- AI channel-run persistence tables exist (`casahud_generation_runs` and related legacy table names for stage outputs, packages, review/publish records, and run outputs).
- Studio integration secrets are stored in `directoryiq_signal_source_credentials` under `studio_domara_*` connector ids.

## Existing Tests

Studio/CasaFlix has broad unit/route/UI coverage, including:
- launcher and route contracts
- command-center UI contracts
- opportunity/campaign/discovery/validation/location/script/media/package/execute route tests
- listing URL importer and browser-assisted import parser/route/review client tests
- integration registry/settings persistence and security tests
- media/render/narration/map/location provider tests
- AI-channel orchestrator and DB migration contract tests

No Reelify runtime tests were found.

## Existing Implementation Status

Implemented and active:
- Studio launcher and CasaFlix workspace.
- End-to-end guarded campaign workflow from opportunity through review package.
- Multiple listing ingestion modes (provider discovery, URL import, browser-assisted import).
- Deterministic fallback strategy across key pipeline stages.
- Campaign persistence and integration-secret persistence.
- Execution-state scaffolding for render/publish/schedule.

Partially implemented / constrained:
- Live publish and scheduling are intentionally blocked at execution-context level.
- Render may degrade to preview package depending on environment capability.
- Dual orchestration models exist (campaign command center and AI-channel run engine), with unclear canonical ownership.

Not implemented:
- Reelify runtime app/API/lib paths.
- Future Studio app runtime paths.

## Current Gaps

1. Studio app family is only partially realized at runtime (CasaFlix implemented, Reelify/Future apps not implemented).
2. Live YouTube upload/scheduling is not enabled, even when YouTube is configured.
3. Two Studio orchestration models coexist (campaign command-center flow and AI-channel run engine) without a clearly documented canonical integration boundary.
4. Legacy namespaces remain mixed (`casahud`, `domara`, and `casaflix`) across UI/routes/lib, increasing architectural ambiguity.
5. Integration-secret storage currently reuses a DirectoryIQ credential table namespace; long-term ownership boundary is unclear (pending architecture interview).

## Recommended Roadmap (From Observed Code)

1. Decide and document canonical Studio execution architecture:
- command-center campaign flow vs AI-channel run engine responsibilities
- data ownership boundaries between `casahud_projects` and run tables
2. Implement/enable real publish/schedule path (or formalize long-term blocked mode) for CasaFlix execution endpoints.
3. Continue migration toward CasaFlix-first naming while preserving backward-compatible route/storage aliases where required.
4. Define dedicated Reelify runtime skeleton if it remains on the Studio launcher.
5. Clarify long-term credential-store ownership for Studio integrations (currently stored via `directoryiq_signal_source_credentials`).

Where product direction is not explicit in code, architecture intent is unclear and pending architecture interview.

## Source-of-Truth Files Reviewed

| File | What it proves |
| --- | --- |
| `app/(shell)/dashboard/page.tsx` | Studio launcher cards: CasaFlix active, Reelify disabled, future apps placeholder. |
| `app/casaflix/page.tsx` | CasaFlix route mounts the current command-center client implementation. |
| `app/reelify/page.tsx` | Backward-compatible legacy alias points to the same CasaFlix workspace. |
| `app/casaflix/studio-domara-client.tsx` | Single client entrypoint (legacy module name) into the command center. |
| `app/casaflix/studio-casahud-command-center.tsx` | Primary operator UI sections, next-step logic, and API wiring (legacy module name). |
| `app/reelify/import/review-client.tsx` | Browser-assisted import review/edit/save workflow. |
| `app/api/studio/domara/opportunity/route.ts` | Viral title opportunity generation endpoint and provider resolution. |
| `app/api/studio/domara/campaigns/route.ts` | Campaign create/list endpoints and duplicate-title handling. |
| `app/api/studio/domara/campaigns/[id]/discover-listings/route.ts` | Discovery phase route and integration-aware discovery execution. |
| `app/api/studio/domara/campaigns/[id]/validate-listings/route.ts` | Validation/ranking gate and shortlist generation route. |
| `app/api/studio/domara/campaigns/[id]/location-intelligence/route.ts` | Location-intelligence prerequisite guards and execution route. |
| `app/api/studio/domara/campaigns/[id]/script/route.ts` | Script-generation prerequisite and stale-location guards. |
| `app/api/studio/domara/campaigns/[id]/media-plan/route.ts` | Media-plan prerequisite gates and persistence flow. |
| `app/api/studio/domara/campaigns/[id]/youtube-package/route.ts` | Review package/render-plan build gate and persistence flow. |
| `app/api/studio/domara/campaigns/[id]/render/route.ts` | Render execution entry and guardrails. |
| `app/api/studio/domara/campaigns/[id]/publish/route.ts` | Publish execution entry and guarded state updates. |
| `app/api/studio/domara/campaigns/[id]/schedule/route.ts` | Schedule execution entry, datetime validation, and guarded state updates. |
| `app/api/studio/domara/campaigns/[id]/listing-candidates/[listingId]/route.ts` | User-imported listing edit/delete behavior and downstream reset/revalidation logic. |
| `app/api/studio/domara/integrations/*` | Integration status/save/test API and secret-safe responses. |
| `app/api/studio/domara/_utils/integration-settings.ts` | Studio integration provider list and encrypted credential persistence path. |
| `app/api/studio/domara/_utils/execution-context.ts` | YouTube execution context currently blocks live upload/scheduling. |
| `app/api/studio/domara/ai-channel/runs/route.ts` | Alternate AI-channel orchestration endpoint and run-output retrieval. |
| `lib/studio/domara/campaigns.ts` | Canonical campaign schema, phase transitions, and summary derivation. |
| `lib/studio/domara/campaign-repository.ts` | Campaign persistence model (`casahud_projects`) and store-availability checks. |
| `lib/studio/domara/listing-discovery-engine.ts` | Listing discovery logic, provider statuses, fallback behavior. |
| `lib/studio/domara/listing-validation-engine.ts` | Title-support scoring, ranking, duplicate reduction, validation warnings. |
| `lib/studio/domara/location-intelligence-engine.ts` | Location/POI/map intelligence generation and fallback behavior. |
| `lib/studio/domara/script-narrative-engine.ts` | OpenAI-based script generation with deterministic fallback and review guard. |
| `lib/studio/domara/media-planning-engine.ts` | Asset mapping, shot list, coverage warnings, placeholder handling. |
| `lib/studio/domara/youtube-package-engine.ts` | Package/review/render-plan assembly from campaign state. |
| `lib/studio/domara/campaign-execution-engine.ts` | Render/publish/schedule execution state machine and blocked live publish path. |
| `lib/studio/domara/listing-working-set.ts` | Script-ready promotion logic for complete user-imported listings. |
| `lib/studio/domara/listing-url-importer.ts` | URL import safety constraints (protocol/host checks, redirects, extraction behavior). |
| `lib/studio/domara/browser-listing-capture-parser.ts` | Browser capture payload schema and extraction interpretation. |
| `lib/studio/domara/ai-channel-engine/orchestrator.ts` | Alternate staged orchestrator with durable stage persistence. |
| `lib/studio/domara/ai-channel-engine/database-repository.ts` | Durable persistence mapping for AI-channel outputs and stage records. |
| `db/migrations/20260427_casahud_ai_channel_engine.sql` | Studio/CasaFlix run/project/storage schema for AI-channel engine. |
| `db/migrations/20260427_casahud_ai_wizard_outputs.sql` | Persisted latest run output table. |
| `app/studio/page.tsx` | Entitlement-gated Studio brain shell and link into app workspace. |
| `app/studio/signal-sources/page.tsx` | Studio signal-source settings surface and copy-level constraints. |
| `tests/studio_casahud_route_contract.test.tsx` | Contract: Studio launcher + CasaFlix route + CasaHud alias behavior. |
| `tests/studio_casahud_command_center_ui.test.tsx` | Command-center UI and state progression expectations. |
| `tests/studio_casahud_campaign_routes.test.ts` | Campaign API contract and duplicate/storage guard behavior. |
| `tests/studio_casahud_execution_routes.test.ts` | Render/publish/schedule route behavior and blocked publish scenarios. |
| `tests/studio_integration_settings.test.ts` | Encrypted integration secret persistence and non-leak contract. |
| `tests/studio_domara_listing_url_importer.test.ts` | URL import extraction and safety behavior contract. |
| `tests/studio_casahud_browser_import_route.test.ts` | Browser-assisted import persistence and manual-completion behavior. |
| `tests/casahud_ai_channel_engine.test.ts` | AI-channel orchestrator stage contracts and DB migration coverage. |

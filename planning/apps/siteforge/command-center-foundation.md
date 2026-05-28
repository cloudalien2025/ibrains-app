# PageBolt Command Center Foundation

Last updated: 2026-05-18 (UTC)

## Sprint Scope

Sprint: `sprint-001-siteforge-command-center-foundation`
Type: planning + lightweight app-shell alignment

Goal: establish PageBolt command-center architecture/builder planning docs and add a Walmart-style workspace shell (left sidebar + right workspace) without changing PageBolt feature behavior.

## Current PageBolt Workspace Architecture (Implemented)

Current operator route: `/pagebolt`

Implemented behavior in current code:

- Single route client (`app/pagebolt/page.tsx`) manages project creation, connection validation, intent capture, and launch flow.
- Main operator journey is explicit and phase-based: `Connect -> Describe -> Launch`.
- Route handlers under `app/api/siteforge/*` provide auth-scoped project/workspace/session lifecycle, connection validation, build enqueueing, AI key save/remove, and refinement enqueueing.
- Repository-backed workspace hydration and persistence contracts are implemented under `lib/siteforge/repository/*` and `lib/siteforge/workspace*.ts`.

## Intended Command-Center Shell Structure

This sprint adds a structural shell around existing PageBolt content:

- left sidebar navigation lane for command-center context
- right workspace panel containing unchanged PageBolt page behavior
- shell header with app-level context and return link

The shell is presentation-only. Existing PageBolt workflow logic stays in `page.tsx` and API/lib layers.

## Primary Navigation Areas

Current shell navigation focuses on already implemented workflow areas:

- Command Center (route home)
- Connect (workspace lane)
- Describe (workspace lane)
- Launch (workspace lane)
- Project Status (workspace lane)

Lane entries are organizational cues for current in-page workflow sections, not new routes.

## Operator Dashboard Sections (Current)

From existing page implementation:

- Header status panel: active project, connection state, Thrive detection
- Connect section: WordPress + key setup and validation
- Describe section: intent prompt and plan creation
- Launch section: build progress, intelligence summary, and draft handoff state

## Listing/AI Visibility/Trust/Sync Surfaces (PageBolt Interpretation)

PageBolt does not expose Walmart-style listing intelligence lanes.

Implemented PageBolt equivalents:

- AI/generation readiness via saved OpenAI/SerpAPI key state and build guardrails
- connection and write capability checks through WordPress validation routes
- run-state progress and verification signals in launch timeline/status
- persistence/storage health surfaced through admin summary and storage policy contracts

## Builder Implementation Boundaries

In scope:

- planning files for command-center architecture and builder execution
- layout/sidebar shell and nav metadata
- focused shell contract tests

Out of scope:

- no PageBolt API behavior changes
- no build/orchestrator logic changes
- no data model or persistence redesign
- no route renames or workflow rewrites

## Deferred Work

- split current monolithic PageBolt page into dedicated sub-routes/components where useful
- add dedicated operator surfaces for session history, diagnostics, and governance
- formalize API-to-UI mapping docs for each workflow lane

## Source-of-Truth Files

Planning:

- `planning/apps/siteforge/overview.md`
- `planning/apps/siteforge/product-intent.md`
- `planning/apps/siteforge/architecture.md`
- `planning/apps/siteforge/builder-workflow.md`
- `planning/apps/siteforge/roadmap.md`

Implementation:

- `app/pagebolt/page.tsx`
- `app/pagebolt/layout.tsx`
- `app/pagebolt/_components/siteforge-sidebar.tsx`
- `lib/siteforge/siteforge-nav.ts`
- `app/api/siteforge/*`
- `lib/siteforge/*`
- `tests/siteforge*`

## Suggested Follow-On Sprints

1. PageBolt Sprint 002: document and test command-center lane contracts (Connect/Describe/Launch) with route-level UI assertions.
2. PageBolt Sprint 003: carve session history and diagnostics into dedicated sub-routes if needed.
3. PageBolt Sprint 004: tighten command-center observability and storage health surfacing in operator UI.

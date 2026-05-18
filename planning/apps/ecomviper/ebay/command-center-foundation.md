# eBay Command Center Foundation

Last updated: 2026-05-18 (UTC)

## Sprint Scope

Sprint: `sprint-001-ebay-command-center-foundation`
Type: planning + lightweight app-shell alignment (no live marketplace execution changes)

Goal: establish the eBay command-center architecture/builder foundation and align the app shell to the Walmart-style EcomViper workspace structure while preserving current eBay Phase 1 behavior boundaries.

## 1) Current eBay Workspace Architecture

Current eBay implementation is Phase 1, read-only, and mock-first:

- route: `/apps/ecomviper/ebay`
- client workspace with deterministic mock import, scoring, and recommendations
- connection/readiness checklist and explicit no-write boundary
- live provider seams exist but remain gated/placeholder for this phase

Core architecture characteristics:

- UI-driven command-center diagnostics with local deterministic data flows
- no dedicated eBay API route layer under `app/api/ecomviper/ebay`
- no durable eBay listing intelligence persistence model in current phase

## 2) Intended Command-Center Shell Structure

The command-center shell follows the established EcomViper workspace pattern:

- persistent left sidebar with section navigation
- right-side workspace panels for triage and operator decisions
- command-center header + summary cards + section panels
- explicit placeholder messaging for deferred lifecycle surfaces

This shell is intentionally lightweight and presentation-focused in this sprint.

## 3) Primary Navigation Areas

Current sidebar navigation areas in the shell:

- Command Center
- Listing Intelligence
- AI Visibility
- Trust & Reputation
- Sync & Reconciliation
- Operator Actions

These are shell-level navigation anchors for operator orientation, not new backend workflow contracts.

## 4) Operator Dashboard Sections

Current dashboard sections include:

- command-center header with read-only scope messaging
- summary cards for connection posture, checklist readiness, listing intelligence volume, and priority pressure
- connection panel and listing import panel
- listing audit table
- listing detail/optimization panel

These surfaces are grounded in existing eBay import/scoring/recommendation behavior.

## 5) Listing Intelligence Surfaces

Implemented listing intelligence surfaces:

- deterministic listing import action (mock-first)
- audit table with aspect/title/description/overall scoring
- priority/status triage
- per-listing optimization recommendation detail

This is the primary real operator value in Phase 1.

## 6) AI Visibility / Trust / Reputation Surfaces

Current status:

- AI visibility/readiness panel is a planning-backed shell surface
- trust/reputation panel is a planning-backed shell surface
- both panels are explicitly marked as deferred for live contracts/signals

No new AI visibility score contracts or reputation ingest pipelines are introduced in this sprint.

## 7) Sync / Reconciliation / Publish Lifecycle Placeholders

Current sync/reconciliation/publish posture:

- sync/reconciliation panel exists as shell-level placeholder
- live import seam remains disabled in phase behavior
- publish/execute actions remain unavailable by design

Placeholder language explicitly avoids implying completed execution capabilities.

## 8) Builder Implementation Boundaries

Guardrails for this sprint:

- no eBay write-path implementation
- no marketplace API execution changes
- no eBay API route expansion
- no persistence/migration additions
- no speculative score contracts outside current implementation evidence

Allowed work:

- shell/layout/navigation alignment
- planning documentation foundation
- focused test alignment for shell behavior

## 9) Deferred Work

Deferred to follow-on sprints:

- dedicated eBay API route boundary (`app/api/ecomviper/ebay/*`)
- durable listing intelligence persistence and audit history
- controlled live read-only ingestion enablement
- reconciliation lifecycle state model
- guarded execute/publish workflows with audit constraints
- typed AI visibility/trust contract definitions

## 10) Source-of-Truth Files

Planning:

- `planning/apps/ecomviper/ebay/overview.md`
- `planning/apps/ecomviper/ebay/product-intent.md`

App UI:

- `app/apps/ecomviper/ebay/layout.tsx`
- `app/apps/ecomviper/ebay/_components/ebay-sidebar.tsx`
- `app/apps/ecomviper/ebay/page.tsx`
- `app/apps/ecomviper/ebay/ebay-dashboard-client.tsx`

Libraries:

- `lib/ecomviper/ebay/types.ts`
- `lib/ecomviper/ebay/ebay-inventory-provider.ts`
- `lib/ecomviper/ebay/dashboard.ts`
- `lib/ecomviper/ebay/listing-score.ts`
- `lib/ecomviper/ebay/recommendations.ts`
- `lib/ecomviper/ebay/ebay-nav.ts`

Tests:

- `tests/ecomviper_ebay_dashboard.test.tsx`
- `tests/ecomviper_ebay_scoring.test.ts`
- `tests/ecomviper_ebay_command_center_shell.test.tsx`

## 11) Suggested Follow-On Sprints (Candidates)

1. eBay Sprint 002: define read-only API boundary and persistence baseline for listing intelligence runs.
2. eBay Sprint 003: formalize sync/reconciliation queue model and durable status timelines.
3. eBay Sprint 004: introduce canonical AI visibility/trust contracts aligned with EcomViper command-center vocabulary.
4. eBay Sprint 005: design guarded execute/publish lifecycle with explicit approval and audit controls.

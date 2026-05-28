# eBay Product Intent

Last updated: 2026-05-18 (UTC)

This document is derived from observed implementation in this repository. It does not define net-new requirements.

For the focused command-center architecture and shell alignment baseline, see:

- `planning/apps/ecomviper/ebay/command-center-foundation.md`

## Product Definition

eBay is currently implemented as a Phase 1, read-only, mock-first listing optimization workspace under EcomViper.

From code and UI, the eBay workspace is designed to:

- provide a marketplace-specific dashboard at `/optibay`,
- expose a BYO credential readiness checklist for future integration,
- import deterministic mock listings for Phase 1 analysis,
- score listing quality against category aspects and listing-quality heuristics,
- generate recommendation output for title/description/spec/asset improvements,
- keep all listing updates non-executing and advisory-only.

## Who It Is For

Primary user appears to be an ecommerce operator optimizing eBay listings inside EcomViper.

Observed operator needs from implementation:

- inspect listing optimization readiness quickly,
- prioritize which listings need attention,
- review safe recommendation guidance without triggering live eBay writes,
- prepare for eventual live read-only ingest using BYO credentials.

## Primary Operator Workflow

Observed flow in the current implementation:

1. Open EcomViper launcher (`/ecomviper`) and choose eBay.
2. Land on eBay Phase 1 dashboard (`/optibay`).
3. Review connection panel status:
- mode (`mock` or `live-ready`),
- environment label,
- BYO credential checklist,
- explicit read-only boundary notice.
4. Trigger listing import from the import panel.
5. Review import warnings and mode outcome.
6. Review listing audit table with aspect/title/description scores, overall score, and status/priority.
7. Select a listing SKU to inspect optimization detail and AI-ready recommendation output.

## Listing Intelligence Workflow

Current listing intelligence is deterministic and local in this repo:

- Import source:
  - Mock provider returns 3 fixed listing profiles (strong/medium/weak).
  - Live-readonly provider seam exists but intentionally returns no live listings in Phase 1.
- Taxonomy/aspect source:
  - Mock taxonomy metadata by category with required/recommended aspects.
  - Live taxonomy seam currently returns mock metadata with live-seam annotation.
- Scoring model:
  - title, description, aspect coverage, image coverage, identifier completeness, inventory state.
  - weighted overall score drives status (`Healthy`/`Improve`/`Needs Attention`) and priority (`low`/`medium`/`high`).
- Recommendation model:
  - suggested title,
  - description direction,
  - missing aspects,
  - identifier issues,
  - image notes,
  - search visibility and conversion notes,
  - compliance-safe rewrite notes.

## AI Visibility Strategy (Current State)

Implementation includes AI-oriented recommendation framing, but no live model execution path:

- UI section labeled "AI-ready recommendation output" is generated from deterministic recommendation logic.
- Search visibility and conversion notes are heuristic outputs from listing score state.
- No eBay-specific LLM call, embedding pipeline, or AI visibility telemetry is implemented in this scope.

## Trust / Reputation Workflow (Current State)

No explicit trust/reputation subsystem is implemented for eBay Phase 1.

Implemented behavior is limited to listing quality heuristics (identifiers, condition, content completeness) and compliance-safe rewrite guidance.

## Semantic Commerce Workflow (Current State)

Partial semantic structure exists via:

- category-specific aspect requirements/recommendations,
- normalized listing identifier handling (`brand`, `model`, `upc`, `ean`, `mpn`),
- keyword-oriented title/recommendation synthesis.

A broader semantic graph, ontology, or cross-market semantic reconciliation flow is not implemented in the eBay module.

## Synchronization / Reconciliation / Publish Lifecycle (Current State)

Current lifecycle is intentionally constrained:

- Import: implemented (mock-first; live-readonly seam only).
- Reconciliation: not implemented as a durable sync pipeline.
- Publish/writeback: intentionally not implemented.
- OAuth connect action is present as UI placeholder and disabled.
- eBay write operation names are enumerated in types for guardrail/testing context, but are not exposed in Phase 1 UI execution paths.

No `app/api/ecomviper/ebay` route family currently exists in this repository.

## Existing Implementation Status

Implemented and active:

- eBay card in EcomViper launcher marked Active.
- eBay dashboard route and client UI.
- Connection summary resolver with mode/env/checklist and read-only boundary messaging.
- Mock inventory provider and mock taxonomy provider.
- Live-readonly provider seams for future integration (explicitly disabled for live calls in Phase 1).
- Deterministic scoring and recommendation engines.
- Focused tests for route rendering/import behavior and scoring behavior.

Partially implemented / constrained:

- Live-readonly mode resolves connection posture but does not call live eBay APIs.
- Taxonomy live seam is placeholder behavior over mock metadata.

Not implemented:

- eBay-specific server API route surface under `app/api/ecomviper/ebay`.
- Persistence layer for imported eBay listings/audits/recommendations.
- Writeback/publish operations to eBay inventory/offer/listing endpoints.
- End-to-end reconciliation lifecycle across eBay and other marketplaces.

## Missing Architecture Areas

Observed gaps from implementation:

1. No dedicated eBay API route layer in this repo (`app/api/ecomviper/ebay` missing).
2. No durable repository/data model for eBay listing imports or optimization history.
3. Connection/OAuth workflow is represented as readiness checklist + placeholder CTA only.
4. Phase 1 scoring/recommendations are local and deterministic with no live marketplace data contracts enforced.
5. No guarded execute path for any eBay listing mutation lifecycle.

Unclear and pending architecture interview:

- intended long-term local-vs-proxy ownership for eBay integration routes,
- intended persistence boundaries for eBay listing intelligence data,
- intended rollout order for read-only live ingest versus guarded write execution.

## Recommended Roadmap

Implementation-derived roadmap:

1. Add an explicit eBay route/service contract boundary:
- establish `app/api/ecomviper/ebay/*` read-only ingest/status routes before write paths.

2. Introduce durable persistence for Phase 1 intelligence:
- store imported listing snapshots, scores, recommendation outputs, and run metadata.

3. Enable controlled live read-only ingest:
- activate live inventory/taxonomy provider seams behind explicit environment and credential guards.

4. Define guarded execution roadmap for future phases:
- require confirmation/idempotency/audit constraints before any write operation surfaces.

5. Expand eBay-focused contract coverage:
- route/service tests for live-readiness, error handling, and persistence contracts once implemented.

## Source-of-Truth Files Reviewed

Planning inputs:

- `AGENTS.md`
- `planning/state.md`
- `planning/apps/ecomviper/overview.md`
- `planning/apps/ecomviper/product-intent.md`
- `planning/apps/ecomviper/ebay/overview.md`
- `planning/apps/ecomviper/ebay/product-intent.md`

UI/app surfaces:

- `app/ecomviper/page.tsx`
- `app/optibay/page.tsx`
- `app/optibay/ebay-dashboard-client.tsx`

API surfaces:

- `app/api/ecomviper/ebay/*` (not present in repo)

Libraries/services:

- `lib/ecomviper/core/marketplace-types.ts`
- `lib/ecomviper/ebay/types.ts`
- `lib/ecomviper/ebay/dashboard.ts`
- `lib/ecomviper/ebay/listing-score.ts`
- `lib/ecomviper/ebay/recommendations.ts`
- `lib/ecomviper/ebay/mock-ebay-provider.ts`
- `lib/ecomviper/ebay/ebay-inventory-provider.ts`
- `lib/ecomviper/ebay/ebay-taxonomy-provider.ts`

Tests:

- `tests/ecomviper_ebay_dashboard.test.tsx`
- `tests/ecomviper_ebay_scoring.test.ts`
- `tests/ecomviper_walmart_route_contract.test.tsx` (launcher coverage includes eBay card)

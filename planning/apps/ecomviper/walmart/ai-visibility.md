# Walmart AI Visibility Foundation

Last updated: 2026-05-18 (UTC)

Sprint: `sprint-003-walmart-ai-visibility`  
Type: Docs/planning foundation from implementation evidence

## 1) Purpose

This document defines what "AI visibility" currently means in the Walmart workspace based on implemented routes, UI copy, data models, API handlers, fixtures, and tests.

Current implementation uses "AI visibility" as an operator-facing readiness concept across:

- listing completeness and quality signals,
- search/semantic coverage signals,
- trust/compliance signals,
- draft/action queue pressure,
- recommendation outputs that are mostly approval-first and preview-first.

It is not yet a single canonical production analytics metric.

## 2) Current Surfaces

## 2.1 Command Center AI visibility and queue surfaces

- Surface: Command Center cards + queues + readiness panel
- Route/component location:
  - `app/apps/ecomviper/walmart/page.tsx`
  - `lib/ecomviper/walmart/walmart-products.ts` (`getWalmartDashboardSnapshotForUser`)
  - `lib/ecomviper/walmart/walmart-agentic-optimization-coverage.ts`
- What operator sees:
  - Cards: `Command Center Health`, `Catalog Coverage`, `Action Queue`, `Trust Signal Alerts`, `Priority Opportunities`
  - Panels: `AI Visibility Queue`, `Signal Timeline`, `Listings Needing Intervention`
  - Coverage/readiness: `AI Recommendation Readiness`, readiness subscores, `Next Best Actions`, `Missing From Code`
- Data appears driven by:
  - persisted products + persisted drafts counts,
  - feed error counts and activity logs,
  - static+scored optimization coverage matrix and per-product readiness scoring.
- Operator decision supported:
  - identify where to triage first,
  - decide whether to run listing optimization or follow missing-field actions,
  - decide whether trust/feed issues need review.
- Backing status:
  - Mixed.
  - Product/draft counts are implementation-backed.
  - Feed/activity storage and many readiness rows are recommendation/scaffold signals, not full live telemetry.

## 2.2 Prompt Match surface (mapped lane)

- Surface: `Prompt Match` nav lane
- Route/component location:
  - `lib/ecomviper/walmart/walmart-nav.ts` maps `Prompt Match` -> `/apps/ecomviper/walmart/activity`
  - `app/apps/ecomviper/walmart/activity/page.tsx`
  - `lib/ecomviper/core/activity-log.ts`
- What operator sees:
  - activity table (time, actor, action, SKU, result, message).
- Data appears driven by:
  - appended activity log entries from imports/drafts/feeds/inventory/pricing flows.
- Operator decision supported:
  - inspect recent workflow outcomes and failures.
- Backing status:
  - Partial.
  - Real logging calls exist, but storage is runtime in-memory store and not durable long-term audit.

## 2.3 Semantic Gaps surface (mapped lane)

- Surface: `Semantic Gaps` nav lane
- Route/component location:
  - `lib/ecomviper/walmart/walmart-nav.ts` maps `Semantic Gaps` -> `/apps/ecomviper/walmart/inventory`
  - `app/apps/ecomviper/walmart/inventory/page.tsx`
  - `app/apps/ecomviper/walmart/inventory/inventory-client.tsx`
  - `lib/ecomviper/walmart/walmart-inventory.ts`
- What operator sees:
  - inventory update workspace + low-stock/out-of-stock tables + recent inventory changes.
- Data appears driven by:
  - persisted products merged with latest drafts,
  - recent activity entries filtered to `inventory_update`.
- Operator decision supported:
  - decide inventory draft updates and identify low availability risk.
- Backing status:
  - Partial.
  - Draft save path is real.
  - direct update path intentionally returns write-disabled warning (no live mutation).

## 2.4 Product Opportunities surface (mapped lane)

- Surface: `Product Opportunities` nav lane
- Route/component location:
  - `lib/ecomviper/walmart/walmart-nav.ts` maps `Product Opportunities` -> `/apps/ecomviper/walmart/pricing`
  - `app/apps/ecomviper/walmart/pricing/page.tsx`
  - `app/apps/ecomviper/walmart/pricing/pricing-client.tsx`
  - `lib/ecomviper/walmart/walmart-pricing.ts`
- What operator sees:
  - pricing update workspace + validation warnings + recent price changes.
- Data appears driven by:
  - persisted products merged with latest drafts,
  - recent activity entries filtered to `pricing_update`.
- Operator decision supported:
  - decide price draft updates and detect invalid price state.
- Backing status:
  - Partial.
  - Draft save path is real.
  - direct submit path intentionally returns write-disabled warning (no live mutation).

## 2.5 Trust Signals surface (mapped lane)

- Surface: `Trust Signals` nav lane
- Route/component location:
  - `lib/ecomviper/walmart/walmart-nav.ts` maps `Trust Signals` -> `/apps/ecomviper/walmart/feeds`
  - `app/apps/ecomviper/walmart/feeds/feeds-client.tsx`
  - `app/api/ecomviper/walmart/feeds/submit/route.ts`
  - `lib/ecomviper/walmart/walmart-feeds.ts`
- What operator sees:
  - feed table with status/error counts and payload preview,
  - explicit UI message: preview/staged only.
- Data appears driven by:
  - feed submission/status runtime store,
  - approval + proposal + env flag gates on submit route.
- Operator decision supported:
  - review feed payload/error history and decide if draft/proposal is ready for gated submit.
- Backing status:
  - Partial/staged.
  - Approval gating is real.
  - live submission remains disabled unless explicit write mode gate is enabled.

## 2.6 iBrains Intelligence opportunities

- Surface: `iBrains Intelligence`
- Route/component location:
  - `app/apps/ecomviper/walmart/ibrains-intelligence/page.tsx`
  - `app/apps/ecomviper/walmart/ibrains-intelligence/walmart-ibrains-intelligence-client.tsx`
  - `lib/ecomviper/walmart/walmart-ibrains-intelligence.ts`
- What operator sees:
  - product selector + run button,
  - run summary (agentic visibility score, opportunities, high-impact actions, compliance warnings),
  - destination-aware opportunities and draft recommendations.
- Data appears driven by:
  - deterministic in-process scoring from product field coverage and destination guardrails,
  - connected WordPress properties from network connections repository.
- Operator decision supported:
  - pick recommendation destination/action,
  - decide what needs approval before external publishing.
- Backing status:
  - Partial/recommendation engine.
  - Real rule/scoring logic exists and is tested.
  - Output is recommendation/draft guidance, not direct execution workflow.

## 2.7 Product Editor readiness and visibility details

- Surface: SKU editor visibility/readiness controls
- Route/component location:
  - `app/apps/ecomviper/walmart/products/[sku]/product-editor-client.tsx`
  - `lib/ecomviper/walmart/walmart-listing-quality.ts`
  - `lib/ecomviper/walmart/walmart-publish-lanes.ts`
  - `lib/ecomviper/walmart/walmart-source-confidence.ts`
  - `lib/ecomviper/walmart/walmart-public-listing-url.ts`
- What operator sees:
  - `Agentic Visibility Score` ring and readiness labels,
  - validation/readiness summary,
  - source confidence + canonical URL/item ID confidence diagnostics,
  - publish preview lanes and blocking/warning lists.
- Data appears driven by:
  - listing-quality heuristic assessment,
  - publish lane diff/validation builder,
  - catalog backfill field confidence classifications,
  - trusted ITEM_ID/public listing URL resolution.
- Operator decision supported:
  - decide whether content is ready for guarded publish preview,
  - decide which fields need trust/compliance/source-confidence improvements.
- Backing status:
  - Mixed.
  - Readiness calculations and diagnostics are implemented.
  - publish execution is explicitly preview-only (`preview_only_no_publish_route`).

## 3) Data and Signal Model

Current Walmart AI visibility is composed of multiple signal families, not one canonical score.

## 3.1 Queue and card signals (Command Center)

- `productsImported`: persisted Walmart product count.
- `draftChanges`: persisted draft count.
- `feedErrors`: sum of feed `errorReport` lengths.
- `listingsNeedingAttention`: products where issues exist or status is not active.
- `recentProducts` and `recentActivity`: used for AI Visibility Queue and timeline.

## 3.2 Listing quality and per-SKU visibility scoring

- `assessWalmartListingQuality` produces score/factors/recommendations.
- Score is penalty-based (starts high, subtracts for missing/weak signals).
- Example penalty classes:
  - missing image, low title quality, missing brand/description/bullets/attributes,
  - inventory unknown or out-of-stock,
  - invalid/missing price.

## 3.3 Agentic readiness scorecard (coverage + per-product blend)

- `buildWalmartAgenticReadinessScorecard` blends:
  - coverage matrix status scores (`supported`, `partial`, `missing`, etc.), and
  - per-product heuristic subgroup scores.
- Produces:
  - `overallAiRecommendationReadinessScore`,
  - `aiConfidenceScore`,
  - readiness subscores by group,
  - prioritized `missingFieldRecommendations` and `nextBestActions`.

## 3.4 Semantic/search, FAQ, and answer-engine readiness signals

- Coverage matrix includes `search_agentic_commerce`, `search_ai_readiness_score`, and answer-engine/FAQ-related rows.
- AI optimizer and rules include explicit answer-engine-friendly copy constraints and FAQ threshold logic.
- Truth guard removes internal diagnostic language from customer-facing output.

## 3.5 Trust and provenance signals

- Compliance risk and warning systems:
  - compliance validator + compliance agent and risky-claim sanitization.
- Source confidence system:
  - per-field actions (`filled_missing`, `replaced_placeholder`, `skipped_conflict`, etc.) and overall confidence summaries.
- Public listing trust:
  - ITEM_ID handling rejects lookup-only identifiers (GTIN/UPC) and untrusted ITEM_ID provenance.
- Label facts trust:
  - fact pack indicates whether trusted label facts were actually available.

## 3.6 Opportunity and recommendation signals

- iBrains opportunities compute:
  - relevance score,
  - citation potential,
  - agentic visibility score,
  - compliance risk/status,
  - destination fit score.
- Destination recommendations are shaped by WordPress guardrails and connection status.

## 3.7 Important current-model caveat

At least three different "visibility/readiness" scoring systems exist in current code:

- listing-quality score (`walmart-listing-quality.ts`),
- command-center readiness scorecard (`walmart-agentic-optimization-coverage.ts`),
- iBrains run summary score (`walmart-ibrains-intelligence.ts`).

No single canonical Walmart AI visibility score contract is implemented yet.

## 4) Current Operator Workflow (Implementation-Supported)

1. Open Command Center to review health, queue counts, AI visibility queue, and readiness actions.
2. If needed, fix connections in `Network Connections` (Walmart/OpenAI/SerpApi/destination properties).
3. Import/refresh catalog in `Products`; review issues and source confidence indicators.
4. Open SKU editor; run AI optimization; review visibility score, compliance warnings, source confidence, and publish readiness.
5. Save staged updates to drafts.
6. Use `Drafts` to validate/submit/discard staged work.
7. Review mapped lanes:
   - Prompt Match (`Activity`) for operational timeline,
   - Semantic Gaps (`Inventory`) for stock readiness,
   - Product Opportunities (`Pricing`) for offer readiness,
   - Trust Signals (`Feeds`) for staged feed diagnostics.
8. Return to Command Center to verify queue movement and next actions.

## 5) Current Implementation Status

## Built/current

- Command Center AI visibility cards/queues and readiness panel rendering.
- Persisted per-user product and draft repositories (DB-backed paths + test fallback).
- SKU-level listing quality assessment and deterministic recommendations.
- Publish-lane preview/diff/validation model with explicit confirmation UX.
- iBrains intelligence run, scoring, and destination-aware recommendation generation.
- AI optimization pipeline with compliance/truth-guard layering and diagnostics.

## Partial/demo/fixture-backed

- Prompt Match lane is currently activity-log audit, not dedicated prompt/query matching surface.
- Semantic Gaps and Product Opportunities lanes currently map to inventory/pricing workspaces.
- Feed/inventory/pricing direct updates remain mostly draft-first/staged with write-disabled production path.
- Command Center readiness matrix contains substantial recommendation/scaffold rows and "missing from code" placeholders by design.
- Activity log and feed/network connection stores use runtime/fallback patterns in current module paths.

## Missing/unclear

- Canonical single AI visibility score and contract across dashboard/editor/iBrains.
- Durable user-scoped long-term storage for all visibility timelines/queues (activity/feed/network connections).
- Explicit Prompt Match workflow tied to prompt/query evidence and actions.
- Explicit Semantic Gaps and Product Opportunities workflows aligned to their lane names.
- Full answer-engine referral telemetry attribution (ChatGPT/Copilot/Perplexity/Gemini) beyond recommendation readiness rows.

## Deferred

- Broad live Walmart mutation rollout (publish/feeds/inventory/pricing execution).
- Expanded analytics proof signals (search visibility, keyword rank, referral attribution) requiring additional access/integration.
- Rich media and cross-platform trust signal execution paths currently marked missing/recommendation-only in coverage model.

## 6) Source-of-Truth Files Inspected

- `app/apps/ecomviper/walmart/page.tsx`: command center cards, AI visibility queue, readiness panel, next-best actions.
- `app/apps/ecomviper/walmart/_components/walmart-sidebar.tsx`: AI discovery/readiness lane copy and nav intent text.
- `lib/ecomviper/walmart/walmart-nav.ts`: lane label to route mapping (Prompt Match/Semantic Gaps/Product Opportunities/Trust Signals).
- `app/apps/ecomviper/walmart/activity/page.tsx`: Prompt Match-mapped activity surface.
- `app/apps/ecomviper/walmart/inventory/page.tsx` + `inventory-client.tsx`: Semantic Gaps-mapped inventory surface.
- `app/apps/ecomviper/walmart/pricing/page.tsx` + `pricing-client.tsx`: Product Opportunities-mapped pricing surface.
- `app/apps/ecomviper/walmart/feeds/page.tsx` + `feeds-client.tsx`: Trust Signals-mapped feed surface and staged messaging.
- `app/apps/ecomviper/walmart/ibrains-intelligence/*`: iBrains run UI and destination-aware opportunity output.
- `app/apps/ecomviper/walmart/products/page.tsx` + `products-client.tsx`: product list triage, source confidence context, import diagnostics.
- `app/apps/ecomviper/walmart/products/[sku]/product-editor-client.tsx`: per-SKU visibility/readiness score, publish preview, source confidence panel.
- `app/api/ecomviper/walmart/health/route.ts`: connection + card payload contract.
- `app/api/ecomviper/walmart/ai/generate/route.ts`: AI optimization route and flow metadata.
- `app/api/ecomviper/walmart/inventory/update/route.ts`: inventory update API behavior.
- `app/api/ecomviper/walmart/pricing/update/route.ts`: pricing update API behavior.
- `app/api/ecomviper/walmart/feeds/submit/route.ts`: feed approval/write-mode gates.
- `lib/ecomviper/walmart/walmart-products.ts`: dashboard snapshot construction and queue/card source derivation.
- `lib/ecomviper/walmart/walmart-listing-quality.ts`: listing quality score and recommendation model.
- `lib/ecomviper/walmart/walmart-agentic-optimization-coverage.ts`: readiness matrix, scorecard, next-best actions.
- `lib/ecomviper/walmart/walmart-ibrains-intelligence.ts`: opportunity scoring, compliance risk states, destination fit.
- `lib/ecomviper/walmart/walmart-ai-optimizer.ts`: layered AI visibility/answer-engine-friendly suggestion generation.
- `lib/ecomviper/walmart/walmart-ai-visibility-content-policy.ts`: visibility copy policy, risk sanitization, entity/search keyword generation.
- `lib/ecomviper/walmart/walmart-source-confidence.ts`: field-level confidence/action model.
- `lib/ecomviper/walmart/walmart-public-listing-url.ts`: trusted public URL/ITEM_ID provenance rules.
- `lib/ecomviper/walmart/walmart-label-facts.ts`: trusted label-fact extraction and warnings.
- `lib/ecomviper/walmart/walmart-inventory.ts`, `walmart-pricing.ts`, `walmart-feeds.ts`: staged update/feed behavior and recent-change sources.
- `lib/ecomviper/walmart/walmart-product-repository.ts`, `walmart-draft-repository.ts`, `walmart-drafts.ts`: persistence model and draft workflow.
- `lib/ecomviper/walmart/walmart-network-connections-repository.ts`: destination connection persistence pattern used by iBrains.
- Tests: `tests/ecomviper_walmart_route_contract.test.tsx`, `tests/ecomviper_walmart_tabbed_workflow.test.tsx`, `tests/ecomviper_walmart_publish_lanes.test.ts`, `tests/ecomviper_walmart_approval_gates.test.ts`, `tests/ecomviper_walmart_agentic_optimization_coverage.test.ts`, `tests/ecomviper_walmart_ibrains_intelligence_workflow.test.tsx`, `tests/ecomviper_walmart_ibrains_intelligence_scoring.test.ts`, `tests/ecomviper_walmart_ai_visibility_content_policy.test.ts`, `tests/ecomviper_walmart_source_confidence.test.ts`.

## 7) Next Sprint Candidates (Not Commitments)

1. Prompt Match foundation sprint: define canonical prompt/query entities and wire Activity lane to prompt evidence instead of generic action log only.
2. Semantic Gaps foundation sprint: document and implement semantic-gap-specific signal rows beyond inventory-only mapping.
3. Product Opportunities workflow sprint: connect pricing/opportunity outputs to explicit draft actions and queue state transitions.
4. Command Center action queue sprint: bind next-best-action items to concrete operator tasks and draft/status movement.
5. Canonical visibility score contract sprint: reconcile dashboard/editor/iBrains scoring into one typed shared visibility model.
6. Focused test sprint: add targeted integration tests for AI visibility card/queue state transitions and lane mapping expectations.

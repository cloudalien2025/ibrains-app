# Walmart Score Contract

Last updated: 2026-05-18 (UTC)

Sprint: `sprint-004-walmart-score-contract`  
Type: Docs/planning contract from implementation evidence

## 1) Purpose

Walmart currently exposes multiple score/readiness models across Command Center, Product Editor, iBrains Intelligence, and lane-mapped surfaces. This document defines a canonical score vocabulary and ownership map so builders do not create drift between:

- Command Center rollups and action queues
- per-product editor scoring/readiness
- iBrains opportunity scoring
- Prompt Match / Semantic Gaps / Product Opportunities / Trust Signals lane semantics

Primary goal: keep labels, data model names, and operator meaning aligned while current implementation is still mixed between production-backed, staged, and recommendation-only behavior.

## 2) Current Score And Signal Inventory

## 2.1 Command Center and optimization coverage

| Label / Signal | Location | Type / Example Values | Surface | Operator Meaning | Backing |
| --- | --- | --- | --- | --- | --- |
| `Command Center Health` | `app/apps/ecomviper/walmart/page.tsx` | badge: `Connected` / `Failed` / `Not Connected` | Command Center card | Connection/control-plane health for operator readiness | Mixed: connection health is real; card presentation is derived |
| `Catalog Coverage` | `app/apps/ecomviper/walmart/page.tsx`, `lib/ecomviper/walmart/walmart-products.ts` | number (`productsImported`) | Command Center card | Imported Walmart catalog breadth | Production-backed (persisted product repo) |
| `Action Queue` | `app/apps/ecomviper/walmart/page.tsx`, `lib/ecomviper/walmart/walmart-products.ts` | number (`draftChanges`) | Command Center card | Pending draft work awaiting review/publish flow | Production-backed (persisted drafts) |
| `Trust Signal Alerts` | `app/apps/ecomviper/walmart/page.tsx`, `lib/ecomviper/walmart/walmart-products.ts` | number (`feedErrors`) | Command Center card | Feed error pressure affecting trust/discoverability | Partial (runtime feed store + staged feed flow) |
| `Priority Opportunities` | `app/apps/ecomviper/walmart/page.tsx`, `lib/ecomviper/walmart/walmart-products.ts` | count + categories (`listingsNeedingAttention`) | Command Center card | Number of products needing intervention | Production-backed + derived from product issues/status |
| `AI Recommendation Readiness` | `app/apps/ecomviper/walmart/page.tsx`, `lib/ecomviper/walmart/walmart-agentic-optimization-coverage.ts` | 0-100 (`overallAiRecommendationReadinessScore`) | Coverage panel | Top-level rollup of current AI readiness model | Derived (coverage matrix + optional per-product blend) |
| `AI Confidence Score` | `app/apps/ecomviper/walmart/page.tsx`, `lib/ecomviper/walmart/walmart-agentic-optimization-coverage.ts` | 0-100 (`aiConfidenceScore`) | Coverage panel | Confidence companion to readiness rollup | Derived |
| `Recommendation Probability` | `lib/ecomviper/walmart/walmart-agentic-optimization-coverage.ts` | enum `low` / `medium` / `high` | Coverage model output | Coarse probability guidance for recommendation quality | Derived |
| `Readiness Subscores` | `app/apps/ecomviper/walmart/page.tsx`, `lib/ecomviper/walmart/walmart-agentic-optimization-coverage.ts` | record of 9 groups, each 0-100 | Coverage panel | Which readiness dimensions are weak/strong | Derived |
| Coverage status counts | `app/apps/ecomviper/walmart/page.tsx`, `lib/ecomviper/walmart/walmart-agentic-optimization-coverage.ts` | counts by `supported`/`partial`/`missing`/`recommendation_only`/`requires_credentials`/`requires_walmart_access` | Coverage panel | Capability availability and gaps | Static scaffold + derived counts |
| `Next Best Actions` | `app/apps/ecomviper/walmart/page.tsx`, `lib/ecomviper/walmart/walmart-agentic-optimization-coverage.ts` | prioritized list (`critical/high/medium/low`, impact) | Coverage panel + queue intent | What operator should do next | Derived + recommendation-only for many rows |
| `Missing From Code` | `app/apps/ecomviper/walmart/page.tsx`, `lib/ecomviper/walmart/walmart-agentic-optimization-coverage.ts` | list of missing/partial rows | Coverage panel | Explicit implementation gaps | Static scaffold inventory |
| Status-to-score mapping | `lib/ecomviper/walmart/walmart-agentic-optimization-coverage.ts` | `supported=100`, `partial=72`, `recommendation_only=52`, `requires_credentials=42`, `requires_walmart_access=34`, `missing=18` | Internal readiness math | How coverage status contributes to readiness score | Derived/internal contract |

## 2.2 Product Editor and products list visibility/readiness signals

| Label / Signal | Location | Type / Example Values | Surface | Operator Meaning | Backing |
| --- | --- | --- | --- | --- | --- |
| `Agentic Visibility Score` | `app/apps/ecomviper/walmart/products/[sku]/product-editor-client.tsx` | 0-100 ring; labels: `Poor`, `Needs work`, `Good`, `Strong`, `Perfectly optimized` | Product Editor summary | Per-product visibility quality snapshot | Derived from listing-quality score (and optional projected suggestion score) |
| Listing quality score | `lib/ecomviper/walmart/walmart-listing-quality.ts` | 1-100 (`score`) | Product Editor internals + proposal generation | Product quality baseline used by editor | Derived heuristics |
| Listing quality factors | `lib/ecomviper/walmart/walmart-listing-quality.ts` | string list (for example missing image, title quality, price/inventory issues) | Product Editor diagnostics | Why score dropped | Derived heuristics |
| Listing recommendations severity | `lib/ecomviper/walmart/walmart-listing-quality.ts` | enum `high` / `medium` / `low` | Product Editor diagnostics | Relative importance of suggested fixes | Derived from penalty weights |
| `Validation / readiness summary` | `app/apps/ecomviper/walmart/products/[sku]/product-editor-client.tsx` | counts: blockers, warnings, info | Product Editor | Publish-readiness diagnostics | Derived live from validation + lane preview |
| Readiness status label | `app/apps/ecomviper/walmart/products/[sku]/product-editor-client.tsx` | `Ready for publish validation` / `Needs review` | Product Editor | Immediate publish-validation state | Derived |
| Merchant readiness label | `app/apps/ecomviper/walmart/products/[sku]/product-editor-client.tsx` | `Ready to publish` / `Needs review` / `Missing required fields` / `Unsafe claims need review` | Product Editor | Merchant-facing readiness wording | Derived |
| Publish status label | `app/apps/ecomviper/walmart/products/[sku]/product-editor-client.tsx` | `Idle` / `Needs review` / `Preview ready` / `Submitted` / `Failed` | Product Editor | State of guarded publish lane | Staged (preview-only path implemented) |
| Products list `source confidence` badge | `app/apps/ecomviper/walmart/products/products-client.tsx` | `high` / `medium` / `needs refresh` / `low` | Products table | Catalog confidence at SKU level | Derived from backfill confidence + content checks |
| Catalog match confidence | `lib/ecomviper/walmart/walmart-catalog-candidate-scoring.ts` | enum `exact` / `strong` / `moderate` / `weak` / `none` from score thresholds (`>=90`, `>=75`, `>=55`, `>=35`) | Backfill/match diagnostics | Reliability of catalog candidate match | Derived/internal |
| Source confidence summary | `lib/ecomviper/walmart/walmart-source-confidence.ts` | `overallConfidence`, `byAction`, `byConfidence`, `actionableFields` | Product Editor diagnostics | Trust/provenance quality of field updates | Derived/internal |
| Import per-product confidence | `app/api/ecomviper/walmart/products/import/route.ts` | `high` / `medium` / `low` / `null` | Import diagnostics + products UI | Confidence for match/search attempt diagnostics | Derived/internal |
| Docket section coverage | `lib/ecomviper/walmart/walmart-docket-freshness.ts` | section `coveragePercent` + status `fresh/stale/missing/pending_report/...` | Product Editor freshness panel logic | Content completeness/freshness by section | Derived |

## 2.3 iBrains Intelligence scoring signals

| Label / Signal | Location | Type / Example Values | Surface | Operator Meaning | Backing |
| --- | --- | --- | --- | --- | --- |
| `Agentic Visibility Score` (summary) | `app/apps/ecomviper/walmart/ibrains-intelligence/walmart-ibrains-intelligence-client.tsx`, `lib/ecomviper/walmart/walmart-ibrains-intelligence.ts` | 0-100 average opportunity score | iBrains summary card | Overall quality of generated opportunity set | Derived |
| `Opportunities Found` | same as above | integer count | iBrains summary card | Opportunity volume | Derived |
| `High-Impact Actions` | same as above | integer count where opportunity score `>=75` | iBrains summary card | Number of high-priority actions | Derived |
| `Compliance Warnings` | same as above | integer count where risk is not low | iBrains summary card | Compliance review pressure | Derived |
| `Strong Destinations` | same as above | integer count from top destination fits | iBrains summary card | Number of strong mapped destinations | Derived |
| Opportunity scores | `lib/ecomviper/walmart/walmart-ibrains-intelligence.ts` | `relevanceScore`, `citationPotentialScore`, `agenticVisibilityScore` (0-100) | iBrains opportunity table | Rank and compare recommendation rows | Derived |
| Destination fit score | `lib/ecomviper/walmart/walmart-ibrains-intelligence.ts` | `fitScore` 0-100; strong match threshold `>=55` | iBrains opportunity routing | Destination suitability for draft placement | Derived |
| Compliance risk | same as above | enum `low` / `medium` / `high` | iBrains opportunity table | Risk gating for approval workflow | Derived |
| Opportunity status | same as above | `new` / `draft_ready` / `needs_approval` / `approved` / `rejected` / `completed` / `monitoring` | iBrains opportunity table | Workflow state and approval posture | Derived |

## 2.4 Lane-mapped surfaces (Prompt Match, Semantic Gaps, Product Opportunities, Trust Signals)

| Label / Signal | Location | Type / Example Values | Surface | Operator Meaning | Backing |
| --- | --- | --- | --- | --- | --- |
| `Prompt Match` lane mapping | `lib/ecomviper/walmart/walmart-nav.ts`, `app/apps/ecomviper/walmart/activity/page.tsx` | mapped to activity log; result badges `success`/`warning`/`error` | Prompt Match (current route: Activity) | Operational event diagnostics, not prompt coverage scoring | Partial (runtime activity store) |
| `Semantic Gaps` lane mapping | `lib/ecomviper/walmart/walmart-nav.ts`, `app/apps/ecomviper/walmart/inventory/inventory-client.tsx` | low stock/out-of-stock lists + recent changes | Semantic Gaps (current route: Inventory) | Inventory risk diagnostics | Partial (draft path real; direct write disabled) |
| `Product Opportunities` lane mapping | `lib/ecomviper/walmart/walmart-nav.ts`, `app/apps/ecomviper/walmart/pricing/pricing-client.tsx` | price validation warnings + recent changes | Product Opportunities (current route: Pricing) | Pricing-quality diagnostics | Partial (draft path real; direct submit disabled) |
| `Trust Signals` lane mapping | `lib/ecomviper/walmart/walmart-nav.ts`, `app/apps/ecomviper/walmart/feeds/feeds-client.tsx` | feed status + `errorReport.length` | Trust Signals (current route: Feeds) | Feed/trust failure monitoring | Partial/staged (approval + write mode gates) |

## 3) Proposed Canonical Model (Implementation-Constrained)

This sprint resolves the broad architecture question by defining a minimal canonical model that maps existing implemented signals without inventing new formulas.

## 3.1 Canonical dimensions

| Canonical Dimension | Canonical Meaning | Current Implemented Source(s) | Type Now | Notes |
| --- | --- | --- | --- | --- |
| `ai_visibility_score` | Top-level Walmart readiness for AI discoverability/selection | `overallAiRecommendationReadinessScore` from coverage scorecard | number 0-100 | Canonical rollup for Command Center; cross-surface top label should map here |
| `prompt_match_coverage` | How well catalog aligns to buyer prompts | No dedicated prompt model yet; Prompt Match routes to activity log | diagnostic status + event evidence only | Constrained as `diagnostic_only` until dedicated prompt evidence exists |
| `semantic_gap_severity` | Severity of missing/misaligned product facts/content | `missingFieldRecommendations`, editor validation blockers/warnings, schema diagnostics | prioritized lists + counts | Canonical severity is list/count driven, not single numeric score yet |
| `opportunity_priority` | Ranked action potential for catalog/product improvement | Command Center `nextBestActions`; iBrains opportunity ranking | prioritized lists + optional scores | iBrains score is supporting ranking input, not top-level rollup |
| `trust_signal_health` | Trust/compliance/feed health affecting discoverability | `feedErrors`, feed statuses, iBrains compliance warnings/risk, compliance validation | counts + enums + statuses | Keep as health index dimensions, no single trust score currently |
| `catalog_readiness_coverage` | Portion of catalog with sufficient content/signals for workflows | `productsImported`, product confidence badges, freshness coverage, attribute completeness diagnostics | counts + percentages + confidence enums | Keep typed components; no single canonical percentage is implemented yet |

## 3.2 Supporting diagnostics (not top-level canonical rollups)

- Product-level listing quality score (`assessWalmartListingQuality().score`) is a per-SKU diagnostic component.
- iBrains opportunity scores (`relevanceScore`, `citationPotentialScore`, `agenticVisibilityScore`) are recommendation-ranking diagnostics.
- `aiConfidenceScore` is a confidence companion for the command-center rollup, not a second top-level visibility score.
- Match/source confidence (`exact/strong/moderate/weak/none`, `high/medium/low`) are trust/provenance diagnostics.

## 4) Score Ownership

| Dimension / Signal | Primary Owning Surface | Secondary Surfaces | Ownership Clarity |
| --- | --- | --- | --- |
| `ai_visibility_score` | Command Center coverage panel | Product Editor, iBrains (consume as context) | Clear |
| Product listing quality score | Product Editor | Command Center coverage inputs | Clear |
| `prompt_match_coverage` | Prompt Match lane | Command Center action planning | Unclear (lane is activity-log mapping today) |
| `semantic_gap_severity` | Command Center next actions + Product Editor validation | Semantic Gaps lane (inventory mapping) | Partial |
| `opportunity_priority` | Command Center next actions | Product Opportunities lane (pricing mapping), iBrains table | Partial |
| `trust_signal_health` | Trust Signals lane (feeds) + Command Center trust card | iBrains compliance summary | Partial |
| `catalog_readiness_coverage` | Products + Product Editor diagnostics | Command Center catalog/action cards | Partial |
| iBrains destination fit and opportunity scores | iBrains Intelligence | Command Center (future rollup candidate) | Clear |

## 5) Score Semantics

## 5.1 Interpretation rules

- Higher numeric values always mean better readiness/quality for that specific metric scope.
- Lower numeric values mean lower readiness/quality and should increase operator review priority.
- Counts are pressure indicators: higher count usually means more unresolved work/risk.

## 5.2 Rollup vs component vs diagnostic

- Rollup: `ai_visibility_score` (Command Center top-level readiness).
- Components: readiness subscores by group, product listing quality score.
- Diagnostics: prompt/activity evidence, semantic gap recommendation rows, trust/feed statuses, confidence/provenance signals.

## 5.3 Display and action behavior

- Rollups and components should be displayed to operators.
- Diagnostics should drive action queues and draft/review tasks.
- Recommendation-only and fixture-backed signals must be clearly labeled as non-execution contracts.

## 5.4 Persistence/derivation expectations (current)

- Persisted now: products, drafts.
- Runtime/fallback now: some activity/feed/network connection paths and lane-mapped diagnostics.
- Derived now: most visibility/readiness/opportunity/confidence scores.

## 5.5 Terms to avoid (to prevent drift)

Avoid introducing unlabeled top-level synonyms such as:

- `Optimization Score` (as a global Walmart score)
- `Readiness Score` (without dimension prefix)
- `Trust Score` (without explicit input contract)
- `Visibility Score` when referring to non-canonical per-surface diagnostics

Use explicit labels tied to this contract:

- `AI Visibility Score` (top-level rollup)
- `Listing Quality Score` (product diagnostic)
- `AI Confidence Score` (rollup confidence companion)
- `Opportunity Score` / `Destination Fit Score` (iBrains diagnostics)

## 6) Current Implementation Status

## Built/current

- Command Center cards and optimization coverage/readiness panel.
- Product Editor listing-quality score and readiness/publish-status diagnostics.
- iBrains opportunity scoring, compliance risk, destination fit, and summary counts.
- Products list/source-confidence and catalog match confidence plumbing.

## Partial/demo/fixture-backed

- Prompt Match, Semantic Gaps, Product Opportunities, Trust Signals are lane mappings to Activity/Inventory/Pricing/Feeds rather than dedicated score-native workflows.
- Feed/inventory/pricing direct execution remains staged/guarded.
- Coverage matrix includes static scaffold rows plus derived overlays.

## Missing/unclear

- Dedicated Prompt Match coverage score and prompt evidence model.
- Single persisted cross-surface score payload that all surfaces read.
- Canonical persisted trust-signal composite score.
- Durable long-term storage for all visibility timeline signals.

## Deferred

- Broad live execution rollout for feed/inventory/pricing/publish.
- External referral attribution metrics (ChatGPT/Copilot/Perplexity/Gemini) as production telemetry.

## 7) Source-Of-Truth Files Inspected

- `app/apps/ecomviper/walmart/page.tsx`: command center cards, queue panels, coverage/readiness panel labels.
- `lib/ecomviper/walmart/walmart-products.ts`: dashboard snapshot counts and activity/feed-derived rollups.
- `lib/ecomviper/walmart/walmart-agentic-optimization-coverage.ts`: coverage matrix, status taxonomy, readiness scoring contract.
- `app/apps/ecomviper/walmart/products/[sku]/product-editor-client.tsx`: agentic score ring, readiness/publish status labels, validation summaries.
- `lib/ecomviper/walmart/walmart-listing-quality.ts`: per-product quality scoring and severity-weighted recommendations.
- `app/apps/ecomviper/walmart/ibrains-intelligence/walmart-ibrains-intelligence-client.tsx`: iBrains score cards and opportunity table labels.
- `lib/ecomviper/walmart/walmart-ibrains-intelligence.ts`: opportunity scoring, risk classification, destination fit scoring.
- `app/apps/ecomviper/walmart/products/products-client.tsx`: source-confidence badge semantics.
- `lib/ecomviper/walmart/walmart-source-confidence.ts`: confidence/actions summary contract.
- `lib/ecomviper/walmart/walmart-catalog-candidate-scoring.ts`: candidate score-to-confidence thresholds.
- `lib/ecomviper/walmart/walmart-docket-freshness.ts`: section coverage/freshness signals.
- `lib/ecomviper/walmart/walmart-nav.ts`: lane-label to route ownership mapping.
- `app/apps/ecomviper/walmart/activity/page.tsx`: Prompt Match-mapped activity diagnostics.
- `app/apps/ecomviper/walmart/inventory/inventory-client.tsx`: Semantic Gaps-mapped inventory diagnostics.
- `app/apps/ecomviper/walmart/pricing/pricing-client.tsx`: Product Opportunities-mapped pricing diagnostics.
- `app/apps/ecomviper/walmart/feeds/feeds-client.tsx`: Trust Signals-mapped feed diagnostics.
- `lib/ecomviper/walmart/walmart-feeds.ts`: feed status/error storage behavior.
- `app/api/ecomviper/walmart/feeds/submit/route.ts`: approval/write gates and staged submit contract.
- `tests/ecomviper_walmart_agentic_optimization_coverage.test.ts`: readiness matrix and scorecard expectations.
- `tests/ecomviper_walmart_agentic_score_ring.test.ts`: product score ring threshold labels.
- `tests/ecomviper_walmart_ibrains_intelligence_scoring.test.ts`: iBrains score/risk summary expectations.
- `tests/ecomviper_walmart_route_contract.test.tsx`: dashboard/lane label and coverage panel contract evidence.

## 8) Builder Rules

- Do not add new Walmart score labels without updating `planning/apps/ecomviper/walmart/score-contract.md`.
- Do not create a new top-level score if one of the canonical dimensions already fits.
- Do not treat recommendation-only, fixture, or staged values as production analytics contracts.
- Keep UI labels, data model names, and planning terminology aligned.
- If a score feeds Command Center rollups, document input and output semantics in code comments/tests/planning.
- If a score drives draft/action creation, document threshold or decision rule in the owning module.
- Keep `AI Visibility Score` reserved for the top-level rollup semantics defined here.

## 9) Next Sprint Candidates (Not Commitments)

1. Align Prompt Match to a dedicated prompt-evidence workflow and define `prompt_match_coverage` payload shape.
2. Normalize Command Center rollup naming to `AI Visibility Score` while keeping compatibility aliases where needed.
3. Map Product Opportunities and Semantic Gaps lanes to explicit score-native diagnostics/actions instead of route aliases.
4. Connect Trust Signals health inputs into one documented, typed health payload for Command Center + Feeds.
5. Add focused tests that prevent label drift (`AI Visibility Score`, `AI Confidence Score`, `Listing Quality Score`).
6. Create fixtures explicitly tagged as fixture/staged so operators/builders do not mistake them for production score contracts.

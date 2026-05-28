# Walmart AI Visibility API Boundary

Last updated: 2026-05-18 (UTC)

Sprint: `sprint-005-walmart-ai-visibility-api-boundary`  
Type: Docs/planning boundary definition from implementation evidence

## 1) Purpose

Walmart now has canonical score vocabulary in `score-contract.md`, but current implementation still exposes multiple score/readiness payload shapes across Command Center, Product Editor, and iBrains Intelligence.

This boundary defines the first canonical API payload target for `ai_visibility_score` so builders can align:

- Command Center rollups,
- Product-level/editor context,
- iBrains recommendation context,
- Prompt Match / Semantic Gaps / Product Opportunities / Trust Signals lane diagnostics,
- queue/recommendation flows.

Primary objective: prevent score drift and label drift before broader production rollout.

## 2) Current Implementation Inventory

| File | Purpose | Score/signal names exposed | Current shape | Consumer surface | Backing | Boundary role |
| --- | --- | --- | --- | --- | --- | --- |
| `lib/ecomviper/walmart/walmart-agentic-optimization-coverage.ts` | Command-center readiness + optimization coverage derivation | `overallAiRecommendationReadinessScore`, `aiConfidenceScore`, `recommendationProbability`, `subscores`, `missingFieldRecommendations`, `nextBestActions` | `WalmartOptimizationCoverageAudit` object with nested `readiness` | Command Center (`/optiwal`) | Derived/scaffold mix | Primary producer (v0 source for canonical boundary) |
| `app/optiwal/page.tsx` | Command-center UI render | "AI Recommendation Readiness", "Confidence" labels and next actions | Coverage audit + command-center score rollup adapter | Command Center | Derived in server component | Consumer aligned to canonical score adapter |
| `lib/ecomviper/walmart/walmart-command-center-score-rollup.ts` | Command-center rollup adapter | canonical `WalmartAiVisibilityScore` mapping into readiness/confidence display values | `{ aiVisibilityScore, readinessScore, confidenceScore, confidenceLevel }` | Command Center | Derived | Consumer boundary adapter |
| `app/api/ecomviper/walmart/health/route.ts` | Authenticated Walmart health payload | `cards` (productsImported, draftChanges, feedErrors, listingsNeedingAttention), `connectionHealth` | `{ ok, mode, connectionHealth, cards }` | Connect page polling and potential command-center API consumers | Production-backed cards + derived counts | First canonical API boundary host (recommended) |
| `app/optiwal/connect/connect-client.tsx` | Connection workspace polling for health | `connectionHealth` payload fields | `WalmartHealthResponse` expects `{ ok, connectionHealth? }` and ignores extra fields | Connect workspace | API-backed | Existing consumer (should tolerate additive `ai_visibility_score`) |
| `lib/ecomviper/walmart/walmart-products.ts` | Dashboard snapshot counts and recent activity/products | `productsImported`, `draftChanges`, `feedErrors`, `listingsNeedingAttention` | `WalmartDashboardSnapshot` | Command Center + health route cards | Mixed persisted/runtime | Producer input to canonical boundary dimensions |
| `lib/ecomviper/walmart/walmart-listing-quality.ts` | Per-product listing quality diagnostics | `score`, `factors`, recommendation severities | `WalmartListingQualityAssessment` | Product Editor score ring/readiness helpers | Derived | Secondary producer (product diagnostic adapter) |
| `app/optiwal/products/[sku]/product-editor-client.tsx` | Product editor score/readiness UI | "Agentic Visibility Score", readiness labels, publish status | In-process canonical adapter consumption via `buildWalmartProductAiVisibilityDiagnostics` | Product Editor | Derived | Consumer (component-level diagnostic aligned to canonical score boundary) |
| `lib/ecomviper/walmart/walmart-ibrains-intelligence.ts` | iBrains opportunity scoring | `agenticVisibilityScore` (summary + per opportunity), destination fit, risk/status | `IBrainsIntelligenceRun` summary/opportunities object | iBrains Intelligence | Derived/recommendation engine | Secondary producer (opportunity diagnostics; not top-level canonical rollup) |
| `app/optiwal/ibrains-intelligence/walmart-ibrains-intelligence-client.tsx` | iBrains score presentation | "Agentic Visibility Score", opportunity/risk cards | Client-side run result object | iBrains UI | Derived | Consumer |
| `lib/ecomviper/walmart/walmart-nav.ts` | Lane labels/routes | Prompt Match / Semantic Gaps / Product Opportunities / Trust Signals mappings | Nav label -> route map | Sidebar/lane routing | Static | Naming/ownership adapter evidence |
| `tests/ecomviper_walmart_agentic_optimization_coverage.test.ts` | Readiness/coverage contract assertions | asserts readiness score + confidence + recommendations exist | Coverage/readiness expectations | CI contract for derived score inputs | Test fixture/derived | Contract guard for producer inputs |
| `tests/ecomviper_walmart_connect_auth.test.tsx` | Health route contract assertions | asserts `connectionHealth` and `cards` fields | health route payload expectations | CI contract for API host route | Test fixture/live-style route tests | Contract guard for API host route |

### Current contract gap

Canonical `ai_visibility_score` now exists in the health API boundary and command-center adapter path, but broader surface migration remains incomplete.

## 3) Proposed First Canonical Boundary

### 3.1 Boundary choice (smallest useful)

Use `GET /api/ecomviper/walmart/health` as the first canonical API boundary host and add an additive top-level field:

- `ai_visibility_score`

Rationale:

- Route already exists, is auth-scoped, and already aggregates command-center card inputs.
- Additive payload change is low-risk for existing consumers.
- It establishes one server/data-layer boundary before broader route refactors.

### 3.2 Canonical object (v0)

```ts
type WalmartAiVisibilityScore = {
  overall: number
  status: "excellent" | "good" | "warning" | "critical" | "unknown"
  dimensions: {
    prompt_match_coverage?: number
    semantic_gap_health?: number
    opportunity_priority?: number
    trust_signal_health?: number
    catalog_readiness_coverage?: number
  }
  confidence?: {
    value: number
    level?: "high" | "medium" | "low" | "unknown"
    reasons?: string[]
  }
  provenance?: {
    source: "fixture" | "demo" | "derived" | "api" | "walmart" | "unknown"
    generated_at?: string
    input_refs?: string[]
  }
  recommendations?: Array<{
    id: string
    label: string
    priority: "high" | "medium" | "low"
    surface?: string
  }>
}
```

### 3.3 v0 mapping from current implementation

- `overall` -> `overallAiRecommendationReadinessScore`.
- `confidence.value` -> `aiConfidenceScore`.
- `confidence.level` -> `recommendationProbability` mapped to `high|medium|low`.
- `recommendations` -> normalized from `nextBestActions`.
- `provenance.source` -> `derived` for current v0 implementation.
- `dimensions`:
  - include only dimensions with explicit implementation evidence,
  - omit unsupported dimensions instead of inventing formulas.

### 3.4 Compatibility note

Current labels like `overallAiRecommendationReadinessScore` remain internal/source names for now. API responses should publish canonical `ai_visibility_score` naming at the boundary and treat existing module labels as implementation details.

## 4) Score Ownership At This Boundary

- Command Center:
  - owns top-level rollup display and queue/action framing from `ai_visibility_score`.
- Product Editor:
  - consumes `ai_visibility_score` as context; keeps listing-quality score as product diagnostic.
- iBrains Intelligence:
  - consumes rollup context; keeps opportunity scoring as recommendation diagnostics.
- Prompt Match / Semantic Gaps / Product Opportunities / Trust Signals:
  - remain diagnostic contributors; canonical dimension values must only be populated when explicit producer logic exists.

Ownership gaps today:

- Prompt Match and Semantic Gaps are route-mapped placeholders (Activity/Inventory), so canonical dimension producers are still partial.

## 5) Score Semantics For Builders

- `ai_visibility_score.overall` is the only top-level Walmart AI visibility rollup.
- higher `overall` means stronger readiness; lower means higher intervention priority.
- component/diagnostic scores (listing quality, iBrains opportunity scores, confidence badges) must not be renamed as top-level rollups.
- unsupported dimensions stay omitted/unknown; do not synthesize values from placeholder UI copy alone.
- fixture/demo values must be explicitly marked in `provenance.source`.

## 6) Current Implementation Status

### Built/current

- Derivation logic exists for command-center readiness rollup + confidence + recommendations.
- Health API route now emits additive canonical `ai_visibility_score`.
- Command Center rollup display now consumes canonical values through `walmart-command-center-score-rollup.ts`.
- Product Editor score diagnostics now consume a canonical product-level adapter boundary through:
  - `lib/ecomviper/walmart/walmart-product-ai-visibility-score.ts`
  - `app/optiwal/products/[sku]/product-editor-client.tsx`
- Focused contract coverage now explicitly asserts adapter-input alignment and projected-score guardrails in:
  - `tests/ecomviper_walmart_product_ai_visibility_score.test.ts`
  - `tests/ecomviper_walmart_product_editor_score_alignment.test.tsx`
- Product/editor and iBrains score diagnostics are implemented and tested.

### Partial/demo/fixture-backed

- Lane semantics remain mapped placeholders for Prompt Match/Semantic Gaps/Product Opportunities/Trust Signals.
- Some queue/timeline/feed inputs remain runtime store based.
- Coverage matrix includes recommendation/scaffold rows by design.

### Missing/unclear

- Command Center and Product Editor are aligned through in-process adapters, but neither surface consumes canonical rollup via health-route fetch yet.
- No dedicated producer for some canonical dimensions (notably Prompt Match coverage).

### Deferred

- Broad production execution rollout and durable long-term analytics attribution.
- Full cross-surface consumer migration to boundary-first reads.

## 7) Source-of-Truth Files Inspected

- `app/optiwal/page.tsx`
- `lib/ecomviper/walmart/walmart-command-center-score-rollup.ts`
- `lib/ecomviper/walmart/walmart-ai-visibility-score.ts`
- `lib/ecomviper/walmart/walmart-product-ai-visibility-score.ts`
- `app/optiwal/products/[sku]/page.tsx`
- `app/optiwal/products/[sku]/product-editor-client.tsx`
- `app/optiwal/ibrains-intelligence/page.tsx`
- `app/optiwal/ibrains-intelligence/walmart-ibrains-intelligence-client.tsx`
- `app/optiwal/connect/connect-client.tsx`
- `app/api/ecomviper/walmart/health/route.ts`
- `app/api/ecomviper/walmart/products/route.ts`
- `app/api/ecomviper/walmart/products/[sku]/route.ts`
- `app/api/ecomviper/walmart/ai/generate/route.ts`
- `lib/ecomviper/walmart/walmart-products.ts`
- `lib/ecomviper/walmart/walmart-agentic-optimization-coverage.ts`
- `lib/ecomviper/walmart/walmart-listing-quality.ts`
- `lib/ecomviper/walmart/walmart-ibrains-intelligence.ts`
- `lib/ecomviper/walmart/walmart-nav.ts`
- `lib/ecomviper/walmart/walmart-types.ts`
- `tests/ecomviper_walmart_agentic_optimization_coverage.test.ts`
- `tests/ecomviper_walmart_command_center_score_rollup.test.ts`
- `tests/ecomviper_walmart_connect_auth.test.tsx`
- `tests/ecomviper_walmart_route_contract.test.tsx`
- `tests/ecomviper_walmart_product_ai_visibility_score.test.ts`
- `tests/ecomviper_walmart_product_editor_score_alignment.test.tsx`

## 8) Builder Guardrails

- Do not add new top-level Walmart AI score fields when `ai_visibility_score` can carry the value.
- Do not add new score labels without updating `score-contract.md` and this boundary file.
- Do not treat module-local names (`overallAiRecommendationReadinessScore`, product-level `Agentic Visibility Score`) as API boundary names.
- Keep route payload labels, planning docs, and tests aligned.
- Any new dimension must define:
  - producer module,
  - input refs,
  - provenance classification,
  - consumer surfaces.

## 9) Next Sprint Candidates (Not Commitments)

1. Move Command Center from canonical adapter consumption to boundary-first route consumption (`/api/ecomviper/walmart/health`) if/when dashboard data fetch path is centralized.
2. Add focused tests enforcing canonical payload keys and label consistency across command-center/editor/iBrains surfaces.
3. Define first production-backed dimension expansion (likely catalog readiness + trust health) with explicit provenance tagging.
4. Add product-editor context wiring to consume canonical rollup where appropriate without replacing per-SKU listing diagnostics.
5. Define prompt-match and semantic-gap producers for currently omitted/partial dimensions.

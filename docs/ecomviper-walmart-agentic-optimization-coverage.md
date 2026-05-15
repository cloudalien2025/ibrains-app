# EcomViper Walmart Agentic Optimization Coverage

## Purpose
This model provides an internal Walmart optimization coverage matrix and readiness scorecard for EcomViper.
It is designed to support Walmart proof-of-concept work for Agentic referrals by making optimization support explicit and auditable.

The model lives in:
- `lib/ecomviper/walmart/walmart-agentic-optimization-coverage.ts`

## Coverage Matrix Contract
Each optimization item includes:
- `id`
- `label`
- `group`
- `status`
- `priority`
- `agenticImpact`
- `apiPushability`
- `sourceInCode`
- `implementationNotes`

### Status Definitions
- `supported`: implemented in current app lane.
- `partial`: some implementation exists, but deterministic coverage is incomplete.
- `missing`: not represented in code.
- `recommendation_only`: represented as recommendation guidance but not direct API/feed push guarantee.
- `requires_credentials`: capability requires provider credentials (for example OpenAI/other connected systems).
- `requires_walmart_access`: capability depends on Walmart access scopes or approval not available in baseline lane.

### API Pushability Definitions
- `api_supported`: can be represented in current API/staged update flow.
- `feed_supported`: can be represented in maintenance feed payload path.
- `recommendation_only`: represented as advisory output only.
- `unknown`: no confirmed safe push path yet.

## Readiness Scorecard
The scorecard includes grouped subscores and an overall score:
- PDP Content
- Structured Attributes
- Images & Media
- FAQ Coverage
- Compliance Safety
- Search/AI Semantics
- Offer/Fulfillment Signals
- Brand Graph
- Analytics/Proof

Outputs:
- `overallAiRecommendationReadinessScore`
- `aiConfidenceScore`
- `recommendationProbability` (`low`/`medium`/`high`)
- `missingFieldRecommendations`

Notes:
- This scorecard is a readiness/probability indicator.
- It does **not** claim guaranteed ChatGPT/Copilot/Perplexity/Gemini referrals.

## UI Integration
The Walmart dashboard now includes a dedicated panel:
- `Walmart Agentic Optimization Coverage`
- coverage status counts
- grouped readiness subscores
- `Missing From Code`
- `Next Best Actions`
- matrix sample rows with explicit support labels and pushability labels

Primary dashboard selectors:
- `ecomviper-walmart-agentic-coverage-panel`
- `ecomviper-walmart-missing-from-code`
- `ecomviper-walmart-next-best-actions`

## Safe MVP Boundaries
Implemented safely without risky production write changes:
- no disabled auth/security/test/lint controls
- no fake live Walmart writes
- maintains staged draft/feed pattern
- maintains BYO key assumptions

## Current Gaps (Recommendation/Gated)
Some optimization families remain recommendation-only or gated, including:
- rich media module publishing
- comprehensive review mining/sentiment flows
- competitor benchmarking
- full attribution telemetry (impressions/CTR/conversions/AI referrals)
- WFS/shipping-badge eligibility and related fulfillment telemetry requiring Walmart access

These are intentionally surfaced as explicit gaps in the coverage matrix and next-action outputs.

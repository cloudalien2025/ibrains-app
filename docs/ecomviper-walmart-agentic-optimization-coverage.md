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

## Walmart Copywriter Reliability Lane
This lane improves deterministic reliability for Walmart supplement copy, image-derived enrichment, FAQ generation, and draft validation hardening.

Primary implementation areas:
- `lib/ecomviper/walmart/walmart-supplement-disclaimer.ts`
- `lib/ecomviper/walmart/walmart-compliance-agent.ts`
- `lib/ecomviper/walmart/walmart-image-intelligence.ts`
- `lib/ecomviper/walmart/product-facts-agent.ts`
- `lib/ecomviper/walmart/walmart-search-browse-mapper.ts`
- `app/apps/ecomviper/walmart/products/[sku]/product-editor-client.tsx`

### FDA Disclaimer Normalization
Supplement long descriptions are normalized to end with exactly one canonical FDA disclaimer:

`These statements have not been evaluated by the Food and Drug Administration. This product is not intended to diagnose, treat, cure, or prevent any disease.`

Reliability behavior:
- inserts disclaimer when missing
- deduplicates canonical/variant duplicates
- detects and repairs malformed disclaimer tails
- flags malformed or duplicate disclaimer cases during validation/compliance review
- flags disease/treat/cure/prevent language outside canonical disclaimer context

### Image-Derived Facts Seam
Image intelligence is deterministic and lightweight (no heavyweight OCR dependency additions in this lane).

Supported image-derived fact targets:
- `form`
- `count`
- `servingSize`
- `servingsPerContainer`
- `dosageStrength`
- `suggestedUse`
- `warnings` / `safety_warnings`
- `supportAreas`
- `activeIngredients` / `main_ingredients`

Low-confidence image facts are not promoted into canonical autofill payloads.

### Search & Browse Autofill
Search & Browse mapping now fills structured supplement fields from canonical facts + compliant copy while preserving protected-field safety and low-confidence filtering.

Key mapped fields include:
- identity: `brand`, `manufacturer`, `product_name`, `supplement_type`, `product_type`, `category`
- usage: `target_audience`, `suggested_use`, `directions_suggested_use`, `safety_warnings`
- composition: `product_form`, `form`, `main_ingredients`, `ingredients_list`, `dosage_strength`
- serving/package: `serving_size`, `servings_per_container`, `servings`, `count`, `count_per_pack`, `count_per_package`
- search intent: `search_keywords`, `search_terms`, `support_areas`

### FAQ Generation + Editor Behavior
Agentic copy generation now produces 5 to 8 product-specific FAQ snippets.

Editor integration:
- FAQ tab + editable FAQ textarea in draft editor
- FAQ persisted in draft payload (`faqSnippets`)
- clear UI label that FAQ output is recommendation-only enrichment (not direct Walmart API push field)
- stable selectors:
  - `ecomviper-walmart-faq-section`
  - `ecomviper-walmart-faq-textarea`
  - `ecomviper-walmart-search-browse-section`

### Validation Behavior
Validation now separates:
- blockers (`violations`)
- warnings (`warnings`)
- informational guidance (`suggestions`)

Reliability checks cover:
- disclaimer duplication/malformed variants
- repeated generated copy artifacts
- risky supplement claims
- missing FAQ after AI/facts extraction stage
- inferable-but-missing Search & Browse structured fields
- vague titles and missing key structured identity/ingredient/form/serving/use/safety fields after extraction

### Agentic Referral Readiness
These reliability upgrades improve answer-engine readiness by making copy + structured fields more deterministic, compliant, and machine-readable while staying within staged-draft safety boundaries.

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

# PDP Intelligence (Sprint 010)

Last updated: 2026-05-31 (UTC)

## Source-Grounded Contract

Generated PDP intelligence must be grounded to:

- Shopify listing fields
- matched supplier product fields
- parsed supplier diagnostics

The generator must not invent ingredients, certifications, testing claims, pricing claims, or inventory quantity.

Deterministic supplier facts are immutable inputs to generation. AI may summarize phrasing but may not alter factual source values.

## Public Output Safety

Public-facing text is sanitized to prevent disclosure of:

- supplier platform names
- supplier matching phrasing
- internal source URL language

## Field Families

- Overview: summary, use-cases, key features, highlights, quick facts
- Ingredients: supplement facts, ingredient lists/highlights, serving metadata
- Trust/Compliance: certifications, dietary attributes, manufacturing claims, warnings, COA
- Commerce: Shopify price/compare-at + supplier wholesale/MSRP/margin/profit + inventory status
- Agentic: FAQ coverage, intent/entity/semantic mappings, selection notes
- SEO/Schema: editable schema-readiness stubs for review

## Deterministic Inputs (Hotfix 009.3)

Generation now consumes pre-mapped supplier fields from ingestion:

- `supplementFacts.value`
- `activeIngredients`
- `amountPerServing`
- `servingSize`
- `servingsPerContainer`
- `otherIngredients`
- `coa.url`
- deterministic source diagnostics (`coa_link_status`, `coa_link_error`)

No generated output may fabricate ingredient/certification/COA claims when these inputs are unknown or unavailable.

## Deterministic Inputs (Hotfix 009.4)

Generation now also consumes selected membership-tier pricing context:

- `pricing.wholesaleCost` (selected tier)
- `pricing.membershipTier`
- `pricing.pricingStatusLabel`
- Shopify `price` / `compare_at_price`
- derived `estimated_profit` and `margin_percent` when inputs are present

If selected tier or cost source is unavailable, generation must preserve `unknown`/source-unavailable semantics and must not invent values.

## Stabilization 009.6 Guardrails

- Generation reads normalized supplier facts only.
- When normalized supplier facts are missing, generation runs in Shopify-limited mode with explicit warning:
  - `Supplier facts not synced. Generated copy will be limited to Shopify data.`
- Generation diagnostics must include source-fact usage and normalized record status fields.

## Hotfix 009.8 Source Facts + Stale Intelligence

Generate Intelligence uses the same `sourceFacts` object displayed by Product Editor.

Diagnostics returned from generation include:

- `normalized_sku`
- `supplier_product_record_status`
- `pricing_record_status`
- `inventory_record_status`
- `asset_record_status`
- `selected_membership_tier`
- `source_facts_used`
- `supplement_facts_status`
- `coa_link_status`
- `generated_from_source_version`
- `stale_intelligence_before_generation`

Saved generated intelligence is merchant-scoped and may be stale. If `last_generated_at` is older than the latest global supplier sync for the matched SKU, Product Editor shows:

`Source data has changed since this intelligence was generated. Regenerate to use latest source facts.`

Old generated `Unknown` values must not be used as source facts. Generation remains Shopify-limited when global supplier facts are missing, and public/generated copy must not mention supplier names, supplier matching, internal source URLs, or internal platform terminology.

Hotfix 009.9 behavior:

- Generation should consume Product Editor `sourceFacts` field families (key features, dietary attributes, certifications, manufacturing claims) before supplier fallback fields.
- When `supplement_facts_status=ocr_required`, generation must not invent ingredient details.

## Product Editor Gallery Relationship (Sprint 010)

- eBay PDP template remains a UX reference pattern (large image + thumbnail selector + top facts).
- EcomViper Product Editor implements this as native React workspace UI, not copied eBay HTML.
- Gallery and summary are display-layer consumers of existing `sourceFacts`/record state.
- Gallery redesign must not change supplier ingestion, extraction, OCR, or generation execution paths.

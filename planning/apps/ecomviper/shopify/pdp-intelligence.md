# PDP Intelligence (Sprint 009.3)

Last updated: 2026-05-30 (UTC)

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

# PDP Intelligence (Sprint 009)

Last updated: 2026-05-29 (UTC)

## Source-Grounded Contract

Generated PDP intelligence must be grounded to:

- Shopify listing fields
- matched supplier product fields
- parsed supplier diagnostics

The generator must not invent ingredients, certifications, testing claims, pricing claims, or inventory quantity.

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

# Product Editor Architecture (Sprint 009)

Last updated: 2026-05-29 (UTC)

## Layout

- BrainOS compact header
- status-chip row (Shopify, supplier match, inventory, COA)
- left rail: product identity and gallery
- center: tabbed workspace (`Overview`, `Ingredients`, `Trust & Compliance`, `Commerce`, `Agentic Visibility`, `Assets`, `SEO & Schema`)
- right rail: commerce intelligence, shipping, COA cards

## Interaction Model

- Generate: server-side source-grounded intelligence generation
- Save: persistence with tenant/workspace isolation
- Tabs reduce vertical scroll and keep high-priority controls above fold

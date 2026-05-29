# Sprint 006 Acceptance Criteria

Status: In progress
Date: 2026-05-29 (UTC)

## Functional Acceptance

1. `/ecomviper` sidebar uses the Sprint 006 simplified IA.
2. `/ecomviper` workspace includes a Shopify listings table with required columns and filters.
3. Product rows open `/ecomviper/products/[productId-or-handle]` PDP route.
4. PDP route renders all required section shells.
5. Rocktomic SKU match placeholder logic is implemented and test-covered.
6. Image Studio and EcomViper.com publishing are clearly marked as future/placeholder where not yet implemented.

## Security Acceptance

1. No Shopify tokens or secrets are rendered in client UI.
2. Product and connection reads remain user-scoped.
3. No supplier-private URLs or sensitive customer data are exposed.

## Regression Acceptance

1. Brain console contract tests continue passing with updated `/ecomviper` shell source.
2. New dashboard tests cover navigation labels, filter behavior, and row-to-editor routing.
3. New helper tests cover Rocktomic matching and inventory row mapping.

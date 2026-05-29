# Sprint 007 Acceptance Criteria

Status: In progress
Date: 2026-05-29 (UTC)

## Functional Acceptance

1. Rocktomic source configuration snapshot is implemented with configured + pending reference statuses.
2. Rocktomic supplier product model supports Sprint 007 required fields with source traceability.
3. SKU normalization and exact lookup return deterministic status, confidence, and reason.
4. `/ecomviper` inventory mapping surfaces supplier match details from SKU match results.
5. PDP Supplier Intelligence section shows matched supplier fields/statuses for matching SKU products.
6. `/ecomviper/dropshipping/rocktomic` route renders source status, reference status, SKU lookup, and sync/log placeholder shell.

## Security Acceptance

1. No Shopify tokens/secrets are rendered in UI.
2. No private supplier credentials are exposed.
3. Existing user-scoped Shopify data access remains intact.

## Regression Acceptance

1. Existing inventory foundation and PDP route tests remain passing.
2. New tests cover SKU normalization, exact lookup, confidence, unmatched behavior, and model shape.
3. New tests cover Rocktomic route shell and supplier panel contract text.

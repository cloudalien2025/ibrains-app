# Sprint 002 Summary

Status: Completed

## Goal

Formalize Shopify policy capability detection and telemetry, replacing ad-hoc fallback behavior with a capability-aware flow.

## Implemented Changes

- Added policy capability module:
  - `lib/ecomviper/shopify/shopify-policy-capabilities.ts`
  - policy field constants/types,
  - capability snapshot shape,
  - cache keying by store domain + API version,
  - 15-minute in-memory TTL cache,
  - GraphQL query builders for policy probe/hydration,
  - unsupported-field extraction helpers.
- Updated live hydrator:
  - `lib/ecomviper/shopify/shopify-live-hydrator.ts`
  - probe on cache miss,
  - capability-aware policy hydration query,
  - runtime capability refresh + retry when unsupported fields appear,
  - telemetry object for policy capability detection/hydration lifecycle,
  - warnings for probe partial/failure and policy hydration failure.
- Expanded regression tests:
  - `tests/ecomviper_shopify_live_workspace.test.ts`
  - capability-aware behavior when `privacyPolicy` is unsupported,
  - cache reuse on subsequent hydrations,
  - non-fatal policy hydration failure behavior.

## Preserved Behavior

- Existing workspace lane structure and source labeling behavior.
- Fallback snapshot path in workspace-state when live hydration throws.
- Non-policy hydration flows (core catalog + content hydration).

# Sprint 003 Summary

Status: Completed

## Goal

Harden Shopify policy capability determinism and telemetry contracts without changing workspace behavior.

## Implemented Outcomes

- Implemented deterministic unsupported policy-field extraction precedence.
- `error.path` now takes precedence over `error.message` parsing.
- Added extraction-source metadata with values:
  - `none`
  - `path`
  - `message`
  - `mixed`
- Added telemetry fields for probe/runtime extraction source.
- Added stable machine-readable warning codes.
- Preserved existing Shopify workspace behavior and fallback behavior.

## Files Changed

- `lib/ecomviper/shopify/shopify-policy-capabilities.ts`
- `lib/ecomviper/shopify/shopify-live-hydrator.ts`
- `tests/ecomviper_shopify_live_workspace.test.ts`
- `tests/ecomviper_shopify_policy_capabilities.test.ts`

## Test Results

- Passed test files: 2
- Passed tests: 11
- Command used:
  - `npm test -- --run tests/ecomviper_shopify_policy_capabilities.test.ts tests/ecomviper_shopify_live_workspace.test.ts`

## Follow-on Recommendation

- Sprint 004: typed warning/telemetry code contract shared across Shopify capability and hydration consumers.

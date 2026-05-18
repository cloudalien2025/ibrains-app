# Sprint 003 Blueprint

Status: Planned

## Implementation Strategy

1. Harden capability detection utilities.
2. Keep hydration flow unchanged at a high level (core -> policy optional -> content).
3. Add stable telemetry/warning contract values for capability flow observability.
4. Add targeted regression tests; avoid unrelated code churn.

## Proposed Change Areas

- `lib/ecomviper/shopify/shopify-policy-capabilities.ts`
  - Strengthen unsupported-field extraction precedence (structured path-first parsing, message parsing as fallback).
  - Return deterministic extraction metadata where useful for telemetry.
- `lib/ecomviper/shopify/shopify-live-hydrator.ts`
  - Use the strengthened extraction path consistently across probe and runtime refresh.
  - Emit stable warning identifiers/codes with current readable warning strings.
  - Preserve current hydration behavior, result shape, and fallback semantics.
- `tests/ecomviper_shopify_live_workspace.test.ts`
  - Add/adjust focused tests for deterministic extraction precedence.
  - Add/adjust tests for stable warning/telemetry signaling in probe failure and runtime refresh scenarios.
  - Re-assert no regression of existing live hydration and workspace source behavior.

## Design Guardrails

- Do not change workspace lanes or UI data model.
- Do not alter fallback snapshot trigger semantics.
- Keep API-surface changes minimal and backward-compatible.

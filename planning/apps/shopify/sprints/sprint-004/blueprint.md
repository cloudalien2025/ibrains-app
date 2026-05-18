# Sprint 004 Blueprint

Status: Planned

# Sprint 004
Shopify Product Editor Draft-to-Publish Workflow

## Intent

Based on `planning/apps/shopify/product-intent.md`, Step 3 currently supports draft editing but not publish execution. Sprint 004 introduces guarded review-to-publish workflow foundations without enabling real Shopify write operations yet.

## Implementation Strategy

1. Baseline current Step 3 behavior and codify local-only boundaries.
2. Introduce review-to-publish domain models (diff, confirmation, audit events, failure states).
3. Add UI workflow states for review and confirmation readiness.
4. Add a publish service boundary/adapter shape, but keep actual Shopify mutation disabled/deferred.
5. Add focused tests covering workflow semantics and safety constraints.

## Proposed Change Areas

- Product editor state + docket modules:
  - represent publish-intent payload shape,
  - compute and render structured draft diffs,
  - track confirmation and workflow status transitions.
- Product editor client (Step 3):
  - show explicit diff preview before publish intent can proceed,
  - require confirmation checkbox/action gate,
  - show audit events and failure recovery guidance,
  - keep existing "Save draft" / "Prepare update" semantics.
- Publish boundary module (new or existing adapter extension):
  - define non-mutating interface for future Shopify publish execution,
  - return deterministic "not enabled" or "dry-run" responses in Sprint 004.
- Tests:
  - Step 3 local-only baseline expectations,
  - diff preview correctness,
  - confirmation gating,
  - audit trail/failure recovery state behavior,
  - no live publish mutation invoked.

## Guardrails

- No live Shopify Admin product mutation in Sprint 004.
- Preserve current lane/page behavior and product editor tab flow.
- Avoid broad unrelated refactors.
- Keep source labels, hydration modes, and fallback behaviors unchanged.

## Output Of Sprint 004

By the end of Sprint 004, the product editor should be structurally ready for safe publish enablement in a follow-on sprint, but publish execution remains intentionally disabled.

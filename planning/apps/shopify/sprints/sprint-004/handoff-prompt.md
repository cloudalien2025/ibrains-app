# Sprint 004 Builder Handoff Prompt
# Shopify Product Editor Draft-to-Publish Workflow

You are the Builder for the iBrains EcomViper Shopify app.

Implement Sprint 004 only.

## Read First

1. README.md
2. planning/state.md
3. planning/decisions.md
4. planning/risks.md
5. planning/apps/shopify/overview.md
6. planning/apps/shopify/product-intent.md
7. planning/apps/shopify/sprints/sprint-003/summary.md
8. planning/apps/shopify/sprints/sprint-004/requirements.md
9. planning/apps/shopify/sprints/sprint-004/blueprint.md
10. planning/apps/shopify/sprints/sprint-004/acceptance-criteria.md

## Background

`product-intent.md` identifies a key gap: Step 3 in the Shopify product editor is currently draft-prep only and does not publish to Shopify Admin API.

Sprint 004 is to move toward a safe review-to-publish workflow foundation.

## Task

Before coding:

1. Inspect current Step 3 implementation in the product editor.
2. Identify what is local-only today (state changes, actions, non-persistent behavior).
3. Provide a concise implementation plan.

Then implement Sprint 004 scope:

- codify Step 3 local-only baseline,
- add diff preview workflow foundations,
- add explicit confirmation gate,
- add audit trail model + surfaced events,
- add failure recovery workflow states/messages,
- add focused regression tests.

## Preserve

- existing Shopify workspace behavior,
- existing product editor 3-step structure,
- existing source/hydration/fallback semantics,
- existing stabilization and capability logic in hydration paths.

## Do Not

- do not implement live Shopify publish mutations in Sprint 004,
- do not redesign workspace lanes,
- do not add marketplace features,
- do not perform broad unrelated refactors.

## Sprint 004 Safety Rule

Any publish action path must remain non-mutating in this sprint (disabled/dry-run/not-enabled behavior).

## Deliverables

Return:

- files changed
- Step 3 local-only findings
- diff/confirmation/audit/failure workflow behavior added
- tests run
- remaining risks
- recommended Sprint 005 (live guarded publish execution)

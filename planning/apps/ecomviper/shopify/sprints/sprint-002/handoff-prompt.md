# Sprint 002 Builder Handoff Prompt
# Shopify Capability Detection + Telemetry

You are the Builder for the iBrains EcomViper Shopify app.

Implement Sprint 002 only.

## Read First

1. README.md
2. AGENTS.md
3. planning/state.md
4. planning/decisions.md
5. planning/risks.md
6. planning/apps/ecomviper/shopify/overview.md
7. planning/apps/ecomviper/shopify/sprints/sprint-002/requirements.md
8. planning/apps/ecomviper/shopify/sprints/sprint-002/blueprint.md
9. planning/apps/ecomviper/shopify/sprints/sprint-002/acceptance-criteria.md

## Background

Sprint 001 stabilized Shopify hydration by retrying without unsupported policy fields.

Current fallback behavior still relies partly on parsing Shopify error messages.

Sprint 002 formalizes capability detection and telemetry.

## Task

Before coding:

1. Inspect the current Sprint 001 implementation.
2. Identify how Shopify policy-field fallback currently works.
3. Present a concise implementation plan.

Then implement:

- Shopify capability detection
- optional policy hydration separation
- capability-aware hydration behavior
- telemetry/warning reporting
- focused regression tests

## Preserve

- existing Shopify workspace behavior
- fallback snapshot behavior
- existing workspace sections
- current stabilization logic where appropriate

## Do Not

- redesign the Shopify workspace
- add marketplace features
- add AI optimization workflows
- perform broad unrelated refactors

## Deliverables

Return:

- files changed
- capability strategy used
- telemetry added
- tests run
- remaining risks
- recommended Sprint 003

Before coding, inspect the Sprint 001 implementation and provide a concise implementation plan for Sprint 002.

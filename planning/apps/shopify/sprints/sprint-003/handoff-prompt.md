# Sprint 003 Builder Handoff Prompt
# Shopify Capability Determinism + Telemetry Contract Hardening

You are the Builder for the iBrains EcomViper Shopify app.

Implement Sprint 003 only.

## Read First

1. README.md
2. planning/state.md
3. planning/decisions.md
4. planning/risks.md
5. planning/apps/shopify/overview.md
6. planning/apps/shopify/sprints/sprint-001/summary.md
7. planning/apps/shopify/sprints/sprint-002/summary.md
8. planning/apps/shopify/sprints/sprint-003/requirements.md
9. planning/apps/shopify/sprints/sprint-003/blueprint.md
10. planning/apps/shopify/sprints/sprint-003/acceptance-criteria.md

## Background

Sprint 001 stabilized Shopify hydration around policy schema mismatch failures.

Sprint 002 introduced policy capability probing, capability-aware hydration, cache reuse, runtime refresh fallback, and telemetry.

Remaining gap: unsupported-field detection still relies partly on free-form error-message parsing, and warning strings are not fully machine-stable.

## Task

Before coding:

1. Inspect the current Sprint 002 implementation.
2. Identify where deterministic and non-deterministic capability signals are used.
3. Present a concise implementation plan.

Then implement:

- deterministic capability signal handling improvements,
- capability-aware hydration behavior preservation,
- stable telemetry/warning contract hardening,
- focused regression tests.

## Preserve

- existing Shopify workspace behavior,
- fallback snapshot behavior,
- existing workspace sections,
- non-blocking policy hydration model.

## Do Not

- redesign the Shopify workspace,
- add marketplace features,
- add AI optimization workflows,
- perform broad unrelated refactors.

## Deliverables

Return:

- files changed
- deterministic capability strategy used
- telemetry/warning contract changes
- tests run
- remaining risks
- recommended Sprint 004

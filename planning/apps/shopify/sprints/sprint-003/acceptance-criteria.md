# Sprint 003 Acceptance Criteria

Status: Planned

## Functional Acceptance

1. Capability handling remains non-blocking for core hydration.
2. Unsupported policy fields are detected deterministically when structured GraphQL error paths are present.
3. Message regex parsing is used only as fallback and is reflected in telemetry.
4. Probe/cache/runtime-refresh telemetry statuses remain coherent and test-validated.
5. Warning outputs include stable machine-readable identifiers/codes and readable text.
6. Workspace source behavior (`live_shopify`, `demo`, `unavailable`) and fallback snapshot behavior remain unchanged.

## Regression Acceptance

1. Existing live hydration happy-path test continues to pass.
2. Existing `privacyPolicy` unsupported scenario continues to pass with capability-aware handling.
3. Existing cache reuse scenario continues to pass.
4. Existing policy-hydration-failure warning scenario continues to pass.
5. New Sprint 003 tests pass for deterministic extraction and warning/telemetry contract behavior.

## Out-of-Scope Enforcement

1. No workspace redesign artifacts are introduced.
2. No marketplace feature additions are introduced.
3. No broad unrelated refactors are introduced.

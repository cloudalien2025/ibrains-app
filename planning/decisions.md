# Planning Decisions

Last updated: 2026-05-18 (UTC)

## D-001 Keep Shopify Workspace Shape Stable

- Status: Accepted
- Decision: Stabilization work is constrained to hydration/capability internals and tests; no workspace redesign.
- Rationale: Existing workspace lanes and user flows are already covered by tests and should remain stable while backend resilience improves.

## D-002 Isolate Optional Policy Hydration from Core Hydration

- Status: Accepted
- Decision: Fetch core store/product data independently from policy data.
- Rationale: Unsupported policy schema fields (for example `privacyPolicy` on some stores/versions) must not fail core workspace hydration.

## D-003 Add Capability Detection with Cache Keyed by Store + API Version

- Status: Accepted
- Decision: Persist policy capability snapshot in memory with TTL and key format `normalizedStoreDomain:normalizedApiVersion`.
- Rationale: Reduces repeated probe calls and keeps behavior deterministic per store/version combination.

## D-004 Degrade to Warnings for Policy Capability/Hydration Failures

- Status: Accepted
- Decision: Policy probe/hydration failures append warnings and telemetry instead of throwing, unless core hydration has no usable data.
- Rationale: Preserves workspace availability and aligns with non-blocking policy enrichment.

## D-005 Preserve Snapshot Fallback Behavior

- Status: Accepted
- Decision: If live hydration throws, return fallback state when imported Shopify products are available.
- Rationale: Maintains existing workspace continuity and avoids regressions for partially connected environments.

## D-006 Track Capability Outcomes via Structured Telemetry Fields

- Status: Accepted
- Decision: Return `policyCapabilities` telemetry including detection source, probe status, hydration status, fallback usage, and event list.
- Rationale: Supports debugging and future instrumentation without changing workspace UI behavior.

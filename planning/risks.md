# Planning Risks

Last updated: 2026-05-18 (UTC)

## R-001 Error-Message Parsing Brittleness

- Severity: High
- Likelihood: Medium
- Description: Unsupported-field detection still partially depends on regex extraction from GraphQL error text.
- Impact: Shopify wording changes can reduce detection accuracy and cause unnecessary policy skips or retries.
- Mitigation: Sprint 003 should prioritize deterministic parsing paths (for example structured error path usage first) and explicit telemetry for parse mode.

## R-002 Capability Cache Staleness During Schema Changes

- Severity: Medium
- Likelihood: Medium
- Description: 15-minute in-memory TTL can preserve outdated capability assumptions after Shopify schema or app scope changes.
- Impact: Temporary partial hydration or extra fallback retries.
- Mitigation: Runtime refresh logic is already present; Sprint 003 should tighten refresh observability and warning codes.

## R-003 Limited Downstream Observability Contract

- Severity: Medium
- Likelihood: Medium
- Description: Warnings are human-readable strings without stable machine-readable codes.
- Impact: Harder to alert, trend, and debug reliably across environments.
- Mitigation: Sprint 003 should standardize warning/telemetry identifiers while preserving existing warning semantics.

## R-004 Probe Overhead for Cold Cache Hydrations

- Severity: Low
- Likelihood: Medium
- Description: Capability probe adds an extra Shopify GraphQL round trip on cold starts.
- Impact: Increased latency for first hydration.
- Mitigation: Cache reuse is already implemented; keep probe lightweight and deterministic.

## R-005 Fallback Snapshot Data Drift

- Severity: Medium
- Likelihood: Medium
- Description: Fallback product snapshot may be stale relative to live storefront data.
- Impact: Users may see non-current product details when live hydration fails.
- Mitigation: Preserve explicit source labeling/warnings and continue encouraging live sync recovery.

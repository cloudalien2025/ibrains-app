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

## R-006 Planning Path Drift from Launcher Structure

- Severity: Medium
- Likelihood: Medium
- Description: Planning docs can drift from actual launcher app hierarchy (top-level app families and child apps).
- Impact: Sprint artifacts become harder to locate and path references become stale across handoff docs.
- Mitigation: Keep planning hierarchy mirrored to `ecomviper`, `studio`, `siteforge`, and `directoryiq`; treat `planning/apps/ecomviper/shopify/` as canonical Shopify planning path.

## R-007 Planning Drift From Implementation Reality

- Severity: High
- Likelihood: Medium
- Description: Planning docs can diverge from current code, routes, UI behavior, or tests.
- Impact: Builders implement incorrect scope or re-open already settled behavior.
- Mitigation: Require implementation-derived product-intent updates and source-of-truth file pointers before major sprint planning.

## R-008 Placeholder Or Demo Paths Mistaken For Production Behavior

- Severity: High
- Likelihood: Medium
- Description: Mock/preview/staged behavior can be interpreted as live execution capability.
- Impact: Incorrect rollout assumptions and unsafe execution expectations.
- Mitigation: Label placeholder/demo behavior explicitly in product-intent and sprint docs; treat live execution as separately gated scope.

## R-009 Invented Requirements Without Source Evidence

- Severity: High
- Likelihood: Medium
- Description: Requirements may be added without support in implementation or approved planning files.
- Impact: Scope creep, rework, and architecture misalignment.
- Mitigation: Enforce \"no invented requirements\" policy in AGENTS + sprint handoff prompts.

## R-010 Broad Infrastructure Work Started Before Product Intent Baseline

- Severity: Medium
- Likelihood: Medium
- Description: Teams may begin refactors before defining the app/product baseline.
- Impact: Low-value churn and delayed operator outcomes.
- Mitigation: Require product-intent sprint completion before broad infrastructure expansion.

## R-011 Old Chat Context Used Instead Of Repo Planning Files

- Severity: Medium
- Likelihood: Medium
- Description: Builders may rely on prior conversation memory instead of in-repo planning docs.
- Impact: Decisions appear inconsistent and sprint continuity degrades.
- Mitigation: Enforce required read order rooted in AGENTS/README/planning docs.

## R-012 Pipeline/Local Check Mismatch

- Severity: Medium
- Likelihood: Medium
- Description: Local focused checks pass but CI pipeline fails due to missing parity or hidden constraints.
- Impact: Delivery delay and repeated MR churn.
- Mitigation: Record verification commands in MR description and fix only failing check families on same branch.

## R-013 Naming Drift Across Legacy Surfaces

- Severity: Medium
- Likelihood: Medium
- Description: Legacy names across routes/modules/docs can conflict with current product identity.
- Impact: Onboarding confusion and implementation mistakes.
- Mitigation: Maintain explicit naming-clarification sections and treat legacy names as compatibility/history context.

## R-014 AI Visibility Model Fragmentation Across Surfaces

- Severity: High
- Likelihood: Medium
- Description: Walmart currently exposes multiple visibility/readiness score models across Command Center, Product Editor, and iBrains Intelligence without one canonical typed contract.
- Impact: Operators and builders may interpret inconsistent scores as equivalent, causing triage and roadmap drift.
- Mitigation: Canonical vocabulary is documented in `planning/apps/ecomviper/walmart/score-contract.md` and first payload boundary is documented in `planning/apps/ecomviper/walmart/ai-visibility-api-boundary.md`; Sprint 007 aligns Command Center readiness/confidence rollups to canonical semantics via `walmart-command-center-score-rollup.ts` + focused tests. Continue migration for remaining surfaces before adding new score labels.

## R-015 Lane Semantics Drift (Label vs Route Responsibility)

- Severity: Medium
- Likelihood: High
- Description: Prompt Match/Semantic Gaps/Product Opportunities labels currently map to Activity/Inventory/Pricing routes rather than dedicated semantic workflows.
- Impact: Workflow expectations can diverge from implementation reality and increase delivery ambiguity for future sprints.
- Mitigation: Either formalize current mappings as intended behavior with clear copy or implement dedicated lane workflows and update nav semantics.

## R-016 Fixture/Recommendation Score Values Mistaken As Production Contract

- Severity: High
- Likelihood: Medium
- Description: Recommendation-only or fixture-derived readiness/opportunity values may be interpreted as stable production analytics contracts.
- Impact: Builders can overfit implementation to placeholder values, causing score contract breakage and operator confusion.
- Mitigation: Require score-label provenance tags (production-backed vs derived vs recommendation-only) in contract docs/tests and block new score labels unless `score-contract.md` is updated; preserve canonical adapter provenance metadata and keep command-center tests asserting canonical rollup-source usage.

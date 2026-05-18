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

## D-007 Enforce GitLab Sprint Delivery Flow for All Future Sprints

- Status: Accepted
- Decision: Every sprint must follow a strict GitLab delivery flow and can only proceed to the next sprint after MR merge and clean local `main`.
- Required flow:
  1. Start from clean main:
     - `git switch main`
     - `git pull`
     - `git status` must be clean
  2. Create sprint branch with format `sprint-###-short-description`
  3. Implement only approved sprint scope
  4. Run focused tests and relevant checks
  5. Commit with a clear sprint commit message
  6. Push branch to GitLab
  7. Create Merge Request
  8. Wait for GitLab checks/pipeline completion
  9. If checks fail: inspect failed job, fix only failure, rerun checks/tests, push fix to same branch
  10. When checks are green: merge MR
  11. Delete branch
  12. Reset local repo to main:
      - `git switch main`
      - `git pull`
      - `git status` must be clean
  13. Update `planning/state.md` with:
      - Sprint completed
      - MR number
      - Commit SHA if available
      - Tests/checks result
      - Next recommended sprint
- Rationale: Standardizes delivery quality gates, keeps sprint scope controlled, and ensures planning state stays synchronized with GitLab outcomes.

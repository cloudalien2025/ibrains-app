# DirectoryIQ Roadmap (Implementation-Grounded)

Last updated: 2026-05-18 (UTC)

## Purpose

Provide a phased, implementation-grounded roadmap from current DirectoryIQ product intent and sprint-001 scope.

## Phase 1: Foundation Shell and Planning Baseline

### Goals

- Establish architecture/builder planning documents.
- Align app presentation to a stable command-center shell (left nav + right workspace).
- Preserve existing DirectoryIQ behavior.

### Likely Deliverables

- Planning foundation docs (`architecture`, `builder`, `implementation-map`, `testing`, `roadmap`).
- Layout shell alignment under `app/directoryiq`.

### Non-Goals

- No API behavior changes.
- No new ingestion/publish automation.

## Phase 2: Workflow Contract Clarification

### Goals

- Tighten route-level and UI-level contracts for dashboard/listings/authority flows already implemented.
- Reduce ambiguity between overlapping authority/integrity surfaces.

### Likely Deliverables

- Focused contract tests for key operator transitions.
- Documentation updates for canonical workflow boundaries.

### Non-Goals

- No broad feature expansion.
- No cross-app architecture refactor.

## Phase 3: Runtime Ownership Consolidation

### Goals

- Clarify local-first vs proxy-owned route families.
- Improve operational predictability for settings/versions and adjacent flows.

### Likely Deliverables

- Ownership matrix by route family.
- Scoped implementation changes for one route family at a time.

### Non-Goals

- No disruptive big-bang migration.

## Phase 4: Guarded Execution Reliability

### Goals

- Strengthen Step 2 publish and Step 3 listing push reliability coverage where behavior already exists.
- Improve auditability around approval and job-state transitions.

### Likely Deliverables

- Focused test and observability coverage for guarded execution paths.
- Documentation of failure/recovery handling.

### Non-Goals

- No automatic large-scale execution rollout.

## Phase 5: Data and Authority Consistency Hardening

### Goals

- Improve consistency of readiness/authority inputs and integrity summaries.
- Reduce fallback-path ambiguity in mixed persistence/runtime conditions.

### Likely Deliverables

- Contract alignment updates and targeted data-quality safeguards.
- Planning updates for future deprecation/consolidation decisions.

### Non-Goals

- No speculative net-new product surfaces without implementation evidence.

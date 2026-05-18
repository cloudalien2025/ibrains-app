# SiteForge Roadmap (Implementation-Grounded)

Last updated: 2026-05-18 (UTC)

## Phase 1: Command Center Foundation

### Goals

- establish SiteForge architecture/builder planning docs
- introduce command-center shell layout (sidebar + workspace)
- preserve existing SiteForge behavior

### Deliverables

- `command-center-foundation.md`
- `builder-workflow.md`
- `architecture.md`
- `roadmap.md`
- lightweight layout/sidebar shell and focused shell tests

### Non-goals

- no API contract changes
- no orchestrator/build logic changes
- no persistence redesign

## Phase 2: Lane Contract Hardening

### Goals

- formalize Connect/Describe/Launch lane contract semantics
- increase UI contract test depth for lane rendering and status transitions

### Likely Deliverables

- lane contract doc updates
- focused route/client tests for phase switching and status cues

### Non-goals

- no broad workflow redesign

## Phase 3: Workspace Decomposition Evaluation

### Goals

- evaluate whether current monolithic workspace should split into dedicated sub-routes
- keep backward-compatible operator flow while reducing page complexity

### Likely Deliverables

- implementation map updates and candidate route plan
- incremental extraction of isolated read-only panels where safe

### Non-goals

- no full rewrite of SiteForge UI state machine in one sprint

## Phase 4: Operator Observability and Governance

### Goals

- improve visibility into run failures, storage health, and queue behavior from command center
- keep trust and publish safeguards explicit in operator UX

### Likely Deliverables

- surfaced diagnostics cards/panels tied to existing APIs
- focused contract tests around failure and degraded storage states

### Non-goals

- no automatic publish pathways beyond current guarded behavior

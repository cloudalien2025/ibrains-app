# Sprint 001: Hub Architecture Foundation

## Purpose

Create the first architecture/content baseline for EcomViper Hub at `/ecomviper/hub`, defining Hub as canonical product intelligence and orchestration control plane rather than a listing database.

## Scope

- Create Hub architecture markdown files under `planning/apps/ecomviper/hub/`
- Define product intent, architecture boundaries, workflows, data model concepts, integrations, and phased roadmap
- Document future UI zone structure and first sprint contract

## Non-Goals

- No route/UI implementation
- No API integration or ingestion implementation
- No database migrations
- No dependency or infrastructure changes
- No broad repo refactors

## Files Created

- `planning/apps/ecomviper/hub/README.md`
- `planning/apps/ecomviper/hub/overview.md`
- `planning/apps/ecomviper/hub/product-intent.md`
- `planning/apps/ecomviper/hub/roadmap.md`
- `planning/apps/ecomviper/hub/architecture.md`
- `planning/apps/ecomviper/hub/workflows.md`
- `planning/apps/ecomviper/hub/integrations.md`
- `planning/apps/ecomviper/hub/data-models.md`
- `planning/apps/ecomviper/hub/operations.md`
- `planning/apps/ecomviper/hub/ui-zones.md`
- `planning/apps/ecomviper/hub/sprints/sprint-001-hub-architecture-foundation.md`

## Expected Checks

- `git status`
- lightweight docs/markdown/route/frontdoor integrity check if available
- `git diff --stat`
- `git diff -- planning/apps/ecomviper/hub`

## Acceptance Criteria

- All required Hub architecture markdown files exist under `planning/apps/ecomviper/hub/`
- Files contain concrete starter content (not placeholders)
- Hub is clearly defined as canonical-first control plane
- Scope stays markdown-only and confined to Hub planning architecture folder
- Delivery completes full GitLab flow through merged MR and clean `main`

## Follow-Up Sprint Candidates

1. Sprint 002: Hub route shell and navigation entry
2. Sprint 003: typed canonical feed intake contracts
3. Sprint 004: canonical product match/merge review queue foundations
4. Sprint 005: routing decision queue and audit timeline MVP
5. Sprint 006: agentic visibility diagnostics and score vocabulary alignment

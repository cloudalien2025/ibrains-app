# EcomViper Hub Architecture Foundation

## Route

- App route: `/apps/ecomviper/hub`
- Production URL: `https://app.ibrains.ai/apps/ecomviper/hub`

## What EcomViper Hub Is

EcomViper Hub is the AI-native commerce intelligence and orchestration control plane for the EcomViper ecosystem.
It is intended to unify canonical product intelligence, marketplace feed aggregation, routing decisions, trust signals, and agentic visibility workflows across marketplace apps.

## Why Architecture Files Live In The Planning Tree

Hub architecture and planning docs live under `planning/apps/ecomviper/hub/`.
This keeps planning as source-of-truth documentation while app implementation at `/apps/ecomviper/hub` remains a future sprint deliverable.

## File Map

- `overview.md`: system context, boundaries, operator goals, assumptions
- `product-intent.md`: canonical product purpose and operating philosophy
- `roadmap.md`: phased rollout from architecture to intelligence APIs
- `architecture.md`: conceptual architecture and service boundaries
- `workflows.md`: end-to-end operational workflows
- `integrations.md`: marketplace, AI, telemetry, and trust integration plans
- `data-models.md`: conceptual entities and relationships
- `operations.md`: reliability, observability, audit, and quality operations
- `ui-zones.md`: future Hub UI zones and navigation philosophy
- `sprints/sprint-001-hub-architecture-foundation.md`: sprint scope and acceptance criteria

## Current Sprint Scope

- Create and maintain the Hub architecture/content foundation under `planning/apps/ecomviper/hub/`
- Define Hub as canonical-first product intelligence and orchestration, not a listing database
- Establish shared language for future Hub app-shell, feed, graph, routing, and visibility sprints

## Non-Goals

- No Hub app route or UI implementation in this sprint
- No marketplace API integration
- No feed ingestion implementation
- No database migration or persistence implementation
- No dependency changes
- No broad refactors outside Hub architecture docs

## Future Sprint Candidates

1. Add app shell + nav entry for `/apps/ecomviper/hub`
2. Define typed canonical feed intake contracts
3. Define canonical product graph write/read boundaries
4. Implement marketplace routing decision queue surface
5. Implement agentic visibility center metrics and review queues

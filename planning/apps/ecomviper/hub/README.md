# EcomViper Hub Architecture Foundation

## Route

- Private app route: `/apps/ecomviper/hub`
- Private production URL: `https://app.ibrains.ai/apps/ecomviper/hub`
- Preferred future public Hub surface: `https://ecomviper.com`

## What EcomViper Hub Is

EcomViper Hub is the AI-native commerce intelligence and orchestration layer for the EcomViper ecosystem.
It unifies canonical product intelligence, marketplace feed aggregation, routing decisions, trust signals, and agentic visibility workflows across marketplace apps.

## Why Architecture Files Live In The Planning Tree

Hub architecture and planning docs live under `planning/apps/ecomviper/hub/`.
Planning is the source of truth for architecture decisions, while implementation evolves in app routes and services through scoped sprints.

## Surface Model

- Public Hub (`ecomviper.com`): public product intelligence and discovery layer
- Private Hub (`app.ibrains.ai/apps/ecomviper/hub`): merchant/operator control plane
- iBrains marketing (`ibrains.ai`): WordPress-served marketing surface
- Private app platform (`app.ibrains.ai`): authenticated app platform

## File Map

- `overview.md`: system context, boundaries, operator goals, assumptions
- `product-intent.md`: canonical product purpose and two-surface product model
- `roadmap.md`: phased rollout from architecture to private/public Hub implementation
- `architecture.md`: conceptual architecture, domain model, and data boundaries
- `workflows.md`: end-to-end operational and publication workflows
- `integrations.md`: marketplace, AI, telemetry, attribution, and platform integration direction
- `data-models.md`: conceptual entities and public/private publishing model
- `operations.md`: reliability, observability, publication governance, and safety operations
- `ui-zones.md`: private control-plane zones and conceptual public page families
- `sprints/sprint-001-hub-architecture-foundation.md`: initial Hub architecture baseline sprint
- `sprints/sprint-002-hub-planning-location-correction.md`: planning-location correction sprint
- `sprints/sprint-004-hub-public-surface-architecture.md`: public/private surface and domain architecture decision sprint

## Current Sprint Scope

- Document preferred Hub public/private surface model
- Document domain/infrastructure direction:
  - `ibrains.ai` WordPress marketing
  - `app.ibrains.ai` private app platform
  - `app.ibrains.ai/apps/ecomviper/hub` private Hub control plane
  - `ecomviper.com` preferred public Hub surface
- Document publication boundary and operational guidance as planning-only architecture

## Non-Goals

- No public route implementation
- No WordPress implementation changes
- No DNS/SSL/reverse proxy or hosting cutover
- No separate DigitalOcean droplet requirement in this sprint
- No database migrations or dependencies
- No marketplace API integration or ingestion implementation

## Future Sprint Candidates

1. Define private Hub publication queue and approval contracts
2. Define first production-backed marketplace feed sync boundary into private Hub
3. Define public-safe canonical projection contract for `ecomviper.com`
4. Implement first public Hub route family (`/products/{slug}`) behind approval-gated data boundary
5. Implement attribution loop from public Hub back into private Hub workflows

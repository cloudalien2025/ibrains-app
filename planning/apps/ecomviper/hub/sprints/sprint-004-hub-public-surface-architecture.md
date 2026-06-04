# Sprint 004: Hub Public Surface Architecture

## Purpose

Document the preferred public/private surface model and domain/infrastructure direction for EcomViper Hub as planning source of truth.

## Strategic Decision

EcomViper Hub operates as one product with two faces:

- Preferred public surface: `ecomviper.com`
- Private operator surface: `app.ibrains.ai/ecomviper/hub`

Marketplace apps optimize listings.
Private Hub receives optimized feeds and manages canonical commerce intelligence.
Public Hub exposes approved canonical intelligence for user and AI discovery.

## Domain / Infrastructure Decision

- `ibrains.ai`: iBrains marketing surface, expected WordPress-served
- `app.ibrains.ai`: private authenticated iBrains app platform
- `app.ibrains.ai/ecomviper/hub`: private Hub control plane
- `ecomviper.com`: preferred public Hub product intelligence/discovery layer

Architecture guidance:

- public Hub does not have to share infrastructure with `ibrains.ai`
- no separate DigitalOcean droplet is required by this planning decision yet
- `ecomviper.com` may initially share app infrastructure via hostname-based routing if safe
- `ecomviper.com` may later move to dedicated deployment for isolation, security, performance, scale, or release cadence

## Scope

- planning-only documentation updates in `planning/apps/ecomviper/hub/`
- explicit public/private model, publication boundary, and domain direction
- conceptual public URL families and publishing lifecycle guidance

## Non-Goals

- no public route implementation
- no WordPress migration or implementation changes
- no DNS/SSL/reverse proxy/droplet/hosting implementation
- no marketplace routing implementation
- no database/dependency/API ingestion implementation
- no app-shell behavior changes

## Files Updated

- `planning/apps/ecomviper/hub/README.md`
- `planning/apps/ecomviper/hub/overview.md`
- `planning/apps/ecomviper/hub/product-intent.md`
- `planning/apps/ecomviper/hub/architecture.md`
- `planning/apps/ecomviper/hub/roadmap.md`
- `planning/apps/ecomviper/hub/workflows.md`
- `planning/apps/ecomviper/hub/integrations.md`
- `planning/apps/ecomviper/hub/data-models.md`
- `planning/apps/ecomviper/hub/operations.md`
- `planning/apps/ecomviper/hub/ui-zones.md`
- `planning/apps/ecomviper/hub/sprints/sprint-004-hub-public-surface-architecture.md`

## Public / Private Surface Model

Public Hub (`ecomviper.com`) should provide:

- approved canonical product pages
- semantic discovery/search surfaces
- category/brand/use-case/comparison pages
- verified/trust signals
- marketplace routing outcomes
- AI-readable structured product intelligence

Private Hub (`app.ibrains.ai/ecomviper/hub`) should provide:

- feed sync intake from marketplace apps
- canonical match/merge governance
- publication approval controls
- routing/trust/compliance controls
- operational analytics and attribution feedback workflows

## Preferred Domain Model

- `ecomviper.com` is the preferred long-term public Hub surface
- `app.ibrains.ai/ecomviper/hub` is the private Hub control plane
- `ibrains.ai` remains WordPress marketing
- `app.ibrains.ai` remains private authenticated app platform
- `hub.ecomviper.com` is not the preferred long-term public surface

## Future Implementation Candidates

1. private publication queue contracts and approval status model
2. first production-backed private feed sync intake contract
3. public-safe canonical projection contract for `ecomviper.com`
4. first public product page family rollout (`/products/{slug}`)
5. public analytics and attribution loop into private Hub operations
6. infrastructure separation playbook if scaling/security criteria are reached

## Acceptance Criteria

- Hub planning docs explicitly document:
  - preferred public surface `ecomviper.com`
  - private surface `app.ibrains.ai/ecomviper/hub`
  - `ibrains.ai` WordPress marketing role
  - `app.ibrains.ai` private app platform role
- docs define public/private data boundary and publication lifecycle
- docs state no public routes or infrastructure changes are implemented in this sprint
- docs state no separate DigitalOcean droplet is required yet by this decision

## Checks

- `git status`
- `git diff --check`
- `git diff --stat`
- `bash scripts/check_route_signatures.sh`
- docs lint discovery command (run if available)

# EcomViper Hub Overview

## What EcomViper Hub Is

EcomViper Hub is the canonical commerce intelligence and orchestration layer for EcomViper.
It is designed to receive optimized marketplace feeds, normalize canonical product intelligence, preserve trust context, and power cross-marketplace routing and AI-native discovery decisions.

## Two Surface Model

Hub has two coordinated product faces:

1. Public Hub (`ecomviper.com`)
   - public product intelligence and discovery layer
   - approved canonical product pages and public discovery surfaces
2. Private Hub (`app.ibrains.ai/apps/ecomviper/hub`)
   - authenticated merchant/operator control plane
   - feed intake, canonicalization, publication governance, and routing operations

## Domain Model Context

- `ibrains.ai`: iBrains marketing site, expected WordPress-served
- `app.ibrains.ai`: private authenticated iBrains app platform
- `app.ibrains.ai/apps/ecomviper/hub`: private Hub control-plane route
- `ecomviper.com`: preferred long-term public Hub product intelligence/discovery surface

`hub.ecomviper.com` is not the preferred long-term public surface.

## Where Hub Fits Inside EcomViper

Hub sits above channel apps as the shared control plane.
Channel apps remain operational workspaces for channel execution, while Hub becomes the canonical intelligence center that coordinates signals, entity matching, publication readiness, and routing guidance.

## Relationship To Marketplace Apps

- Walmart, Shopify, eBay, Amazon apps: source and execution surfaces
- Private Hub: cross-channel canonical layer and orchestration center
- Public Hub: approved canonical intelligence exposure for discovery and routing
- Future marketplace apps: additional source/execution nodes connected to Hub contracts

Hub should aggregate and reconcile intelligence from channel apps rather than duplicate their full operational UIs.

## Why Hub Is Not A Marketplace Clone

Hub is not intended to behave like a shopper marketplace, affiliate catalog, or listing browser.
Its purpose is canonical intelligence governance and orchestration, not listing-database expansion.

## Why Hub Is Canonical-First

A listing-first model creates drift and duplicates conflicting product records per marketplace.
Hub instead starts from canonical product identity, then maps marketplace-specific offers and variants as attached execution contexts.

## System Boundaries

Inside Hub boundary:

- canonical product intelligence graph concepts
- feed aggregation and normalization planning
- visibility/publication governance planning
- routing and agentic intelligence planning
- trust and recommendation signal planning
- cross-channel audit and queue concepts

Outside Hub boundary (for now):

- full channel-specific edit/submit UX parity
- marketplace API write execution
- implemented public site routes and deployment infrastructure changes

## Target Operators

- commerce operations leads
- marketplace managers
- catalog intelligence operators
- AI optimization analysts
- trust/compliance reviewers

## Operator Goals

- understand true canonical product state across channels
- detect conflicts and opportunities across marketplace feeds
- approve public-safe publication states
- prioritize and route high-impact actions
- improve agentic visibility and recommendation readiness
- maintain auditable trust and quality posture

## Initial Assumptions

- channel apps continue as source/execution systems
- private Hub consumes channel outputs and maps them to canonical entities
- public Hub consumes approved canonical outputs only
- operator workflows require queue-first triage and clear audit trails
- early versions remain review-first before heavy automation

## Open Questions

1. What minimal canonical identifier contract should be required on day one?
2. Which channel feed should become the first production-backed intake path?
3. How should Hub expose unresolved canonical merge conflicts to operators?
4. Which trust/routing signals should gate public publication?
5. Which criteria should trigger separate deployment infrastructure for `ecomviper.com`?

# EcomViper Hub Overview

## What EcomViper Hub Is

EcomViper Hub is the canonical commerce intelligence and orchestration layer for EcomViper.
It is designed to receive marketplace feeds, normalize product intelligence, preserve trust context, and power cross-marketplace routing and AI-native discovery decisions.

## Where Hub Fits Inside EcomViper

Hub sits above channel apps as the shared control plane.
Channel apps remain operational workspaces for channel execution, while Hub becomes the canonical intelligence center that coordinates signals, entity matching, and routing guidance.

## Relationship To Marketplace Apps

- Walmart, Shopify, eBay, Amazon apps: source and execution surfaces
- Hub: cross-channel canonical layer and orchestration center
- Future marketplace apps: additional source/execution nodes connected to Hub contracts

Hub should aggregate and reconcile intelligence from channel apps rather than duplicate their full operational UIs.

## Why Hub Is Not A Marketplace Clone

Hub is not intended to behave like a shopper marketplace, affiliate catalog, or listing browser.
Its purpose is operational intelligence and orchestration, not storefront discovery for end consumers.

## Why Hub Is Canonical-First

A listing-first model creates drift and duplicates conflicting product records per marketplace. Hub instead starts from canonical product identity, then maps marketplace-specific offers and variants as attached execution contexts.

## System Boundaries

Inside Hub boundary:

- Canonical product intelligence graph concepts
- Feed aggregation and normalization planning
- Routing and agentic intelligence planning
- Trust and recommendation signal planning
- Cross-channel audit and queue concepts

Outside Hub boundary (for now):

- Full channel-specific edit/submit UX parity
- Marketplace API write execution
- Direct storefront/search experiences

## Target Operators

- Commerce operations leads
- Marketplace managers
- Catalog intelligence operators
- AI optimization analysts
- Trust/compliance reviewers

## Operator Goals

- Understand true canonical product state across channels
- Detect conflicts and opportunities across marketplace feeds
- Prioritize and route high-impact actions
- Improve agentic visibility and recommendation readiness
- Maintain auditable trust and quality posture

## Initial Assumptions

- Channel apps continue as source/execution systems
- Hub consumes channel outputs and maps them to canonical entities
- Operator workflows require queue-first triage and clear audit trails
- Early versions should be review-first before heavy automation

## Open Questions

1. What minimal canonical identifier contract should be required on day one?
2. Which channel feed should become the first production-backed intake path?
3. How should Hub expose unresolved canonical merge conflicts to operators?
4. Which signals should gate automatic routing versus manual review?
5. What should be the first stable API surface for downstream agentic consumers?

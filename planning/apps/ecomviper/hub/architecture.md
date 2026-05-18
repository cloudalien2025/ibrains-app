# EcomViper Hub Architecture

## Surfaces And Routes

- Private Hub control plane route: `/apps/ecomviper/hub`
- Private production surface: `https://app.ibrains.ai/apps/ecomviper/hub`
- Preferred public Hub surface: `https://ecomviper.com` (future public discovery/product-intelligence surface)

## Two-Surface Architecture

Hub architecture uses one canonical intelligence core with two delivery surfaces:

1. Public surface (`ecomviper.com`)
   - public product intelligence and discovery
   - public canonical product pages and semantic/public trust surfaces
2. Private surface (`app.ibrains.ai/apps/ecomviper/hub`)
   - authenticated merchant/operator control plane
   - feed intake, canonicalization, visibility/routing controls, trust/compliance operations

`hub.ecomviper.com` is not the preferred long-term public Hub surface.
It may be treated only as a transitional alternative if ever needed.

## Domain And Infrastructure Model

- `ibrains.ai`: iBrains marketing site, expected WordPress-served
- `app.ibrains.ai`: private authenticated iBrains app platform
- `app.ibrains.ai/apps/ecomviper/hub`: private Hub control plane
- `ecomviper.com`: preferred public Hub product intelligence/discovery layer

Infrastructure direction:

- Do not assume `ecomviper.com` must share infra with `ibrains.ai`
- Do not require a separate DigitalOcean droplet yet
- `ecomviper.com` may initially share existing app infrastructure using hostname-based routing if operationally safe
- `ecomviper.com` may later move to separate deployment infrastructure for traffic isolation, security boundaries, SEO/public performance, scaling, or independent release cadence

This document is architectural guidance only. It does not implement DNS, SSL, reverse proxy, hostname routing, droplets, or hosting changes.

## App Architecture (Conceptual)

Hub architecture is organized around canonical intelligence first, then orchestration:

1. Feed intake layer
2. Canonical product graph layer
3. Routing/orchestration layer
4. Agentic intelligence layer
5. Discovery/query layer
6. Audit/event layer
7. Publication/public-surface layer

## Canonical Product Graph Concept

The canonical graph represents product truth independent of any single marketplace listing.
Marketplace records are linked as mapped artifacts with provenance and confidence, not merged blindly into one listing row.

## Feed Intake Layer

Feed intake should:

- accept structured channel payloads
- validate schema and source metadata
- classify errors and route to review queues
- preserve raw source evidence for audit and replay

## Marketplace Listing vs Canonical Product Distinction

- Canonical product: identity + normalized intelligence + trust posture
- Marketplace listing: channel-specific representation and constraints

Hub should model both distinctly and maintain explicit mapping between them.

## Marketplace Offer / Variant Model

Offer and variant context should remain channel-aware while referencing canonical identity.
Examples include price, inventory, fulfillment mode, packaging differences, and variant-level identifiers.

## Public / Private Data Boundary

Private-only domains include:

- raw feed submissions
- merchant notes and operator diagnostics
- merge conflict internals and decision rationale
- trust/compliance escalations not approved for public display
- internal routing policies and operational queue metadata

Public-safe domains include approved canonical outputs such as:

- public product identity and canonical summaries
- approved marketplace offers and outbound routing links
- approved trust/verification markers
- public schema metadata and discovery-facing content

Boundary rule:

- Public Hub must never expose private merchant/operator data from `app.ibrains.ai`.

## Publishing Lifecycle

1. Optimized marketplace feed is synced into private Hub.
2. Canonical product is matched or created.
3. Intelligence, trust, and routing signals are computed.
4. Merchant/operator approves visibility and publication eligibility.
5. Approved canonical product page becomes eligible for public publication.
6. Public Hub (`ecomviper.com`) serves approved canonical intelligence and marketplace routing.

## Routing Layer

Routing layer should translate canonical insights into action recommendations:

- channel destination
- priority and reason
- review requirements
- execution gate

## Agentic Intelligence Layer

Agentic layer should produce diagnostics and recommendation signals using canonical context, semantic coverage, trust posture, and historical outcomes while maintaining explicit confidence and auditability.

## Discovery Layer

Discovery layer should support operator and internal-agent querying across canonical entities, mapped listings, routing states, and trust evidence.
Public discovery surfaces should consume only approved public-safe projections.

## Public URL Concepts (Conceptual Only)

- `ecomviper.com/products/{canonical-product-slug}`
- `ecomviper.com/search`
- `ecomviper.com/categories/{category-slug}`
- `ecomviper.com/brands/{brand-slug}`
- `ecomviper.com/use-cases/{use-case-slug}`
- `ecomviper.com/verified`

These are conceptual architecture targets; routes are not implemented by this sprint.

## Event / Audit Flow

All high-impact state transitions should emit auditable events, including:

- feed ingestion outcomes
- canonical merge decisions
- visibility/publication decisions
- routing decisions
- manual override actions
- automation queue transitions
- unpublish/suppression actions

## Service Boundaries

Suggested conceptual service boundaries:

- Intake service (ingest/validate/classify)
- Canonical graph service (match/merge/conflict)
- Routing service (queue/decision/dispatch)
- Intelligence service (signals/scoring/recommendations)
- Publication service (approval/public projection/publish state)
- Audit service (event timeline/evidence)

## Persistence Considerations

Persistence should eventually support:

- immutable source evidence snapshots
- canonical entity versions
- mapping confidence history
- queue lifecycle history
- publication eligibility and public visibility state history
- auditable operator/automation decisions

This sprint does not define migrations or schemas; it only defines conceptual persistence direction.

## Initial Implementation Principles

- Canonical-first before listing-first
- Explicit confidence/provenance on non-trivial merges
- Queue-first workflows for high-risk actions
- Approval-gated public publication
- Reviewable automation, not opaque mutation
- Stable domain language across Hub and channel apps
- Strict public/private data separation

# EcomViper Hub Architecture

## Intended App Route

- Intended route: `/apps/ecomviper/hub`
- Production target: `https://app.ibrains.ai/apps/ecomviper/hub`

## App Architecture (Conceptual)

Hub architecture is organized around canonical intelligence first, then orchestration:

1. Feed intake layer
2. Canonical product graph layer
3. Routing/orchestration layer
4. Agentic intelligence layer
5. Discovery/query layer
6. Audit/event layer

## Canonical Product Graph Concept

The canonical graph represents product truth independent of any single marketplace listing. Marketplace records are linked as mapped artifacts with provenance and confidence, not merged blindly into one listing row.

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

## Event / Audit Flow

All high-impact state transitions should emit auditable events, including:

- feed ingestion outcomes
- canonical merge decisions
- routing decisions
- manual override actions
- automation queue transitions

## Service Boundaries

Suggested conceptual service boundaries:

- Intake service (ingest/validate/classify)
- Canonical graph service (match/merge/conflict)
- Routing service (queue/decision/dispatch)
- Intelligence service (signals/scoring/recommendations)
- Audit service (event timeline/evidence)

## Persistence Considerations

Persistence should eventually support:

- immutable source evidence snapshots
- canonical entity versions
- mapping confidence history
- queue lifecycle history
- auditable operator/automation decisions

This sprint does not define migrations or schemas; it only defines conceptual persistence direction.

## Initial Implementation Principles

- Canonical-first before listing-first
- Explicit confidence/provenance on non-trivial merges
- Queue-first workflows for high-risk actions
- Reviewable automation, not opaque mutation
- Stable domain language across Hub and channel apps

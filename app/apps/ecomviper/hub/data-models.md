# EcomViper Hub Data Models (Conceptual)

This document defines conceptual entities for Hub architecture. It does not define migrations or physical schemas.

## Hub Merchant

Represents an operator or merchant workspace boundary using Hub capabilities.

## Feed Submission

Represents a submitted source feed package with source metadata, validation status, and diagnostics.

## Source Marketplace

Represents channel origin context (Walmart, Shopify, eBay, Amazon, future channels).

## Marketplace Listing

Represents a channel-specific listing record mapped to canonical products.

## Canonical Product

Represents normalized product identity and canonical intelligence context independent of channel-specific listing representation.

## Canonical Product Attribute

Represents normalized product attributes attached to canonical products with source provenance and confidence context.

## Canonical Identifier

Represents identifier evidence (SKU family, UPC/GTIN, item IDs, internal IDs) used for canonical matching and conflict resolution.

## Marketplace Offer

Represents channel-specific commercial context (price, fulfillment, inventory posture, eligibility markers).

## Marketplace Variant

Represents variant-level distinctions mapped to canonical identity and offer context.

## Product Intelligence Signal

Represents scored or classified intelligence signal tied to canonical product quality, completeness, and discoverability posture.

## AI Retrieval Score

Represents retrieval-oriented signal used to estimate AI discoverability readiness.

## Agentic Selection Score

Represents selection-oriented signal used to estimate recommendation/selection fitness in agentic workflows.

## Semantic Coverage Signal

Represents semantic intent coverage and content gap diagnostics.

## Trust Signal

Represents trust/compliance/provenance signal that influences merge confidence and routing posture.

## Routing Decision

Represents a decision record linking canonical insight to a channel/action destination with priority and execution gates.

## Audit Event

Represents immutable event timeline entries for ingestion, merge, routing, review, and override actions.

## Automation Queue Item

Represents actionable queue units with lifecycle states (`queued`, `in_review`, `approved`, `dispatched`, `blocked`, `resolved`).

## Entity Relationship Direction (High-Level)

- `Hub Merchant` owns `Feed Submission` context
- `Feed Submission` emits `Marketplace Listing` candidates
- `Marketplace Listing` maps to `Canonical Product`
- `Canonical Product` contains `Canonical Product Attribute` and `Canonical Identifier`
- `Canonical Product` links to `Marketplace Offer` and `Marketplace Variant`
- Signals (`Product Intelligence Signal`, `AI Retrieval Score`, `Agentic Selection Score`, `Semantic Coverage Signal`, `Trust Signal`) attach to canonical and mapping contexts
- `Routing Decision` creates/updates `Automation Queue Item`
- Every major transition emits `Audit Event`

# EcomViper Hub Data Models (Conceptual)

This document defines conceptual entities for Hub architecture.
It does not define migrations or physical schemas.

## Core Entities

### Hub Merchant

Represents an operator or merchant workspace boundary using private Hub capabilities.

### Feed Submission

Represents a submitted source feed package with source metadata, validation status, and diagnostics.

### Source Marketplace

Represents channel origin context (Walmart, Shopify, eBay, Amazon, future channels).

### Marketplace Listing

Represents a channel-specific listing record mapped to canonical products.

### Canonical Product

Represents normalized product identity and canonical intelligence context independent of channel-specific listing representation.

### Canonical Product Attribute

Represents normalized product attributes attached to canonical products with source provenance and confidence context.

### Canonical Identifier

Represents identifier evidence (SKU family, UPC/GTIN, item IDs, internal IDs) used for canonical matching and conflict resolution.

### Marketplace Offer

Represents channel-specific commercial context (price, fulfillment, inventory posture, eligibility markers).

### Marketplace Variant

Represents variant-level distinctions mapped to canonical identity and offer context.

### Product Intelligence Signal

Represents scored or classified intelligence signal tied to canonical product quality, completeness, and discoverability posture.

### AI Retrieval Score

Represents retrieval-oriented signal used to estimate AI discoverability readiness.

### Agentic Selection Score

Represents selection-oriented signal used to estimate recommendation/selection fitness in agentic workflows.

### Semantic Coverage Signal

Represents semantic intent coverage and content gap diagnostics.

### Trust Signal

Represents trust/compliance/provenance signal that influences merge confidence and routing posture.

### Routing Decision

Represents a decision record linking canonical insight to a channel/action destination with priority and execution gates.

### Audit Event

Represents immutable event timeline entries for ingestion, merge, routing, review, publication, and override actions.

### Automation Queue Item

Represents actionable queue units with lifecycle states (`queued`, `in_review`, `approved`, `dispatched`, `blocked`, `resolved`).

## Public / Private Publishing Entities

### Canonical Product Visibility Status

Represents private control-plane visibility state for a canonical product (for example `hidden`, `review_required`, `public_eligible`).

### Public Publication Status

Represents publication lifecycle state for public Hub exposure (for example `draft`, `approved`, `published`, `suppressed`, `unpublished`).

### Public Slug

Represents approved public route identifier for a canonical product page on `ecomviper.com`.

### Public-Safe Summary

Represents curated public-safe summary content approved for public discovery surfaces.

### Private Merchant Notes

Represents private operator/merchant-only notes that must never be exposed to public Hub.

### Approved Marketplace Offer

Represents marketplace offer data approved for public routing exposure.

### Routing Policy

Represents rule configuration controlling marketplace routing eligibility and preference at canonical or offer scope.

### Trust Verification Status

Represents publication-facing trust posture used for verified/trust public surfaces.

### Public Schema Metadata

Represents structured metadata payload generated for public AI/search readability.

### Public Analytics Event

Represents public-surface discovery events (view/search/click/routing intent) captured from `ecomviper.com`.

### Attribution Event

Represents attribution linkage between public discovery/routing events and downstream marketplace outcomes.

### Publication Audit Event

Represents immutable lifecycle events for approve/publish/unpublish/suppress decisions.

### Public/Private Field Classification

Represents field-level governance tag (`public_safe`, `private_only`, `review_required`) used to enforce publication boundaries.

### Hosting / Deployment Target Metadata (Optional)

Represents conceptual deployment target metadata for publication outputs (shared-host routing versus dedicated deployment) without binding this sprint to infrastructure changes.

## Entity Relationship Direction (High-Level)

- `Hub Merchant` owns private `Feed Submission` context
- `Feed Submission` emits `Marketplace Listing` candidates
- `Marketplace Listing` maps to `Canonical Product`
- `Canonical Product` contains `Canonical Product Attribute` and `Canonical Identifier`
- `Canonical Product` links to `Marketplace Offer` and `Marketplace Variant`
- Signals (`Product Intelligence Signal`, `AI Retrieval Score`, `Agentic Selection Score`, `Semantic Coverage Signal`, `Trust Signal`) attach to canonical and mapping contexts
- `Routing Decision` creates/updates `Automation Queue Item`
- `Canonical Product Visibility Status` and `Public Publication Status` govern public exposure
- `Public/Private Field Classification` gates which fields can populate `Public-Safe Summary` and `Public Schema Metadata`
- `Publication Audit Event` tracks approve/publish/unpublish/suppress transitions
- `Public Analytics Event` and `Attribution Event` loop outcomes back into private Hub operations

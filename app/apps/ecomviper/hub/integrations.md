# EcomViper Hub Integrations

## Current Integration Direction

Hub is designed to integrate with channel apps and intelligence systems as a canonical orchestration layer.

## EcomViper / Walmart

- Walmart should provide listing/feed/diagnostic source signals to Hub
- Hub should return canonical/routing guidance consumable by Walmart workflows

Assumptions:

- Walmart remains a primary execution surface
- Hub does not replace Walmart lane-specific operations

Unknowns:

- First production-backed payload boundary for Hub ingestion

## EcomViper / Shopify

- Shopify data can serve as high-quality source context for canonical matching and enrichment
- Hub should consume normalized Shopify outputs, not raw ad hoc payloads

Assumptions:

- Shopify remains a key source catalog contributor

Unknowns:

- Priority order for Shopify-first vs Walmart-first feed contracts

## EcomViper / eBay

- eBay integration should provide listing and offer context for canonical mapping
- Hub should emit routing and remediation recommendations back to eBay surfaces

## EcomViper / Amazon

- Amazon integration should contribute product/listing/offer signal context when implemented
- Hub should preserve distinction between Amazon-specific listing constraints and canonical product identity

## Future Marketplaces (Etsy, TikTok Shop, WooCommerce)

- Future channel integrations should follow the same canonical intake contract pattern
- New channels should map to canonical entities and routing primitives without redefining core Hub vocabulary

## AI Systems

Hub should support AI systems that consume:

- canonical product context
- semantic coverage signals
- trust and routing evidence

Assumptions:

- AI systems require typed and auditable context

Unknowns:

- Initial model/provider contract and governance boundary

## Analytics And Telemetry Systems

Hub should integrate with telemetry systems to track:

- feed health and freshness
- merge quality outcomes
- routing decision performance
- agentic visibility trend changes

## Marketplace Routing / Referral Systems

Hub should interface with routing systems that consume action queues and decision metadata.
Routing contracts should preserve manual-review gates where confidence is low.

## Trust / Compliance Systems

Hub should aggregate trust and compliance signals from channel systems and internal checks.
Trust integration should support explainable risk posture and review workflows.

## Cross-Integration Unknowns

1. Which integration path becomes first production-backed path?
2. Which trust signals are mandatory for initial routing decisions?
3. Which telemetry fields become required for queue accountability?

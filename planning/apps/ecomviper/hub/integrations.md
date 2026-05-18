# EcomViper Hub Integrations

## Integration Direction

Hub integrates marketplace execution apps with canonical intelligence orchestration and publication governance.
The preferred surface model is:

- Public Hub: `ecomviper.com`
- Private Hub control plane: `app.ibrains.ai/apps/ecomviper/hub`
- iBrains marketing: `ibrains.ai` (WordPress)
- Private app platform: `app.ibrains.ai`

WordPress should not be assumed as the long-term host for public Hub product intelligence/discovery surfaces.

## Marketplace App -> Private Hub Sync

Marketplace apps are optimization/execution surfaces.
Private Hub is the canonical intake and governance surface.

Flow direction:

- EcomViper/Walmart, EcomViper/Shopify, EcomViper/eBay, EcomViper/Amazon
- optimized listing/feed outputs
- sync into private Hub (`app.ibrains.ai/apps/ecomviper/hub`)
- canonicalize, approve, and publish approved public-safe intelligence

## EcomViper / Walmart

- Walmart should provide listing/feed/diagnostic source signals to private Hub
- Private Hub should return canonical/routing guidance consumable by Walmart workflows

Assumptions:

- Walmart remains a primary execution surface
- Hub does not replace Walmart lane-specific operations

Unknowns:

- First production-backed Walmart -> Hub intake payload boundary

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

## Public Hub Publishing Integration (`ecomviper.com`)

Private Hub should publish approved canonical intelligence projections to public Hub.
Public Hub should serve only public-safe, approved outputs and routing links.

Public-facing families are expected to include:

- canonical product pages
- semantic/public discovery surfaces
- trust/verification surfaces
- marketplace routing/referral surfaces

## iBrains Platform Relationship

- `ibrains.ai`: WordPress-served iBrains marketing presence
- `app.ibrains.ai`: authenticated private app platform
- private Hub operates as an app surface inside `app.ibrains.ai`
- public Hub is preferred on `ecomviper.com`

## AI Systems And Search/Crawler Considerations

Hub should support AI/search consumers with:

- canonical product context
- semantic coverage signals
- trust and routing evidence
- structured metadata/schema outputs on public-safe pages

Assumptions:

- AI/search systems require typed and auditable context
- public metadata should be generated from approved canonical intelligence only

Unknowns:

- initial schema and metadata contract versioning strategy

## Analytics And Attribution Loop

Hub should support analytics flows that capture:

- public discovery and routing events on `ecomviper.com`
- attribution outcomes linked back to private Hub decisions
- optimization feedback loops into marketplace app workflows

## Marketplace Routing / Referral Systems

Hub should interface with routing systems that consume action queues and decision metadata.
Routing contracts should preserve manual-review gates where confidence is low.

## Trust / Compliance Systems

Hub should aggregate trust and compliance signals from channel systems and internal checks.
Trust integration should support explainable risk posture and review workflows before public publication.

## Infrastructure Deployment Notes

Infrastructure guidance:

- `ecomviper.com` may initially share existing app infrastructure with hostname-based routing if operationally safe
- `ecomviper.com` may later move to dedicated infrastructure for traffic isolation, security boundaries, SEO/public performance, scaling, or independent release cadence
- no separate DigitalOcean droplet is required by this planning decision yet

This sprint does not implement DNS, SSL, reverse proxy, hostname routing, or deployment changes.

## Cross-Integration Unknowns

1. Which integration path becomes first production-backed private Hub intake path?
2. Which trust signals are mandatory before publication to public Hub?
3. Which analytics fields become required for attribution-loop accountability?
4. Which criteria should trigger infrastructure separation for `ecomviper.com`?

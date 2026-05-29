# EcomViper Product Intent

Last updated: 2026-05-29 (UTC)

EcomViper is the multi-channel ecommerce operations family inside iBrains.

At the parent level, EcomViper intent is to provide a shared operator workspace model for channel-specific listing workflows with guarded execution patterns.

## App UX Boundary

- The route `/ecomviper` is an EcomViper-only brain workspace and does not act as a launcher for OptiBay, OptiWal, or OptiZon.
- Cross-brain navigation belongs to `/brains` where all standalone brains are listed equally.

## Parent Scope

EcomViper coordinates channel work across:

- Shopify
- Walmart
- eBay
- Amazon

Channel behavior and requirements are defined in channel planning docs and implementation, not invented at parent level.

## Sprint 006 UX Direction

- `/ecomviper` is Shopify-first with a Sellbrite-style listing workflow:
  - connect Shopify
  - view products table
  - open PDP editor
- Sidebar IA for this sprint:
  - Overview
  - Products
  - Product Editor / PDP Optimizer
  - Image Studio
  - Dropshipping (Rocktomic)
  - Agentic Visibility
  - Settings
- Hub is not treated as a separate IA concept in this sprint.
- Buy Now Links are part of PDP editor scope (modeled/placeholder).

## Sprint 007 UX Direction

- Rocktomic supplier intelligence moves from placeholder to typed SKU-backed foundation.
- Supplier match behavior is deterministic and exact-SKU-first with confidence + reason surfaced in UI.
- Merchants continue to use Shopify as product source-of-truth and do not manually upload Rocktomic files.
- Dropshipping -> Rocktomic is a platform/admin intelligence surface for source status, lookup, and future sync controls.

## Future Public Surface Direction (Preserved)

- EcomViper.com remains the future public optimized PDP surface.
- Future discoverability architecture should preserve:
  - crawlable public PDPs
  - schema: Product, Offer, FAQPage, Organization, BreadcrumbList, ImageObject
  - `robots.txt` AI crawler policy
  - `sitemap.xml` + product/brand/category sitemaps
  - `llms.txt`
  - `ai-products-feed.json`
  - future agent endpoints:
    - `/.well-known/agent.json`
    - `/api/agent/search`
    - `/api/agent/products/[slug]`
    - `/api/agent/answer`
    - `/api/agent/offers`
    - `/api/agent/compare`

## Planning Contract

- Parent docs define family-level direction and navigation.
- Channel docs are source of truth for implemented behavior, gaps, and sprint scope.
- Product intent should precede major infrastructure expansion.

## Source-of-Truth Pointers

- `planning/apps/ecomviper/overview.md`
- `planning/apps/ecomviper/shopify/product-intent.md`
- `planning/apps/ecomviper/walmart/product-intent.md`
- `planning/apps/ecomviper/ebay/product-intent.md`
- `planning/apps/ecomviper/amazon/product-intent.md`

# EcomViper Overview

Last updated: 2026-05-18 (UTC)

EcomViper is the iBrains parent app family for multi-channel commerce operations.

## Workspace Route Contract

- `/ecomviper` is the standalone EcomViper brain console for EcomViper-specific workflows.
- OptiBay (`/optibay`), OptiWal (`/optiwal`), and OptiZon (`/optizon`) are standalone commerce brains, not nested `/ecomviper` modules.
- EcomViper console UX may reference other commerce brains only through `/brains` (My Brains), not direct launcher cards/links.

## Channel Planning Structure

Channel-specific planning belongs under:

- `planning/apps/ecomviper/shopify/`
- `planning/apps/ecomviper/walmart/`
- `planning/apps/ecomviper/ebay/`
- `planning/apps/ecomviper/amazon/`

These planning roots are active in the current repository structure.

## Current Channel Surfaces

- Shopify: implemented workspace with established planning/sprint history.
- Walmart: implemented command-center workspace with implementation-derived planning baseline.
- eBay: implemented Phase 1 read-only mock-first dashboard with implementation-derived product intent baseline.
- Amazon: planning and route surface present, broader implementation pending.

## Planning Navigation

For family-level direction, start with:

- `planning/apps/ecomviper/product-intent.md`

For channel-specific implementation truth, use each channel's:

- `overview.md`
- `product-intent.md`
- sprint docs where present

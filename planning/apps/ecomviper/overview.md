# EcomViper Overview

Last updated: 2026-05-31 (UTC)

EcomViper is the iBrains parent app family for multi-channel commerce operations.

## Workspace Route Contract

- `/ecomviper` is the standalone EcomViper brain console for EcomViper-specific workflows.
- OptiBay (`/optibay`), OptiWal (`/optiwal`), and OptiZon (`/optizon`) are standalone commerce brains, not nested `/ecomviper` modules.
- EcomViper console UX may reference other commerce brains only through `/brains` (My Brains), not direct launcher cards/links.

## Shared Shell Contract

- `/ecomviper` and all `/ecomviper/*` pages use the global iBrains header + EcomViper sidebar + workspace layout.
- Global header rules:
  - zero blank space above header
  - iBrains logo links to `/brains`
  - includes Settings, Notifications, signed-in user identity, and Clerk log out
- EcomViper sidebar baseline:
  - Products
  - Image Studio (placeholder)
  - Dropshipping
  - Agentic Visibility (placeholder)
  - Settings

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

## Sprint 006 Foundation Direction

- `/ecomviper` is Shopify-first for this foundation sprint.
- Parent EcomViper workspace now centers on a simple inventory/listings table and PDP editor route flow.
- Hub is not modeled as a separate app concept in this sprint IA.
- Rocktomic is the first dropshipping supplier intelligence source (SKU-match placeholder contract).

## Sprint 007 Foundation Direction

- Rocktomic placeholder contract has been advanced to a supplier intelligence engine foundation.
- `/ecomviper` PDP/editor now consumes Rocktomic SKU-match confidence/reason and supplier fact/status fields.
- Dropshipping -> Rocktomic route is now a dedicated platform-intelligence shell (source status + SKU lookup).

## Sprint 008 Foundation Direction

- `/ecomviper/products/[productId-or-handle]` now includes an AI PDP Intelligence workspace.
- PDP intelligence generation uses Shopify listing facts plus Rocktomic supplier facts when SKU matches.
- Generated intelligence is editable, saved server-side, and reloaded on reopen for the same signed-in user.
- OpenAI generation runs server-side only and degrades safely to `generation_unavailable` when credentials are missing.
- Image Studio remains a placeholder and is deferred to Sprint 009+.

## Product Editor Gallery Standard (Sprint 010)

- `/ecomviper/products/[productId-or-handle]` uses a top hero-gallery model:
  - large primary product image
  - selectable thumbnail gallery
  - compact product summary/action context beside gallery
- Product imagery is part of main workspace content, not sidebar navigation.
- Product Rail is removed from primary layout to avoid duplicate image rails.
- Gallery supports Shopify images plus hosted/generated asset URLs when available.
- Merchant identity zones avoid extraction-debug/internal key wording.

## Planning Navigation

For family-level direction, start with:

- `planning/apps/ecomviper/product-intent.md`

For channel-specific implementation truth, use each channel's:

- `overview.md`
- `product-intent.md`
- sprint docs where present

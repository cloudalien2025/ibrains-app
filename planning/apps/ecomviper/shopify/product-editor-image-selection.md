# Product Editor Default Image Selection (Phase 5.2)

Last updated: 2026-06-01 (UTC)

## Purpose

Ensure canonical Shopify Product Editor opens with the best front/primary/featured product image as the main gallery image, without product/SKU hardcoding.

## Canonical Route Scope

Only canonical merchant-facing Product Editor workflow is in scope:

- `/ecomviper/products/[productId-or-handle]`

Out of scope:

- `/ecomviper/shopify/products/[productId-or-handle]` (removed route family remains removed)

## Default Selection Contract

On product open, default main image selection is deterministic and global:

1. explicit role cues (`front`, `primary`, `featured`, `hero`, `main`)
2. Shopify featured image match when available (id/url)
3. front-facing heuristic cues from role/type/title/alt/filename context
4. lowest stable image position/order fallback
5. first available image fallback

Back/facts/lifestyle-oriented cues are deprioritized when a front-facing candidate exists.

## Interaction Contract

- Thumbnails remain fully interactive.
- Merchant manual thumbnail selection remains active for the same product session.
- Default selection re-initializes when navigating to a new product.

## Non-Goals

- no Product Editor layout redesign
- no image-card resize/layout blank-space changes
- no Generate Intelligence behavior changes
- no Save/Publish behavior changes
- no supplier writes/import/sync/extraction/OCR/AI-label runtime execution changes
- no ecommerce schema changes
- no `DATABASE_URL` fallback changes for ecommerce supplier-facts read path
- no duplicate route restoration

## Verification Summary

- Focused helper/gallery/editor/route tests verify default selection behavior, route safety, and thumbnail click continuity.
- No SKU-specific or handle-specific hardcoded branching is allowed in selection logic.

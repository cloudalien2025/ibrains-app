# Sprint 006 Requirements

Status: In progress
Date: 2026-05-29 (UTC)

# Sprint 006
Shopify Inventory Foundation + PDP Optimizer Shell

## Problem Statement

`/ecomviper` still reflected a generic console shell and did not provide a Shopify-first Sellbrite-style listings workflow in the parent EcomViper workspace.

## Goal

Deliver the smallest production-safe Shopify-first inventory foundation inside `/ecomviper`:

1. Connect Shopify via existing secure custom-app credential flow.
2. Display imported Shopify listings in a simple product table.
3. Open a product PDP editor route from each listing row.
4. Seed Rocktomic SKU-match intelligence placeholders without fake live supplier sync.

## Functional Requirements

1. Sidebar IA for `/ecomviper` must be:
   - Overview
   - Products
   - Product Editor / PDP Optimizer
   - Image Studio
   - Dropshipping (Rocktomic)
   - Agentic Visibility
   - Settings
2. Products table columns must include:
   - product image
   - product name
   - SKU
   - vendor
   - product type
   - Shopify status
   - supplier match
   - AI/PDP score
   - published status
   - last updated
3. Products table must support filters/search for:
   - product search
   - supplier match (Rocktomic/unmatched)
   - Shopify status (active/draft/archived)
   - published to EcomViper.com (yes/no)
   - AI score range
   - inventory status when available
4. Product rows must open PDP editor route under `/ecomviper/products/[productId-or-handle]`.
5. PDP route must include section shells for:
   - Shopify Product Data
   - Supplier Intelligence
   - AI PDP Optimizer
   - Image Studio
   - Buy Now Links
   - Publish Controls
6. Rocktomic must be modeled as platform-managed supplier intelligence (no merchant file upload dependency in normal workflow).

## Security Requirements

1. Keep existing auth and user scoping patterns (`requireSignedInUser`, per-user product/connection access).
2. Do not expose Shopify secrets/tokens in UI or logs.
3. Keep tenant/workspace isolation in all new data reads.

## Non-Goals

1. No fake live Shopify import behavior.
2. No full EcomViper.com public publishing implementation.
3. No insecure direct token handling in client code.
4. No expansion into Walmart/eBay/Amazon scope.

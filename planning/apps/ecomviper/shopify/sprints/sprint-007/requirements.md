# Sprint 007 Requirements

Status: In progress
Date: 2026-05-29 (UTC)

# Sprint 007
Rocktomic Supplier Intelligence Engine Foundation

## Problem Statement

Sprint 006 established Shopify-first listings and PDP shells, but Rocktomic supplier intelligence remained a minimal placeholder and could not yet provide reliable SKU-backed supplier facts inside PDP workflows.

## Goal

Deliver the smallest production-safe Rocktomic Supplier Intelligence Engine foundation:

1. Model Rocktomic platform-managed source references.
2. Provide typed supplier product facts with source traceability.
3. Support deterministic SKU normalization + exact match lookup with confidence/reason.
4. Surface matched supplier intelligence in `/ecomviper/products/[productId-or-handle]`.
5. Add Dropshipping -> Rocktomic route shell for source status and SKU lookup.

## Functional Requirements

1. Rocktomic source config model must track configured vs pending references (catalog/templates/policy now; inventory/pricing/COA feeds pending).
2. Rocktomic supplier product model must include core fields needed for future PDP generation and media workflows.
3. Seeded representative catalog SKUs must include:
   - ROC817
   - ROC949
   - ROC937
   - ROC2251
   - ROC918
   - ROC920
4. SKU lookup service must:
   - normalize input consistently
   - match exact SKU first
   - return match status, confidence, and reason
5. PDP Supplier Intelligence panel must display real matched Rocktomic facts/statuses when SKU matches.
6. Dropshipping -> Rocktomic route must show:
   - source status summary
   - source reference status table
   - product count
   - searchable SKU lookup
   - sync/log placeholder section

## Security Requirements

1. Keep Shopify auth/user scoping unchanged.
2. Do not expose tokens/secrets/credentials in logs or client UI.
3. Keep supplier source URLs/config server-side unless explicitly needed in UI.
4. Preserve workspace/tenant data isolation.

## Non-Goals

1. No AI PDP generation execution in Sprint 007.
2. No merchant Rocktomic file-upload workflow.
3. No full inventory/pricing/policy sync daemon.
4. No public EcomViper.com publishing system implementation.

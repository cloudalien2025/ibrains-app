# Sprint 008 Requirements

Status: In progress
Date: 2026-05-29 (UTC)

# Sprint 008
AI PDP Intelligence Engine Foundation

## Goal

Deliver the smallest production-safe AI PDP intelligence workflow for `/ecomviper/products/[productId-or-handle]`:

1. Generate structured PDP intelligence from Shopify facts + Rocktomic supplier context (when SKU matched).
2. Keep generated intelligence editable and saveable.
3. Reopen the editor and load saved intelligence for the same signed-in user.
4. Add deterministic compliance risk detection metadata.

## Functional Requirements

1. Typed PDP intelligence model includes Sprint 008 required fields and FAQ shape.
2. Product editor clearly separates:
   - Shopify Product Data
   - Supplier Intelligence
   - AI PDP Intelligence
   - Buy Now Links placeholder
   - Image Studio placeholder
   - Publish Controls placeholder
3. Generation action is server-side only and never exposes OpenAI keys or secrets in client responses/logs.
4. Generation unavailable state is explicit and non-breaking when OpenAI configuration is missing.
5. Save/reopen behavior persists server-side and is scoped by signed-in user.
6. Deterministic compliance risk detector records risk level + risky phrase set + safer rewrite notes.

## Non-Goals

1. No Image Studio execution in Sprint 008 (placeholder only).
2. No public EcomViper.com PDP publishing execution in Sprint 008.
3. No merchant Rocktomic file-upload workflows.
4. No full granular regeneration API contract beyond the main generation action in this sprint.

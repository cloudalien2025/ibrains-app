# Agentic Visibility (Sprint 009)

Last updated: 2026-05-31 (UTC)

## Principles

- Agentic visibility outputs must derive from known source facts.
- Unknown values remain `Unknown`/`Source Unavailable`.
- No supplier platform references in shopper-facing outputs.

## Current Signals

- FAQ topic scaffolding
- buyer-intent mapping
- entity mapping
- semantic coverage checklist
- referral readiness notes

All signals are generated server-side and persisted for operator review before publishing.

## Product Editor Placement (Sprint 010)

- Agentic Visibility remains a dedicated tab inside Product Editor below the new hero gallery + summary area.
- Top identity and gallery surfaces remain merchant-facing and should not expose extraction/debug internals.

## Final Layout Placement (Sprint 010.1)

- Agentic Visibility tab remains below hero in the full-width edit area, after the primary action row.
- Action row order remains:
  - `Generate Intelligence`
  - `Save Changes`
  - `Publish`
- Agentic tab content must continue to avoid rendering extraction/debug internals in merchant-facing text.

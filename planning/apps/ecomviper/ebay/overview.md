# eBay Overview

Last updated: 2026-05-18 (UTC)

eBay is an active EcomViper child app with a Phase 1, read-only, mock-first listing optimization dashboard.

Current implementation provides:

- eBay route under `/apps/ecomviper/ebay`,
- connection/readiness checklist for future BYO credentials,
- deterministic listing import/scoring/recommendation workflow,
- explicit non-write boundary (no live listing mutation in this phase).

This overview is intentionally high-level.

For implementation-derived details, contracts, and gaps, use:
- `planning/apps/ecomviper/ebay/product-intent.md`
- `planning/apps/ecomviper/ebay/command-center-foundation.md`

Expected next planning direction:
- evolve command-center shell and architecture boundaries from implementation evidence,
- keep scope grounded in current eBay code/tests and avoid speculative requirements.

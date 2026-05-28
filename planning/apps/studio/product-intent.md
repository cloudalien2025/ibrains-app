# Media Brains Product Intent (Legacy Studio Planning Path)

Last reviewed: 2026-05-28 (UTC)

This document is implementation-derived and reflects the standalone brain route model.

## Product Definition

- `CasaFlix` and `Reelify` are independent top-level brains.
- Canonical routes:
  - `/casaflix`
  - `/reelify`
- Canonical launcher/index route:
  - `/brains` ("My Brains")

Studio is not a user-facing route container.

## Route Contract

Supported authenticated routes:

- `/brains`
- `/casaflix`
- `/reelify`

Deprecated/removed routes (no compatibility redirects):

- `/apps`
- `/apps/*`
- `/studio`

## Current Runtime Notes

- `app/reelify/page.tsx` currently reuses the CasaFlix workspace client while preserving standalone route identity.
- Internal legacy module namespaces remain under `app/api/studio/domara/*` and `lib/studio/domara/*` for implementation continuity.
- Legacy module naming is not a user-facing naming contract.

## Naming Baseline

- User-facing: `CasaFlix`, `Reelify`, `My Brains`, `Open Brain`.
- Not user-facing: `Studio` container naming for runtime routing.

## Source-of-Truth Pointers

- `app/casaflix/page.tsx`
- `app/reelify/page.tsx`
- `app/(shell)/brains/page.tsx`
- `lib/brains/brainCatalog.ts`

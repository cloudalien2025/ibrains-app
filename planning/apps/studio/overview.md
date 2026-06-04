# Studio Planning Overview (Legacy Namespace)

Last updated: 2026-05-28 (UTC)

This planning directory remains for historical organization only.

User-facing Studio is not an active route container.

## Runtime Route Baseline

- Canonical brain index: `/brains`
- Standalone media brains:
  - `/casaflix`
  - `/reelify`

## Removed Routes (Must Stay 404)

- `/apps`
- `/apps/*`
- `/studio`
- `/siteforge`
- `/uapforge`

## Naming Baseline

- Use `CasaFlix` and `Reelify` as user-facing brain names.
- Do not use Studio as a user-facing product container.
- Use `PageBolt` for the website brain (not SiteForge).

## Planning Note

Legacy implementation namespaces under `app/api/studio/*` and `lib/studio/*` are internal module paths, not user-facing routing/product names.

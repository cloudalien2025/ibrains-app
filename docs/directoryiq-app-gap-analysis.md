# DirectoryIQ App Gap Analysis (Monorepo vs Standalone)

Compared:
- Standalone source of truth: `/tmp/DirectoryIQ` (`3c905188104ad924f7b8000f1a4e82eb4e9ba285`)
- Current monorepo implementation: `app/directoryiq/**` and `app/api/directoryiq/**`

## Route parity
- `app/directoryiq/**` now contains the same section structure as standalone.
- Compatibility redirects from `/directoryiq` to `/directoryiq` exist and should remain.

## What was still wrong for product expectations
1. Landing perception mismatch
- User reported `/directoryiq` still looked like an AI-visibility/fetch-failed surface rather than the expected full product experience.
- Root cause at UX level: landing page is dashboard-first and error-prone if upstream/data is unavailable.

2. Visual-system mismatch
- Most DirectoryIQ screens still used standalone dark/cyan classes and standalone primitive styling.
- This looked visually disconnected from iBrains app styling (`app.ibrains.ai` light-blue card/surface system).

3. Incomplete iBrains shell adaptation
- DirectoryIQ app structure was present, but visual token usage was not aligned to iBrains primitives/tokens.

## What is intentionally not a gap
- `/brains/**` console routes and brain operational surfaces are separate and must remain unchanged.
- PageBolt app routes remain separate and unchanged.

## Required corrective actions in this lane
- Keep route/API parity with standalone DirectoryIQ app.
- Replace dark standalone visual defaults in app-level primitives with iBrains visual tokens.
- Ensure `/directoryiq` still reflects real standalone IA while visually matching iBrains.
- Keep `/brains/**` and PageBolt untouched.

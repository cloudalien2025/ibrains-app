# SiteForge Thrive-Native Blueprint (Safe Mode First)

## Grounded Current Truth
- Live iPetzo stack exposes `thrive-theme` (Thrive Theme Builder) and `thrive-visual-editor` (Thrive Architect).
- Front-page targeting is still canonical WordPress settings (`show_on_front=page`, `page_on_front=<id>`).
- Thrive-native primitives are observable through safe GET surfaces (`tcb_symbol`, `thrive_template`, `thrive_layout`, `thrive_section`, `thrive_skin_tax`).
- Proven safe write surface remains standard WordPress endpoints:
  - `/wp-json/wp/v2/pages`
  - `/wp-json/wp/v2/settings`
  - existing menu flows already used by SiteForge.

## Safe Control Surface (Now)
- Site-changing execution remains WordPress-page/settings based.
- Thrive intelligence is read-only, collected by REST GET inventory.
- SiteForge records execution mode explicitly as `wp_safe_mode`.

## Thrive Primitives SiteForge Now Understands
- Active Thrive skin (from `thrive_skin_tax`).
- Symbol inventory (from `tcb_symbol`) including:
  - symbol identity (`id`, `title`, `slug`)
  - taxonomy context (`headers`, `footers`, etc.)
  - inferred role (`header` / `footer` / `section` / `unknown`)
  - builder/style presence flags (`tve_updated_post`, `tve_custom_css` as booleans only)
- Primitive counts:
  - `thrive_template`
  - `thrive_layout`
  - `thrive_section`
  - `tcb_symbol`

## What SiteForge Now Persists
- Snapshot-level Thrive intelligence bundle:
  - active skin
  - normalized symbol inventory
  - symbol summary counts
  - primitive counts
  - safe hints (front-page settings usage)
  - inventory warnings
- Execution metadata:
  - `executionMode`
  - `intelligenceAvailable`
  - `symbolInventoryPresent`

## BuildSpec Intelligence (Additive, Safe)
- BuildSpec metadata now carries safe Thrive-aware intent hints:
  - page/section `preferredRenderTarget` values
  - section intent labels (`conversion`, `informational`, `trust`, `navigation`)
  - candidate symbol role hints (`header`, `footer`, `section`, `unknown`)
- These hints are planning metadata only; they do not trigger Thrive-native writes.

## Explicitly Off-Limits in Safe Mode
- Direct Thrive-native writes in normal execution:
  - no `ttb/v1` create/assign/update flows
  - no blind CRUD against Thrive CPT endpoints
  - no raw builder blob rewrites

## Phased Path Forward
1. Phase 1 (now): Thrive-aware safe mode
- Read-only Thrive inventory + normalized intelligence.
- Keep writes on pages/settings/menu surfaces only.

2. Phase 2 (next): Deterministic mapping harness
- Build strict schema harness for specific Thrive endpoints in non-production first.
- Add invariant checks and rollback strategy for any future Thrive-native mutations.

3. Phase 3 (future): Controlled Thrive-native composition
- Introduce explicit opt-in execution mode beyond `wp_safe_mode`.
- Allow narrow Thrive-native writes only after endpoint contracts are captured, versioned, and test-validated.

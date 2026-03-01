# DirectoryIQ UI Fix Plan (Post-Implementation Remaining)

Audit source: `2026-03-01T06-35-31-930Z`

## Remaining 1) Reduce control density in Authority slots on narrow widths
- Impact: M
- Effort: S
- Rubric: E, I
- Evidence: `screenshots/directoryiq_listings_321__authority-section.png`
- Change:
  - Collapse secondary actions into a compact overflow menu below 1024px.
- Acceptance check:
  - On small screens, each slot shows one primary CTA row without wrapping clutter.

## Remaining 2) Improve explicit success toast language consistency
- Impact: L
- Effort: S
- Rubric: F, H
- Evidence: `screenshots/directoryiq_listings_321__generate-draft-validation.png`
- Change:
  - Standardize success copy format: `[Action] complete` and include slot label.
- Acceptance check:
  - All success banners follow one copy template.

## Remaining 3) Add micro-transition for drawer expand/collapse
- Impact: L
- Effort: S
- Rubric: I
- Evidence: `screenshots/directoryiq_settings_integrations__drawer-open.png`
- Change:
  - Add subtle 150-200ms fade/slide transition for inline drawers.
- Acceptance check:
  - Drawer open/close feels smooth and consistent across providers.

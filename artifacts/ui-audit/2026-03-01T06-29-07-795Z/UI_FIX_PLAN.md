# DirectoryIQ UI Fix Plan (Ranked)

Audit source: `2026-03-01T06-29-07-795Z`

## 1) Simplify Authority slot action flow
- Impact: H
- Effort: M
- Rubric: A, C, D, H
- Evidence: `screenshots/directoryiq_listings_321__authority-section.png`
- Change:
  - Keep one primary action per slot.
  - Force step order: inputs -> Generate Draft -> Preview -> Publish.
  - Hide Publish until Preview is completed.
  - Replace internal labels (`not_created`, `missing`) with human labels.
- Acceptance check:
  - Preview disabled until draft exists.
  - Publish hidden unless preview token exists.
  - Statuses read “Not Created”, “Draft Ready”, “Linked/Missing”.

## 2) Improve orientation and navigation clarity
- Impact: H
- Effort: S
- Rubric: B, G
- Evidence: `screenshots/directoryiq__full.png`, `screenshots/directoryiq_listings_321__full.png`, `screenshots/directoryiq_settings_integrations__full.png`
- Change:
  - Add page heading + one-line purpose on each audited route.
  - Update sidebar nav labels to explicitly include Authority, Integrations, History.
  - Strengthen active nav visual treatment.
- Acceptance check:
  - Each audited page answers where/what/next action at glance.
  - Active nav item visually unmistakable.

## 3) Move technical detail behind disclosure
- Impact: M
- Effort: S
- Rubric: C, E
- Evidence: `screenshots/directoryiq_listings_321__authority-section.png`
- Change:
  - Keep summary concise in cards.
  - Place debug/link-check/diff detail in accordions.
- Acceptance check:
  - Default view shows only next action + concise status.
  - Details accessible without clutter.

## 4) Normalize Signal Sources card + drawer CTA pattern
- Impact: M
- Effort: S
- Rubric: A, H, I
- Evidence: `screenshots/directoryiq_settings_integrations__full.png`, `screenshots/directoryiq_settings_integrations__drawer-open.png`
- Change:
  - Card level: one top action (`Configure`/`Edit`).
  - Drawer level: `Save` primary, `Test Connection` secondary, `Cancel` secondary.
  - Add required markers and field labels.
- Acceptance check:
  - Consistent card CTA across all providers.
  - Required fields visibly marked.

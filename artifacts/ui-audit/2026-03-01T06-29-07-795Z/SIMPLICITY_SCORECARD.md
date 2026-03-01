# DirectoryIQ Simplicity Scorecard (Before)

Audit timestamp: `2026-03-01T06-29-07-795Z`
Base URL: `http://127.0.0.1:3001`

## /directoryiq
- A One primary action per panel: 3/5
Evidence: `screenshots/directoryiq__full.png` (primary actions mostly constrained, but orientation hierarchy is weak).
- B 3-second orientation: 2/5
Evidence: `screenshots/directoryiq__full.png` (no explicit page purpose/next action header).
- C Progressive disclosure: 3/5
Evidence: `screenshots/directoryiq__full.png`.
- D Human states: 3/5
Evidence: listing state labels showed low context.
- E Calm visual hierarchy: 3/5
Evidence: `screenshots/directoryiq__full.png`.
- F Zero silent failures: 3/5
Evidence: no explicit action-result feedback at page shell level.
- G Navigation obviousness: 2/5
Evidence: nav omitted explicit Authority/Integrations/History labeling pattern.
- H Consistent patterns: 3/5
Evidence: card patterns were mixed between areas.
- I Polish: 3/5
Evidence: active nav state was not emphatic.

## /directoryiq/listings/321
- A One primary action per panel: 1/5
Evidence: `screenshots/directoryiq_listings_321__authority-section.png` (Generate Draft and Publish both prominent; multiple strong CTAs).
- B 3-second orientation: 2/5
Evidence: `screenshots/directoryiq_listings_321__full.png` (no explicit page purpose strip).
- C Progressive disclosure: 1/5
Evidence: `screenshots/directoryiq_listings_321__authority-section.png` (Publish visible before preview).
- D Human states: 1/5
Evidence: `screenshots/directoryiq_listings_321__authority-section.png` (`not_created`, `missing` raw states).
- E Calm visual hierarchy: 2/5
Evidence: dense control layout in each slot.
- F Zero silent failures: 4/5
Evidence: `screenshots/directoryiq_listings_321__generate-draft-validation.png`, `screenshots/directoryiq_listings_321__preview-validation.png` (validation surfaces present).
- G Navigation obviousness: 2/5
Evidence: missing explicit Authority nav label in sidebar.
- H Consistent patterns: 3/5
Evidence: slot cards structurally similar but flow was not constrained.
- I Polish: 2/5
Evidence: disabled/progression state unclear around preview/publish.

## /directoryiq/settings/integrations
- A One primary action per panel: 2/5
Evidence: `screenshots/directoryiq_settings_integrations__full.png` (card-level Edit + Disconnect side-by-side).
- B 3-second orientation: 3/5
Evidence: purpose partially implied by title only.
- C Progressive disclosure: 4/5
Evidence: inline drawers already used.
- D Human states: 4/5
Evidence: connected/disconnected labels present.
- E Calm visual hierarchy: 3/5
Evidence: left helper panel and main cards were clear but dense.
- F Zero silent failures: 4/5
Evidence: toasts/banner paths existed.
- G Navigation obviousness: 2/5
Evidence: nav labels did not expose Integrations explicitly.
- H Consistent patterns: 3/5
Evidence: connector cards mostly consistent, but CTA rows varied.
- I Polish: 3/5
Evidence: input labels/required markers were missing in drawers.

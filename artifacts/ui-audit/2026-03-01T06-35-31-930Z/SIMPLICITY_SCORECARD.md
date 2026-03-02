# DirectoryIQ Simplicity Scorecard (After)

Audit timestamp: `2026-03-01T06-35-31-930Z`
Base URL: `http://127.0.0.1:3001`

## /directoryiq
- A One primary action per panel: 4/5
Evidence: `screenshots/directoryiq__full.png`.
- B 3-second orientation: 5/5
Evidence: `screenshots/directoryiq__full.png` (explicit page header + one-line purpose).
- C Progressive disclosure: 4/5
Evidence: `screenshots/directoryiq__full.png`.
- D Human states: 4/5
Evidence: listing table states normalized to human labels in UI.
- E Calm visual hierarchy: 4/5
Evidence: `screenshots/directoryiq__full.png`.
- F Zero silent failures: 4/5
Evidence: no silent click path observed in audited interactions.
- G Navigation obviousness: 5/5
Evidence: `screenshots/directoryiq__full.png` (Dashboard, Listings, Authority, Integrations, History visible).
- H Consistent patterns: 4/5
Evidence: card/system treatment aligned.
- I Polish: 4/5
Evidence: stronger active nav emphasis, consistent button/spacing rhythm.

## /directoryiq/listings/321
- A One primary action per panel: 4/5
Evidence: `screenshots/directoryiq_listings_321__authority-section.png` (single primary per slot).
- B 3-second orientation: 5/5
Evidence: `screenshots/directoryiq_listings_321__full.png` (header explains purpose and next flow).
- C Progressive disclosure: 5/5
Evidence: `screenshots/directoryiq_listings_321__authority-section.png` (Preview disabled until draft; Publish hidden until preview).
- D Human states: 5/5
Evidence: `screenshots/directoryiq_listings_321__authority-section.png` (“Not Created”, “Missing”).
- E Calm visual hierarchy: 4/5
Evidence: step labels and details accordions reduce noise.
- F Zero silent failures: 5/5
Evidence: `logs/network.json` (intentional 400 validations captured by UI); `screenshots/directoryiq_listings_321__generate-draft-validation.png`, `screenshots/directoryiq_listings_321__preview-validation.png`.
- G Navigation obviousness: 5/5
Evidence: `screenshots/directoryiq_listings_321__full.png` (Authority/Integrations/History present in nav).
- H Consistent patterns: 5/5
Evidence: all 4 slots share identical step structure.
- I Polish: 4/5
Evidence: consistent disabled/hover/accordion patterns.

## /directoryiq/settings/integrations
- A One primary action per panel: 5/5
Evidence: `screenshots/directoryiq_settings_integrations__full.png` (single card action per provider).
- B 3-second orientation: 5/5
Evidence: `screenshots/directoryiq_settings_integrations__full.png` (clear title + purpose).
- C Progressive disclosure: 5/5
Evidence: `screenshots/directoryiq_settings_integrations__drawer-open.png` (inline drawer controls).
- D Human states: 5/5
Evidence: connected/disconnected + saved timestamp + masked tail.
- E Calm visual hierarchy: 4/5
Evidence: clear sectioning (Core/Recommended/Optional).
- F Zero silent failures: 4/5
Evidence: error/result banners in page shell; test/save paths instrumented.
- G Navigation obviousness: 5/5
Evidence: sidebar includes explicit Integrations location.
- H Consistent patterns: 5/5
Evidence: uniform card and drawer behavior across providers.
- I Polish: 5/5
Evidence: required field markers and aligned control hierarchy in drawer.

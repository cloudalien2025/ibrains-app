# COA Architecture (Sprint 009)

Last updated: 2026-05-29 (UTC)

## COA Data Contract

Persist and render:

- `coa_status`
- `coa_link`
- `coa_expiration_date`
- `coa_testing_categories`
- `coa_verification_status`

## Rules

- COA links are internal intelligence inputs and operator tools.
- Missing COA data must remain explicit (`unknown`/empty), not inferred.
- COA status appears in diagnostics and product editor trust/compliance sections.

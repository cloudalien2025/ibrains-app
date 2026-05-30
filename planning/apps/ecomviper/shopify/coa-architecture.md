# COA Architecture (Sprint 009.4)

Last updated: 2026-05-30 (UTC)

## COA Data Contract

Persist and render:

- `coa_status`
- `coa_link`
- `coa_expiration_date`
- `coa_testing_categories`
- `coa_verification_status`
- `coa_link_status` (`extracted` | `extraction_failed` | `not_present`)
- `coa_link_error` (redacted deterministic extraction reason)

## Rules

- COA links are internal intelligence inputs and operator tools.
- Missing COA data must remain explicit (`unknown`/empty), not inferred.
- COA status appears in diagnostics and product editor trust/compliance sections.
- Matched SKU COA URLs should be extracted from catalog PDF hyperlink annotations.
- If matched SKU hyperlink extraction fails, preserve deterministic diagnostics instead of generic unavailable messaging.
- Do not fallback to generic page-level hyperlinks when SKU-level COA association is unclear.

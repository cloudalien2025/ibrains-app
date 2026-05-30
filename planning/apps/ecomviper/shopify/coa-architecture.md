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

## Hotfix 009.8 Global Assets/COA Binding

Assets and COA values are global supplier facts by normalized SKU. Product Editor and PDP generation read them from `supplier_assets_normalized` and the mapped supplier product row after merchant authentication.

UI states:

- COA URL present: show `View COA`, status `available/extracted`.
- label/mockup URL present: show the link in Assets, status `available/extracted`.
- COA repository pending: show `COA repository pending`.
- extraction error: show the deterministic extraction diagnostic.

COA repository pending is optional-source state and must not zero out product/pricing/inventory counts or mark required feed sync as never synced.

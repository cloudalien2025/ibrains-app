# Sprint: Stale DirectoryIQ Docs Audit & Archive

Status: `QUEUED` (planning-only; not started)
Queued: 2026-06-03 (UTC)
Origin: Deferred tier from the repo cleanup audit (see `planning/state.md` cleanup closures).

## Problem

`docs/` holds 14 `directoryiq-*` markdown files, several of which are one-time migration /
audit / gap-analysis artifacts that are typically obsolete once the work they describe has
shipped. They are not referenced by code or CI (only a couple cross-reference each other),
so they add noise and imply ongoing work that may be long done. This sprint reviews each and
**archives or removes the confirmed-obsolete ones**, keeping anything still authoritative.

Staleness is a JUDGMENT CALL that depends on the current DB/migration state — this sprint
requires operator knowledge, not mechanical deletion.

## Candidate docs (all in `docs/`; none referenced by code/CI)

One-time migration/retirement artifacts (most likely obsolete — confirm the migration shipped):
- `directoryiq-db-migration-plan.md`
- `directoryiq-db-classification.md`  (xref: migration-plan)
- `directoryiq-db-operator-checklist.md`  (xref: migration-plan)
- `directoryiq-old-table-retirement.md`
- `directoryiq-old-table-rollback.md`

Point-in-time audits / gap analyses (obsolete once acted on — confirm):
- `directoryiq-app-gap-analysis.md`
- `directoryiq-app-parity-audit.md`
- `directoryiq-functional-gap-analysis.md`
- `directoryiq-functional-parity-audit.md`
- `directoryiq-dashboard-operational-audit.md`
- `directoryiq-full-style-audit.md`

Possibly-still-authoritative contracts/plans (lean KEEP unless superseded):
- `directoryiq-bd-post-type-autodetect-plan.md`
- `directoryiq-bd-verification-contract.md`
- `directoryiq-ibrains-token-mapping.md`

## Decision per doc (operator)

- **Archive** (preferred default for obsolete-but-historical): move to a new
  `planning/apps/directoryiq/history/` folder so the audit trail survives without cluttering
  `docs/`. Update the two internal xrefs (`db-classification`, `db-operator-checklist`) if
  their target moves.
- **Delete**: only for docs that are pure duplicates or fully superseded with no historical
  value.
- **Keep**: still-authoritative; leave in `docs/`. If kept but at risk of re-flagging, add a
  one-line status header (e.g. `> Status: current as of 2026-06-03`).

## Scope (out)

- Non-DirectoryIQ docs (`AUTH_CLERK_FOUNDATION.md`, `PRODUCTION_DEPLOYMENT.md`,
  `siteforge_thrive_native_blueprint.md`, etc.) — not in scope; several are referenced by
  `planning/state.md` and are live operational docs.
- Any code or `src/directoryiq` / `lib/directoryiq` changes. Docs only.

## Verification gate

- No code/CI touched; `tsc`/`vitest` baselines unchanged (this is a docs-only sprint).
- After archive/delete, grep the repo for links to each moved/removed doc and confirm no
  dangling references remain (the two known internal xrefs updated).

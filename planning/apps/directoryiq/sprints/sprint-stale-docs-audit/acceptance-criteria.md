# Acceptance Criteria: Stale DirectoryIQ Docs Audit & Archive

## Must pass

1. **Ground-truth check done.** The MR documents whether the DirectoryIQ DB migration /
   old-table retirement described by the migration-cluster docs has actually shipped
   (evidence from `db/migrations/` and `lib/`/`src/directoryiq/` references). Disposition
   follows from that evidence, not assumption.
2. **Per-doc disposition table** present in the MR description: every one of the 14
   `directoryiq-*` docs marked Archive / Delete / Keep with a one-line justification and
   (for Keep/Decide rows) owner sign-off.
3. **Archived, not destroyed, by default.** Obsolete-but-historical docs are `git mv`-ed into
   `planning/apps/directoryiq/history/`, not deleted. Delete is used only for true
   duplicates/fully-superseded docs.
4. **No dangling links.** The internal xrefs (`directoryiq-db-classification.md`,
   `directoryiq-db-operator-checklist.md` → `directoryiq-db-migration-plan.md`) are updated
   if their target moved; a repo-wide grep shows zero broken references to any moved/removed doc.
5. **Docs-only.** No code, CI, `src/directoryiq`, or `lib/directoryiq` changes. `tsc`/`vitest`
   baselines unchanged (not expected to be affected at all).
6. **Out-of-scope docs untouched.** The non-DirectoryIQ docs in `docs/` are not moved/removed.

## Definition of done

Clean `main` → branch → `git mv`/`git rm` per dispositions + xref fixes → grep proof of no
dangling links → push → MR (with disposition table) → green CI → squash-merge → delete
remote+local branch → sync main → update `planning/state.md` (MR #, pipeline, merge SHA,
branch cleanup, count archived vs deleted vs kept).

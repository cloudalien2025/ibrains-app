# Blueprint: Stale DirectoryIQ Docs Audit & Archive

## Step 1 — Establish ground truth (before any move/delete)

For the migration cluster, confirm the migration actually shipped:
- Check `db/migrations/` for the DirectoryIQ table changes the docs describe.
- Check `lib/directoryiq/` / `src/directoryiq/repositories/` for whether the "old tables"
  named in `directoryiq-old-table-retirement.md` are still referenced. If the code no longer
  touches them, the retirement/rollback/migration docs are obsolete → Archive.

## Step 2 — Per-doc disposition

Produce a table in the MR description with one row per doc and its decision
(Archive / Delete / Keep) + one-line justification. Suggested leans:

| Doc | Lean | Why |
|---|---|---|
| directoryiq-db-migration-plan.md | Archive | one-time plan; historical |
| directoryiq-db-classification.md | Archive | migration support doc |
| directoryiq-db-operator-checklist.md | Archive | one-time runbook |
| directoryiq-old-table-retirement.md | Archive | obsolete once retirement done |
| directoryiq-old-table-rollback.md | Archive | rollback for a completed migration |
| directoryiq-app-gap-analysis.md | Archive | point-in-time |
| directoryiq-app-parity-audit.md | Archive | point-in-time |
| directoryiq-functional-gap-analysis.md | Archive | point-in-time |
| directoryiq-functional-parity-audit.md | Archive | point-in-time |
| directoryiq-dashboard-operational-audit.md | Archive | point-in-time |
| directoryiq-full-style-audit.md | Archive | point-in-time |
| directoryiq-bd-post-type-autodetect-plan.md | Keep/Decide | may be active design |
| directoryiq-bd-verification-contract.md | Keep/Decide | may be an active contract |
| directoryiq-ibrains-token-mapping.md | Keep/Decide | may still map live tokens |

## Step 3 — Execute

- Create `planning/apps/directoryiq/history/` and `git mv` each Archive doc into it.
- `git rm` only the Delete-decided docs.
- Fix internal xrefs: `directoryiq-db-classification.md` and
  `directoryiq-db-operator-checklist.md` both link to `directoryiq-db-migration-plan.md` —
  if any of those three moves, update the relative links so they don't dangle.
- Add the `> Status:` header to any Keep doc that needs it.

## Step 4 — Prove no dangling links

```
grep -rEn "directoryiq-(db-migration-plan|old-table-retirement|app-gap-analysis|...)" \
  docs planning --include='*.md'
```
Confirm every remaining reference points at the doc's new location (or is gone).

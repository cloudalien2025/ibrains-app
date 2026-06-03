# Handoff Prompt: Stale DirectoryIQ Docs Audit & Archive

You are the Builder for the queued sprint **Stale DirectoryIQ Docs Audit & Archive**.

Read first: `AGENTS.md`, `planning/state.md` (confirm this sprint is still `QUEUED`), then
this folder's `requirements.md`, `blueprint.md`, `acceptance-criteria.md`.

## Task

Review the 14 `directoryiq-*` docs in `docs/` and dispose of each: **Archive** (move to a
new `planning/apps/directoryiq/history/`), **Delete** (only if a pure duplicate / fully
superseded), or **Keep** (still authoritative). This is a **docs-only** sprint.

## Hard rules

- Staleness is a judgment call — establish ground truth FIRST: confirm via `db/migrations/`
  and `lib/`/`src/directoryiq/` whether the migration/old-table retirement those docs
  describe has actually shipped. Disposition must follow evidence.
- Default to **Archive (git mv)**, not delete, for obsolete-but-historical docs — preserve
  the audit trail.
- Get owner sign-off for the three Keep/Decide docs (`bd-post-type-autodetect-plan`,
  `bd-verification-contract`, `ibrains-token-mapping`) before changing them.
- Fix internal cross-references: `directoryiq-db-classification.md` and
  `directoryiq-db-operator-checklist.md` link to `directoryiq-db-migration-plan.md`; update
  links if any of the three moves. End with a repo-wide grep proving no dangling links.
- Do NOT touch non-DirectoryIQ docs (several are referenced by `planning/state.md` and are
  live operational docs).

## Verification

Docs-only; `tsc`/`vitest` baselines (155 / 10, pre-existing) must be unaffected. Main
verification is the no-dangling-links grep and the disposition table.

## Delivery (GitLab flow)

`git switch main && git pull` → branch `chore/directoryiq-stale-docs-audit` →
`git mv`/`git rm` + xref fixes → grep proof → push `-o merge_request.create
-o merge_request.target=main -o merge_request.remove_source_branch` → green pipeline →
squash-merge → delete remote+local branch → sync main → update `planning/state.md` with
MR #, pipeline, merge SHA, branch cleanup, and counts (archived / deleted / kept).

Env note: pushes use `core.sshCommand` → `~/.ssh/id_ed25519` (`ibrains`-owned key on the
`@cloudalien` GitLab account). API merge needs a GitLab PAT (`api` scope) supplied
out-of-band; never commit it.

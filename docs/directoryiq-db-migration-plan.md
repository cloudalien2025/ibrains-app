# DirectoryIQ DB Split Plan (Verification-First, Non-Destructive)

Date: 2026-04-23 (UTC)
Branch: `chore/directoryiq-database-split`

## Scope
Move only confirmed DirectoryIQ-owned tables (`directoryiq_*`) from shared `ibrains-postgres` into dedicated `directoryiq-postgres`.

Out of scope for this change:
- Siteforge tables
- iPetzo data
- shared/platform tables
- ambiguous ownership tables (see `docs/directoryiq-db-classification.md`)

## Connection Design
- Keep `DATABASE_URL` as shared DB (Siteforge + platform unchanged).
- Introduce `DIRECTORYIQ_DATABASE_URL` for DirectoryIQ-owned persistence path.
- Do not repoint global/shared DB helpers in this change.

## Source-of-Truth Artifacts
- Ownership/FK introspection SQL:
  - `db/directoryiq/000_directoryiq_ownership_introspection.sql`
- Schema creation SQL:
  - `db/directoryiq/001_directoryiq_schema_from_shared.sql`
- Data copy + sequence reset SQL:
  - `db/directoryiq/002_directoryiq_data_copy_and_sequences.sql`
- Validation SQL:
  - `db/directoryiq/003_directoryiq_validation.sql`
- Operator runbook:
  - `docs/directoryiq-db-operator-checklist.md`

## Schema Dependency Decisions
1. Keep internal `directoryiq_* -> directoryiq_*` foreign keys.
2. Omit `directoryiq_* -> users` foreign keys in new DB.
   - Reason: `users` remains on shared DB; cross-DB FK is not viable in Postgres.
   - Keep `user_id`/`created_by_user_id` columns as unconstrained identifiers.
3. Keep all indexes and primary/unique/check constraints from source for moved tables.
4. Do not delete or alter source shared DB tables.

## Deterministic Create/Copy Order
Create order:
1. Sequences
2. Tables
3. PK/unique/check/internal FK constraints
4. Secondary indexes

Copy order (FK-safe):
1. `directoryiq_policy_profiles`
2. `directoryiq_authority_hubs`
3. `directoryiq_authority_posts`
4. `directoryiq_versions`
5. `directoryiq_reinforcement_plans`
6. `directoryiq_blog_posts`
7. `directoryiq_blog_post_links`
8. `directoryiq_blog_post_mentions`
9. `directoryiq_blog_sync_runs`
10. `directoryiq_bd_sites`
11. `directoryiq_nodes`
12. `directoryiq_settings`
13. `directoryiq_signal_source_credentials`
14. `directoryiq_listing_upgrades`
15. `directoryiq_ingest_runs`
16. `directoryiq_jobs`
17. `directoryiq_audit_events`
18. `directoryiq_blog_fixes`

## Tooling Choice
- `pg_dump` schema extraction was not usable here due client/server major version mismatch (client 14 vs server 18).
- Used read-only `psql` catalog introspection to generate executable schema SQL deterministically.
- Data copy plan uses `psql` `\copy` per table and explicit sequence resets.

## Cutover Safety Gates
Must all pass before any traffic/config cutover:
1. Schema apply succeeded on destination DB.
2. Row counts match for all moved tables.
3. Spot checks match for high-value tables:
   - `directoryiq_jobs`
   - `directoryiq_nodes`
   - `directoryiq_authority_posts`
   - `directoryiq_ingest_runs`
   - `directoryiq_listing_upgrades`
   - `directoryiq_bd_sites`
4. Sequence reset checks pass on destination.
5. DirectoryIQ read/write smoke checks pass in non-production or controlled environment.
6. Siteforge smoke checks pass and remain on shared `DATABASE_URL`.

## Rollback
- Rollback is config-only because source tables remain untouched.
- Revert DirectoryIQ env/config from `DIRECTORYIQ_DATABASE_URL` path back to shared path.
- No data deletion step in this task.

## Current Blockers for Full Execution
1. No usable destination DB connection string is present in repo/env for `directoryiq-postgres`.
2. Ambiguous table ownership set cannot be conclusively proven from this repo alone.

Until blockers are resolved, execute only preparation artifacts and do not perform cutover.

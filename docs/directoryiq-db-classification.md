# DirectoryIQ DB Classification (Evidence-Based)

Date: 2026-04-23 (UTC)
Branch: `chore/directoryiq-database-split`

## Evidence Sources
- DirectoryIQ route and ingestion engine:
  - `app/api/brains/[id]/ingest/route.ts`
  - `lib/directoryiq/ingestion/engine.ts`
- Shared DB pool binding:
  - `lib/brain-learning/db.ts`
- Siteforge DB usage (must remain on shared DB):
  - `lib/siteforge/repository/index.ts`
- Shared DB foreign-key topology (`information_schema` query on current `DATABASE_URL`)
- Repository-wide table-name search (`rg`) for SQL references

## Key Findings
- In this repo, DirectoryIQ code paths currently query `brain_*` tables, not `directoryiq_*` tables.
- No in-repo SQL references were found for `directoryiq_*` table names.
- `directoryiq_*` tables form an internally connected cluster and have outbound FKs to `public.users`.
- No inbound FKs from non-DirectoryIQ tables into `directoryiq_*` were found.

## Classification Map

### A) DirectoryIQ-only tables (approved migration set)
These are treated as DirectoryIQ-owned persistence for this split.

- `directoryiq_audit_events`
- `directoryiq_authority_hubs`
- `directoryiq_authority_posts`
- `directoryiq_bd_sites`
- `directoryiq_blog_fixes`
- `directoryiq_blog_post_links`
- `directoryiq_blog_post_mentions`
- `directoryiq_blog_posts`
- `directoryiq_blog_sync_runs`
- `directoryiq_ingest_runs`
- `directoryiq_jobs`
- `directoryiq_listing_upgrades`
- `directoryiq_nodes`
- `directoryiq_policy_profiles`
- `directoryiq_reinforcement_plans`
- `directoryiq_settings`
- `directoryiq_signal_source_credentials`
- `directoryiq_versions`

Evidence:
- FK graph: all inter-table links are either `directoryiq_* -> directoryiq_*` or `directoryiq_* -> users`.
- No inbound foreign keys from non-DirectoryIQ tables.
- No in-repo SQL references tie these tables to Siteforge code paths.

### B) Shared tables read by DirectoryIQ but should remain shared
These are used by in-repo DirectoryIQ ingestion/retrieval paths and are `brain_*` platform tables.

- `brains`
- `brain_source_watches`
- `brain_source_items`
- `brain_ingest_runs`
- `brain_documents`
- `brain_chunks`
- `brain_taxonomy_nodes`
- `brain_chunk_taxonomy_assignments`

Evidence:
- Direct SQL usage in:
  - `lib/directoryiq/ingestion/engine.ts` (reads/writes `brain_source_items`, `brain_ingest_runs`, `brain_documents`, `brain_chunks`)
  - `lib/brain-learning/taxonomyEnrichment.ts`
  - `lib/brain-learning/retrieval.ts`
- These are not part of the requested `directoryiq_*` migration scope and are shared platform persistence.

### C) Ambiguous tables needing human/product-owner confirmation
These tables are present in the shared DB, but this repo has no direct SQL usage proving active DirectoryIQ ownership.

- `authority_actions`
- `authority_graph_edges`
- `authority_graph_evidence`
- `authority_graph_mentions`
- `authority_graph_nodes`
- `authority_graph_runs`
- `content_edges`
- `content_nodes`
- `entity_mentions`
- `ingest_runs`
- `listing_aliases`
- `serp_competitors`
- `serp_snapshots`
- `brain_snapshots`
- `ssc_prompt_pack_active`
- `ssc_prompt_packs`
- `ssc_prompts`
- `ssc_storyboard_runs`
- `ssc_storyboard_scores`

Evidence:
- Repo search did not find in-repo SQL references for these table names.
- FK topology places many in shared/platform clusters (`users`, `integrations`, `connected_sites`, `site_nodes`, `content_nodes`), not in the `directoryiq_*` cluster.

Status:
- Ownership is not provable from this repo alone.
- Per stop conditions, these remain out-of-scope for migration in this change set.

### D) Non-DirectoryIQ tables (must not move)
- Siteforge tables:
  - `siteforge_connections`
  - `siteforge_failures`
  - `siteforge_project_ai_configs`
  - `siteforge_projects`
  - `siteforge_run_logs`
  - `siteforge_sessions`
  - `siteforge_snapshots`
  - `siteforge_user_workspace_state`
- Shared/platform:
  - `users`
  - `oauth_states`
  - `byo_api_keys`
  - `integrations`
  - `integrations_credentials`
  - `connected_sites`
  - `surfaces`
  - `site_nodes`

Evidence:
- Siteforge repository SQL in `lib/siteforge/repository/index.ts` uses only `siteforge_*` tables.
- Platform FK graph links these shared tables to many non-DirectoryIQ domains.

## Decision for This Migration
- Proceed only with the 18 `directoryiq_*` tables listed in Section A.
- Do not move Section C ambiguous tables until additional ownership evidence is provided.

-- DirectoryIQ validation queries
-- Run on SOURCE and DESTINATION, then compare outputs.

-- 1) Table row counts
SELECT 'directoryiq_audit_events' AS table_name, count(*)::bigint AS row_count FROM public.directoryiq_audit_events
UNION ALL SELECT 'directoryiq_authority_hubs', count(*)::bigint FROM public.directoryiq_authority_hubs
UNION ALL SELECT 'directoryiq_authority_posts', count(*)::bigint FROM public.directoryiq_authority_posts
UNION ALL SELECT 'directoryiq_bd_sites', count(*)::bigint FROM public.directoryiq_bd_sites
UNION ALL SELECT 'directoryiq_blog_fixes', count(*)::bigint FROM public.directoryiq_blog_fixes
UNION ALL SELECT 'directoryiq_blog_post_links', count(*)::bigint FROM public.directoryiq_blog_post_links
UNION ALL SELECT 'directoryiq_blog_post_mentions', count(*)::bigint FROM public.directoryiq_blog_post_mentions
UNION ALL SELECT 'directoryiq_blog_posts', count(*)::bigint FROM public.directoryiq_blog_posts
UNION ALL SELECT 'directoryiq_blog_sync_runs', count(*)::bigint FROM public.directoryiq_blog_sync_runs
UNION ALL SELECT 'directoryiq_ingest_runs', count(*)::bigint FROM public.directoryiq_ingest_runs
UNION ALL SELECT 'directoryiq_jobs', count(*)::bigint FROM public.directoryiq_jobs
UNION ALL SELECT 'directoryiq_listing_upgrades', count(*)::bigint FROM public.directoryiq_listing_upgrades
UNION ALL SELECT 'directoryiq_nodes', count(*)::bigint FROM public.directoryiq_nodes
UNION ALL SELECT 'directoryiq_policy_profiles', count(*)::bigint FROM public.directoryiq_policy_profiles
UNION ALL SELECT 'directoryiq_reinforcement_plans', count(*)::bigint FROM public.directoryiq_reinforcement_plans
UNION ALL SELECT 'directoryiq_settings', count(*)::bigint FROM public.directoryiq_settings
UNION ALL SELECT 'directoryiq_signal_source_credentials', count(*)::bigint FROM public.directoryiq_signal_source_credentials
UNION ALL SELECT 'directoryiq_versions', count(*)::bigint FROM public.directoryiq_versions
ORDER BY table_name;

-- 2) High-value table spot checks
SELECT
  'directoryiq_jobs' AS table_name,
  count(*)::bigint AS row_count,
  min(accepted_at) AS min_ts,
  max(accepted_at) AS max_ts,
  count(DISTINCT user_id)::bigint AS distinct_users
FROM public.directoryiq_jobs
UNION ALL
SELECT
  'directoryiq_nodes',
  count(*)::bigint,
  min(created_at),
  max(updated_at),
  count(DISTINCT user_id)::bigint
FROM public.directoryiq_nodes
UNION ALL
SELECT
  'directoryiq_authority_posts',
  count(*)::bigint,
  min(created_at),
  max(updated_at),
  count(DISTINCT user_id)::bigint
FROM public.directoryiq_authority_posts
UNION ALL
SELECT
  'directoryiq_ingest_runs',
  count(*)::bigint,
  min(started_at),
  max(COALESCE(finished_at, started_at)),
  count(DISTINCT user_id)::bigint
FROM public.directoryiq_ingest_runs
UNION ALL
SELECT
  'directoryiq_listing_upgrades',
  count(*)::bigint,
  min(created_at),
  max(COALESCE(pushed_at, previewed_at, created_at)),
  count(DISTINCT user_id)::bigint
FROM public.directoryiq_listing_upgrades
UNION ALL
SELECT
  'directoryiq_bd_sites',
  count(*)::bigint,
  min(created_at),
  max(updated_at),
  count(DISTINCT user_id)::bigint
FROM public.directoryiq_bd_sites;

-- 3) Null/non-null distributions on key identifiers
SELECT 'directoryiq_jobs.user_id_nulls' AS metric, count(*) FILTER (WHERE user_id IS NULL)::bigint AS value FROM public.directoryiq_jobs
UNION ALL SELECT 'directoryiq_jobs.listing_id_nulls', count(*) FILTER (WHERE listing_id IS NULL)::bigint FROM public.directoryiq_jobs
UNION ALL SELECT 'directoryiq_nodes.user_id_nulls', count(*) FILTER (WHERE user_id IS NULL)::bigint FROM public.directoryiq_nodes
UNION ALL SELECT 'directoryiq_authority_posts.listing_source_id_nulls', count(*) FILTER (WHERE listing_source_id IS NULL)::bigint FROM public.directoryiq_authority_posts
UNION ALL SELECT 'directoryiq_listing_upgrades.created_by_user_id_nulls', count(*) FILTER (WHERE created_by_user_id IS NULL)::bigint FROM public.directoryiq_listing_upgrades
UNION ALL SELECT 'directoryiq_bd_sites.base_url_nulls', count(*) FILTER (WHERE base_url IS NULL)::bigint FROM public.directoryiq_bd_sites
ORDER BY metric;

-- 4) Sequence sanity (destination)
SELECT 'directoryiq_blog_posts_id_seq' AS seq_name, last_value, is_called FROM public.directoryiq_blog_posts_id_seq
UNION ALL SELECT 'directoryiq_blog_sync_runs_id_seq', last_value, is_called FROM public.directoryiq_blog_sync_runs_id_seq
UNION ALL SELECT 'directoryiq_blog_post_links_id_seq', last_value, is_called FROM public.directoryiq_blog_post_links_id_seq
UNION ALL SELECT 'directoryiq_blog_post_mentions_id_seq', last_value, is_called FROM public.directoryiq_blog_post_mentions_id_seq;

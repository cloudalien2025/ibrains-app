-- DirectoryIQ data copy plan (runbook SQL snippets)
-- NOTE: This file is a template of deterministic operations.
-- Execute with explicit SOURCE and DESTINATION URLs from operator shell.
-- No DELETE/TRUNCATE included.

-- Copy order (FK-safe):
-- 1 directoryiq_policy_profiles
-- 2 directoryiq_authority_hubs
-- 3 directoryiq_authority_posts
-- 4 directoryiq_versions
-- 5 directoryiq_reinforcement_plans
-- 6 directoryiq_blog_posts
-- 7 directoryiq_blog_post_links
-- 8 directoryiq_blog_post_mentions
-- 9 directoryiq_blog_sync_runs
-- 10 directoryiq_bd_sites
-- 11 directoryiq_nodes
-- 12 directoryiq_settings
-- 13 directoryiq_signal_source_credentials
-- 14 directoryiq_listing_upgrades
-- 15 directoryiq_ingest_runs
-- 16 directoryiq_jobs
-- 17 directoryiq_audit_events
-- 18 directoryiq_blog_fixes

-- Sequence resets (destination, after load):
SELECT setval(
  'public.directoryiq_blog_posts_id_seq',
  GREATEST(COALESCE((SELECT MAX(id) FROM public.directoryiq_blog_posts), 0), 1),
  COALESCE((SELECT MAX(id) FROM public.directoryiq_blog_posts), 0) > 0
);
SELECT setval(
  'public.directoryiq_blog_sync_runs_id_seq',
  GREATEST(COALESCE((SELECT MAX(id) FROM public.directoryiq_blog_sync_runs), 0), 1),
  COALESCE((SELECT MAX(id) FROM public.directoryiq_blog_sync_runs), 0) > 0
);
SELECT setval(
  'public.directoryiq_blog_post_links_id_seq',
  GREATEST(COALESCE((SELECT MAX(id) FROM public.directoryiq_blog_post_links), 0), 1),
  COALESCE((SELECT MAX(id) FROM public.directoryiq_blog_post_links), 0) > 0
);
SELECT setval(
  'public.directoryiq_blog_post_mentions_id_seq',
  GREATEST(COALESCE((SELECT MAX(id) FROM public.directoryiq_blog_post_mentions), 0), 1),
  COALESCE((SELECT MAX(id) FROM public.directoryiq_blog_post_mentions), 0) > 0
);

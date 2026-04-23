-- Retire legacy DirectoryIQ tables from old shared DB (DATABASE_URL).
-- Scope: only the 18 directoryiq_* tables listed below.
-- Safety: no CASCADE; ordered to satisfy internal FK dependencies.

BEGIN;

DROP TABLE IF EXISTS public.directoryiq_blog_post_links;
DROP TABLE IF EXISTS public.directoryiq_blog_post_mentions;
DROP TABLE IF EXISTS public.directoryiq_versions;
DROP TABLE IF EXISTS public.directoryiq_reinforcement_plans;
DROP TABLE IF EXISTS public.directoryiq_authority_posts;
DROP TABLE IF EXISTS public.directoryiq_authority_hubs;
DROP TABLE IF EXISTS public.directoryiq_blog_posts;
DROP TABLE IF EXISTS public.directoryiq_policy_profiles;

DROP TABLE IF EXISTS public.directoryiq_audit_events;
DROP TABLE IF EXISTS public.directoryiq_bd_sites;
DROP TABLE IF EXISTS public.directoryiq_blog_fixes;
DROP TABLE IF EXISTS public.directoryiq_blog_sync_runs;
DROP TABLE IF EXISTS public.directoryiq_ingest_runs;
DROP TABLE IF EXISTS public.directoryiq_jobs;
DROP TABLE IF EXISTS public.directoryiq_listing_upgrades;
DROP TABLE IF EXISTS public.directoryiq_nodes;
DROP TABLE IF EXISTS public.directoryiq_settings;
DROP TABLE IF EXISTS public.directoryiq_signal_source_credentials;

COMMIT;

-- Read-only ownership introspection queries used for classification

-- 1) FK topology for all public tables
SELECT
  tc.table_name AS source_table,
  kcu.column_name AS source_column,
  ccu.table_name AS target_table,
  ccu.column_name AS target_column,
  tc.constraint_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
ORDER BY tc.table_name, tc.constraint_name;

-- 2) DirectoryIQ migration candidate FK boundaries
WITH moved AS (
  SELECT unnest(ARRAY[
    'directoryiq_audit_events','directoryiq_authority_hubs','directoryiq_authority_posts','directoryiq_bd_sites',
    'directoryiq_blog_fixes','directoryiq_blog_post_links','directoryiq_blog_post_mentions','directoryiq_blog_posts',
    'directoryiq_blog_sync_runs','directoryiq_ingest_runs','directoryiq_jobs','directoryiq_listing_upgrades',
    'directoryiq_nodes','directoryiq_policy_profiles','directoryiq_reinforcement_plans','directoryiq_settings',
    'directoryiq_signal_source_credentials','directoryiq_versions'
  ]) AS table_name
), fks AS (
  SELECT tc.table_name AS source_table, kcu.column_name AS source_column,
         ccu.table_name AS target_table, ccu.column_name AS target_column, tc.constraint_name
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
  JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
  WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema='public'
)
SELECT 'OUTBOUND' AS direction, *
FROM fks
WHERE source_table IN (SELECT table_name FROM moved)
UNION ALL
SELECT 'INBOUND' AS direction, *
FROM fks
WHERE target_table IN (SELECT table_name FROM moved)
  AND source_table NOT IN (SELECT table_name FROM moved)
ORDER BY direction, source_table, constraint_name;

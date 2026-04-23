-- Verify legacy DirectoryIQ tables were removed from old shared DB.

SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name LIKE 'directoryiq_%'
ORDER BY table_name;

SELECT
  COUNT(*)::int AS remaining_directoryiq_table_count
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name LIKE 'directoryiq_%';

-- Siteforge safety check: these must still exist.
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'siteforge_projects',
    'siteforge_sessions',
    'siteforge_connections',
    'siteforge_run_logs',
    'siteforge_snapshots',
    'siteforge_failures',
    'siteforge_project_ai_configs',
    'siteforge_user_workspace_state'
  )
ORDER BY table_name;

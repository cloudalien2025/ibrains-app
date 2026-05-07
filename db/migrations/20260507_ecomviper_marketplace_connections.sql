BEGIN;

CREATE TABLE IF NOT EXISTS marketplace_connections (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  marketplace TEXT NOT NULL,
  account_name TEXT NOT NULL,
  environment TEXT NOT NULL DEFAULT 'production',
  region TEXT NOT NULL DEFAULT 'US',
  status TEXT NOT NULL DEFAULT 'not_connected',
  client_id TEXT,
  masked_client_id TEXT NOT NULL DEFAULT 'Not configured',
  encrypted_client_secret TEXT,
  credential_storage_mode TEXT NOT NULL DEFAULT 'encrypted-db',
  last_token_status TEXT NOT NULL DEFAULT 'unknown',
  last_safe_read_status TEXT NOT NULL DEFAULT 'unknown',
  last_successful_auth_at TIMESTAMPTZ,
  last_successful_read_at TIMESTAMPTZ,
  last_error_code TEXT,
  last_error_message TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'marketplace_connections_marketplace_check'
  ) THEN
    ALTER TABLE marketplace_connections
      ADD CONSTRAINT marketplace_connections_marketplace_check
      CHECK (marketplace = 'walmart');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'marketplace_connections_environment_check'
  ) THEN
    ALTER TABLE marketplace_connections
      ADD CONSTRAINT marketplace_connections_environment_check
      CHECK (environment = 'production');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'marketplace_connections_user_marketplace_key'
  ) THEN
    ALTER TABLE marketplace_connections
      ADD CONSTRAINT marketplace_connections_user_marketplace_key
      UNIQUE (user_id, marketplace);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_marketplace_connections_user_marketplace
  ON marketplace_connections(user_id, marketplace);

COMMIT;

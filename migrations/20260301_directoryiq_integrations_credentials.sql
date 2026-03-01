CREATE TABLE IF NOT EXISTS integrations_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product TEXT NOT NULL,
  provider TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'connected',
  secret_ciphertext TEXT,
  secret_iv TEXT,
  secret_tag TEXT,
  secret_last4 TEXT,
  meta_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  saved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, product, provider)
);

ALTER TABLE integrations_credentials
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'connected';

ALTER TABLE integrations_credentials
  ADD COLUMN IF NOT EXISTS secret_ciphertext TEXT;

ALTER TABLE integrations_credentials
  ADD COLUMN IF NOT EXISTS secret_iv TEXT;

ALTER TABLE integrations_credentials
  ADD COLUMN IF NOT EXISTS secret_tag TEXT;

ALTER TABLE integrations_credentials
  ADD COLUMN IF NOT EXISTS secret_last4 TEXT;

ALTER TABLE integrations_credentials
  ADD COLUMN IF NOT EXISTS meta_json JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE integrations_credentials
  ADD COLUMN IF NOT EXISTS saved_at TIMESTAMPTZ NOT NULL DEFAULT now();

import { Pool, type PoolClient } from "pg";

let pool: Pool | null = null;
let schemaReady = false;
let schemaInitPromise: Promise<void> | null = null;

function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL not configured");
    }
    pool = new Pool({ connectionString });
  }
  return pool;
}

async function ensureSchema(): Promise<void> {
  if (schemaReady) return;
  if (!schemaInitPromise) {
    schemaInitPromise = (async () => {
      const client = getPool();
      await client.query(`
        CREATE EXTENSION IF NOT EXISTS pgcrypto;

        CREATE TABLE IF NOT EXISTS users (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          external_id TEXT UNIQUE,
          email TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS integrations (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          provider TEXT NOT NULL,
          shop_domain TEXT NOT NULL,
          access_token_ciphertext TEXT NOT NULL,
          scopes TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'connected',
          installed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          last_verified_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          UNIQUE (user_id, provider, shop_domain)
        );

        CREATE TABLE IF NOT EXISTS oauth_states (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          provider TEXT NOT NULL,
          shop_domain TEXT NOT NULL,
          state TEXT NOT NULL UNIQUE,
          expires_at TIMESTAMPTZ NOT NULL,
          used_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS ingest_runs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          integration_id UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
          status TEXT NOT NULL,
          started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          finished_at TIMESTAMPTZ,
          products_count INTEGER NOT NULL DEFAULT 0,
          articles_count INTEGER NOT NULL DEFAULT 0,
          pages_count INTEGER NOT NULL DEFAULT 0,
          collections_count INTEGER NOT NULL DEFAULT 0,
          error_message TEXT
        );

        CREATE TABLE IF NOT EXISTS site_nodes (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          integration_id UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
          node_type TEXT NOT NULL,
          source_id TEXT NOT NULL,
          handle TEXT,
          title TEXT NOT NULL,
          url TEXT,
          tags JSONB NOT NULL DEFAULT '[]',
          body_text TEXT,
          body_html TEXT,
          image_url TEXT,
          published_at TIMESTAMPTZ,
          updated_at_source TIMESTAMPTZ,
          raw_json JSONB NOT NULL DEFAULT '{}',
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          UNIQUE (integration_id, source_id)
        );

        CREATE INDEX IF NOT EXISTS idx_site_nodes_integration_type
          ON site_nodes(integration_id, node_type);

        CREATE TABLE IF NOT EXISTS product_blog_links (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          integration_id UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
          product_node_id UUID NOT NULL REFERENCES site_nodes(id) ON DELETE CASCADE,
          article_node_id UUID NOT NULL REFERENCES site_nodes(id) ON DELETE CASCADE,
          score NUMERIC NOT NULL,
          reason TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          UNIQUE (product_node_id, article_node_id)
        );

        CREATE TABLE IF NOT EXISTS byo_api_keys (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          provider TEXT NOT NULL,
          key_ciphertext TEXT NOT NULL,
          key_last4 TEXT,
          key_length INTEGER,
          label TEXT,
          last_verified_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          UNIQUE (user_id, provider)
        );

        ALTER TABLE byo_api_keys
          ADD COLUMN IF NOT EXISTS key_last4 TEXT;

        ALTER TABLE byo_api_keys
          ADD COLUMN IF NOT EXISTS key_length INTEGER;

        ALTER TABLE byo_api_keys
          ADD COLUMN IF NOT EXISTS last_verified_at TIMESTAMPTZ;

        CREATE TABLE IF NOT EXISTS directoryiq_signal_source_credentials (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          connector_id TEXT NOT NULL,
          secret_ciphertext TEXT NOT NULL,
          secret_last4 TEXT,
          secret_length INTEGER,
          label TEXT,
          last_verified_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          UNIQUE (user_id, connector_id)
        );

        ALTER TABLE directoryiq_signal_source_credentials
          ADD COLUMN IF NOT EXISTS secret_last4 TEXT;

        ALTER TABLE directoryiq_signal_source_credentials
          ADD COLUMN IF NOT EXISTS secret_length INTEGER;

        ALTER TABLE directoryiq_signal_source_credentials
          ADD COLUMN IF NOT EXISTS last_verified_at TIMESTAMPTZ;
      `);
      schemaReady = true;
    })().catch((error) => {
      schemaInitPromise = null;
      throw error;
    });
  }
  await schemaInitPromise;
}

export async function query<T>(text: string, params: unknown[] = []): Promise<T[]> {
  await ensureSchema();
  const result = await getPool().query(text, params);
  return result.rows as T[];
}

export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  await ensureSchema();
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

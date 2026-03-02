import { Pool, type PoolClient } from "pg";

let pool: Pool | null = null;
let schemaReady = false;
let schemaInitPromise: Promise<void> | null = null;
let loggedSelfSignedMode = false;

function shouldAllowSelfSignedDbSsl(connectionString: string): boolean {
  const explicitAllow =
    process.env.DATABASE_SSL_ALLOW_SELF_SIGNED === "1" ||
    process.env.PGSSLMODE === "no-verify";
  if (explicitAllow) return true;

  const isDev = process.env.NODE_ENV !== "production";
  const hasRequireMode = /sslmode=require/i.test(connectionString);
  return isDev && hasRequireMode;
}

function toNoVerifyConnectionString(connectionString: string): string {
  if (!/sslmode=/i.test(connectionString)) {
    const joiner = connectionString.includes("?") ? "&" : "?";
    return `${connectionString}${joiner}sslmode=no-verify`;
  }
  return connectionString.replace(/sslmode=([^&]+)/i, "sslmode=no-verify");
}

function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL not configured");
    }
    const allowSelfSigned = shouldAllowSelfSignedDbSsl(connectionString);
    if (allowSelfSigned && !loggedSelfSignedMode) {
      loggedSelfSignedMode = true;
      console.warn(
        "[db] Allowing self-signed PostgreSQL TLS certificate validation bypass (dev mode or DATABASE_SSL_ALLOW_SELF_SIGNED=1)."
      );
    }
    const resolvedConnectionString = allowSelfSigned
      ? toNoVerifyConnectionString(connectionString)
      : connectionString;
    pool = new Pool({
      connectionString: resolvedConnectionString,
      ssl: allowSelfSigned ? { rejectUnauthorized: false } : undefined,
    });
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
          config_json JSONB NOT NULL DEFAULT '{}'::jsonb,
          last_verified_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          UNIQUE (user_id, connector_id)
        );

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

        ALTER TABLE directoryiq_signal_source_credentials
          ADD COLUMN IF NOT EXISTS secret_last4 TEXT;

        ALTER TABLE directoryiq_signal_source_credentials
          ADD COLUMN IF NOT EXISTS secret_length INTEGER;

        ALTER TABLE directoryiq_signal_source_credentials
          ADD COLUMN IF NOT EXISTS last_verified_at TIMESTAMPTZ;

        ALTER TABLE directoryiq_signal_source_credentials
          ADD COLUMN IF NOT EXISTS config_json JSONB NOT NULL DEFAULT '{}'::jsonb;

        CREATE TABLE IF NOT EXISTS directoryiq_ingest_runs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          status TEXT NOT NULL,
          source_base_url TEXT,
          started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          finished_at TIMESTAMPTZ,
          listings_count INTEGER NOT NULL DEFAULT 0,
          blog_posts_count INTEGER NOT NULL DEFAULT 0,
          error_message TEXT
        );

        CREATE TABLE IF NOT EXISTS directoryiq_nodes (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          source_type TEXT NOT NULL,
          source_id TEXT NOT NULL,
          title TEXT,
          url TEXT,
          updated_at_source TIMESTAMPTZ,
          raw_json JSONB NOT NULL DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          UNIQUE (user_id, source_type, source_id)
        );

        CREATE TABLE IF NOT EXISTS directoryiq_settings (
          user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
          vertical_override TEXT,
          risk_tier_overrides_json JSONB NOT NULL DEFAULT '{}'::jsonb,
          image_style_preference TEXT NOT NULL DEFAULT 'editorial clean',
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS directoryiq_authority_posts (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          listing_source_id TEXT NOT NULL,
          slot_index INTEGER NOT NULL CHECK (slot_index >= 1 AND slot_index <= 4),
          post_type TEXT NOT NULL,
          focus_topic TEXT NOT NULL DEFAULT '',
          title TEXT,
          status TEXT NOT NULL DEFAULT 'not_created',
          draft_markdown TEXT,
          draft_html TEXT,
          featured_image_prompt TEXT,
          featured_image_url TEXT,
          published_post_id TEXT,
          published_url TEXT,
          blog_to_listing_link_status TEXT NOT NULL DEFAULT 'missing',
          listing_to_blog_link_status TEXT NOT NULL DEFAULT 'missing',
          metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          UNIQUE (user_id, listing_source_id, slot_index)
        );

        CREATE INDEX IF NOT EXISTS idx_directoryiq_authority_posts_listing
          ON directoryiq_authority_posts(user_id, listing_source_id);

        CREATE TABLE IF NOT EXISTS directoryiq_versions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          listing_source_id TEXT NOT NULL,
          authority_post_id UUID REFERENCES directoryiq_authority_posts(id) ON DELETE SET NULL,
          action_type TEXT NOT NULL,
          version_label TEXT NOT NULL,
          score_snapshot_json JSONB NOT NULL DEFAULT '{}'::jsonb,
          content_delta_json JSONB NOT NULL DEFAULT '{}'::jsonb,
          link_delta_json JSONB NOT NULL DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );

        CREATE INDEX IF NOT EXISTS idx_directoryiq_versions_user_created
          ON directoryiq_versions(user_id, created_at DESC);

        CREATE TABLE IF NOT EXISTS directoryiq_listing_upgrades (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          listing_source_id TEXT NOT NULL,
          created_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          original_description_hash TEXT NOT NULL,
          original_description TEXT NOT NULL DEFAULT '',
          proposed_description TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'draft',
          bd_update_ref TEXT,
          bd_status TEXT,
          bd_response_excerpt TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          previewed_at TIMESTAMPTZ,
          pushed_at TIMESTAMPTZ
        );

        ALTER TABLE directoryiq_listing_upgrades
          ADD COLUMN IF NOT EXISTS bd_status TEXT;

        ALTER TABLE directoryiq_listing_upgrades
          ADD COLUMN IF NOT EXISTS bd_response_excerpt TEXT;

        CREATE INDEX IF NOT EXISTS idx_directoryiq_listing_upgrades_listing
          ON directoryiq_listing_upgrades(user_id, listing_source_id, created_at DESC);

        CREATE TABLE IF NOT EXISTS brain_snapshots (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          brain_id TEXT NOT NULL,
          snapshot_json JSONB NOT NULL DEFAULT '[]'::jsonb,
          snapshot_status TEXT NOT NULL DEFAULT 'needs_connection',
          snapshot_updated_at TIMESTAMPTZ,
          hints_json JSONB NOT NULL DEFAULT '[]'::jsonb,
          last_error TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          UNIQUE (user_id, brain_id)
        );

        CREATE TABLE IF NOT EXISTS snapshot_refresh_locks (
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          brain_id TEXT NOT NULL,
          locked_until TIMESTAMPTZ NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          PRIMARY KEY (user_id, brain_id)
        );

        CREATE TABLE IF NOT EXISTS connected_sites (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          brain_id TEXT NOT NULL,
          connection_type TEXT NOT NULL,
          base_url TEXT NOT NULL,
          sitemap_url_used TEXT,
          robots_txt_url TEXT,
          status TEXT NOT NULL DEFAULT 'connected',
          use_decodo BOOLEAN NOT NULL DEFAULT false,
          respect_robots BOOLEAN NOT NULL DEFAULT true,
          progress_stage TEXT NOT NULL DEFAULT 'idle',
          counts_json JSONB NOT NULL DEFAULT '{}'::jsonb,
          last_error TEXT,
          last_analyzed_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );

        CREATE INDEX IF NOT EXISTS idx_connected_sites_user_brain_updated
          ON connected_sites(user_id, brain_id, updated_at DESC);

        CREATE TABLE IF NOT EXISTS surfaces (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          brain_id TEXT NOT NULL,
          connected_site_id UUID NOT NULL REFERENCES connected_sites(id) ON DELETE CASCADE,
          url TEXT NOT NULL,
          url_hash TEXT NOT NULL,
          canonical_url TEXT,
          type TEXT NOT NULL DEFAULT 'unknown',
          lastmod TIMESTAMPTZ,
          http_status INTEGER,
          title TEXT,
          meta_description TEXT,
          h1 TEXT,
          extracted_text TEXT,
          jsonld_blobs JSONB,
          outbound_internal_links JSONB,
          fetched_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          UNIQUE (user_id, brain_id, url_hash)
        );

        CREATE INDEX IF NOT EXISTS idx_surfaces_site_type
          ON surfaces(connected_site_id, type);

        CREATE TABLE IF NOT EXISTS serp_competitors (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          brain_id TEXT NOT NULL,
          connected_site_id UUID NOT NULL REFERENCES connected_sites(id) ON DELETE CASCADE,
          query TEXT NOT NULL,
          results_json JSONB NOT NULL DEFAULT '[]'::jsonb,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );

        CREATE INDEX IF NOT EXISTS idx_serp_competitors_site
          ON serp_competitors(connected_site_id, created_at DESC);

        DO $$ BEGIN
          CREATE TYPE content_node_type AS ENUM ('listing', 'blog_post', 'support_post', 'hub_post');
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;

        DO $$ BEGIN
          CREATE TYPE content_source_type AS ENUM ('bd', 'site_crawl', 'generated');
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;

        DO $$ BEGIN
          CREATE TYPE content_edge_type AS ENUM ('explicit_link', 'implied_mention', 'thematic_association', 'category_association');
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;

        DO $$ BEGIN
          CREATE TYPE mention_resolution_method AS ENUM ('exact', 'alias', 'fuzzy', 'ai');
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;

        CREATE TABLE IF NOT EXISTS content_nodes (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          node_type content_node_type NOT NULL,
          external_id TEXT,
          url TEXT NOT NULL,
          title TEXT NOT NULL,
          slug TEXT NOT NULL,
          excerpt TEXT,
          clean_text TEXT NOT NULL DEFAULT '',
          raw_html TEXT,
          headings_json JSONB NOT NULL DEFAULT '[]'::jsonb,
          images_json JSONB NOT NULL DEFAULT '[]'::jsonb,
          published_at TIMESTAMPTZ,
          author TEXT,
          source content_source_type NOT NULL,
          content_hash TEXT NOT NULL,
          last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          UNIQUE (tenant_id, node_type, url)
        );

        CREATE INDEX IF NOT EXISTS idx_content_nodes_tenant_type
          ON content_nodes(tenant_id, node_type, updated_at DESC);

        CREATE INDEX IF NOT EXISTS idx_content_nodes_tenant_slug
          ON content_nodes(tenant_id, slug);

        CREATE TABLE IF NOT EXISTS content_edges (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          from_node_id UUID NOT NULL REFERENCES content_nodes(id) ON DELETE CASCADE,
          to_node_id UUID NOT NULL REFERENCES content_nodes(id) ON DELETE CASCADE,
          edge_type content_edge_type NOT NULL,
          anchor_text TEXT,
          evidence_snippet TEXT,
          strength_score NUMERIC NOT NULL DEFAULT 0.5,
          first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          CHECK (strength_score >= 0 AND strength_score <= 1),
          UNIQUE (tenant_id, from_node_id, to_node_id, edge_type, COALESCE(anchor_text, ''))
        );

        CREATE INDEX IF NOT EXISTS idx_content_edges_tenant_type
          ON content_edges(tenant_id, edge_type, last_seen_at DESC);

        CREATE TABLE IF NOT EXISTS listing_aliases (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          listing_node_id UUID NOT NULL REFERENCES content_nodes(id) ON DELETE CASCADE,
          alias TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          UNIQUE (tenant_id, listing_node_id, alias)
        );

        CREATE TABLE IF NOT EXISTS entity_mentions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          blog_node_id UUID NOT NULL REFERENCES content_nodes(id) ON DELETE CASCADE,
          mention_text TEXT NOT NULL,
          mention_type TEXT NOT NULL,
          evidence_snippet TEXT,
          confidence NUMERIC NOT NULL DEFAULT 0.5,
          resolved_listing_node_id UUID REFERENCES content_nodes(id) ON DELETE SET NULL,
          resolution_method mention_resolution_method,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          CHECK (confidence >= 0 AND confidence <= 1)
        );

        CREATE INDEX IF NOT EXISTS idx_entity_mentions_blog
          ON entity_mentions(tenant_id, blog_node_id, created_at DESC);

        CREATE TABLE IF NOT EXISTS serp_snapshots (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          query TEXT NOT NULL,
          results_json JSONB NOT NULL DEFAULT '[]'::jsonb,
          fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          ttl_expires_at TIMESTAMPTZ NOT NULL,
          UNIQUE (tenant_id, query)
        );

        CREATE TABLE IF NOT EXISTS authority_actions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          action_type TEXT NOT NULL,
          target_node_id UUID REFERENCES content_nodes(id) ON DELETE SET NULL,
          status TEXT NOT NULL,
          details_json JSONB NOT NULL DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );

        CREATE INDEX IF NOT EXISTS idx_authority_actions_tenant_created
          ON authority_actions(tenant_id, created_at DESC);
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

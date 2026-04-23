-- DirectoryIQ schema extracted from shared ibrains-postgres (read-only introspection)
-- FK constraints to public.users intentionally omitted for split-db isolation.
BEGIN;
CREATE SEQUENCE IF NOT EXISTS public.directoryiq_blog_post_links_id_seq;
CREATE SEQUENCE IF NOT EXISTS public.directoryiq_blog_post_mentions_id_seq;
CREATE SEQUENCE IF NOT EXISTS public.directoryiq_blog_posts_id_seq;
CREATE SEQUENCE IF NOT EXISTS public.directoryiq_blog_sync_runs_id_seq;
CREATE TABLE IF NOT EXISTS public.directoryiq_audit_events (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  req_id text NOT NULL,
  user_id uuid NOT NULL,
  listing_source_id text NOT NULL,
  action text NOT NULL,
  status text NOT NULL,
  details text,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.directoryiq_authority_hubs (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  policy_profile_id uuid,
  hub_type text NOT NULL,
  title text NOT NULL,
  canonical_url text NOT NULL,
  scope jsonb DEFAULT '{}'::jsonb NOT NULL,
  status text DEFAULT 'draft'::text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.directoryiq_authority_posts (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  listing_source_id text NOT NULL,
  slot_index integer NOT NULL,
  post_type text NOT NULL,
  focus_topic text DEFAULT ''::text NOT NULL,
  title text,
  status text DEFAULT 'not_created'::text NOT NULL,
  draft_markdown text,
  draft_html text,
  featured_image_prompt text,
  featured_image_url text,
  published_post_id text,
  published_url text,
  blog_to_listing_link_status text DEFAULT 'missing'::text NOT NULL,
  listing_to_blog_link_status text DEFAULT 'missing'::text NOT NULL,
  metadata_json jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.directoryiq_bd_sites (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  label text,
  base_url text NOT NULL,
  enabled boolean DEFAULT true NOT NULL,
  listings_data_id integer,
  blog_posts_data_id integer,
  listings_path text DEFAULT '/api/v2/users_portfolio_groups/search'::text NOT NULL,
  blog_posts_path text,
  ingest_checkpoint_json jsonb DEFAULT '{}'::jsonb NOT NULL,
  secret_ciphertext text,
  secret_last4 text,
  secret_length integer,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  bd_api_key_ciphertext text,
  bd_api_key_last4 text
);
CREATE TABLE IF NOT EXISTS public.directoryiq_blog_fixes (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  blog_source_id text NOT NULL,
  status text NOT NULL,
  payload_json jsonb DEFAULT '{}'::jsonb NOT NULL,
  pushed_to_bd boolean DEFAULT false NOT NULL,
  notes text,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.directoryiq_blog_post_links (
  id bigint DEFAULT nextval('directoryiq_blog_post_links_id_seq'::regclass) NOT NULL,
  blog_post_id bigint NOT NULL,
  listing_user_id text NOT NULL,
  has_link boolean DEFAULT false NOT NULL,
  anchor_text text,
  link_url text,
  link_quality text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.directoryiq_blog_post_mentions (
  id bigint DEFAULT nextval('directoryiq_blog_post_mentions_id_seq'::regclass) NOT NULL,
  blog_post_id bigint NOT NULL,
  listing_user_id text NOT NULL,
  mention_type text NOT NULL,
  evidence jsonb,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.directoryiq_blog_posts (
  id bigint DEFAULT nextval('directoryiq_blog_posts_id_seq'::regclass) NOT NULL,
  source text NOT NULL,
  source_post_id text NOT NULL,
  url text,
  title text NOT NULL,
  slug text,
  status text DEFAULT 'unknown'::text NOT NULL,
  excerpt text,
  content_text text,
  published_at timestamp with time zone,
  updated_at_source timestamp with time zone,
  last_synced_at timestamp with time zone DEFAULT now() NOT NULL,
  metadata_json jsonb
);
CREATE TABLE IF NOT EXISTS public.directoryiq_blog_sync_runs (
  id bigint DEFAULT nextval('directoryiq_blog_sync_runs_id_seq'::regclass) NOT NULL,
  started_at timestamp with time zone DEFAULT now() NOT NULL,
  finished_at timestamp with time zone,
  status text NOT NULL,
  summary_json jsonb,
  error_text text
);
CREATE TABLE IF NOT EXISTS public.directoryiq_ingest_runs (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  status text NOT NULL,
  source_base_url text,
  started_at timestamp with time zone DEFAULT now() NOT NULL,
  finished_at timestamp with time zone,
  listings_count integer DEFAULT 0 NOT NULL,
  blog_posts_count integer DEFAULT 0 NOT NULL,
  error_message text
);
CREATE TABLE IF NOT EXISTS public.directoryiq_jobs (
  id text NOT NULL,
  req_id text NOT NULL,
  user_id uuid NOT NULL,
  kind text NOT NULL,
  status text NOT NULL,
  stage text NOT NULL,
  listing_id text NOT NULL,
  site_id text,
  slot integer,
  accepted_at timestamp with time zone NOT NULL,
  started_at timestamp with time zone,
  finished_at timestamp with time zone,
  result_json jsonb,
  error_json jsonb
);
CREATE TABLE IF NOT EXISTS public.directoryiq_listing_upgrades (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  listing_source_id text NOT NULL,
  created_by_user_id uuid NOT NULL,
  original_description_hash text NOT NULL,
  original_description text DEFAULT ''::text NOT NULL,
  proposed_description text NOT NULL,
  status text DEFAULT 'draft'::text NOT NULL,
  bd_update_ref text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  previewed_at timestamp with time zone,
  pushed_at timestamp with time zone,
  bd_status text,
  bd_response_excerpt text
);
CREATE TABLE IF NOT EXISTS public.directoryiq_nodes (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  source_type text NOT NULL,
  source_id text NOT NULL,
  title text,
  url text,
  updated_at_source timestamp with time zone,
  raw_json jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  bd_site_id uuid
);
CREATE TABLE IF NOT EXISTS public.directoryiq_policy_profiles (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  name text NOT NULL,
  version integer DEFAULT 1 NOT NULL,
  config jsonb DEFAULT '{}'::jsonb NOT NULL,
  is_default boolean DEFAULT false NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.directoryiq_reinforcement_plans (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  hub_id uuid,
  policy_profile_id uuid,
  plan_kind text DEFAULT 'dry_run'::text NOT NULL,
  input_snapshot jsonb DEFAULT '{}'::jsonb NOT NULL,
  plan jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.directoryiq_settings (
  user_id uuid NOT NULL,
  vertical_override text,
  risk_tier_overrides_json jsonb DEFAULT '{}'::jsonb NOT NULL,
  image_style_preference text DEFAULT 'editorial clean'::text NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.directoryiq_signal_source_credentials (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  connector_id text NOT NULL,
  secret_ciphertext text NOT NULL,
  secret_last4 text,
  secret_length integer,
  label text,
  last_verified_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  config_json jsonb DEFAULT '{}'::jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS public.directoryiq_versions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  listing_source_id text NOT NULL,
  authority_post_id uuid,
  action_type text NOT NULL,
  version_label text NOT NULL,
  score_snapshot_json jsonb DEFAULT '{}'::jsonb NOT NULL,
  content_delta_json jsonb DEFAULT '{}'::jsonb NOT NULL,
  link_delta_json jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE ONLY public.directoryiq_audit_events ADD CONSTRAINT directoryiq_audit_events_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.directoryiq_authority_hubs ADD CONSTRAINT directoryiq_authority_hubs_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.directoryiq_authority_posts ADD CONSTRAINT directoryiq_authority_posts_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.directoryiq_authority_posts ADD CONSTRAINT directoryiq_authority_posts_slot_index_check CHECK (slot_index >= 1 AND slot_index <= 5);
ALTER TABLE ONLY public.directoryiq_authority_posts ADD CONSTRAINT directoryiq_authority_posts_user_id_listing_source_id_slot__key UNIQUE (user_id, listing_source_id, slot_index);
ALTER TABLE ONLY public.directoryiq_bd_sites ADD CONSTRAINT directoryiq_bd_sites_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.directoryiq_bd_sites ADD CONSTRAINT directoryiq_bd_sites_user_id_base_url_key UNIQUE (user_id, base_url);
ALTER TABLE ONLY public.directoryiq_blog_fixes ADD CONSTRAINT directoryiq_blog_fixes_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.directoryiq_blog_post_links ADD CONSTRAINT directoryiq_blog_post_links_blog_post_id_listing_user_id_key UNIQUE (blog_post_id, listing_user_id);
ALTER TABLE ONLY public.directoryiq_blog_post_links ADD CONSTRAINT directoryiq_blog_post_links_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.directoryiq_blog_post_mentions ADD CONSTRAINT directoryiq_blog_post_mention_blog_post_id_listing_user_id__key UNIQUE (blog_post_id, listing_user_id, mention_type);
ALTER TABLE ONLY public.directoryiq_blog_post_mentions ADD CONSTRAINT directoryiq_blog_post_mentions_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.directoryiq_blog_posts ADD CONSTRAINT directoryiq_blog_posts_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.directoryiq_blog_posts ADD CONSTRAINT directoryiq_blog_posts_source_source_post_id_key UNIQUE (source, source_post_id);
ALTER TABLE ONLY public.directoryiq_blog_post_links ADD CONSTRAINT directoryiq_blog_post_links_blog_post_id_fkey FOREIGN KEY (blog_post_id) REFERENCES directoryiq_blog_posts(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.directoryiq_blog_post_mentions ADD CONSTRAINT directoryiq_blog_post_mentions_blog_post_id_fkey FOREIGN KEY (blog_post_id) REFERENCES directoryiq_blog_posts(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.directoryiq_blog_sync_runs ADD CONSTRAINT directoryiq_blog_sync_runs_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.directoryiq_ingest_runs ADD CONSTRAINT directoryiq_ingest_runs_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.directoryiq_jobs ADD CONSTRAINT directoryiq_jobs_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.directoryiq_listing_upgrades ADD CONSTRAINT directoryiq_listing_upgrades_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.directoryiq_nodes ADD CONSTRAINT directoryiq_nodes_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.directoryiq_nodes ADD CONSTRAINT directoryiq_nodes_user_id_source_type_source_id_key UNIQUE (user_id, source_type, source_id);
ALTER TABLE ONLY public.directoryiq_policy_profiles ADD CONSTRAINT directoryiq_policy_profiles_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.directoryiq_authority_hubs ADD CONSTRAINT directoryiq_authority_hubs_policy_profile_id_fkey FOREIGN KEY (policy_profile_id) REFERENCES directoryiq_policy_profiles(id);
ALTER TABLE ONLY public.directoryiq_reinforcement_plans ADD CONSTRAINT directoryiq_reinforcement_plans_hub_id_fkey FOREIGN KEY (hub_id) REFERENCES directoryiq_authority_hubs(id);
ALTER TABLE ONLY public.directoryiq_reinforcement_plans ADD CONSTRAINT directoryiq_reinforcement_plans_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.directoryiq_reinforcement_plans ADD CONSTRAINT directoryiq_reinforcement_plans_policy_profile_id_fkey FOREIGN KEY (policy_profile_id) REFERENCES directoryiq_policy_profiles(id);
ALTER TABLE ONLY public.directoryiq_settings ADD CONSTRAINT directoryiq_settings_pkey PRIMARY KEY (user_id);
ALTER TABLE ONLY public.directoryiq_signal_source_credentials ADD CONSTRAINT directoryiq_signal_source_credentials_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.directoryiq_signal_source_credentials ADD CONSTRAINT directoryiq_signal_source_credentials_user_id_connector_id_key UNIQUE (user_id, connector_id);
ALTER TABLE ONLY public.directoryiq_versions ADD CONSTRAINT directoryiq_versions_authority_post_id_fkey FOREIGN KEY (authority_post_id) REFERENCES directoryiq_authority_posts(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.directoryiq_versions ADD CONSTRAINT directoryiq_versions_pkey PRIMARY KEY (id);
CREATE INDEX IF NOT EXISTS directoryiq_authority_hubs_user_status_idx ON public.directoryiq_authority_hubs USING btree (user_id, status);
CREATE INDEX IF NOT EXISTS directoryiq_authority_hubs_user_type_idx ON public.directoryiq_authority_hubs USING btree (user_id, hub_type);
CREATE UNIQUE INDEX IF NOT EXISTS directoryiq_authority_hubs_user_canonical_url_uq ON public.directoryiq_authority_hubs USING btree (user_id, canonical_url);
CREATE INDEX IF NOT EXISTS idx_directoryiq_authority_posts_listing ON public.directoryiq_authority_posts USING btree (user_id, listing_source_id);
CREATE INDEX IF NOT EXISTS idx_directoryiq_bd_sites_user_id ON public.directoryiq_bd_sites USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_directoryiq_blog_post_links_link_quality ON public.directoryiq_blog_post_links USING btree (link_quality);
CREATE INDEX IF NOT EXISTS idx_directoryiq_blog_post_mentions_listing_user_id ON public.directoryiq_blog_post_mentions USING btree (listing_user_id);
CREATE INDEX IF NOT EXISTS idx_directoryiq_blog_posts_last_synced_desc ON public.directoryiq_blog_posts USING btree (last_synced_at DESC);
CREATE INDEX IF NOT EXISTS idx_directoryiq_blog_posts_status ON public.directoryiq_blog_posts USING btree (status);
CREATE INDEX IF NOT EXISTS idx_directoryiq_jobs_user_accepted ON public.directoryiq_jobs USING btree (user_id, accepted_at DESC);
CREATE INDEX IF NOT EXISTS idx_directoryiq_listing_upgrades_listing ON public.directoryiq_listing_upgrades USING btree (user_id, listing_source_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_directoryiq_nodes_site ON public.directoryiq_nodes USING btree (user_id, bd_site_id, source_type);
CREATE INDEX IF NOT EXISTS directoryiq_policy_profiles_user_default_idx ON public.directoryiq_policy_profiles USING btree (user_id, is_default);
CREATE UNIQUE INDEX IF NOT EXISTS directoryiq_policy_profiles_user_name_uq ON public.directoryiq_policy_profiles USING btree (user_id, name);
CREATE INDEX IF NOT EXISTS directoryiq_reinforcement_plans_user_created_at_idx ON public.directoryiq_reinforcement_plans USING btree (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS directoryiq_reinforcement_plans_user_hub_idx ON public.directoryiq_reinforcement_plans USING btree (user_id, hub_id);
CREATE INDEX IF NOT EXISTS idx_directoryiq_versions_user_created ON public.directoryiq_versions USING btree (user_id, created_at DESC);
ALTER SEQUENCE public.directoryiq_blog_post_links_id_seq OWNED BY public.directoryiq_blog_post_links.id;
ALTER SEQUENCE public.directoryiq_blog_post_mentions_id_seq OWNED BY public.directoryiq_blog_post_mentions.id;
ALTER SEQUENCE public.directoryiq_blog_posts_id_seq OWNED BY public.directoryiq_blog_posts.id;
ALTER SEQUENCE public.directoryiq_blog_sync_runs_id_seq OWNED BY public.directoryiq_blog_sync_runs.id;
COMMIT;

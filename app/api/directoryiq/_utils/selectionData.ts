import { query } from "@/app/api/ecomviper/_utils/db";
import { listBdSiteRows } from "@/app/api/directoryiq/_utils/bdSites";
import crypto from "crypto";
import {
  computeSiteReadiness,
  detectVerticalFromSignals,
  evaluateListingSelection,
  type AuthorityPostInput,
  type DirectoryIqVerticalId,
  type ListingSelectionEvaluation,
  type ListingSelectionInput,
  type PostType,
  type RiskTier,
} from "@/lib/directoryiq/selectionEngine";
import { AUTHORITY_SLOT_COUNT, AUTHORITY_SLOT_MIN } from "@/lib/directoryiq/authoritySlotContract";
import type {
  Step2DraftStatus,
  Step2ImageStatus,
  Step2LinkStatus,
  Step2PublishStatus,
  Step2ReviewStatus,
} from "@/lib/directoryiq/step2SlotWorkflowContract";

type ListingRow = {
  source_id: string;
  bd_site_id: string | null;
  title: string | null;
  url: string | null;
  updated_at: string;
  raw_json: Record<string, unknown>;
};

type AuthorityPostRow = {
  id: string;
  listing_source_id: string;
  slot_index: number;
  post_type: string;
  focus_topic: string;
  title: string | null;
  status: "not_created" | "draft" | "published";
  draft_markdown: string | null;
  draft_html: string | null;
  featured_image_prompt: string | null;
  featured_image_url: string | null;
  published_post_id: string | null;
  published_url: string | null;
  blog_to_listing_link_status: "linked" | "missing";
  listing_to_blog_link_status: "linked" | "missing";
  metadata_json: Record<string, unknown> | null;
  updated_at: string;
};

export type PersistedStep2State = {
  draft_status: Step2DraftStatus;
  image_status: Step2ImageStatus;
  review_status: Step2ReviewStatus;
  publish_status: Step2PublishStatus;
  blog_to_listing_link_status: Step2LinkStatus;
  listing_to_blog_link_status: Step2LinkStatus;
  draft_version: number;
  image_version: number;
  draft_generated_at: string | null;
  image_generated_at: string | null;
  draft_last_error_code: string | null;
  draft_last_error_message: string | null;
  image_last_error_code: string | null;
  image_last_error_message: string | null;
  approved_at: string | null;
  approved_snapshot_draft_version: number | null;
  approved_snapshot_image_version: number | null;
  publish_attempted_at: string | null;
  publish_completed_at: string | null;
  published_post_id: string | null;
  published_url: string | null;
  publish_last_error_code: string | null;
  publish_last_error_message: string | null;
  publish_last_req_id: string | null;
  last_link_error_code: string | null;
  last_link_error_message: string | null;
};

export type PersistedStep2ResearchState =
  | "not_started"
  | "queued"
  | "researching"
  | "ready"
  | "ready_thin"
  | "ready_grounded"
  | "failed";

type SettingsRow = {
  vertical_override: string | null;
  risk_tier_overrides_json: Record<string, unknown> | null;
  image_style_preference: string | null;
  updated_at: string;
};

type ListingUpgradeRow = {
  id: string;
  user_id: string;
  listing_source_id: string;
  created_by_user_id: string;
  original_description_hash: string;
  original_description: string;
  proposed_description: string;
  status: "draft" | "previewed" | "pushed";
  bd_update_ref: string | null;
  created_at: string;
  previewed_at: string | null;
  pushed_at: string | null;
};

export type DirectoryIqSettings = {
  verticalOverride: DirectoryIqVerticalId | null;
  riskTierOverrides: Partial<Record<DirectoryIqVerticalId, RiskTier>>;
  imageStylePreference: string;
  updatedAt: string | null;
};

export type ListingCard = {
  sourceId: string;
  listingId: string;
  name: string;
  url: string | null;
  category: string | null;
  authorityStatus: "Strong" | "Needs Support";
  trustStatus: "Strong" | "Needs Trust";
  lastOptimized: string | null;
  evaluation: ListingSelectionEvaluation;
  siteId?: string | null;
  siteLabel?: string | null;
};

export type ListingCandidate = {
  sourceId: string;
  siteId: string | null;
  siteLabel: string | null;
};

function toPostType(value: string): PostType {
  if (value === "comparison" || value === "best_of" || value === "contextual_guide" || value === "persona_intent") {
    return value;
  }
  return "contextual_guide";
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function readListingCategory(raw: Record<string, unknown>): string | null {
  const primaryCategory = raw.primary_category;
  const candidates = [
    asString(raw.group_category),
    asString(raw.category),
    asString(raw.category_name),
    typeof primaryCategory === "string" ? primaryCategory : asString((primaryCategory as Record<string, unknown> | undefined)?.name),
    asString(raw.listing_category),
  ];

  for (const candidate of candidates) {
    const trimmed = candidate.trim();
    if (trimmed) return trimmed;
  }

  return null;
}

function readListingId(raw: Record<string, unknown>, fallback: string): string {
  const fromRaw = asString(raw.listing_id);
  return fromRaw || fallback;
}

function asArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function hashText(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asNullableString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function asNonNegativeInteger(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) return Math.floor(value);
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed >= 0) return Math.floor(parsed);
  }
  return fallback;
}

function coerceStep2Status<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  if (typeof value !== "string") return fallback;
  return (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

export function readPersistedStep2State(metadata: Record<string, unknown> | null | undefined): PersistedStep2State {
  const step2 = asRecord(asRecord(metadata).step2_state);
  return {
    draft_status: coerceStep2Status(step2.draft_status, ["not_started", "generating", "ready", "failed"], "not_started"),
    image_status: coerceStep2Status(step2.image_status, ["not_started", "generating", "ready", "failed"], "not_started"),
    review_status: coerceStep2Status(step2.review_status, ["not_ready", "ready", "approved"], "not_ready"),
    publish_status: coerceStep2Status(step2.publish_status, ["not_started", "publishing", "published", "failed"], "not_started"),
    blog_to_listing_link_status: coerceStep2Status(step2.blog_to_listing_link_status, ["not_started", "linked", "failed"], "not_started"),
    listing_to_blog_link_status: coerceStep2Status(step2.listing_to_blog_link_status, ["not_started", "linked", "failed"], "not_started"),
    draft_version: asNonNegativeInteger(step2.draft_version, 0),
    image_version: asNonNegativeInteger(step2.image_version, 0),
    draft_generated_at: asNullableString(step2.draft_generated_at),
    image_generated_at: asNullableString(step2.image_generated_at),
    draft_last_error_code: asNullableString(step2.draft_last_error_code),
    draft_last_error_message: asNullableString(step2.draft_last_error_message),
    image_last_error_code: asNullableString(step2.image_last_error_code),
    image_last_error_message: asNullableString(step2.image_last_error_message),
    approved_at: asNullableString(step2.approved_at),
    approved_snapshot_draft_version: step2.approved_snapshot_draft_version == null ? null : asNonNegativeInteger(step2.approved_snapshot_draft_version, 0),
    approved_snapshot_image_version: step2.approved_snapshot_image_version == null ? null : asNonNegativeInteger(step2.approved_snapshot_image_version, 0),
    publish_attempted_at: asNullableString(step2.publish_attempted_at),
    publish_completed_at: asNullableString(step2.publish_completed_at),
    published_post_id: asNullableString(step2.published_post_id),
    published_url: asNullableString(step2.published_url),
    publish_last_error_code: asNullableString(step2.publish_last_error_code),
    publish_last_error_message: asNullableString(step2.publish_last_error_message),
    publish_last_req_id: asNullableString(step2.publish_last_req_id),
    last_link_error_code: asNullableString(step2.last_link_error_code),
    last_link_error_message: asNullableString(step2.last_link_error_message),
  };
}

function mergeStep2StateMetadata(
  metadata: Record<string, unknown> | null | undefined,
  patch: Partial<PersistedStep2State>
): Record<string, unknown> {
  const baseMetadata = asRecord(metadata);
  const current = readPersistedStep2State(baseMetadata);
  return {
    ...baseMetadata,
    step2_state: {
      ...current,
      ...patch,
    },
  };
}

export function extractListingDescription(raw: Record<string, unknown>): string {
  return (
    asString(raw.group_desc) ||
    asString(raw.short_description) ||
    asString(raw.description) ||
    asString(raw.content) ||
    asString((raw.content as Record<string, unknown> | undefined)?.rendered) ||
    asString(raw.excerpt)
  );
}

function parseListing(row: ListingRow, posts: AuthorityPostRow[], settings: DirectoryIqSettings): ListingSelectionInput {
  const raw = (row.raw_json ?? {}) as Record<string, unknown>;
  const title = row.title ?? asString(raw.title) ?? row.source_id;
  const description = extractListingDescription(raw);
  const category = readListingCategory(raw) ?? "";
  const location =
    asString(raw.post_location) ||
    asString(raw.location) ||
    asString(raw.city) ||
    asString(raw.address) ||
    asString(raw.service_area);
  const contact =
    asString(raw.phone) ||
    asString(raw.phone1) ||
    asString(raw.email) ||
    asString(raw.contact) ||
    asString(raw.website);
  const ctaText =
    asString(raw.cta) ||
    asString(raw.call_to_action) ||
    asString(raw.booking_url) ||
    asString(raw.contact_url);

  const schemaSignals = [
    ...(asArray(raw.schema_types) ?? []),
    ...(raw.structured_data ? ["structured_data"] : []),
    ...(raw.schema_mapping ? ["schema_mapping"] : []),
  ];

  const taxonomySignals = [
    category,
    ...asArray(raw.tags),
    ...asArray(raw.categories),
    ...asArray(raw.taxonomy_terms),
  ].filter(Boolean);

  const credentialsSignals = [
    asString(raw.license),
    asString(raw.certification),
    asString(raw.accreditation),
  ].filter(Boolean);

  const evidenceSignals = [
    asString(raw.case_studies),
    asString(raw.testimonials),
    asString(raw.portfolio),
    asString(raw.years_in_business),
  ].filter(Boolean);

  const identitySignals = [
    asString(raw.business_name),
    asString(raw.nap_name),
    asString(raw.nap_phone),
    asString(raw.nap_address),
  ].filter(Boolean);

  const reviewCount = Number(raw.review_count ?? raw.reviews_count ?? 0) || 0;
  const averageRatingRaw = raw.average_rating ?? raw.rating ?? null;
  const averageRating = typeof averageRatingRaw === "number" ? averageRatingRaw : null;

  const mappedVertical = detectVerticalFromSignals(category, taxonomySignals);
  const vertical = settings.verticalOverride ?? mappedVertical;

  const riskOverride = settings.riskTierOverrides[vertical] ?? null;

  const authorityPosts: AuthorityPostInput[] = posts.map((post) => {
    const metadata = (post.metadata_json ?? {}) as Record<string, unknown>;
    const qualityScoreRaw = metadata.quality_score;
    const qualityScore = typeof qualityScoreRaw === "number" ? clamp(qualityScoreRaw, 0, 100) : post.status === "published" ? 78 : post.status === "draft" ? 55 : 0;

    return {
      slot: post.slot_index,
      type: toPostType(post.post_type),
      status: post.status,
      focusTopic: post.focus_topic,
      title: post.title ?? "",
      qualityScore,
      blogToListingLinked: post.blog_to_listing_link_status === "linked",
      listingToBlogLinked: post.listing_to_blog_link_status === "linked",
    };
  });

  const clusterDensityRaw = Number(raw.cluster_density ?? 0.3);
  const orphanRiskRaw = Number(raw.orphan_risk ?? 0.5);

  return {
    listingId: row.source_id,
    title,
    description,
    category,
    location,
    contact,
    ctaText,
    schemaSignals,
    taxonomySignals,
    credentialsSignals,
    reviewCount,
    averageRating,
    evidenceSignals,
    identitySignals,
    internalMentionsCount: Number(raw.internal_mentions_count ?? 0),
    clusterDensity: Number.isFinite(clusterDensityRaw) ? clamp(clusterDensityRaw, 0, 1) : 0.3,
    orphanRisk: Number.isFinite(orphanRiskRaw) ? clamp(orphanRiskRaw, 0, 1) : 0.5,
    vertical,
    riskTierOverride: riskOverride,
    authorityPosts,
  };
}

export async function getDirectoryIqSettings(userId: string): Promise<DirectoryIqSettings> {
  const rows = await query<SettingsRow>(
    `
    SELECT vertical_override, risk_tier_overrides_json, image_style_preference, updated_at
    FROM directoryiq_settings
    WHERE user_id = $1
    LIMIT 1
    `,
    [userId]
  );

  const row = rows[0];
  if (!row) {
    return {
      verticalOverride: null,
      riskTierOverrides: {},
      imageStylePreference: "editorial clean",
      updatedAt: null,
    };
  }

  const riskTierOverrides: Partial<Record<DirectoryIqVerticalId, RiskTier>> = {};
  const raw = (row.risk_tier_overrides_json ?? {}) as Record<string, unknown>;
  for (const [key, value] of Object.entries(raw)) {
    if (
      (key === "home-services" || key === "health-medical" || key === "legal-financial" || key === "hospitality-travel" || key === "education" || key === "general") &&
      (value === "low" || value === "medium" || value === "high")
    ) {
      riskTierOverrides[key] = value;
    }
  }

  const verticalOverrideRaw = row.vertical_override;
  const verticalOverride =
    verticalOverrideRaw === "home-services" ||
    verticalOverrideRaw === "health-medical" ||
    verticalOverrideRaw === "legal-financial" ||
    verticalOverrideRaw === "hospitality-travel" ||
    verticalOverrideRaw === "education" ||
    verticalOverrideRaw === "general"
      ? verticalOverrideRaw
      : null;

  return {
    verticalOverride,
    riskTierOverrides,
    imageStylePreference: row.image_style_preference?.trim() || "editorial clean",
    updatedAt: row.updated_at,
  };
}

export async function upsertDirectoryIqSettings(
  userId: string,
  input: {
    verticalOverride: DirectoryIqVerticalId | null;
    riskTierOverrides: Partial<Record<DirectoryIqVerticalId, RiskTier>>;
    imageStylePreference: string;
  }
): Promise<void> {
  await query(
    `
    INSERT INTO directoryiq_settings (user_id, vertical_override, risk_tier_overrides_json, image_style_preference, updated_at)
    VALUES ($1, $2, $3::jsonb, $4, now())
    ON CONFLICT (user_id)
    DO UPDATE SET
      vertical_override = EXCLUDED.vertical_override,
      risk_tier_overrides_json = EXCLUDED.risk_tier_overrides_json,
      image_style_preference = EXCLUDED.image_style_preference,
      updated_at = now()
    `,
    [userId, input.verticalOverride, JSON.stringify(input.riskTierOverrides), input.imageStylePreference]
  );
}

export async function hasDirectoryIqSiteConnected(userId: string): Promise<boolean> {
  const rows = await listBdSiteRows(userId);
  return rows.some((row) => row.enabled && Boolean(row.secret_ciphertext) && Boolean(row.base_url));
}

export async function getLastAnalyzedAt(userId: string): Promise<string | null> {
  const rows = await query<{ finished_at: string | null }>(
    `
    SELECT finished_at
    FROM directoryiq_ingest_runs
    WHERE user_id = $1 AND status = 'succeeded'
    ORDER BY finished_at DESC NULLS LAST
    LIMIT 1
    `,
    [userId]
  );

  return rows[0]?.finished_at ?? null;
}

export async function ensureAuthoritySlots(userId: string, listingSourceId: string): Promise<void> {
  const defaultTypes: PostType[] = ["comparison", "best_of", "contextual_guide", "persona_intent", "contextual_guide"];

  for (let i = 0; i < AUTHORITY_SLOT_COUNT; i += 1) {
    const slot = AUTHORITY_SLOT_MIN + i;
    await query(
      `
      INSERT INTO directoryiq_authority_posts
      (user_id, listing_source_id, slot_index, post_type, focus_topic, status)
      VALUES ($1, $2, $3, $4, $5, 'not_created')
      ON CONFLICT (user_id, listing_source_id, slot_index)
      DO NOTHING
      `,
      [userId, listingSourceId, slot, defaultTypes[i], ""]
    );
  }
}

export async function getAuthorityPosts(userId: string, listingSourceId: string): Promise<AuthorityPostRow[]> {
  await ensureAuthoritySlots(userId, listingSourceId);

  const rows = await query<AuthorityPostRow>(
    `
    SELECT
      id,
      listing_source_id,
      slot_index,
      post_type,
      focus_topic,
      title,
      status,
      draft_markdown,
      draft_html,
      featured_image_prompt,
      featured_image_url,
      published_post_id,
      published_url,
      blog_to_listing_link_status,
      listing_to_blog_link_status,
      metadata_json,
      updated_at
    FROM directoryiq_authority_posts
    WHERE user_id = $1 AND listing_source_id = $2
    ORDER BY slot_index ASC
    `,
    [userId, listingSourceId]
  );

  return rows;
}

export async function getAuthorityPostBySlot(
  userId: string,
  listingSourceId: string,
  slot: number
): Promise<AuthorityPostRow | null> {
  await ensureAuthoritySlots(userId, listingSourceId);
  const rows = await query<AuthorityPostRow>(
    `
    SELECT
      id,
      listing_source_id,
      slot_index,
      post_type,
      focus_topic,
      title,
      status,
      draft_markdown,
      draft_html,
      featured_image_prompt,
      featured_image_url,
      published_post_id,
      published_url,
      blog_to_listing_link_status,
      listing_to_blog_link_status,
      metadata_json,
      updated_at
    FROM directoryiq_authority_posts
    WHERE user_id = $1 AND listing_source_id = $2 AND slot_index = $3
    LIMIT 1
    `,
    [userId, listingSourceId, slot]
  );
  return rows[0] ?? null;
}

export async function getAllListingsWithEvaluations(
  userId: string,
  siteIds?: string[] | null
): Promise<{
  cards: ListingCard[];
  readiness: number;
  pillarAverages: { structure: number; clarity: number; trust: number; authority: number; actionability: number };
  verticalDetected: DirectoryIqVerticalId;
}> {
  const settings = await getDirectoryIqSettings(userId);

  const listings = await query<ListingRow>(
    `
    SELECT source_id, bd_site_id, title, url, updated_at, raw_json
    FROM directoryiq_nodes
    WHERE user_id = $1 AND source_type = 'listing'
      AND ($2::uuid[] IS NULL OR bd_site_id = ANY($2::uuid[]))
    ORDER BY updated_at DESC
    `,
    [userId, siteIds ?? null]
  );

  const listingIds = listings.map((row) => row.source_id);
  let authorityRows: AuthorityPostRow[] = [];
  if (listingIds.length > 0) {
    authorityRows = await query<AuthorityPostRow>(
      `
      SELECT
        id,
        listing_source_id,
        slot_index,
        post_type,
        focus_topic,
        title,
        status,
        draft_markdown,
        draft_html,
        featured_image_prompt,
        featured_image_url,
        published_post_id,
        published_url,
        blog_to_listing_link_status,
        listing_to_blog_link_status,
        metadata_json,
        updated_at
      FROM directoryiq_authority_posts
      WHERE user_id = $1 AND listing_source_id = ANY($2::text[])
      ORDER BY listing_source_id, slot_index ASC
      `,
      [userId, listingIds]
    );
  }

  const grouped = new Map<string, AuthorityPostRow[]>();
  for (const post of authorityRows) {
    const arr = grouped.get(post.listing_source_id) ?? [];
    arr.push(post);
    grouped.set(post.listing_source_id, arr);
  }

  const evaluations: ListingSelectionEvaluation[] = [];
  const cards: ListingCard[] = [];

  for (const listing of listings) {
    const posts = grouped.get(listing.source_id) ?? [];
    const parsed = parseListing(listing, posts, settings);
    const evaluation = evaluateListingSelection(parsed);

    evaluations.push(evaluation);

    const raw = (listing.raw_json ?? {}) as Record<string, unknown>;
    cards.push({
      sourceId: listing.source_id,
      listingId: readListingId(raw, listing.source_id),
      name: listing.title ?? readListingId(raw, listing.source_id),
      url: listing.url,
      category: readListingCategory(raw),
      authorityStatus: evaluation.scores.authority >= 70 ? "Strong" : "Needs Support",
      trustStatus: evaluation.scores.trust >= 70 ? "Strong" : "Needs Trust",
      lastOptimized: posts.some((post) => post.status === "published") ? listing.updated_at : null,
      evaluation,
      siteId: listing.bd_site_id,
      siteLabel: asString(raw.site_label) || null,
    });
  }

  const site = computeSiteReadiness(evaluations);

  const verticalDetected = settings.verticalOverride ?? cards[0]?.evaluation.vertical ?? "general";

  return {
    cards,
    readiness: site.readiness,
    pillarAverages: site.pillars,
    verticalDetected,
  };
}

export async function findListingCandidates(userId: string, listingId: string): Promise<ListingCandidate[]> {
  const rows = await query<{
    source_id: string;
    bd_site_id: string | null;
    site_label: string | null;
  }>(
    `
    SELECT source_id, bd_site_id, raw_json->>'site_label' as site_label
    FROM directoryiq_nodes
    WHERE user_id = $1
      AND source_type = 'listing'
      AND (raw_json->>'listing_id' = $2 OR source_id = $2)
    ORDER BY updated_at DESC
    `,
    [userId, listingId]
  );

  return rows.map((row) => ({
    sourceId: row.source_id,
    siteId: row.bd_site_id,
    siteLabel: row.site_label,
  }));
}

export async function getListingEvaluation(
  userId: string,
  listingId: string,
  siteId?: string | null
): Promise<{
  listing: ListingRow | null;
  authorityPosts: AuthorityPostRow[];
  evaluation: ListingSelectionEvaluation | null;
  settings: DirectoryIqSettings;
}> {
  const settings = await getDirectoryIqSettings(userId);
  const normalizedListingId = listingId.includes(":") ? listingId.split(":", 2)[1] ?? listingId : listingId;

  let listingRows: ListingRow[] = [];
  if (siteId) {
    const sourceIdCandidates = Array.from(
      new Set([`${siteId}:${normalizedListingId}`, listingId, `${siteId}:${listingId}`].map((value) => value.trim()).filter(Boolean))
    );
    listingRows = await query<ListingRow>(
      `
      SELECT source_id, bd_site_id, title, url, updated_at, raw_json
      FROM directoryiq_nodes
      WHERE user_id = $1
        AND source_type = 'listing'
        AND (
          source_id = ANY($2::text[])
          OR (bd_site_id = $3 AND raw_json->>'listing_id' = $4)
        )
      ORDER BY updated_at DESC
      LIMIT 1
      `,
      [userId, sourceIdCandidates, siteId, normalizedListingId]
    );
  } else {
    listingRows = await query<ListingRow>(
      `
      SELECT source_id, bd_site_id, title, url, updated_at, raw_json
      FROM directoryiq_nodes
      WHERE user_id = $1 AND source_type = 'listing' AND raw_json->>'listing_id' = $2
      `,
      [userId, listingId]
    );
  }

  const listing = listingRows[0] ?? null;
  if (!listing) {
    return { listing: null, authorityPosts: [], evaluation: null, settings };
  }

  const authorityPosts = await getAuthorityPosts(userId, listing.source_id);
  const parsed = parseListing(listing, authorityPosts, settings);
  const evaluation = evaluateListingSelection(parsed);

  return {
    listing,
    authorityPosts,
    evaluation,
    settings,
  };
}

export async function upsertAuthorityPostDraft(
  userId: string,
  listingId: string,
  slot: number,
  input: {
    type: PostType;
    title: string;
    focusTopic: string;
    draftMarkdown: string;
    draftHtml: string;
    blogToListingStatus: "linked" | "missing";
    metadata: Record<string, unknown>;
  }
): Promise<void> {
  const mergedMetadata = mergeStep2StateMetadata(input.metadata, {
    draft_status: "ready",
    draft_generated_at: new Date().toISOString(),
    draft_last_error_code: null,
    draft_last_error_message: null,
    publish_status: "not_started",
    publish_attempted_at: null,
    publish_completed_at: null,
    publish_last_error_code: null,
    publish_last_error_message: null,
    publish_last_req_id: null,
    published_post_id: null,
    published_url: null,
    listing_to_blog_link_status: "not_started",
  });

  await query(
    `
    INSERT INTO directoryiq_authority_posts
    (user_id, listing_source_id, slot_index, post_type, focus_topic, title, status, draft_markdown, draft_html, blog_to_listing_link_status, metadata_json, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, 'draft', $7, $8, $9, $10::jsonb, now())
    ON CONFLICT (user_id, listing_source_id, slot_index)
    DO UPDATE SET
      post_type = EXCLUDED.post_type,
      focus_topic = EXCLUDED.focus_topic,
      title = EXCLUDED.title,
      status = 'draft',
      draft_markdown = EXCLUDED.draft_markdown,
      draft_html = EXCLUDED.draft_html,
      blog_to_listing_link_status = EXCLUDED.blog_to_listing_link_status,
      metadata_json = EXCLUDED.metadata_json,
      updated_at = now()
    `,
    [
      userId,
      listingId,
      slot,
      input.type,
      input.focusTopic,
      input.title,
      input.draftMarkdown,
      input.draftHtml,
      input.blogToListingStatus,
      JSON.stringify(mergedMetadata),
    ]
  );
}

export async function saveAuthorityImage(
  userId: string,
  listingId: string,
  slot: number,
  input: {
    imagePrompt: string;
    imageUrl: string;
  }
): Promise<void> {
  const existing = await getAuthorityPostBySlot(userId, listingId, slot);
  const mergedMetadata = mergeStep2StateMetadata(existing?.metadata_json, {
    image_status: "ready",
    image_generated_at: new Date().toISOString(),
    image_last_error_code: null,
    image_last_error_message: null,
    publish_status: "not_started",
    publish_attempted_at: null,
    publish_completed_at: null,
    publish_last_error_code: null,
    publish_last_error_message: null,
    publish_last_req_id: null,
    published_post_id: null,
    published_url: null,
    listing_to_blog_link_status: "not_started",
  });
  await query(
    `
    UPDATE directoryiq_authority_posts
    SET
      featured_image_prompt = $4,
      featured_image_url = $5,
      metadata_json = $6::jsonb,
      updated_at = now()
    WHERE user_id = $1 AND listing_source_id = $2 AND slot_index = $3
    `,
    [userId, listingId, slot, input.imagePrompt, input.imageUrl, JSON.stringify(mergedMetadata)]
  );
}

export async function markAuthorityReviewReady(
  userId: string,
  listingId: string,
  slot: number
): Promise<void> {
  const existing = await getAuthorityPostBySlot(userId, listingId, slot);
  if (!existing) return;
  const current = readPersistedStep2State(existing.metadata_json);
  const reviewStatus = current.draft_status === "ready" && current.image_status === "ready" ? "ready" : "not_ready";
  const mergedMetadata = mergeStep2StateMetadata(existing.metadata_json, {
    review_status: reviewStatus,
    approved_at: null,
    approved_snapshot_draft_version: null,
    approved_snapshot_image_version: null,
  });
  await query(
    `
    UPDATE directoryiq_authority_posts
    SET metadata_json = $4::jsonb, updated_at = now()
    WHERE user_id = $1 AND listing_source_id = $2 AND slot_index = $3
    `,
    [userId, listingId, slot, JSON.stringify(mergedMetadata)]
  );
}

export async function markAuthorityPublishAttempt(
  userId: string,
  listingId: string,
  slot: number
): Promise<void> {
  const existing = await getAuthorityPostBySlot(userId, listingId, slot);
  if (!existing) return;
  const mergedMetadata = mergeStep2StateMetadata(existing.metadata_json, {
    publish_status: "publishing",
    publish_attempted_at: new Date().toISOString(),
    publish_last_error_code: null,
    publish_last_error_message: null,
    publish_last_req_id: null,
  });
  await query(
    `
    UPDATE directoryiq_authority_posts
    SET metadata_json = $4::jsonb, updated_at = now()
    WHERE user_id = $1 AND listing_source_id = $2 AND slot_index = $3
    `,
    [userId, listingId, slot, JSON.stringify(mergedMetadata)]
  );
}

export async function markAuthorityPublishFailure(
  userId: string,
  listingId: string,
  slot: number,
  input: { code?: string | null; message?: string | null; reqId?: string | null }
): Promise<void> {
  const existing = await getAuthorityPostBySlot(userId, listingId, slot);
  if (!existing) return;
  const mergedMetadata = mergeStep2StateMetadata(existing.metadata_json, {
    publish_status: "failed",
    publish_last_error_code: asNullableString(input.code),
    publish_last_error_message: asNullableString(input.message),
    publish_last_req_id: asNullableString(input.reqId),
  });
  await query(
    `
    UPDATE directoryiq_authority_posts
    SET metadata_json = $4::jsonb, updated_at = now()
    WHERE user_id = $1 AND listing_source_id = $2 AND slot_index = $3
    `,
    [userId, listingId, slot, JSON.stringify(mergedMetadata)]
  );
}

export async function markAuthorityApprovedSnapshot(
  userId: string,
  listingId: string,
  slot: number
): Promise<PersistedStep2State | null> {
  const existing = await getAuthorityPostBySlot(userId, listingId, slot);
  if (!existing) return null;
  const current = readPersistedStep2State(existing.metadata_json);
  const mergedMetadata = mergeStep2StateMetadata(existing.metadata_json, {
    review_status: "approved",
    approved_at: new Date().toISOString(),
    approved_snapshot_draft_version: current.draft_version,
    approved_snapshot_image_version: current.image_version,
  });
  await query(
    `
    UPDATE directoryiq_authority_posts
    SET metadata_json = $4::jsonb, updated_at = now()
    WHERE user_id = $1 AND listing_source_id = $2 AND slot_index = $3
    `,
    [userId, listingId, slot, JSON.stringify(mergedMetadata)]
  );
  return readPersistedStep2State(mergedMetadata);
}

export async function markAuthorityDraftFailure(
  userId: string,
  listingId: string,
  slot: number,
  input: { code?: string | null; message?: string | null }
): Promise<void> {
  const existing = await getAuthorityPostBySlot(userId, listingId, slot);
  if (!existing) return;
  const mergedMetadata = mergeStep2StateMetadata(existing.metadata_json, {
    draft_status: "failed",
    draft_last_error_code: asNullableString(input.code),
    draft_last_error_message: asNullableString(input.message),
  });
  await query(
    `
    UPDATE directoryiq_authority_posts
    SET metadata_json = $4::jsonb, updated_at = now()
    WHERE user_id = $1 AND listing_source_id = $2 AND slot_index = $3
    `,
    [userId, listingId, slot, JSON.stringify(mergedMetadata)]
  );
}

export async function markAuthorityImageFailure(
  userId: string,
  listingId: string,
  slot: number,
  input: { code?: string | null; message?: string | null }
): Promise<void> {
  const existing = await getAuthorityPostBySlot(userId, listingId, slot);
  if (!existing) return;
  const mergedMetadata = mergeStep2StateMetadata(existing.metadata_json, {
    image_status: "failed",
    image_last_error_code: asNullableString(input.code),
    image_last_error_message: asNullableString(input.message),
  });
  await query(
    `
    UPDATE directoryiq_authority_posts
    SET metadata_json = $4::jsonb, updated_at = now()
    WHERE user_id = $1 AND listing_source_id = $2 AND slot_index = $3
    `,
    [userId, listingId, slot, JSON.stringify(mergedMetadata)]
  );
}

export async function upsertAuthorityStep2ResearchContract(
  userId: string,
  listingId: string,
  slot: number,
  input: {
    contract?: Record<string, unknown> | null;
    state: PersistedStep2ResearchState;
    errorCode?: string | null;
    errorMessage?: string | null;
  }
): Promise<void> {
  const existing = await getAuthorityPostBySlot(userId, listingId, slot);
  const baseMetadata = mergeStep2StateMetadata(existing?.metadata_json, {});
  const previousResearch = asRecord(baseMetadata.step2_research);
  const now = new Date().toISOString();
  const nextResearch = {
    ...previousResearch,
    state: input.state,
    updated_at: now,
    started_at:
      input.state === "queued" || input.state === "researching"
        ? asNullableString(previousResearch.started_at) ?? now
        : asNullableString(previousResearch.started_at),
    completed_at:
      input.state === "ready" || input.state === "ready_thin" || input.state === "ready_grounded"
        ? now
        : input.state === "failed"
          ? now
          : null,
    error_code: input.errorCode ?? null,
    error_message: input.errorMessage ?? null,
  };

  const mergedMetadata = {
    ...baseMetadata,
    step2_contract: input.contract ?? asRecord(baseMetadata.step2_contract),
    step2_research: nextResearch,
  };

  await query(
    `
    INSERT INTO directoryiq_authority_posts
      (user_id, listing_source_id, slot_index, post_type, focus_topic, status, metadata_json, updated_at)
    VALUES
      ($1, $2, $3, COALESCE($4, 'local_guide'), COALESCE($5, ''), COALESCE($6, 'not_created'), $7::jsonb, now())
    ON CONFLICT (user_id, listing_source_id, slot_index)
    DO UPDATE SET
      metadata_json = EXCLUDED.metadata_json,
      updated_at = now()
    `,
    [
      userId,
      listingId,
      slot,
      existing?.post_type ?? null,
      existing?.focus_topic ?? null,
      existing?.status ?? null,
      JSON.stringify(mergedMetadata),
    ]
  );
}

export async function patchAuthorityStep2State(
  userId: string,
  listingId: string,
  slot: number,
  patch: Partial<PersistedStep2State>
): Promise<PersistedStep2State | null> {
  const existing = await getAuthorityPostBySlot(userId, listingId, slot);
  if (!existing) return null;
  const mergedMetadata = mergeStep2StateMetadata(existing.metadata_json, patch);
  await query(
    `
    UPDATE directoryiq_authority_posts
    SET metadata_json = $4::jsonb, updated_at = now()
    WHERE user_id = $1 AND listing_source_id = $2 AND slot_index = $3
    `,
    [userId, listingId, slot, JSON.stringify(mergedMetadata)]
  );
  return readPersistedStep2State(mergedMetadata);
}

export async function markPostPublished(
  userId: string,
  listingId: string,
  slot: number,
  input: {
    publishedPostId: string;
    publishedUrl: string;
    blogToListingStatus: "linked" | "missing";
    listingToBlogStatus: "linked" | "missing";
    metadata: Record<string, unknown>;
  }
): Promise<void> {
  const mergedMetadata = mergeStep2StateMetadata(input.metadata, {
    publish_status: "published",
    publish_completed_at: new Date().toISOString(),
    publish_last_error_code: null,
    publish_last_error_message: null,
    publish_last_req_id: null,
    published_post_id: input.publishedPostId,
    published_url: input.publishedUrl,
    blog_to_listing_link_status: input.blogToListingStatus === "linked" ? "linked" : "failed",
    listing_to_blog_link_status: input.listingToBlogStatus === "linked" ? "linked" : "failed",
    last_link_error_code: null,
    last_link_error_message: null,
  });

  await query(
    `
    UPDATE directoryiq_authority_posts
    SET
      status = 'published',
      published_post_id = $4,
      published_url = $5,
      blog_to_listing_link_status = $6,
      listing_to_blog_link_status = $7,
      metadata_json = $8::jsonb,
      updated_at = now()
    WHERE user_id = $1 AND listing_source_id = $2 AND slot_index = $3
    `,
    [
      userId,
      listingId,
      slot,
      input.publishedPostId,
      input.publishedUrl,
      input.blogToListingStatus,
      input.listingToBlogStatus,
      JSON.stringify(mergedMetadata),
    ]
  );
}

export async function addDirectoryIqVersion(
  userId: string,
  input: {
    listingId: string;
    authorityPostId?: string | null;
    actionType: "listing_push" | "blog_publish" | "restore";
    versionLabel: string;
    scoreSnapshot: Record<string, unknown>;
    contentDelta: Record<string, unknown>;
    linkDelta: Record<string, unknown>;
  }
): Promise<string> {
  const rows = await query<{ id: string }>(
    `
    INSERT INTO directoryiq_versions
    (user_id, listing_source_id, authority_post_id, action_type, version_label, score_snapshot_json, content_delta_json, link_delta_json)
    VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb)
    RETURNING id
    `,
    [
      userId,
      input.listingId,
      input.authorityPostId ?? null,
      input.actionType,
      input.versionLabel,
      JSON.stringify(input.scoreSnapshot),
      JSON.stringify(input.contentDelta),
      JSON.stringify(input.linkDelta),
    ]
  );

  return rows[0].id;
}

export async function getDirectoryIqVersions(userId: string): Promise<Array<{
  id: string;
  listing_source_id: string;
  action_type: string;
  version_label: string;
  score_snapshot_json: Record<string, unknown>;
  content_delta_json: Record<string, unknown>;
  link_delta_json: Record<string, unknown>;
  created_at: string;
}>> {
  return query(
    `
    SELECT
      id,
      listing_source_id,
      action_type,
      version_label,
      score_snapshot_json,
      content_delta_json,
      link_delta_json,
      created_at
    FROM directoryiq_versions
    WHERE user_id = $1
    ORDER BY created_at DESC
    LIMIT 200
    `,
    [userId]
  );
}

export async function getDirectoryIqVersionById(userId: string, versionId: string): Promise<{
  id: string;
  listing_source_id: string;
  action_type: string;
  version_label: string;
  score_snapshot_json: Record<string, unknown>;
  content_delta_json: Record<string, unknown>;
  link_delta_json: Record<string, unknown>;
  created_at: string;
} | null> {
  const rows = await query<{
    id: string;
    listing_source_id: string;
    action_type: string;
    version_label: string;
    score_snapshot_json: Record<string, unknown>;
    content_delta_json: Record<string, unknown>;
    link_delta_json: Record<string, unknown>;
    created_at: string;
  }>(
    `
    SELECT
      id,
      listing_source_id,
      action_type,
      version_label,
      score_snapshot_json,
      content_delta_json,
      link_delta_json,
      created_at
    FROM directoryiq_versions
    WHERE user_id = $1 AND id = $2
    LIMIT 1
    `,
    [userId, versionId]
  );

  return rows[0] ?? null;
}

export async function createListingUpgradeDraft(params: {
  userId: string;
  listingId: string;
  createdByUserId: string;
  originalDescription: string;
  proposedDescription: string;
}): Promise<{ id: string }> {
  const rows = await query<{ id: string }>(
    `
    INSERT INTO directoryiq_listing_upgrades
    (user_id, listing_source_id, created_by_user_id, original_description_hash, original_description, proposed_description, status)
    VALUES ($1, $2, $3, $4, $5, $6, 'draft')
    RETURNING id
    `,
    [
      params.userId,
      params.listingId,
      params.createdByUserId,
      hashText(params.originalDescription),
      params.originalDescription,
      params.proposedDescription,
    ]
  );
  return rows[0];
}

export async function getListingUpgradeDraft(
  userId: string,
  listingId: string,
  draftId: string
): Promise<ListingUpgradeRow | null> {
  const rows = await query<ListingUpgradeRow>(
    `
    SELECT
      id,
      user_id,
      listing_source_id,
      created_by_user_id,
      original_description_hash,
      original_description,
      proposed_description,
      status,
      bd_update_ref,
      created_at,
      previewed_at,
      pushed_at
    FROM directoryiq_listing_upgrades
    WHERE user_id = $1 AND listing_source_id = $2 AND id = $3
    LIMIT 1
    `,
    [userId, listingId, draftId]
  );
  return rows[0] ?? null;
}

export async function markListingUpgradePreviewed(userId: string, listingId: string, draftId: string): Promise<void> {
  await query(
    `
    UPDATE directoryiq_listing_upgrades
    SET status = 'previewed', previewed_at = now()
    WHERE user_id = $1 AND listing_source_id = $2 AND id = $3
    `,
    [userId, listingId, draftId]
  );
}

export async function markListingUpgradePushed(params: {
  userId: string;
  listingId: string;
  draftId: string;
  bdUpdateRef: string | null;
}): Promise<void> {
  await query(
    `
    UPDATE directoryiq_listing_upgrades
    SET status = 'pushed', pushed_at = now(), bd_update_ref = $4
    WHERE user_id = $1 AND listing_source_id = $2 AND id = $3
    `,
    [params.userId, params.listingId, params.draftId, params.bdUpdateRef]
  );
}

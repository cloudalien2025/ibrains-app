import { query } from "@/app/api/ecomviper/_utils/db";
import { decryptSecret } from "@/app/api/ecomviper/_utils/crypto";
import {
  normalizeBdBaseUrl,
  parseBdRecords,
  parseBdTotals,
} from "@/app/api/directoryiq/_utils/bdApi";
import { getDirectoryIqIntegrationSecret } from "@/app/api/directoryiq/_utils/credentials";

type DirectoryIqNode = {
  sourceId: string;
  title: string;
  url: string | null;
  updatedAt: string | null;
  raw: Record<string, unknown>;
};

type IntegrationRow = {
  id: string;
  user_id: string | null;
  secret_ciphertext: string | null;
  meta_json: Record<string, unknown> | null;
  saved_at: string;
};

type BdIntegration = {
  id: string;
  userId: string;
  baseUrl: string;
  apiKey: string;
  meta: Record<string, unknown>;
  label: string | null;
};

type LocalBdResponse = {
  ok: boolean;
  status: number;
  json: unknown;
  text?: string;
};

export type DirectoryIqIngestResult = {
  runId: string;
  status: "succeeded" | "failed";
  counts: {
    listings: number;
    blogPosts: number;
  };
  errorMessage?: string;
};

export type DirectoryIqBlogIngestResult = {
  runId: string;
  status: "succeeded" | "failed";
  counts: {
    blogPosts: number;
  };
  blogPostsDataId: number;
  errorMessage?: string;
};

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asNumber(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

async function bdRequestFormXApiKey(input: {
  baseUrl: string;
  apiKey: string;
  method?: string;
  path: string;
  form?: Record<string, unknown>;
}): Promise<LocalBdResponse> {
  try {
    const method = (input.method ?? "POST").toUpperCase();
    const headers: Record<string, string> = {
      "Content-Type": "application/x-www-form-urlencoded",
      "X-Api-Key": input.apiKey,
      Authorization: `Bearer ${input.apiKey}`,
    };
    const formWithKey = input.form ? { ...input.form } : {};
    if (!("api_key" in formWithKey)) {
      formWithKey.api_key = input.apiKey;
    }

    const body = new URLSearchParams();
    for (const [key, value] of Object.entries(formWithKey ?? {})) {
      if (value == null) continue;
      body.set(key, String(value));
    }

    const query =
      method === "GET" && formWithKey && Object.keys(formWithKey).length > 0
        ? `?${new URLSearchParams(
            Object.entries(formWithKey)
              .filter(([, value]) => value != null)
              .map(([key, value]) => [key, String(value)])
          ).toString()}`
        : "";

    const response = await fetch(`${normalizeBdBaseUrl(input.baseUrl)}${input.path}${query}`, {
      method,
      headers,
      body: method === "GET" ? undefined : body,
      cache: "no-store",
    });

    const text = await response.text();
    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    return { ok: response.ok, status: response.status, json, text };
  } catch (error) {
    const message = error instanceof Error ? error.message : "bd request failed";
    return { ok: false, status: 500, json: { error: message }, text: message };
  }
}

async function bdRequestFormWithFallback(input: {
  baseUrl: string;
  apiKey: string;
  method?: string;
  path: string;
  form?: Record<string, unknown>;
}): Promise<LocalBdResponse> {
  const primary = await bdRequestFormXApiKey(input);
  if (primary.status !== 401) return primary;
  return primary;
}

async function bdRequestWithRetryLocal(
  request: () => Promise<LocalBdResponse>,
  maxAttempts = 2
): Promise<LocalBdResponse> {
  let last: LocalBdResponse | null = null;
  for (let attempt = 1; attempt <= Math.max(1, maxAttempts); attempt += 1) {
    const result = await request();
    if (result.ok || result.status < 500) return result;
    last = result;
  }
  return last ?? { ok: false, status: 500, json: { error: "request failed" } };
}

function normalizeBdJson(value: unknown): Record<string, unknown> {
  if (Array.isArray(value)) {
    return { data: value };
  }
  if (value && typeof value === "object") {
    return value as Record<string, unknown>;
  }
  return {};
}

function normalizeBdPath(rawPath: string): string {
  if (!rawPath) return "/api/v2/user/search";
  const trimmed = rawPath.trim();
  if (!trimmed) return "/api/v2/user/search";
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    try {
      const url = new URL(trimmed);
      const path = `${url.pathname}${url.search}`;
      return path.startsWith("/") ? path : `/${path}`;
    } catch {
      return "/api/v2/user/search";
    }
  }
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function extractRecordsFromUnknownShape(payload: Record<string, unknown>): Record<string, unknown>[] {
  const isRecordArray = (value: unknown): value is Record<string, unknown>[] =>
    Array.isArray(value) && value.some((row) => row && typeof row === "object");

  const directCandidates = [
    payload.data,
    payload.records,
    payload.items,
    payload.rows,
    payload.listings,
    payload.posts,
    payload.data_posts,
  ];
  for (const candidate of directCandidates) {
    if (isRecordArray(candidate)) return candidate;
  }

  const nested = payload.data;
  if (nested && typeof nested === "object") {
    for (const value of Object.values(nested as Record<string, unknown>)) {
      if (isRecordArray(value)) return value;
    }
  }

  return [];
}

function extractUsersFromResponse(payload: Record<string, unknown>): Record<string, unknown>[] {
  const isRecordArray = (value: unknown): value is Record<string, unknown>[] =>
    Array.isArray(value) && value.some((row) => row && typeof row === "object");

  const directCandidates = [
    payload.message,
    payload.users,
    payload.results,
    payload.data,
    payload.items,
  ];
  for (const candidate of directCandidates) {
    if (isRecordArray(candidate)) return candidate;
  }

  const message = payload.message;
  if (message && typeof message === "object") {
    const nested = message as Record<string, unknown>;
    for (const value of Object.values(nested)) {
      if (isRecordArray(value)) return value;
    }
  }

  return [];
}

async function fetchBdUsersPaged(params: {
  baseUrl: string;
  apiKey: string;
  path: string;
  pageSize?: number;
  maxPages?: number;
  onPage?: (input: { page: number; received: number; total: number }) => void;
}): Promise<Record<string, unknown>[]> {
  const all: Record<string, unknown>[] = [];
  const pageSize = params.pageSize ?? 100;
  const maxPages = params.maxPages ?? 200;

  const strategies: Array<(page: number) => Record<string, unknown>> = [
    (page) => ({ page, per_page: pageSize }),
    (page) => ({ page, limit: pageSize }),
    (page) => ({ offset: (page - 1) * pageSize, limit: pageSize }),
  ];

  for (const formBuilder of strategies) {
    all.length = 0;
    let lastFirstId = "";
    let usedPages = 0;

    for (let page = 1; page <= maxPages; page += 1) {
      const form = formBuilder(page);
      const response = await bdRequestWithRetryLocal(() =>
        bdRequestFormWithFallback({
          baseUrl: params.baseUrl,
          apiKey: params.apiKey,
          method: "POST",
          path: params.path,
          form,
        })
      );

      if (!response.ok) {
        const detail = typeof response.text === "string" && response.text.trim().length > 0 ? response.text.trim() : "";
        const snippet = detail.length > 200 ? `${detail.slice(0, 200)}...` : detail;
        const suffix = snippet ? `: ${snippet}` : "";
        throw new Error(`DirectoryIQ source returned HTTP ${response.status} for ${params.path}${suffix}`);
      }

      const payload = normalizeBdJson(response.json);
      if (typeof payload.status === "string" && payload.status.toLowerCase() === "error") {
        const msg = typeof payload.message === "string" ? payload.message : "Unknown BD error";
        throw new Error(`DirectoryIQ source returned error for ${params.path}: ${msg}`);
      }

      const users = extractUsersFromResponse(payload);
      const received = users.length;
      params.onPage?.({ page, received, total: all.length + received });
      usedPages += 1;

      if (received === 0) break;

      const firstId =
        String(users[0]?.user_id ?? users[0]?.id ?? users[0]?.ID ?? users[0]?.userId ?? "");
      if (firstId && firstId === lastFirstId) break;
      lastFirstId = firstId;

      all.push(...users);

      if (received < pageSize) break;
    }

    if (all.length > 0) return all;
    if (usedPages > 1) continue;
  }

  return all;
}

export class BdIntegrationMissingError extends Error {
  baseUrlPresent: boolean;
  apiKeyPresent: boolean;
  tenantUserIdPresent: boolean;

  constructor(params: { baseUrlPresent: boolean; apiKeyPresent: boolean; tenantUserIdPresent: boolean }) {
    super("bd_integration_missing");
    this.name = "BdIntegrationMissingError";
    this.baseUrlPresent = params.baseUrlPresent;
    this.apiKeyPresent = params.apiKeyPresent;
    this.tenantUserIdPresent = params.tenantUserIdPresent;
  }
}

function isDeterministicEnabled(): boolean {
  const mode = typeof process.env.DIRECTORYIQ_MODE === "string" ? process.env.DIRECTORYIQ_MODE.toLowerCase() : "";
  if (mode === "deterministic") return true;
  if (process.env.DIRECTORYIQ_DETERMINISTIC === "1") return true;
  if (process.env.E2E_TEST_MODE === "1") return true;
  if (process.env.E2E_MOCK_BD === "1") return true;
  return false;
}

const DEFAULT_DIRECTORYIQ_USER_ID = "00000000-0000-4000-8000-000000000001";

async function loadBdIntegrations(userId: string): Promise<{
  integrations: BdIntegration[];
  baseUrlPresent: boolean;
  apiKeyPresent: boolean;
  tenantUserIdPresent: boolean;
}> {
  const rows = await query<IntegrationRow>(
    `
    SELECT id, user_id, secret_ciphertext, meta_json, saved_at
    FROM integrations_credentials
    WHERE product = 'directoryiq' AND provider = 'brilliant_directories'
      AND (user_id = $1 OR user_id = $2 OR user_id IS NULL)
    ORDER BY saved_at DESC
    `,
    [userId, DEFAULT_DIRECTORYIQ_USER_ID]
  );

  const exact = rows.filter((row) => row.user_id === userId);
  const fallback = rows.filter((row) => row.user_id === DEFAULT_DIRECTORYIQ_USER_ID || row.user_id === null);
  const selected = exact.length > 0 ? exact : fallback;

  const tenantUserIdPresent = exact.length > 0;
  const baseUrlPresent = selected.some((row) => {
    const meta = (row.meta_json ?? {}) as Record<string, unknown>;
    const baseUrlRaw =
      (typeof meta.baseUrl === "string" && meta.baseUrl.trim()) ||
      (typeof meta.base_url === "string" && meta.base_url.trim()) ||
      "";
    return Boolean(baseUrlRaw);
  });
  const apiKeyPresent = selected.some((row) => Boolean(row.secret_ciphertext));

  const integrations: BdIntegration[] = [];
  for (const row of selected) {
    if (!row.secret_ciphertext) continue;
    const meta = (row.meta_json ?? {}) as Record<string, unknown>;
    const baseUrlRaw =
      (typeof meta.baseUrl === "string" && meta.baseUrl.trim()) ||
      (typeof meta.base_url === "string" && meta.base_url.trim()) ||
      "";
    if (!baseUrlRaw) continue;

    const contextUserId = row.user_id ?? DEFAULT_DIRECTORYIQ_USER_ID;
    let apiKey = "";
    try {
      apiKey = decryptSecret(row.secret_ciphertext, `${contextUserId}:directoryiq:brilliant_directories`).trim();
    } catch {
      continue;
    }
    if (!apiKey) continue;

    const disabled =
      meta.disabled === true ||
      meta.disabled === "true" ||
      meta.enabled === false ||
      meta.enabled === "false";
    if (disabled) continue;

    const label = typeof meta.label === "string" ? meta.label : null;
    integrations.push({
      id: row.id,
      userId: contextUserId,
      baseUrl: normalizeBdBaseUrl(baseUrlRaw),
      apiKey,
      meta,
      label,
    });
  }

  const uniqueByBaseUrl = new Map<string, BdIntegration>();
  for (const integration of integrations) {
    if (!uniqueByBaseUrl.has(integration.baseUrl)) {
      uniqueByBaseUrl.set(integration.baseUrl, integration);
    }
  }

  return {
    integrations: Array.from(uniqueByBaseUrl.values()),
    baseUrlPresent,
    apiKeyPresent,
    tenantUserIdPresent,
  };
}

function parseCityState(location: string): { city: string; state: string } {
  const trimmed = location.trim();
  if (!trimmed) return { city: "", state: "" };
  const match = trimmed.match(/^([^,]+),\s*([A-Za-z]{2})$/);
  if (match?.[1] && match?.[2]) {
    return { city: match[1].trim(), state: match[2].trim().toUpperCase() };
  }
  return { city: trimmed, state: "" };
}

function readPrimaryCategory(item: Record<string, unknown>): string {
  const primary = item.primary_category;
  if (primary && typeof primary === "object") {
    const name = (primary as Record<string, unknown>).name;
    return typeof name === "string" ? name.trim() : "";
  }
  return "";
}

function readFirstString(values: Array<unknown>): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
}

function normalizeListingRecord(item: Record<string, unknown>, fallbackId: string): Record<string, unknown> {
  const listingId = readFirstString([
    item.listing_id,
    item.id,
    item.post_id,
    item.group_id,
    item.data_post_id,
    item.listingId,
    fallbackId,
  ]);

  const name = readFirstString([item.group_name, item.name, item.title, item.post_title, listingId]);

  const category = readFirstString([item.group_category, item.category, item.category_name, readPrimaryCategory(item)]);

  const location = readFirstString([item.post_location, item.location, item.city, item.address]);
  const parsedLocation = location ? parseCityState(location) : { city: "", state: "" };
  const city = readFirstString([item.city, parsedLocation.city]);
  const state = readFirstString([item.state, item.state_code, parsedLocation.state]);

  const description = readFirstString([
    item.group_desc,
    item.short_description,
    item.description,
    item.content,
    (item.content as Record<string, unknown> | undefined)?.rendered,
    item.excerpt,
  ]);

  const sourceUrl = readFirstString([
    item.source_url,
    item.url,
    item.listing_url,
    item.profile_url,
    item.link,
    item.permalink,
  ]);

  const heroImage = readFirstString([
    item.hero_image,
    item.primary_image,
    item.featured_image,
    item.image_url,
    item.photo,
    item.logo,
    item.thumbnail,
    item.image,
    item.cover_image,
    (item as { imageUrl?: unknown }).imageUrl,
  ]);

  return {
    ...item,
    listing_id: listingId || fallbackId,
    name: name || listingId || fallbackId,
    category: category || "",
    city: city || "",
    state: state || "",
    hero_image: heroImage || "",
    description: description || "",
    source_url: sourceUrl || "",
    group_name: item.group_name ?? name,
    group_category: item.group_category ?? category,
    group_desc: item.group_desc ?? description,
    post_location: item.post_location ?? (city && state ? `${city}, ${state}` : location),
    url: item.url ?? sourceUrl,
    image_url: item.image_url ?? heroImage,
  };
}

function normalizeUserListing(item: Record<string, unknown>, baseUrl: string, fallbackId: string): Record<string, unknown> {
  const listingId = readFirstString([
    item.user_id,
    item.id,
    item.ID,
    item.userId,
    item.member_id,
    item.profile_id,
    fallbackId,
  ]);

  const firstName = readFirstString([item.first_name, item.firstname, item.firstName]);
  const lastName = readFirstString([item.last_name, item.lastname, item.lastName]);
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();

  const name = readFirstString([
    item.company,
    item.company_name,
    item.business_name,
    item.name,
    fullName,
    item.email,
    listingId,
  ]);

  const category = readFirstString([
    item.profession,
    item.category,
    item.group_category,
    item.industry,
    item.post_tags,
  ]);

  const city = readFirstString([item.city, item.location_city, item.post_city, item.address_city]);
  const state = readFirstString([item.state, item.state_sn, item.state_code, item.region]);

  const heroImage = readFirstString([
    item.avatar,
    item.profile_photo,
    item.photo,
    item.image_url,
    item.image,
    item.logo,
  ]);

  const description = readFirstString([
    item.about,
    item.about_me,
    item.bio,
    item.description,
    item.search_description,
    item.summary,
  ]);

  const profilePath = readFirstString([item.profile_url, item.user_url, item.url, item.permalink, item.link]);
  let sourceUrl = baseUrl;
  if (profilePath) {
    if (profilePath.startsWith("http://") || profilePath.startsWith("https://")) {
      sourceUrl = profilePath;
    } else {
      const trimmedBase = baseUrl.replace(/\/+$/, "");
      const trimmedPath = profilePath.startsWith("/") ? profilePath : `/${profilePath}`;
      sourceUrl = `${trimmedBase}${trimmedPath}`;
    }
  }

  return {
    ...item,
    listing_id: listingId || fallbackId,
    name: name || listingId || fallbackId,
    category: category || "Unknown",
    city: city || "",
    state: state || "",
    hero_image: heroImage || "",
    description: description || "",
    source_url: sourceUrl,
    source_base_url: baseUrl,
  };
}

function buildDeterministicListings(): Record<string, unknown>[] {
  const base = {
    listing_id: "101",
    name: "Summit Home Services",
    category: "Home Services",
    city: "Denver",
    state: "CO",
    hero_image: "https://images.unsplash.com/photo-1523413651479-597eb2da0ad6?w=1200&q=80&auto=format",
    description:
      "Summit Home Services provides plumbing, electrical, and HVAC solutions for residential clients across the Denver metro area.",
    source_url: "https://example.com/listings/summit-home-services",
    phone: "(303) 555-0198",
    website: "https://example.com",
    review_count: 87,
    average_rating: 4.7,
    tags: ["plumbing", "hvac", "electrical"],
    taxonomy_terms: ["home services", "contractor"],
  };

  return [normalizeListingRecord(base, "101")];
}

function extractBlogHtmlAndText(item: Record<string, unknown>): { rawHtml: string; cleanText: string } {
  const rawHtml =
    asString(item.raw_html) ||
    asString(item.body_html) ||
    asString(item.post_html) ||
    asString(item.content_html) ||
    asString(item.post_content) ||
    asString(item.description) ||
    asString(item.excerpt);

  const cleanText = stripHtml(
    asString(item.clean_text) ||
      asString(item.summary) ||
      asString(item.body) ||
      asString(item.post_content) ||
      rawHtml
  );

  return { rawHtml, cleanText };
}

function extractNode(item: Record<string, unknown>, fallbackPrefix: string, index: number): DirectoryIqNode {
  const sourceId =
    String(item.id ?? item.post_id ?? item.group_id ?? item.data_post_id ?? item.listing_id ?? item.slug ?? `${fallbackPrefix}-${index + 1}`);

  const title =
    String(item.title ?? item.post_title ?? item.group_name ?? item.name ?? item.listing_title ?? item.headline ?? sourceId);

  const urlValue = item.url ?? item.permalink ?? item.link ?? item.listing_url ?? item.profile_url;
  const url = typeof urlValue === "string" ? urlValue : null;

  const updatedAtValue = item.updated_at ?? item.modified ?? item.date_modified ?? item.updated ?? item.revision_timestamp ?? item.date_updated;
  const updatedAt = typeof updatedAtValue === "string" ? updatedAtValue : null;

  return {
    sourceId,
    title,
    url,
    updatedAt,
    raw: item,
  };
}

async function fetchBdPagedSearch(params: {
  baseUrl: string;
  apiKey: string;
  path: string;
  dataId?: number | null;
  userId?: string | null;
  maxPages?: number;
  limit?: number;
  includeAction?: boolean;
  method?: "GET" | "POST";
  includeOutputType?: boolean;
  extraForm?: Record<string, unknown>;
  onPage?: (input: { page: number; perPage: number; received: number; total: number }) => void;
}): Promise<Record<string, unknown>[]> {
  const all: Record<string, unknown>[] = [];
  const maxPages = params.maxPages ?? 200;
  const perPage = params.limit ?? 100;
  const method = params.method ?? "POST";
  const includeOutputType = params.includeOutputType ?? true;

  let discoveredTotalPages: number | null = null;

  for (let page = 1; page <= maxPages; page += 1) {
    const form: Record<string, unknown> = {
      per_page: perPage,
      page,
    };
    if (method !== "GET") {
      if (includeOutputType) {
        form.output_type = "array";
        form.limit = perPage;
      }
    }
    if (typeof params.dataId === "number") {
      form.data_id = params.dataId;
    }
    if (params.userId) {
      form.user_id = params.userId;
    }

    if (params.includeAction) {
      form.action = "search";
    }
    if (params.extraForm) {
      for (const [key, value] of Object.entries(params.extraForm)) {
        if (value == null) continue;
        form[key] = value;
      }
    }

    const response = await bdRequestWithRetryLocal(() =>
      bdRequestFormWithFallback({
        baseUrl: params.baseUrl,
        apiKey: params.apiKey,
        method,
        path: params.path,
        form,
      })
    );

    if (response.status === 404 && page === 1) return [];
    if (!response.ok) {
      const detail = typeof response.text === "string" && response.text.trim().length > 0 ? response.text.trim() : "";
      const snippet = detail.length > 200 ? `${detail.slice(0, 200)}...` : detail;
      const suffix = snippet ? `: ${snippet}` : "";
      throw new Error(`DirectoryIQ source returned HTTP ${response.status} for ${params.path}${suffix}`);
    }

    const json = normalizeBdJson(response.json);
    const totals = parseBdTotals(json);
    let records = parseBdRecords(json);
    if (records.length === 0) {
      const fallbackRecords = extractRecordsFromUnknownShape(json);
      if (fallbackRecords.length > 0) {
        records = fallbackRecords;
      }
    }

    if (totals.status && totals.status !== "success" && page === 1) {
      throw new Error(`DirectoryIQ source returned non-success wrapper status for ${params.path}`);
    }

    if (records.length === 0) {
      params.onPage?.({ page, perPage, received: 0, total: all.length });
      break;
    }

    all.push(...records);
    params.onPage?.({ page, perPage, received: records.length, total: all.length });

    if (totals.totalPages && !discoveredTotalPages) {
      discoveredTotalPages = totals.totalPages;
    }

    if (discoveredTotalPages && page >= discoveredTotalPages) break;
    if (records.length < perPage && !discoveredTotalPages) break;
  }

  return all;
}

function extractSlugFromListing(item: Record<string, unknown>): string {
  const fromFilename = asString(item.group_filename ?? item.slug ?? item.post_slug);
  if (fromFilename) return fromFilename.replace(/^\/+/, "").replace(/\/+$/, "").toLowerCase();

  const url = asString(item.url ?? item.link ?? item.profile_url);
  if (!url) return "";
  const match = url.match(/\/listings\/([^/?#]+)/i);
  if (match?.[1]) return match[1].toLowerCase();
  return "";
}

function extractSlugFromDataPost(item: Record<string, unknown>): string {
  const direct = asString(item.post_filename ?? item.slug ?? item.group_filename ?? item.post_slug);
  if (direct) return direct.replace(/^\/+/, "").replace(/\/+$/, "").toLowerCase();

  const url = asString(item.url ?? item.link ?? item.permalink);
  if (!url) return "";
  const match = url.match(/\/listings\/([^/?#]+)/i);
  if (match?.[1]) return match[1].toLowerCase();
  return "";
}

function extractTitle(item: Record<string, unknown>): string {
  return asString(item.group_name ?? item.post_title ?? item.title ?? item.name);
}

function extractPostId(item: Record<string, unknown>): string {
  return String(item.post_id ?? item.id ?? item.data_post_id ?? item.group_id ?? "").trim();
}

function resolveTruePostMapping(
  listings: Record<string, unknown>[],
  dataPosts: Record<string, unknown>[]
): Array<Record<string, unknown>> {
  const bySlug = new Map<string, string>();
  const byTitle = new Map<string, string>();

  for (const post of dataPosts) {
    const postId = extractPostId(post);
    if (!postId) continue;

    const slug = extractSlugFromDataPost(post);
    if (slug && !bySlug.has(slug)) bySlug.set(slug, postId);

    const title = extractTitle(post).toLowerCase();
    if (title && !byTitle.has(title)) byTitle.set(title, postId);
  }

  return listings.map((listing) => {
    const domPostId = String(listing.group_id ?? listing.id ?? "").trim();
    const slug = extractSlugFromListing(listing);
    const title = extractTitle(listing).toLowerCase();

    let truePostId = "";
    let mappingKey = "unresolved";

    if (slug && bySlug.has(slug)) {
      truePostId = bySlug.get(slug) ?? "";
      mappingKey = "slug";
    } else if (title && byTitle.has(title)) {
      truePostId = byTitle.get(title) ?? "";
      mappingKey = "title";
    }

    return {
      ...listing,
      dom_post_id: domPostId,
      true_post_id: truePostId,
      mapping_key: mappingKey,
      listing_slug: slug,
    };
  });
}

async function discoverDataPostsSearchPath(params: {
  baseUrl: string;
  apiKey: string;
  preferredPath?: string;
  dataId: number;
}): Promise<string> {
  const candidates = [
    params.preferredPath,
    "/api/v2/data_posts/search",
    "/api/v2/data_post/search",
    "/api/v2/posts/search",
    "/api/v2/data_posts/list",
  ].filter((value): value is string => Boolean(value && value.trim()));

  let bestPath = "";
  let bestCount = -1;

  for (const path of candidates) {
    try {
      const response = await bdRequestWithRetryLocal(() =>
        bdRequestFormWithFallback({
          baseUrl: params.baseUrl,
          apiKey: params.apiKey,
          method: "POST",
          path,
          form: {
            data_id: params.dataId,
            page: 1,
            limit: 1,
            output_type: "array",
          },
        })
      );

      if (!response.ok) continue;
      const payload = normalizeBdJson(response.json);
      let records = parseBdRecords(payload);
      if (records.length === 0) {
        const fallbackRecords = extractRecordsFromUnknownShape(payload);
        if (fallbackRecords.length > 0) {
          records = fallbackRecords;
        }
      }
      const totals = parseBdTotals(payload);
      if (totals.status && totals.status !== "success") continue;
      const count = records.length;
      if (count > bestCount) {
        bestCount = count;
        bestPath = path;
      }
    } catch {
      continue;
    }
  }

  return bestPath || "/api/v2/data_posts/search";
}

async function upsertNodes(params: {
  userId: string;
  sourceType: "listing" | "blog_post";
  nodes: DirectoryIqNode[];
}): Promise<void> {
  for (const node of params.nodes) {
    await query(
      `
      INSERT INTO directoryiq_nodes (user_id, source_type, source_id, title, url, updated_at_source, raw_json)
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
      ON CONFLICT (user_id, source_type, source_id)
      DO UPDATE SET
        title = EXCLUDED.title,
        url = EXCLUDED.url,
        updated_at_source = EXCLUDED.updated_at_source,
        raw_json = EXCLUDED.raw_json,
        updated_at = now()
      `,
      [params.userId, params.sourceType, node.sourceId, node.title, node.url, node.updatedAt, JSON.stringify(node.raw)]
    );
  }
}

async function createRun(userId: string, sourceBaseUrl: string): Promise<string> {
  const rows = await query<{ id: string }>(
    `
    INSERT INTO directoryiq_ingest_runs (user_id, status, source_base_url)
    VALUES ($1, 'running', $2)
    RETURNING id
    `,
    [userId, sourceBaseUrl]
  );
  return rows[0].id;
}

async function finishRun(params: {
  runId: string;
  status: "succeeded" | "failed";
  listings: number;
  blogPosts: number;
  errorMessage?: string;
}): Promise<void> {
  await query(
    `
    UPDATE directoryiq_ingest_runs
    SET status = $2,
        finished_at = now(),
        listings_count = $3,
        blog_posts_count = $4,
        error_message = $5
    WHERE id = $1
    `,
    [params.runId, params.status, params.listings, params.blogPosts, params.errorMessage ?? null]
  );
}

export async function runDirectoryIqFullIngest(userId: string): Promise<DirectoryIqIngestResult> {
  const startedAt = Date.now();
  const deterministicEnabled = isDeterministicEnabled();
  const {
    integrations,
    baseUrlPresent,
    apiKeyPresent,
    tenantUserIdPresent,
  } = await loadBdIntegrations(userId);

  if (integrations.length === 0) {
    if (process.env.NODE_ENV === "production" && !deterministicEnabled) {
      throw new BdIntegrationMissingError({
        baseUrlPresent,
        apiKeyPresent,
        tenantUserIdPresent,
      });
    }
    if (!deterministicEnabled) {
      throw new Error("Brilliant Directories API credential is not configured.");
    }

    const runId = await createRun(userId, "deterministic://fixtures");
    const listings = buildDeterministicListings().map((item, index) => extractNode(item, "listing", index));
    await upsertNodes({ userId, sourceType: "listing", nodes: listings });
    await finishRun({
      runId,
      status: "succeeded",
      listings: listings.length,
      blogPosts: 0,
    });
    console.info(`[directoryiq-ingest] fixture_used=true listings=${listings.length}`);

    return {
      runId,
      status: "succeeded",
      counts: { listings: listings.length, blogPosts: 0 },
    };
  }

  let runId = "";
  try {
    const runBaseUrl = integrations[0]?.baseUrl ?? "multi://brilliant_directories";
    runId = await createRun(userId, runBaseUrl);

    let listingsTotal = 0;
    let blogPostsTotal = 0;
    const usingFallback = integrations.some((integration) => integration.userId !== userId);
    console.info(
      `[directoryiq-ingest] integrations_selected count=${integrations.length} fallback=${usingFallback}`
    );

    for (const integration of integrations) {
      const baseUrl = integration.baseUrl;
      const apiKey = integration.apiKey;
      const meta = integration.meta ?? {};

      const baseHost = (() => {
        try {
          return new URL(baseUrl).host || baseUrl;
        } catch {
          return baseUrl;
        }
      })();

      const configuredListingsPath =
        asString((meta as Record<string, unknown>).listingsPath) ||
        asString((meta as Record<string, unknown>).listings_path) ||
        asString(process.env.DIRECTORYIQ_LISTINGS_PATH) ||
        "/api/v2/user/search";
      let listingsPath = normalizeBdPath(configuredListingsPath);
      if (!listingsPath.includes("/api/v2/user/search")) {
        console.info(
          `[directoryiq-ingest] listings_path_override base=${baseHost} configured=${listingsPath} fallback=/api/v2/user/search`
        );
        listingsPath = "/api/v2/user/search";
      }

      console.info(
        `[directoryiq-ingest] site_start base=${baseHost} path=${listingsPath} label=${integration.label ?? ""} integration_id=${integration.id}`
      );

      let pagesFetched = 0;
      let lastPage = 0;
      const users = await fetchBdUsersPaged({
        baseUrl,
        apiKey,
        path: listingsPath,
        pageSize: 100,
        maxPages: 200,
        onPage: ({ page, received, total }) => {
          pagesFetched += 1;
          lastPage = page;
          console.info(
            `[directoryiq-ingest] listings_page base=${baseHost} path=${listingsPath} page=${page} per_page=100 received=${received} total=${total}`
          );
        },
      });

      const normalizedListings = users.map((item, index) =>
        normalizeUserListing(item, baseUrl, `user-${index + 1}`)
      );
      const listings = normalizedListings.map((item, index) => extractNode(item, "listing", index));
      await upsertNodes({ userId, sourceType: "listing", nodes: listings });
      listingsTotal += listings.length;

      console.info(
        `[directoryiq-ingest] site_complete base=${baseHost} count_ingested=${listings.length} pages_fetched=${pagesFetched} last_page=${lastPage}`
      );

      const blogPostsPath =
        asString((meta as Record<string, unknown>).blogPostsPath) ||
        asString((meta as Record<string, unknown>).blog_posts_path) ||
        asString(process.env.DIRECTORYIQ_BLOG_POSTS_PATH) ||
        "/api/v2/data_posts/search";

      const blogPostsDataId =
        asNumber((meta as Record<string, unknown>).blogPostsDataId) ??
        asNumber((meta as Record<string, unknown>).blog_posts_data_id) ??
        asNumber(process.env.DIRECTORYIQ_BLOG_POSTS_DATA_ID) ??
        14;

      try {
        const dataPostsSearchPath = await discoverDataPostsSearchPath({
          baseUrl,
          apiKey,
          preferredPath: blogPostsPath,
          dataId: blogPostsDataId,
        });

        const blogItems = await fetchBdPagedSearch({
          baseUrl,
          apiKey,
          path: dataPostsSearchPath,
          dataId: blogPostsDataId,
          includeAction: false,
          limit: 100,
          maxPages: 20,
        });

        const blogs = blogItems.map((item, index) => extractNode(item, "blog", index));
        if (blogs.length > 0) {
          await upsertNodes({ userId, sourceType: "blog_post", nodes: blogs });
        }
        blogPostsTotal += blogs.length;
        console.info(`[directoryiq-ingest] blog_site_complete base=${baseHost} count=${blogs.length}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`[directoryiq-ingest] blog_ingest_failed base=${baseHost} error=${message}`);
      }
    }

    await finishRun({
      runId,
      status: "succeeded",
      listings: listingsTotal,
      blogPosts: blogPostsTotal,
    });
    const durationMs = Date.now() - startedAt;
    console.info(
      `[directoryiq-ingest] completed status=succeeded listings=${listingsTotal} blog_posts=${blogPostsTotal} duration_ms=${durationMs}`
    );

    return {
      runId,
      status: "succeeded",
      counts: {
        listings: listingsTotal,
        blogPosts: blogPostsTotal,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown DirectoryIQ ingest error";
    if (runId) {
      await finishRun({
        runId,
        status: "failed",
        listings: 0,
        blogPosts: 0,
        errorMessage: message,
      });
    }
    const durationMs = Date.now() - startedAt;
    console.info(`[directoryiq-ingest] completed status=failed duration_ms=${durationMs}`);

    return {
      runId,
      status: "failed",
      counts: { listings: 0, blogPosts: 0 },
      errorMessage: message,
    };
  }
}

export async function runDirectoryIqBlogIngest(userId: string): Promise<DirectoryIqBlogIngestResult> {
  const row = await getDirectoryIqIntegrationSecret(userId, "brilliant_directories");
  if (!row) {
    throw new Error("Brilliant Directories API credential is not configured.");
  }

  const config = row.meta ?? {};
  const baseUrlRaw =
    (typeof config.baseUrl === "string" && config.baseUrl.trim()) ||
    (typeof config.base_url === "string" && config.base_url.trim()) ||
    process.env.DIRECTORYIQ_BRILLIANT_DIRECTORIES_BASE_URL ||
    "";

  if (!baseUrlRaw) {
    throw new Error("Brilliant Directories API not configured. Go to DirectoryIQ -> Settings -> Integrations.");
  }

  const baseUrl = normalizeBdBaseUrl(baseUrlRaw);
  const blogPostsPath =
    (typeof config.blogPostsPath === "string" && config.blogPostsPath.trim()) ||
    (typeof config.blog_posts_path === "string" && config.blog_posts_path.trim()) ||
    process.env.DIRECTORYIQ_BLOG_POSTS_PATH ||
    "/api/v2/data_posts/search";

  const blogPostsDataId =
    asNumber(config.blogPostsDataId) ??
    asNumber(config.blog_posts_data_id) ??
    asNumber(process.env.DIRECTORYIQ_BLOG_POSTS_DATA_ID) ??
    14;

  const apiKey = row.secret;

  let runId = "";
  try {
    runId = await createRun(userId, baseUrl);

    const dataPostsSearchPath = await discoverDataPostsSearchPath({
      baseUrl,
      apiKey,
      preferredPath: blogPostsPath,
      dataId: blogPostsDataId,
    });

    const blogItems = await fetchBdPagedSearch({
      baseUrl,
      apiKey,
      path: dataPostsSearchPath,
      dataId: blogPostsDataId,
      includeAction: false,
      limit: 100,
      maxPages: 20,
    });
    const blogSignals = blogItems.map(extractBlogHtmlAndText);
    const blogsWithRawHtml = blogSignals.filter((signal) => signal.rawHtml.length > 0).length;
    const avgCleanTextLength =
      blogSignals.length > 0
        ? Math.round(blogSignals.reduce((sum, signal) => sum + signal.cleanText.length, 0) / blogSignals.length)
        : 0;
    console.info(
      `[directoryiq-authority-ingest] Ingestion Debug Summary blogs_fetched=${blogItems.length} blog_detail_fetched=0 public_fetch=0 serpapi_fetch=0 blogs_with_raw_html=${blogsWithRawHtml} avg_clean_text_length=${avgCleanTextLength}`
    );

    const blogs = blogItems.map((item, index) => extractNode(item, "blog", index));
    await upsertNodes({ userId, sourceType: "blog_post", nodes: blogs });

    await finishRun({
      runId,
      status: "succeeded",
      listings: 0,
      blogPosts: blogs.length,
    });

    return {
      runId,
      status: "succeeded",
      counts: { blogPosts: blogs.length },
      blogPostsDataId,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown DirectoryIQ blog ingest error";
    if (runId) {
      await finishRun({
        runId,
        status: "failed",
        listings: 0,
        blogPosts: 0,
        errorMessage: message,
      });
    }

    return {
      runId,
      status: "failed",
      counts: { blogPosts: 0 },
      blogPostsDataId,
      errorMessage: message,
    };
  }
}

import { query } from "@/app/api/ecomviper/_utils/db";
import {
  normalizeBdBaseUrl,
  parseBdRecords,
  parseBdTotals,
} from "@/app/api/directoryiq/_utils/bdApi";
import {
  BdSiteRow,
  decryptBdSiteKey,
  ensureLegacyBdSite,
  getBdSite,
  listBdSiteRows,
} from "@/app/api/directoryiq/_utils/bdSites";

type DirectoryIqNode = {
  sourceId: string;
  title: string;
  url: string | null;
  updatedAt: string | null;
  raw: Record<string, unknown>;
};

type BdSiteConfig = {
  id: string;
  userId: string;
  label: string | null;
  baseUrl: string;
  apiKey: string;
  enabled: boolean;
  listingsDataId: number | null;
  blogPostsDataId: number | null;
  listingsPath: string;
  blogPostsPath: string | null;
  ingestCheckpoint: Record<string, unknown>;
};

type LocalBdResponse = {
  ok: boolean;
  status: number;
  json: unknown;
  text?: string;
  headers?: Record<string, string>;
};

export type DirectoryIqIngestResult = {
  runId: string;
  status: "succeeded" | "failed";
  counts: {
    listings: number;
    blogPosts: number;
  };
  errorMessage?: string;
  siteResults?: Array<{
    siteId: string;
    siteLabel: string | null;
    status: "succeeded" | "failed";
    listings: number;
    blogPosts: number;
    errorCode?: string | null;
  }>;
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
      Accept: "application/json",
    };
    const formWithKey = input.form ? { ...input.form } : {};

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
    const headersMap: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headersMap[key.toLowerCase()] = value;
    });
    return { ok: response.ok, status: response.status, json, text, headers: headersMap };
  } catch (error) {
    const message = error instanceof Error ? error.message : "bd request failed";
    return { ok: false, status: 500, json: { error: message }, text: message };
  }
}

async function bdRequestGet(input: {
  baseUrl: string;
  apiKey: string;
  path: string;
}): Promise<LocalBdResponse> {
  try {
    const headers: Record<string, string> = {
      "X-Api-Key": input.apiKey,
      Accept: "application/json",
    };
    const response = await fetch(`${normalizeBdBaseUrl(input.baseUrl)}${input.path}`, {
      method: "GET",
      headers,
      cache: "no-store",
    });
    const text = await response.text();
    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    const headersMap: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headersMap[key.toLowerCase()] = value;
    });
    return { ok: response.ok, status: response.status, json, text, headers: headersMap };
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

function extractDataType(payload: Record<string, unknown>): string | null {
  const direct = asString(payload.data_type);
  if (direct) return direct;
  const message = payload.message;
  if (message && typeof message === "object") {
    const nested = message as Record<string, unknown>;
    const nestedType = asString(nested.data_type);
    if (nestedType) return nestedType;
    for (const value of Object.values(nested)) {
      if (value && typeof value === "object") {
        const found = asString((value as Record<string, unknown>).data_type);
        if (found) return found;
      }
    }
  }
  return null;
}

async function fetchBdListingsPaged(params: {
  baseUrl: string;
  apiKey: string;
  path: string;
  dataId: number;
  limit: number;
  startPage?: number;
  maxPages?: number;
  pageDelayMs?: number;
  maxRetries?: number;
  retryBaseDelayMs?: number;
  retryMaxDelayMs?: number;
  sleepFn?: (ms: number) => Promise<void>;
  onPage?: (input: { page: number; limit: number; received: number; total: number }) => void;
}): Promise<Record<string, unknown>[]> {
  const all: Record<string, unknown>[] = [];
  const maxPages = params.maxPages ?? 200;
  const pageDelayMs = params.pageDelayMs ?? 300;
  const maxRetries = params.maxRetries ?? 6;
  const retryBaseDelayMs = params.retryBaseDelayMs ?? 500;
  const retryMaxDelayMs = params.retryMaxDelayMs ?? 8000;
  const sleepFn = params.sleepFn ?? sleep;

  for (let page = params.startPage ?? 1; page <= maxPages; page += 1) {
    const form: Record<string, unknown> = {
      action: "search",
      output_type: "array",
      data_id: params.dataId,
      limit: params.limit,
      page,
    };

    let response: LocalBdResponse | null = null;
    let attempt = 0;
    let lastDelayMs: number | null = null;
    for (; attempt <= maxRetries; attempt += 1) {
      response = await bdRequestWithRetryLocal(() =>
        bdRequestFormWithFallback({
          baseUrl: params.baseUrl,
          apiKey: params.apiKey,
          method: "POST",
          path: params.path,
          form,
        })
      );
      if (response.status !== 429) break;
      const retryAfterMs = parseRetryAfterMs(response.headers);
      const jitter = Math.floor(Math.random() * 250);
      const backoff = Math.min(retryMaxDelayMs, retryBaseDelayMs * 2 ** attempt) + jitter;
      const delay = Math.min(retryMaxDelayMs, retryAfterMs ?? backoff);
      lastDelayMs = delay;
      await sleepFn(delay);
    }
    if (!response) {
      throw new BdRequestFailure({
        statusCode: 500,
        endpoint: params.path,
        page,
        snippet: "empty_response",
      });
    }

    if (!response.ok) {
      const detail = typeof response.text === "string" && response.text.trim().length > 0 ? response.text.trim() : "";
      const snippet = detail.length > 120 ? `${detail.slice(0, 120)}...` : detail;
      const failure = new BdRequestFailure({
        statusCode: response.status,
        endpoint: params.path,
        page,
        snippet,
      });
      failure.retryAttempts = attempt;
      failure.nextRetryDelayMs = lastDelayMs;
      throw failure;
    }

    const payload = normalizeBdJson(response.json);
    if (typeof payload.status === "string" && payload.status.toLowerCase() === "error") {
      const msg = typeof payload.message === "string" ? payload.message : "Unknown BD error";
      const snippet = msg.length > 120 ? `${msg.slice(0, 120)}...` : msg;
      throw new BdRequestFailure({
        statusCode: response.status,
        endpoint: params.path,
        page,
        snippet,
      });
    }

    const message = payload.message;
    if (!Array.isArray(message)) {
      const raw =
        typeof message === "string"
          ? message
          : JSON.stringify(message ?? payload).slice(0, 120);
      const snippet = raw.length > 120 ? `${raw.slice(0, 120)}...` : raw;
      throw new BdRequestFailure({
        statusCode: response.status,
        endpoint: params.path,
        page,
        snippet,
      });
    }

    const records = message.filter((row) => row && typeof row === "object") as Record<string, unknown>[];
    params.onPage?.({ page, limit: params.limit, received: records.length, total: all.length + records.length });

    if (records.length === 0) break;
    all.push(...records);

    if (pageDelayMs > 0) {
      await sleepFn(pageDelayMs);
    }
  }

  return all;
}

type BdIngestErrorCode =
  | "bd_integration_missing"
  | "bd_integration_invalid"
  | "bd_post_type_invalid"
  | "bd_request_failed"
  | "bd_rate_limited";

export class BdIngestError extends Error {
  code: BdIngestErrorCode;
  baseUrlPresent: boolean;
  apiKeyPresent: boolean;
  listingsPathPresent: boolean;
  listingsDataIdPresent: boolean;
  listingsDataIdValue: number | null;
  dataTypeObserved: string | null;
  statusCode: number | null;
  endpoint: string | null;
  page: number | null;
  messageSnippet: string | null;
  pagesSucceeded: number | null;
  pageFailed: number | null;
  listingsIngested: number | null;
  willResumeFromPage: number | null;
  retryAttempts: number | null;
  nextRetryDelayMs: number | null;

  constructor(params: {
    code: BdIngestErrorCode;
    baseUrlPresent: boolean;
    apiKeyPresent: boolean;
    listingsPathPresent: boolean;
    listingsDataIdPresent: boolean;
    listingsDataIdValue: number | null;
    dataTypeObserved?: string | null;
    statusCode?: number | null;
    endpoint?: string | null;
    page?: number | null;
    messageSnippet?: string | null;
    pagesSucceeded?: number | null;
    pageFailed?: number | null;
    listingsIngested?: number | null;
    willResumeFromPage?: number | null;
    retryAttempts?: number | null;
    nextRetryDelayMs?: number | null;
  }) {
    super(params.code);
    this.name = "BdIngestError";
    this.code = params.code;
    this.baseUrlPresent = params.baseUrlPresent;
    this.apiKeyPresent = params.apiKeyPresent;
    this.listingsPathPresent = params.listingsPathPresent;
    this.listingsDataIdPresent = params.listingsDataIdPresent;
    this.listingsDataIdValue = params.listingsDataIdValue;
    this.dataTypeObserved = params.dataTypeObserved ?? null;
    this.statusCode = params.statusCode ?? null;
    this.endpoint = params.endpoint ?? null;
    this.page = params.page ?? null;
    this.messageSnippet = params.messageSnippet ?? null;
    this.pagesSucceeded = params.pagesSucceeded ?? null;
    this.pageFailed = params.pageFailed ?? null;
    this.listingsIngested = params.listingsIngested ?? null;
    this.willResumeFromPage = params.willResumeFromPage ?? null;
    this.retryAttempts = params.retryAttempts ?? null;
    this.nextRetryDelayMs = params.nextRetryDelayMs ?? null;
  }
}

class BdRequestFailure extends Error {
  statusCode: number;
  endpoint: string;
  page: number;
  snippet: string | null;
  retryAttempts: number;
  nextRetryDelayMs: number | null;

  constructor(params: { statusCode: number; endpoint: string; page: number; snippet?: string | null }) {
    super("bd_request_failed");
    this.name = "BdRequestFailure";
    this.statusCode = params.statusCode;
    this.endpoint = params.endpoint;
    this.page = params.page;
    this.snippet = params.snippet ?? null;
    this.retryAttempts = 0;
    this.nextRetryDelayMs = null;
  }
}

function parseRetryAfterMs(headers?: Record<string, string>): number | null {
  if (!headers) return null;
  const raw = headers["retry-after"];
  if (!raw) return null;
  const seconds = Number(raw);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const dateMs = Date.parse(raw);
  if (Number.isFinite(dateMs)) {
    const delta = dateMs - Date.now();
    return delta > 0 ? delta : 0;
  }
  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isDeterministicEnabled(): boolean {
  const mode = typeof process.env.DIRECTORYIQ_MODE === "string" ? process.env.DIRECTORYIQ_MODE.toLowerCase() : "";
  if (mode === "deterministic") return true;
  if (process.env.DIRECTORYIQ_DETERMINISTIC === "1") return true;
  if (process.env.E2E_TEST_MODE === "1") return true;
  if (process.env.E2E_MOCK_BD === "1") return true;
  return false;
}

async function loadBdSitesForIngest(params: {
  userId: string;
  siteId?: string | null;
  allSites?: boolean;
}): Promise<{
  sites: BdSiteConfig[];
  baseUrlPresent: boolean;
  apiKeyPresent: boolean;
  listingsPathPresent: boolean;
  listingsDataIdPresent: boolean;
}> {
  await ensureLegacyBdSite(params.userId);
  let rows: BdSiteRow[] = [];
  if (params.siteId) {
    const row = await getBdSite(params.userId, params.siteId);
    if (row) rows = [row];
  } else {
    rows = await listBdSiteRows(params.userId);
    if (!params.allSites) {
      rows = rows.filter((row) => row.enabled);
      if (rows.length > 1) rows = [rows[0]];
    }
  }

  const baseUrlPresent = rows.some((row) => Boolean(row.base_url));
  const apiKeyPresent = rows.some((row) => Boolean(row.secret_ciphertext));
  const listingsPathPresent = rows.some((row) => Boolean(row.listings_path));
  const listingsDataIdPresent = rows.some((row) => row.listings_data_id != null);

  const sites: BdSiteConfig[] = [];
  for (const row of rows) {
    if (!row.secret_ciphertext) continue;
    const apiKey = (await decryptBdSiteKey(row)).trim();
    if (!apiKey) continue;
    if (!row.enabled && !params.allSites) continue;
    sites.push({
      id: row.id,
      userId: row.user_id,
      label: row.label,
      baseUrl: normalizeBdBaseUrl(row.base_url),
      apiKey,
      enabled: row.enabled,
      listingsDataId: row.listings_data_id,
      blogPostsDataId: row.blog_posts_data_id,
      listingsPath: row.listings_path,
      blogPostsPath: row.blog_posts_path,
      ingestCheckpoint: row.ingest_checkpoint_json ?? {},
    });
  }

  return {
    sites,
    baseUrlPresent,
    apiKeyPresent,
    listingsPathPresent,
    listingsDataIdPresent,
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

async function updateListingsCheckpoint(params: {
  siteId: string;
  lastPage: number;
}): Promise<void> {
  await query(
    `
    UPDATE directoryiq_bd_sites
    SET ingest_checkpoint_json = jsonb_set(
      COALESCE(ingest_checkpoint_json, '{}'::jsonb),
      '{listings_last_page}',
      to_jsonb($2::int),
      true
    ),
    updated_at = now()
    WHERE id = $1
    `,
    [params.siteId, params.lastPage]
  );
}

function readListingsCheckpoint(meta: Record<string, unknown>): number | null {
  const checkpoint = meta;
  if (checkpoint && typeof checkpoint === "object") {
    const value = asNumber((checkpoint as Record<string, unknown>).listings_last_page);
    return value ?? null;
  }
  return null;
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

function extractNode(
  item: Record<string, unknown>,
  fallbackPrefix: string,
  index: number,
  siteId?: string | null
): DirectoryIqNode {
  const rawId = String(
    item.id ?? item.post_id ?? item.group_id ?? item.data_post_id ?? item.listing_id ?? item.slug ?? `${fallbackPrefix}-${index + 1}`
  );
  const sourceId = siteId ? `${siteId}:${rawId}` : rawId;

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
  siteId?: string | null;
}): Promise<void> {
  for (const node of params.nodes) {
    await query(
      `
      INSERT INTO directoryiq_nodes (user_id, source_type, source_id, bd_site_id, title, url, updated_at_source, raw_json)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
      ON CONFLICT (user_id, source_type, source_id)
      DO UPDATE SET
        bd_site_id = EXCLUDED.bd_site_id,
        title = EXCLUDED.title,
        url = EXCLUDED.url,
        updated_at_source = EXCLUDED.updated_at_source,
        raw_json = EXCLUDED.raw_json,
        updated_at = now()
      `,
      [
        params.userId,
        params.sourceType,
        node.sourceId,
        params.siteId ?? null,
        node.title,
        node.url,
        node.updatedAt,
        JSON.stringify(node.raw),
      ]
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

export async function runDirectoryIqFullIngest(
  userId: string,
  options?: { siteId?: string | null; allSites?: boolean }
): Promise<DirectoryIqIngestResult> {
  const startedAt = Date.now();
  const deterministicEnabled = isDeterministicEnabled();
  const { sites, baseUrlPresent, apiKeyPresent, listingsPathPresent, listingsDataIdPresent } =
    await loadBdSitesForIngest({
      userId,
      siteId: options?.siteId ?? null,
      allSites: options?.allSites ?? false,
    });

  if (sites.length === 0) {
    if (process.env.NODE_ENV === "production" && !deterministicEnabled) {
      throw new BdIngestError({
        code: "bd_integration_missing",
        baseUrlPresent,
        apiKeyPresent,
        listingsPathPresent,
        listingsDataIdPresent,
        listingsDataIdValue: null,
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
    const fixtureCleanup = await query<{ count: number }>(
      `
      DELETE FROM directoryiq_nodes
      WHERE user_id = $1
        AND source_type = 'listing'
        AND (raw_json->>'source_url') = 'https://example.com/listings/summit-home-services'
      RETURNING 1 as count
      `,
      [userId]
    );
    if (fixtureCleanup.length > 0) {
      console.info(`[directoryiq-ingest] fixture_cleanup removed=${fixtureCleanup.length}`);
    }

    const runBaseUrl = sites[0]?.baseUrl ?? "multi://brilliant_directories";
    runId = await createRun(userId, runBaseUrl);

    let listingsTotal = 0;
    let blogPostsTotal = 0;
    const siteResults: Array<{
      siteId: string;
      siteLabel: string | null;
      status: "succeeded" | "failed";
      listings: number;
      blogPosts: number;
      errorCode?: string | null;
    }> = [];
    let hasFailures = false;
    console.info(
      `[directoryiq-ingest] integrations_selected count=${sites.length} fallback=false`
    );

    for (const site of sites) {
      const baseUrl = site.baseUrl;
      const apiKey = site.apiKey;

      const baseHost = (() => {
        try {
          return new URL(baseUrl).host || baseUrl;
        } catch {
          return baseUrl;
        }
      })();

      const listingsPathRaw = asString(site.listingsPath) || asString(process.env.DIRECTORYIQ_LISTINGS_PATH);
      const listingsPath = normalizeBdPath(listingsPathRaw || "/api/v2/users_portfolio_groups/search");
      const listingsPathPresentLocal = Boolean(listingsPathRaw);

      const listingsDataId = site.listingsDataId ?? asNumber(process.env.DIRECTORYIQ_LISTINGS_DATA_ID);

      const listingsDataIdPresent = typeof listingsDataId === "number";
      const listingsLimit =
        asNumber(process.env.DIRECTORYIQ_LISTINGS_LIMIT) ??
        100;
      const pageDelayMs =
        asNumber(process.env.DIRECTORYIQ_LISTINGS_PAGE_DELAY_MS) ??
        300;
      const maxRetries =
        asNumber(process.env.DIRECTORYIQ_LISTINGS_429_MAX_RETRIES) ??
        6;
      const retryBaseDelayMs =
        asNumber(process.env.DIRECTORYIQ_LISTINGS_429_BASE_DELAY_MS) ??
        500;
      const retryMaxDelayMs =
        asNumber(process.env.DIRECTORYIQ_LISTINGS_429_MAX_DELAY_MS) ??
        8000;
      const resetRequested =
        process.env.DIRECTORYIQ_INGEST_RESET === "1" ||
        process.env.DIRECTORYIQ_LISTINGS_RESET === "1";
      const checkpointPage = resetRequested ? null : readListingsCheckpoint(site.ingestCheckpoint ?? {});
      const startPage = checkpointPage ? checkpointPage + 1 : 1;

      console.info(
        `[directoryiq-ingest] site_start base=${baseHost} path=${listingsPath} label=${site.label ?? ""} site_id=${site.id}`
      );

      if (!listingsDataIdPresent) {
        throw new BdIngestError({
          code: "bd_integration_missing",
          baseUrlPresent,
          apiKeyPresent,
          listingsPathPresent: listingsPathPresentLocal,
          listingsDataIdPresent,
          listingsDataIdValue: null,
          endpoint: listingsPath,
        });
      }

      const preflightPath = `/api/v2/data_categories/get/${listingsDataId}`;
      const preflightResponse = await bdRequestGet({ baseUrl, apiKey, path: preflightPath });
      const preflightPayload = normalizeBdJson(preflightResponse.json);
      const dataTypeObserved = extractDataType(preflightPayload);
      const preflightOk =
        preflightResponse.ok &&
        !(typeof preflightPayload.status === "string" && preflightPayload.status.toLowerCase() === "error");
      console.info(
        JSON.stringify({
          phase: "bd_preflight",
          ok: preflightOk,
          data_id: listingsDataId,
          data_type_observed: dataTypeObserved,
        })
      );

      if (!preflightOk) {
        throw new BdIngestError({
          code: "bd_integration_invalid",
          baseUrlPresent,
          apiKeyPresent,
          listingsPathPresent: listingsPathPresentLocal,
          listingsDataIdPresent,
          listingsDataIdValue: listingsDataId,
          dataTypeObserved,
          statusCode: preflightResponse.status,
          endpoint: preflightPath,
        });
      }

      if (dataTypeObserved !== "4") {
        throw new BdIngestError({
          code: "bd_post_type_invalid",
          baseUrlPresent,
          apiKeyPresent,
          listingsPathPresent: listingsPathPresentLocal,
          listingsDataIdPresent,
          listingsDataIdValue: listingsDataId,
          dataTypeObserved,
          statusCode: preflightResponse.status,
          endpoint: preflightPath,
        });
      }

      let pagesFetched = 0;
      let itemsTotal = 0;
      let listingsItems: Record<string, unknown>[] = [];
      try {
        listingsItems = await fetchBdListingsPaged({
          baseUrl,
          apiKey,
          path: listingsPath,
          dataId: listingsDataId,
          limit: listingsLimit,
          maxPages: 200,
          startPage,
          pageDelayMs,
          maxRetries,
          retryBaseDelayMs,
          retryMaxDelayMs,
          onPage: ({ page, limit, received, total }) => {
            pagesFetched += 1;
            itemsTotal = total;
            console.info(
              JSON.stringify({
                phase: "bd_page",
                page,
                limit,
                returned: received,
                total,
              })
            );
            updateListingsCheckpoint({ siteId: site.id, lastPage: page }).catch(() => {});
          },
        });
      } catch (error) {
        if (error instanceof BdRequestFailure) {
          const code = error.statusCode === 429 ? "bd_rate_limited" : "bd_request_failed";
          const ingestError = new BdIngestError({
            code,
            baseUrlPresent,
            apiKeyPresent,
            listingsPathPresent: listingsPathPresentLocal,
            listingsDataIdPresent,
            listingsDataIdValue: listingsDataId,
            statusCode: error.statusCode,
            endpoint: error.endpoint,
            page: error.page,
            messageSnippet: error.snippet,
            pagesSucceeded: pagesFetched,
            pageFailed: error.page,
            listingsIngested: listingsTotal,
            willResumeFromPage: error.page,
            retryAttempts: error.retryAttempts,
            nextRetryDelayMs: error.nextRetryDelayMs,
          });
          if (options?.allSites) {
            hasFailures = true;
            siteResults.push({
              siteId: site.id,
              siteLabel: site.label,
              status: "failed",
              listings: 0,
              blogPosts: 0,
              errorCode: ingestError.code,
            });
            continue;
          }
          throw ingestError;
        }
        throw error;
      }

      console.info(
        JSON.stringify({
          phase: "bd_done",
          pages_fetched: pagesFetched,
          items_total: itemsTotal,
        })
      );

      const normalizedListings = listingsItems.map((item, index) => {
        const normalized = normalizeListingRecord(item, `listing-${index + 1}`);
        normalized.site_id = site.id;
        normalized.site_label = site.label ?? "";
        return normalized;
      });
      const filteredListings: Record<string, unknown>[] = [];
      for (const listing of normalizedListings) {
        const listingId = asString(listing.listing_id);
        if (!listingId) {
          console.warn("[directoryiq-ingest] listing_missing_id skipped=true");
          continue;
        }
        listing.listing_id = listingId;
        filteredListings.push(listing);
      }

      const listings = filteredListings.map((item, index) =>
        extractNode(item, `listing:${site.id}`, index, site.id)
      );
      if (listings.length > 0) {
        await upsertNodes({ userId, sourceType: "listing", nodes: listings, siteId: site.id });
      }
      listingsTotal += listings.length;

      let siteBlogPosts = 0;
      const blogPostsPath =
        asString(site.blogPostsPath) ||
        asString(process.env.DIRECTORYIQ_BLOG_POSTS_PATH) ||
        "/api/v2/data_posts/search";

      const blogPostsDataId =
        site.blogPostsDataId ??
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

        const blogs = blogItems.map((item, index) => extractNode(item, `blog:${site.id}`, index, site.id));
        if (blogs.length > 0) {
          await upsertNodes({ userId, sourceType: "blog_post", nodes: blogs, siteId: site.id });
        }
        siteBlogPosts = blogs.length;
        blogPostsTotal += blogs.length;
        console.info(`[directoryiq-ingest] blog_site_complete base=${baseHost} count=${blogs.length}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`[directoryiq-ingest] blog_ingest_failed base=${baseHost} error=${message}`);
      }

      siteResults.push({
        siteId: site.id,
        siteLabel: site.label,
        status: "succeeded",
        listings: listings.length,
        blogPosts: siteBlogPosts,
      });
    }

    await finishRun({
      runId,
      status: hasFailures ? "failed" : "succeeded",
      listings: listingsTotal,
      blogPosts: blogPostsTotal,
    });
    const durationMs = Date.now() - startedAt;
    console.info(
      `[directoryiq-ingest] completed status=succeeded listings=${listingsTotal} blog_posts=${blogPostsTotal} duration_ms=${durationMs}`
    );

    return {
      runId,
      status: hasFailures ? "failed" : "succeeded",
      counts: {
        listings: listingsTotal,
        blogPosts: blogPostsTotal,
      },
      siteResults,
    };
  } catch (error) {
    if (error instanceof BdIngestError) {
      if (runId) {
        await finishRun({
          runId,
          status: "failed",
          listings: 0,
          blogPosts: 0,
          errorMessage: error.code,
        });
      }
      const durationMs = Date.now() - startedAt;
      console.info(`[directoryiq-ingest] completed status=failed duration_ms=${durationMs}`);
      throw error;
    }
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
  const { sites } = await loadBdSitesForIngest({ userId });
  const site = sites[0];
  if (!site) {
    throw new Error("Brilliant Directories API credential is not configured.");
  }

  const baseUrl = normalizeBdBaseUrl(site.baseUrl);
  const blogPostsPath =
    asString(site.blogPostsPath) ||
    asString(process.env.DIRECTORYIQ_BLOG_POSTS_PATH) ||
    "/api/v2/data_posts/search";

  const blogPostsDataId =
    site.blogPostsDataId ??
    asNumber(process.env.DIRECTORYIQ_BLOG_POSTS_DATA_ID) ??
    14;

  const apiKey = site.apiKey;

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

    const blogs = blogItems.map((item, index) => extractNode(item, `blog:${site.id}`, index, site.id));
    await upsertNodes({ userId, sourceType: "blog_post", nodes: blogs, siteId: site.id });

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

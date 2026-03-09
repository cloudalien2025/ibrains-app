import {
  normalizeBdBaseUrl,
} from "@/app/api/directoryiq/_utils/bdApi";
import { decryptBdSiteKey, getBdSite, listBdSiteRows } from "@/app/api/directoryiq/_utils/bdSites";
import { getDirectoryIqIntegrationSecret } from "@/app/api/directoryiq/_utils/credentials";

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asNumber(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function extractSlug(value: unknown): string {
  const text = asString(value);
  if (!text) return "";
  const match = text.match(/\/listings\/([^/?#]+)/i);
  if (match?.[1]) return match[1].toLowerCase();
  return text.replace(/^\/+/, "").replace(/\/+$/, "").toLowerCase();
}

function extractTitle(item: Record<string, unknown>): string {
  return asString(item.group_name ?? item.post_title ?? item.title ?? item.name).toLowerCase();
}

function extractCanonicalPostId(item: Record<string, unknown>): string {
  const postId = item.post_id;
  if (typeof postId === "string" && postId.trim().length > 0) return postId.trim();
  if (typeof postId === "number" && Number.isFinite(postId)) return String(postId);
  return "";
}

type BdResponse = {
  ok: boolean;
  status: number;
  json: Record<string, unknown> | null;
  text?: string;
};

async function requestBd(params: {
  baseUrl: string;
  apiKey: string;
  method: "GET" | "POST" | "PUT";
  path: string;
  form?: Record<string, unknown>;
}): Promise<BdResponse> {
  try {
    const headers: Record<string, string> = {
      "X-Api-Key": params.apiKey,
      Accept: "application/json",
    };

    let body: URLSearchParams | undefined;
    if (params.method !== "GET") {
      headers["Content-Type"] = "application/x-www-form-urlencoded";
      body = new URLSearchParams();
      for (const [key, value] of Object.entries(params.form ?? {})) {
        if (value == null) continue;
        body.set(key, String(value));
      }
    }

    const query =
      params.method === "GET" && params.form
        ? `?${new URLSearchParams(
            Object.entries(params.form)
              .filter(([, value]) => value != null)
              .map(([key, value]) => [key, String(value)])
          ).toString()}`
        : "";

    const response = await fetch(`${normalizeBdBaseUrl(params.baseUrl)}${params.path}${query}`, {
      method: params.method,
      headers,
      body,
      cache: "no-store",
    });

    const text = await response.text();
    let json: Record<string, unknown> | null = null;
    try {
      json = text ? (JSON.parse(text) as Record<string, unknown>) : null;
    } catch {
      json = null;
    }
    return { ok: response.ok, status: response.status, json, text };
  } catch (error) {
    const message = error instanceof Error ? error.message : "bd request failed";
    return { ok: false, status: 500, json: { error: message }, text: message };
  }
}

async function requestBdWithRetry(
  request: () => Promise<BdResponse>,
  maxAttempts = 2
): Promise<BdResponse> {
  let last: BdResponse | null = null;
  for (let attempt = 1; attempt <= Math.max(1, maxAttempts); attempt += 1) {
    const result = await request();
    if (result.ok || result.status < 500) return result;
    last = result;
  }
  return last ?? { ok: false, status: 500, json: { error: "request failed" } };
}

function parseBdTotals(json: Record<string, unknown>): { status: string | null; totalPages: number | null } {
  const asNum = (value: unknown): number | null => {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  };
  return {
    status: typeof json.status === "string" ? json.status : null,
    totalPages: asNum(json.total_pages ?? json.pages ?? json.last_page),
  };
}

function extractDataPostRecords(json: Record<string, unknown>): Record<string, unknown>[] {
  const isRows = (value: unknown): value is Record<string, unknown>[] =>
    Array.isArray(value) && value.some((row) => row && typeof row === "object");

  const candidates: unknown[] = [json.data, json.records, json.items, json.rows, json.message, json.data_posts, json.posts];
  for (const candidate of candidates) {
    if (isRows(candidate)) return candidate;
    if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) {
      const nested = candidate as Record<string, unknown>;
      const nestedCandidates = [nested.records, nested.items, nested.rows, nested.data_posts, nested.posts];
      for (const nestedCandidate of nestedCandidates) {
        if (isRows(nestedCandidate)) return nestedCandidate;
      }
    }
  }
  return [];
}

function normalizePath(path: string): string {
  const trimmed = path.trim();
  if (!trimmed) return "/";
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function dataPostsGetPath(postId: string): string {
  return `/api/v2/data_posts/get/${encodeURIComponent(postId)}`;
}

function extractSlugFromPost(item: Record<string, unknown>): string {
  return extractSlug(item.post_filename ?? item.slug ?? item.group_filename ?? item.post_slug ?? item.url ?? item.link ?? item.permalink);
}

function extractUrl(item: Record<string, unknown>): string {
  return asString(item.url ?? item.link ?? item.permalink);
}

function isSuccessfulWrapper(payload: Record<string, unknown>): boolean {
  const status = typeof payload.status === "string" ? payload.status.toLowerCase() : null;
  return !status || status === "success";
}

function normalizeForCompare(value: string): string {
  return value.trim().toLowerCase();
}

function collectDataPostsSearchPaths(preferredPath: string): string[] {
  const candidates = [
    preferredPath,
    "/api/v2/data_posts/search",
    "/api/v2/data_post/search",
    "/api/v2/posts/search",
    "/api/v2/data_posts/list",
  ];
  const normalized: string[] = [];
  for (const candidate of candidates) {
    const path = normalizePath(candidate);
    if (!path || normalized.includes(path)) continue;
    normalized.push(path);
  }
  return normalized;
}

export async function getDirectoryIqOpenAiKey(userId: string): Promise<string | null> {
  const row = await getDirectoryIqIntegrationSecret(userId, "openai");
  if (row?.secret) return row.secret;
  return process.env.OPENAI_API_KEY ?? null;
}

export async function getSerpApiKeyForUser(userId: string): Promise<string | null> {
  const row = await getDirectoryIqIntegrationSecret(userId, "serpapi");
  return row?.secret ?? null;
}

export async function getGa4ConfigForUser(userId: string): Promise<{ measurementId: string; apiSecret: string } | null> {
  const row = await getDirectoryIqIntegrationSecret(userId, "ga4");
  if (!row?.secret) return null;
  const measurementId = asString(row.meta.measurementId);
  if (!measurementId) return null;
  return {
    measurementId,
    apiSecret: row.secret,
  };
}

export async function getDirectoryIqBdConnection(
  userId: string,
  siteId?: string | null
): Promise<{
  baseUrl: string;
  apiKey: string;
  listingsSearchPath: string;
  dataPostsSearchPath: string;
  dataPostsUpdatePath: string;
  dataPostsCreatePath: string;
  listingsDataId: number;
  blogPostsDataId: number | null;
} | null> {
  const site = siteId ? await getBdSite(userId, siteId) : (await listBdSiteRows(userId)).find((row) => row.enabled);
  if (!site || !site.secret_ciphertext) return null;

  const baseUrl = normalizeBdBaseUrl(site.base_url);
  if (!baseUrl) return null;

  const listingsSearchPath = asString(site.listings_path) || "/api/v2/users_portfolio_groups/search";
  const dataPostsSearchPath = asString(site.blog_posts_path) || "/api/v2/data_posts/search";
  const dataPostsUpdatePath = "/api/v2/data_posts/update";
  const dataPostsCreatePath = "/api/v2/data_posts/create";
  const listingsDataId = site.listings_data_id ?? asNumber(process.env.DIRECTORYIQ_LISTINGS_DATA_ID) ?? 75;
  const blogPostsDataId =
    site.blog_posts_data_id ?? asNumber(process.env.DIRECTORYIQ_BLOG_POSTS_DATA_ID) ?? 14;

  const apiKey = (await decryptBdSiteKey(site)).trim();
  if (!apiKey) return null;

  return {
    baseUrl,
    apiKey,
    listingsSearchPath,
    dataPostsSearchPath,
    dataPostsUpdatePath,
    dataPostsCreatePath,
    listingsDataId,
    blogPostsDataId,
  };
}

export async function resolveTruePostIdForListing(params: {
  baseUrl: string;
  apiKey: string;
  dataPostsSearchPath: string;
  listingsDataId: number;
  listingId: string;
  listingSlug?: string;
  listingTitle?: string;
}): Promise<{ truePostId: string | null; mappingKey: "slug" | "title" | "unresolved" }> {
  const slugTarget = extractSlug(params.listingSlug ?? "");
  const titleTarget = asString(params.listingTitle).toLowerCase();
  const urlTarget = extractUrl({
    url: params.listingSlug && /^https?:\/\//i.test(params.listingSlug) ? params.listingSlug : "",
  });
  if (!slugTarget && !titleTarget && !urlTarget) {
    return { truePostId: null, mappingKey: "unresolved" };
  }

  const perPage = 100;
  const maxPages = 5;
  const recordsByPath = new Map<string, Record<string, unknown>[]>();
  for (const path of collectDataPostsSearchPaths(params.dataPostsSearchPath)) {
    const collected: Record<string, unknown>[] = [];
    for (let page = 1; page <= maxPages; page += 1) {
      const response = await requestBdWithRetry(() =>
        requestBd({
          baseUrl: params.baseUrl,
          apiKey: params.apiKey,
          method: "POST",
          path,
          form: {
            action: "search",
            output_type: "array",
            data_id: params.listingsDataId,
            page,
            limit: perPage,
          },
        })
      );
      if (!response.ok) break;
      const payload = response.json ?? {};
      if (!isSuccessfulWrapper(payload)) break;

      const pageRecords = extractDataPostRecords(payload);
      if (pageRecords.length === 0) break;
      collected.push(...pageRecords);

      const totals = parseBdTotals(payload);
      if (totals.totalPages && page >= totals.totalPages) break;
      if (pageRecords.length < perPage) break;
    }
    if (collected.length > 0) {
      recordsByPath.set(path, collected);
    }
  }

  const confirmCandidate = async (candidate: {
    postId: string;
    expectSlug?: string;
    expectTitle?: string;
    expectUrl?: string;
  }): Promise<Record<string, unknown> | null> => {
    const response = await requestBdWithRetry(() =>
      requestBd({
        baseUrl: params.baseUrl,
        apiKey: params.apiKey,
        method: "GET",
        path: dataPostsGetPath(candidate.postId),
      })
    );
    if (!response.ok) return null;
    const payload = response.json ?? {};
    if (!isSuccessfulWrapper(payload)) return null;
    const single = [payload.data, payload.message, payload.post, payload.data_post, payload]
      .find((candidate) => candidate && typeof candidate === "object" && !Array.isArray(candidate)) as
      | Record<string, unknown>
      | undefined;
    if (!single) return null;
    const confirmedPostId = extractCanonicalPostId(single);
    if (!confirmedPostId || confirmedPostId !== candidate.postId) return null;

    const confirmedSlug = extractSlugFromPost(single);
    const confirmedTitle = extractTitle(single);
    const confirmedUrl = normalizeForCompare(extractUrl(single));
    const expectUrl = normalizeForCompare(candidate.expectUrl ?? "");

    if (candidate.expectSlug && confirmedSlug !== candidate.expectSlug) return null;
    if (candidate.expectTitle && confirmedTitle !== candidate.expectTitle) return null;
    if (expectUrl && confirmedUrl !== expectUrl) return null;

    return single;
  };

  const resolveFromRecords = async (
    records: Record<string, unknown>[]
  ): Promise<{ truePostId: string | null; mappingKey: "slug" | "title" | "unresolved" }> => {
    const canonical = records.filter((row) => extractCanonicalPostId(row).length > 0);

    if (slugTarget) {
      const bySlug = canonical.filter((row) => extractSlugFromPost(row) === slugTarget);
      if (bySlug.length > 1) return { truePostId: null, mappingKey: "unresolved" };
      if (bySlug.length === 1) {
        const postId = extractCanonicalPostId(bySlug[0]);
        const confirmed = await confirmCandidate({
          postId,
          expectSlug: slugTarget,
        });
        if (!confirmed) return { truePostId: null, mappingKey: "unresolved" };
        return { truePostId: postId, mappingKey: "slug" };
      }
    }

    if (titleTarget) {
      const byTitle = canonical.filter((row) => extractTitle(row) === titleTarget);
      if (byTitle.length > 1) return { truePostId: null, mappingKey: "unresolved" };
      if (byTitle.length === 1) {
        const postId = extractCanonicalPostId(byTitle[0]);
        const confirmed = await confirmCandidate({
          postId,
          expectTitle: titleTarget,
        });
        if (!confirmed) return { truePostId: null, mappingKey: "unresolved" };
        return { truePostId: postId, mappingKey: "title" };
      }
    }

    if (urlTarget) {
      const byUrl = canonical.filter((row) => normalizeForCompare(extractUrl(row)) === normalizeForCompare(urlTarget));
      if (byUrl.length > 1) return { truePostId: null, mappingKey: "unresolved" };
      if (byUrl.length === 1) {
        const postId = extractCanonicalPostId(byUrl[0]);
        const confirmed = await confirmCandidate({
          postId,
          expectUrl: urlTarget,
        });
        if (!confirmed) return { truePostId: null, mappingKey: "unresolved" };
        return { truePostId: postId, mappingKey: "title" };
      }
    }

    return { truePostId: null, mappingKey: "unresolved" };
  };

  for (const path of collectDataPostsSearchPaths(params.dataPostsSearchPath)) {
    const records = recordsByPath.get(path);
    if (!records || records.length === 0) continue;
    const resolved = await resolveFromRecords(records);
    if (resolved.truePostId) return resolved;
    if (resolved.mappingKey === "unresolved") {
      // continue trying next candidate path only when no clear conflicting evidence
      continue;
    }
  }

  return { truePostId: null, mappingKey: "unresolved" };
}

export async function pushListingUpdateToBd(params: {
  baseUrl: string;
  apiKey: string;
  dataPostsUpdatePath: string;
  postId: string;
  changes: Record<string, unknown>;
}): Promise<{ ok: boolean; status: number; body: Record<string, unknown> | null }> {
  const form: Record<string, unknown> = { post_id: params.postId };
  for (const [key, value] of Object.entries(params.changes)) {
    if (value == null) continue;
    form[key] = String(value);
  }

  const response = await requestBdWithRetry(() =>
    requestBd({
      baseUrl: params.baseUrl,
      apiKey: params.apiKey,
      method: "PUT",
      path: params.dataPostsUpdatePath,
      form,
    })
  );

  return {
    ok: response.ok,
    status: response.status,
    body: response.json,
  };
}

export async function publishBlogPostToBd(params: {
  baseUrl: string;
  apiKey: string;
  dataPostsCreatePath: string;
  blogDataId: number | null;
  title: string;
  html: string;
  featuredImageUrl: string | null;
}): Promise<{ ok: boolean; status: number; body: Record<string, unknown> | null }> {
  const form: Record<string, unknown> = {
    output_type: "array",
    post_title: params.title,
    post_body: params.html,
    group_desc: params.html,
    post_status: "1",
  };

  if (params.blogDataId) {
    form.data_id = params.blogDataId;
  }

  if (params.featuredImageUrl) {
    form.featured_image_url = params.featuredImageUrl;
  }

  const response = await requestBdWithRetry(() =>
    requestBd({
      baseUrl: params.baseUrl,
      apiKey: params.apiKey,
      method: "POST",
      path: params.dataPostsCreatePath,
      form,
    })
  );

  return {
    ok: response.ok,
    status: response.status,
    body: response.json,
  };
}

import {
  bdRequestForm,
  bdRequestWithRetry,
  normalizeBdBaseUrl,
  parseBdRecords,
  parseBdTotals,
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

function extractDataPostRecords(json: Record<string, unknown>): Record<string, unknown>[] {
  const parsed = parseBdRecords(json);
  if (parsed.length > 0) return parsed;

  const candidates = [json.message, json.data_posts, json.posts];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      const rows = candidate.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object");
      if (rows.length > 0) return rows;
    }
  }
  return [];
}

function extractSlugFromPost(item: Record<string, unknown>): string {
  return extractSlug(item.post_filename ?? item.slug ?? item.group_filename ?? item.post_slug ?? item.url ?? item.link ?? item.permalink);
}

function extractUrl(item: Record<string, unknown>): string {
  return asString(item.url ?? item.link ?? item.permalink);
}

function normalizeForCompare(value: string): string {
  return value.trim().toLowerCase();
}

function normalizePath(path: string): string {
  if (!path.trim()) return "/";
  return path.startsWith("/") ? path : `/${path}`;
}

function dataPostsGetPath(path: string, postId: string): string {
  const normalized = normalizePath(path).toLowerCase();
  if (normalized.includes("/data_posts/")) {
    return `/api/v2/data_posts/get/${encodeURIComponent(postId)}`;
  }
  return `/api/v2/data_posts/get/${encodeURIComponent(postId)}`;
}

function pickDataPostFromGetResponse(json: Record<string, unknown>): Record<string, unknown> | null {
  const candidates: unknown[] = [json.message, json.data, json.data_post, json.post, json];
  for (const candidate of candidates) {
    if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) {
      return candidate as Record<string, unknown>;
    }
    if (Array.isArray(candidate)) {
      const first = candidate.find((row) => row && typeof row === "object");
      if (first && typeof first === "object") {
        return first as Record<string, unknown>;
      }
    }
  }
  return null;
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
    const records: Record<string, unknown>[] = [];
    for (let page = 1; page <= maxPages; page += 1) {
      const response = await bdRequestWithRetry(() =>
        bdRequestForm({
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
      const totals = parseBdTotals(payload);
      if (totals.status && totals.status !== "success") break;
      const pageRecords = extractDataPostRecords(payload);
      if (pageRecords.length === 0) break;
      records.push(...pageRecords);
      if (pageRecords.length < perPage) break;
      if (totals.totalPages && page >= totals.totalPages) break;
    }
    if (records.length > 0) recordsByPath.set(path, records);
  }

  const confirmCandidate = async (candidate: {
    postId: string;
    expectSlug?: string;
    expectTitle?: string;
    expectUrl?: string;
  }): Promise<boolean> => {
    const getResponse = await bdRequestWithRetry(() =>
      bdRequestForm({
        baseUrl: params.baseUrl,
        apiKey: params.apiKey,
        method: "GET",
        path: dataPostsGetPath(params.dataPostsSearchPath, candidate.postId),
      })
    );
    if (!getResponse.ok) return false;
    const payload = getResponse.json ?? {};
    const totals = parseBdTotals(payload);
    if (totals.status && totals.status !== "success") return false;
    const record = pickDataPostFromGetResponse(payload);
    if (!record) return false;
    const confirmedPostId = extractCanonicalPostId(record);
    if (confirmedPostId !== candidate.postId) return false;
    if (candidate.expectSlug) {
      const slug = extractSlugFromPost(record);
      if (slug !== candidate.expectSlug) return false;
    }
    if (candidate.expectTitle) {
      const title = extractTitle(record);
      if (title !== candidate.expectTitle) return false;
    }
    if (candidate.expectUrl) {
      const url = normalizeForCompare(extractUrl(record));
      if (url !== normalizeForCompare(candidate.expectUrl)) return false;
    }
    return true;
  };

  for (const path of collectDataPostsSearchPaths(params.dataPostsSearchPath)) {
    const records = recordsByPath.get(path);
    if (!records || records.length === 0) continue;
    const canonicalRecords = records.filter((row) => extractCanonicalPostId(row).length > 0);

    if (slugTarget) {
      const bySlug = canonicalRecords.filter((row) => extractSlugFromPost(row) === slugTarget);
      if (bySlug.length > 1) return { truePostId: null, mappingKey: "unresolved" };
      if (bySlug.length === 1) {
        const postId = extractCanonicalPostId(bySlug[0]);
        if (!postId) return { truePostId: null, mappingKey: "unresolved" };
        const confirmed = await confirmCandidate({
          postId,
          expectSlug: slugTarget,
        });
        if (!confirmed) return { truePostId: null, mappingKey: "unresolved" };
        return { truePostId: postId, mappingKey: "slug" };
      }
    }

    if (titleTarget) {
      const byTitle = canonicalRecords.filter((row) => extractTitle(row) === titleTarget);
      if (byTitle.length > 1) return { truePostId: null, mappingKey: "unresolved" };
      if (byTitle.length === 1) {
        const postId = extractCanonicalPostId(byTitle[0]);
        if (!postId) return { truePostId: null, mappingKey: "unresolved" };
        const confirmed = await confirmCandidate({
          postId,
          expectTitle: titleTarget,
        });
        if (!confirmed) return { truePostId: null, mappingKey: "unresolved" };
        return { truePostId: postId, mappingKey: "title" };
      }
    }

    if (urlTarget) {
      const byUrl = canonicalRecords.filter((row) => normalizeForCompare(extractUrl(row)) === normalizeForCompare(urlTarget));
      if (byUrl.length > 1) return { truePostId: null, mappingKey: "unresolved" };
      if (byUrl.length === 1) {
        const postId = extractCanonicalPostId(byUrl[0]);
        if (!postId) return { truePostId: null, mappingKey: "unresolved" };
        const confirmed = await confirmCandidate({
          postId,
          expectUrl: urlTarget,
        });
        if (!confirmed) return { truePostId: null, mappingKey: "unresolved" };
        return { truePostId: postId, mappingKey: "title" };
      }
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

  const response = await bdRequestWithRetry(() =>
    bdRequestForm({
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

  const response = await bdRequestWithRetry(() =>
    bdRequestForm({
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

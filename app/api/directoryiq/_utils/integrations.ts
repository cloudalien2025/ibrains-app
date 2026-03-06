import {
  bdRequestForm,
  bdRequestWithRetry,
  normalizeBdBaseUrl,
  parseBdRecords,
  parseBdTotals,
} from "@/app/api/directoryiq/_utils/bdApi";
import { decryptBdSiteKey, getBdSite, listBdSiteRows } from "@/app/api/directoryiq/_utils/bdSites";

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

function extractPostId(item: Record<string, unknown>): string {
  return String(item.post_id ?? item.id ?? item.data_post_id ?? item.group_id ?? "").trim();
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
  const response = await bdRequestWithRetry(() =>
    bdRequestForm({
      baseUrl: params.baseUrl,
      apiKey: params.apiKey,
      method: "POST",
      path: params.dataPostsSearchPath,
      form: {
        data_id: params.listingsDataId,
        page: 1,
        limit: 200,
        output_type: "array",
      },
    })
  );

  if (!response.ok) return { truePostId: null, mappingKey: "unresolved" };

  const totals = parseBdTotals(response.json ?? {});
  if (totals.status && totals.status !== "success") {
    return { truePostId: null, mappingKey: "unresolved" };
  }

  const records = parseBdRecords(response.json ?? {});

  const slugTarget = extractSlug(params.listingSlug ?? "");
  const titleTarget = asString(params.listingTitle).toLowerCase();

  if (slugTarget) {
    const bySlug = records.find((row) => extractSlug(row.post_filename ?? row.slug ?? row.group_filename ?? row.url ?? row.link) === slugTarget);
    if (bySlug) return { truePostId: extractPostId(bySlug) || null, mappingKey: "slug" };
  }

  if (titleTarget) {
    const byTitle = records.find((row) => extractTitle(row) === titleTarget);
    if (byTitle) return { truePostId: extractPostId(byTitle) || null, mappingKey: "title" };
  }

  const exactId = records.find((row) => extractPostId(row) === params.listingId);
  if (exactId) return { truePostId: extractPostId(exactId) || null, mappingKey: "title" };

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

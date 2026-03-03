import { query } from "@/app/api/ecomviper/_utils/db";
import {
  bdRequestWithRetry,
  bdRequestForm,
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
  dataId: number;
  maxPages?: number;
  limit?: number;
  includeAction?: boolean;
}): Promise<Record<string, unknown>[]> {
  const all: Record<string, unknown>[] = [];
  const maxPages = params.maxPages ?? 20;
  const limit = params.limit ?? 100;

  let discoveredTotalPages: number | null = null;

  for (let page = 1; page <= maxPages; page += 1) {
    const form: Record<string, unknown> = {
      output_type: "array",
      data_id: params.dataId,
      limit,
      page,
    };

    if (params.includeAction) {
      form.action = "search";
    }

    const response = await bdRequestWithRetry(() =>
      bdRequestForm({
        baseUrl: params.baseUrl,
        apiKey: params.apiKey,
        method: "POST",
        path: params.path,
        form,
      })
    );

    if (response.status === 404 && page === 1) return [];
    if (!response.ok) {
      throw new Error(`DirectoryIQ source returned HTTP ${response.status} for ${params.path}`);
    }

    const json = response.json ?? {};
    const totals = parseBdTotals(json);
    const records = parseBdRecords(json);

    if (totals.status && totals.status !== "success" && page === 1) {
      throw new Error(`DirectoryIQ source returned non-success wrapper status for ${params.path}`);
    }

    if (records.length === 0) break;

    all.push(...records);

    if (totals.totalPages && !discoveredTotalPages) {
      discoveredTotalPages = totals.totalPages;
    }

    if (discoveredTotalPages && page >= discoveredTotalPages) break;
    if (records.length < limit && !discoveredTotalPages) break;
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

  for (const path of candidates) {
    try {
      const response = await bdRequestWithRetry(() =>
        bdRequestForm({
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
      const records = parseBdRecords(response.json ?? {});
      const totals = parseBdTotals(response.json ?? {});
      if (totals.status && totals.status !== "success") continue;
      if (records.length >= 0) {
        return path;
      }
    } catch {
      continue;
    }
  }

  return "/api/v2/data_posts/search";
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
  const listingsPath =
    (typeof config.listingsPath === "string" && config.listingsPath.trim()) ||
    (typeof config.listings_path === "string" && config.listings_path.trim()) ||
    process.env.DIRECTORYIQ_LISTINGS_PATH ||
    "/api/v2/users_portfolio_groups/search";

  const blogPostsPath =
    (typeof config.blogPostsPath === "string" && config.blogPostsPath.trim()) ||
    (typeof config.blog_posts_path === "string" && config.blog_posts_path.trim()) ||
    process.env.DIRECTORYIQ_BLOG_POSTS_PATH ||
    "/api/v2/data_posts/search";

  const listingsDataId =
    asNumber(config.listingsDataId) ??
    asNumber(config.listings_data_id) ??
    asNumber(process.env.DIRECTORYIQ_LISTINGS_DATA_ID) ??
    75;

  const blogPostsDataId =
    asNumber(config.blogPostsDataId) ??
    asNumber(config.blog_posts_data_id) ??
    asNumber(process.env.DIRECTORYIQ_BLOG_POSTS_DATA_ID) ??
    14;

  const apiKey = row.secret;

  let runId = "";
  try {
    runId = await createRun(userId, baseUrl);

    let listingItems: Record<string, unknown>[] = [];
    try {
      listingItems = await fetchBdPagedSearch({
        baseUrl,
        apiKey,
        path: listingsPath,
        dataId: listingsDataId,
        includeAction: true,
        limit: 100,
        maxPages: 20,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const isListingsAuthFailure = message.includes("HTTP 401") && message.includes(listingsPath);
      if (!isListingsAuthFailure) throw error;

      console.warn(
        `[directoryiq-ingest] listings search auth failed on ${listingsPath}; retrying without action param and falling back to data_posts mapping if needed`
      );
      try {
        listingItems = await fetchBdPagedSearch({
          baseUrl,
          apiKey,
          path: listingsPath,
          dataId: listingsDataId,
          includeAction: false,
          limit: 100,
          maxPages: 20,
        });
      } catch {
        listingItems = [];
      }
    }

    const dataPostsSearchPath = await discoverDataPostsSearchPath({
      baseUrl,
      apiKey,
      preferredPath: blogPostsPath,
      dataId: listingsDataId,
    });

    const listingDataPosts = await fetchBdPagedSearch({
      baseUrl,
      apiKey,
      path: dataPostsSearchPath,
      dataId: listingsDataId,
      includeAction: false,
      limit: 100,
      maxPages: 20,
    });

    const listingItemsMapped =
      listingItems.length > 0 ? resolveTruePostMapping(listingItems, listingDataPosts) : listingDataPosts;

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

    const listings = listingItemsMapped.map((item, index) => extractNode(item, "listing", index));
    const blogs = blogItems.map((item, index) => extractNode(item, "blog", index));

    await upsertNodes({ userId, sourceType: "listing", nodes: listings });
    await upsertNodes({ userId, sourceType: "blog_post", nodes: blogs });

    await finishRun({
      runId,
      status: "succeeded",
      listings: listings.length,
      blogPosts: blogs.length,
    });

    return {
      runId,
      status: "succeeded",
      counts: {
        listings: listings.length,
        blogPosts: blogs.length,
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

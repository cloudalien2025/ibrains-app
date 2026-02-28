import { decryptSecret } from "@/app/api/ecomviper/_utils/crypto";
import { query } from "@/app/api/ecomviper/_utils/db";

type CredentialRow = {
  secret_ciphertext: string;
  config_json: Record<string, unknown> | null;
};

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

function normalizeBaseUrl(input: string): string {
  const value = input.trim().replace(/\/$/, "");
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  return `https://${value}`;
}

function resolveArray(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) {
    return payload.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"));
  }

  if (payload && typeof payload === "object") {
    const candidate = payload as Record<string, unknown>;
    const keys = ["listings", "posts", "blog_posts", "items", "data", "results", "entries"];
    for (const key of keys) {
      const value = candidate[key];
      if (Array.isArray(value)) {
        return value.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"));
      }
    }
  }

  return [];
}

function extractNode(item: Record<string, unknown>, fallbackPrefix: string, index: number): DirectoryIqNode {
  const sourceId =
    String(item.id ?? item.listing_id ?? item.post_id ?? item.wp_id ?? item.slug ?? `${fallbackPrefix}-${index + 1}`);

  const title =
    String(item.title ?? item.name ?? item.post_title ?? item.listing_title ?? item.headline ?? sourceId);

  const urlValue = item.url ?? item.permalink ?? item.link ?? item.listing_url;
  const url = typeof urlValue === "string" ? urlValue : null;

  const updatedAtValue = item.updated_at ?? item.modified ?? item.date_modified ?? item.updated;
  const updatedAt = typeof updatedAtValue === "string" ? updatedAtValue : null;

  return {
    sourceId,
    title,
    url,
    updatedAt,
    raw: item,
  };
}

async function fetchPagedCollection(params: {
  baseUrl: string;
  path: string;
  apiKey: string;
}): Promise<Record<string, unknown>[]> {
  const path = params.path.startsWith("/") ? params.path : `/${params.path}`;
  const all: Record<string, unknown>[] = [];

  for (let page = 1; page <= 20; page += 1) {
    const url = new URL(`${params.baseUrl}${path}`);
    if (!url.searchParams.has("per_page")) url.searchParams.set("per_page", "100");
    if (!url.searchParams.has("page")) url.searchParams.set("page", String(page));

    const headers = {
      Accept: "application/json",
      Authorization: `Bearer ${params.apiKey}`,
      "X-API-Key": params.apiKey,
    };

    const response = await fetch(url.toString(), {
      headers,
      cache: "no-store",
    });

    if (response.status === 404 && page === 1) {
      return [];
    }

    if (!response.ok) {
      throw new Error(`DirectoryIQ source returned HTTP ${response.status} for ${path}`);
    }

    const payload = (await response.json().catch(() => null)) as unknown;
    const pageItems = resolveArray(payload);
    if (pageItems.length === 0) break;

    all.push(...pageItems);

    const totalPagesHeader = response.headers.get("x-wp-totalpages");
    const totalPages = totalPagesHeader ? Number(totalPagesHeader) : null;
    if (totalPages && page >= totalPages) break;
    if (pageItems.length < 100 && !totalPages) break;
  }

  return all;
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
  const rows = await query<CredentialRow>(
    `
    SELECT secret_ciphertext, config_json
    FROM directoryiq_signal_source_credentials
    WHERE user_id = $1 AND connector_id = 'brilliant_directories_api'
    LIMIT 1
    `,
    [userId]
  );

  const row = rows[0];
  if (!row) {
    throw new Error("Brilliant Directories API credential is not configured.");
  }

  const config = (row.config_json ?? {}) as Record<string, unknown>;
  const baseUrlRaw =
    (typeof config.base_url === "string" && config.base_url.trim()) ||
    process.env.DIRECTORYIQ_BRILLIANT_DIRECTORIES_BASE_URL ||
    "";

  if (!baseUrlRaw) {
    throw new Error("Brilliant Directories base URL is required. Save it in Signal Sources.");
  }

  const baseUrl = normalizeBaseUrl(baseUrlRaw);
  const listingsPath =
    (typeof config.listings_path === "string" && config.listings_path.trim()) ||
    process.env.DIRECTORYIQ_LISTINGS_PATH ||
    "/wp-json/brilliantdirectories/v1/listings";
  const blogPostsPath =
    (typeof config.blog_posts_path === "string" && config.blog_posts_path.trim()) ||
    process.env.DIRECTORYIQ_BLOG_POSTS_PATH ||
    "/wp-json/wp/v2/posts";

  const apiKey = decryptSecret(row.secret_ciphertext, `${userId}:directoryiq:brilliant_directories_api`);

  let runId = "";
  try {
    runId = await createRun(userId, baseUrl);

    const [listingItems, blogItems] = await Promise.all([
      fetchPagedCollection({ baseUrl, path: listingsPath, apiKey }),
      fetchPagedCollection({ baseUrl, path: blogPostsPath, apiKey }),
    ]);

    const listings = listingItems.map((item, index) => extractNode(item, "listing", index));
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

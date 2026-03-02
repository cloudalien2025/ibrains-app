import type { PoolClient } from "pg";
import { decryptSecret } from "./crypto";
import { query, withTransaction } from "./db";
import { scoreProductToArticle } from "./matcher";
import { paginateGraphqlNodes } from "./shopify";

interface IntegrationRow {
  id: string;
  user_id: string;
  shop_domain: string;
  access_token_ciphertext: string;
}

interface IngestRunResult {
  runId: string;
  status: "succeeded" | "failed";
  counts: {
    products: number;
    articles: number;
    pages: number;
    collections: number;
  };
  errorMessage?: string;
}

interface ShopifyProductNode {
  id: string;
  handle?: string | null;
  title: string;
  tags?: string[];
  bodyHtml?: string | null;
  descriptionHtml?: string | null;
  featuredImage?: { url?: string | null } | null;
  onlineStoreUrl?: string | null;
  publishedAt?: string | null;
  updatedAt?: string | null;
}

interface ShopifyArticleNode {
  id: string;
  handle?: string | null;
  title: string;
  tags?: string[];
  body?: string | null;
  bodyHtml?: string | null;
  image?: { url?: string | null } | null;
  onlineStoreUrl?: string | null;
  publishedAt?: string | null;
  updatedAt?: string | null;
}

interface ShopifyPageNode {
  id: string;
  handle?: string | null;
  title: string;
  body?: string | null;
  bodyHtml?: string | null;
  onlineStoreUrl?: string | null;
  publishedAt?: string | null;
  updatedAt?: string | null;
}

interface ShopifyCollectionNode {
  id: string;
  handle?: string | null;
  title: string;
  descriptionHtml?: string | null;
  image?: { url?: string | null } | null;
  onlineStoreUrl?: string | null;
  updatedAt?: string | null;
}

interface SiteNodeRow {
  id: string;
  source_id: string;
  handle: string | null;
  title: string;
  tags: string[];
  body_text: string | null;
  published_at: string | null;
}

function htmlToText(html: string | null | undefined): string {
  if (!html) return "";
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

async function createRun(client: PoolClient, userId: string, integrationId: string): Promise<string> {
  const rows = await client.query<{ id: string }>(
    `
    INSERT INTO ingest_runs (user_id, integration_id, status)
    VALUES ($1, $2, 'running')
    RETURNING id
    `,
    [userId, integrationId]
  );
  return rows.rows[0].id;
}

async function finishRun(
  runId: string,
  status: "succeeded" | "failed",
  counts: IngestRunResult["counts"],
  errorMessage?: string
): Promise<void> {
  await query(
    `
    UPDATE ingest_runs
    SET status = $2,
        finished_at = now(),
        products_count = $3,
        articles_count = $4,
        pages_count = $5,
        collections_count = $6,
        error_message = $7
    WHERE id = $1
    `,
    [runId, status, counts.products, counts.articles, counts.pages, counts.collections, errorMessage ?? null]
  );
}

async function upsertSiteNode(client: PoolClient, params: {
  userId: string;
  integrationId: string;
  nodeType: "product" | "article" | "page" | "collection";
  sourceId: string;
  handle?: string | null;
  title: string;
  url?: string | null;
  tags?: string[];
  bodyHtml?: string | null;
  imageUrl?: string | null;
  publishedAt?: string | null;
  updatedAtSource?: string | null;
  rawJson: unknown;
}): Promise<void> {
  await client.query(
    `
    INSERT INTO site_nodes (
      user_id, integration_id, node_type, source_id, handle, title, url, tags,
      body_text, body_html, image_url, published_at, updated_at_source, raw_json
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11,$12,$13,$14::jsonb)
    ON CONFLICT (integration_id, source_id)
    DO UPDATE SET
      handle = EXCLUDED.handle,
      title = EXCLUDED.title,
      url = EXCLUDED.url,
      tags = EXCLUDED.tags,
      body_text = EXCLUDED.body_text,
      body_html = EXCLUDED.body_html,
      image_url = EXCLUDED.image_url,
      published_at = EXCLUDED.published_at,
      updated_at_source = EXCLUDED.updated_at_source,
      raw_json = EXCLUDED.raw_json,
      updated_at = now()
    `,
    [
      params.userId,
      params.integrationId,
      params.nodeType,
      params.sourceId,
      params.handle ?? null,
      params.title,
      params.url ?? null,
      JSON.stringify(params.tags ?? []),
      htmlToText(params.bodyHtml),
      params.bodyHtml ?? null,
      params.imageUrl ?? null,
      params.publishedAt ?? null,
      params.updatedAtSource ?? null,
      JSON.stringify(params.rawJson ?? {}),
    ]
  );
}

async function rebuildProductBlogLinks(client: PoolClient, userId: string, integrationId: string): Promise<void> {
  const products = await client.query<SiteNodeRow>(
    `
    SELECT id, source_id, handle, title, tags, body_text, published_at
    FROM site_nodes
    WHERE integration_id = $1 AND node_type = 'product'
    `,
    [integrationId]
  );

  const articles = await client.query<SiteNodeRow>(
    `
    SELECT id, source_id, handle, title, tags, body_text, published_at
    FROM site_nodes
    WHERE integration_id = $1 AND node_type = 'article'
    `,
    [integrationId]
  );

  await client.query(`DELETE FROM product_blog_links WHERE integration_id = $1`, [integrationId]);

  for (const product of products.rows) {
    for (const article of articles.rows) {
      const match = scoreProductToArticle(
        {
          handle: product.handle,
          title: product.title,
          tags: product.tags ?? [],
          bodyText: product.body_text,
        },
        {
          handle: article.handle,
          title: article.title,
          tags: article.tags ?? [],
          bodyText: article.body_text,
        }
      );

      if (match.score <= 0.7) continue;

      await client.query(
        `
        INSERT INTO product_blog_links (
          user_id, integration_id, product_node_id, article_node_id, score, reason
        ) VALUES ($1,$2,$3,$4,$5,$6)
        ON CONFLICT (product_node_id, article_node_id)
        DO UPDATE SET score = EXCLUDED.score, reason = EXCLUDED.reason
        `,
        [userId, integrationId, product.id, article.id, match.score, match.reason]
      );
    }
  }
}

const PRODUCTS_QUERY = `
query ProductsPage($first: Int!, $after: String) {
  products(first: $first, after: $after) {
    edges {
      node {
        id
        handle
        title
        tags
        descriptionHtml
        featuredImage { url }
        onlineStoreUrl
        publishedAt
        updatedAt
      }
    }
    pageInfo { hasNextPage endCursor }
  }
}`;

const ARTICLES_QUERY = `
query ArticlesPage($first: Int!, $after: String) {
  articles(first: $first, after: $after) {
    edges {
      node {
        id
        handle
        title
        tags
        body
        image { url }
        onlineStoreUrl
        publishedAt
        updatedAt
      }
    }
    pageInfo { hasNextPage endCursor }
  }
}`;

const PAGES_QUERY = `
query PagesPage($first: Int!, $after: String) {
  pages(first: $first, after: $after) {
    edges {
      node {
        id
        handle
        title
        body
        onlineStoreUrl
        publishedAt
        updatedAt
      }
    }
    pageInfo { hasNextPage endCursor }
  }
}`;

const COLLECTIONS_QUERY = `
query CollectionsPage($first: Int!, $after: String) {
  collections(first: $first, after: $after) {
    edges {
      node {
        id
        handle
        title
        descriptionHtml
        image { url }
        onlineStoreUrl
        updatedAt
      }
    }
    pageInfo { hasNextPage endCursor }
  }
}`;

export async function runFullShopifyIngest(params: {
  userId: string;
  integrationId: string;
}): Promise<IngestRunResult> {
  const integrationRows = await query<IntegrationRow>(
    `
    SELECT id, user_id, shop_domain, access_token_ciphertext
    FROM integrations
    WHERE id = $1 AND user_id = $2 AND provider = 'shopify' AND status = 'connected'
    LIMIT 1
    `,
    [params.integrationId, params.userId]
  );

  const integration = integrationRows[0];
  if (!integration) {
    throw new Error("Integration not found or not connected");
  }

  const accessToken = decryptSecret(integration.access_token_ciphertext, `${params.userId}:shopify`);

  let runId = "";
  const counts = { products: 0, articles: 0, pages: 0, collections: 0 };

  try {
    runId = await withTransaction(async (client) => {
      const id = await createRun(client, params.userId, params.integrationId);
      return id;
    });

    const [products, articles, pages, collections] = await Promise.all([
      paginateGraphqlNodes<ShopifyProductNode>({
        shopDomain: integration.shop_domain,
        accessToken,
        query: PRODUCTS_QUERY,
        rootField: "products",
      }),
      paginateGraphqlNodes<ShopifyArticleNode>({
        shopDomain: integration.shop_domain,
        accessToken,
        query: ARTICLES_QUERY,
        rootField: "articles",
      }),
      paginateGraphqlNodes<ShopifyPageNode>({
        shopDomain: integration.shop_domain,
        accessToken,
        query: PAGES_QUERY,
        rootField: "pages",
      }),
      paginateGraphqlNodes<ShopifyCollectionNode>({
        shopDomain: integration.shop_domain,
        accessToken,
        query: COLLECTIONS_QUERY,
        rootField: "collections",
      }),
    ]);

    counts.products = products.length;
    counts.articles = articles.length;
    counts.pages = pages.length;
    counts.collections = collections.length;

    await withTransaction(async (client) => {
      for (const node of products) {
        await upsertSiteNode(client, {
          userId: params.userId,
          integrationId: params.integrationId,
          nodeType: "product",
          sourceId: node.id,
          handle: node.handle,
          title: node.title,
          url: node.onlineStoreUrl,
          tags: node.tags,
          bodyHtml: node.descriptionHtml,
          imageUrl: node.featuredImage?.url ?? null,
          publishedAt: node.publishedAt,
          updatedAtSource: node.updatedAt,
          rawJson: node,
        });
      }

      for (const node of articles) {
        await upsertSiteNode(client, {
          userId: params.userId,
          integrationId: params.integrationId,
          nodeType: "article",
          sourceId: node.id,
          handle: node.handle,
          title: node.title,
          url: node.onlineStoreUrl,
          tags: node.tags,
          bodyHtml: node.body ?? node.bodyHtml,
          imageUrl: node.image?.url ?? null,
          publishedAt: node.publishedAt,
          updatedAtSource: node.updatedAt,
          rawJson: node,
        });
      }

      for (const node of pages) {
        await upsertSiteNode(client, {
          userId: params.userId,
          integrationId: params.integrationId,
          nodeType: "page",
          sourceId: node.id,
          handle: node.handle,
          title: node.title,
          url: node.onlineStoreUrl,
          tags: [],
          bodyHtml: node.body ?? node.bodyHtml,
          imageUrl: null,
          publishedAt: node.publishedAt,
          updatedAtSource: node.updatedAt,
          rawJson: node,
        });
      }

      for (const node of collections) {
        await upsertSiteNode(client, {
          userId: params.userId,
          integrationId: params.integrationId,
          nodeType: "collection",
          sourceId: node.id,
          handle: node.handle,
          title: node.title,
          url: node.onlineStoreUrl,
          tags: [],
          bodyHtml: node.descriptionHtml,
          imageUrl: node.image?.url ?? null,
          publishedAt: null,
          updatedAtSource: node.updatedAt,
          rawJson: node,
        });
      }

      await rebuildProductBlogLinks(client, params.userId, params.integrationId);
    });

    await finishRun(runId, "succeeded", counts);
    return { runId, status: "succeeded", counts };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown ingest error";
    if (runId) {
      await finishRun(runId, "failed", counts, message);
    }
    return { runId, status: "failed", counts, errorMessage: message };
  }
}

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/app/api/ecomviper/_utils/db";
import { ensureUser, resolveUserId } from "@/app/api/ecomviper/_utils/user";

interface ProductRow {
  id: string;
  source_id: string;
  handle: string | null;
  title: string;
  url: string | null;
  image_url: string | null;
  tags: string[];
  body_html: string | null;
}

interface LinkRow {
  score: string;
  reason: string;
  article_id: string;
  article_title: string;
  article_url: string | null;
  article_published_at: string | null;
}

function deriveIngredients(descriptionHtml: string | null): string | null {
  if (!descriptionHtml) return null;
  const text = descriptionHtml
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const ingredientPattern = /ingredients?\s*:\s*([^\.]{8,220})/i;
  const match = text.match(ingredientPattern);
  return match?.[1]?.trim() ?? null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: { productHandleOrId: string } }
) {
  try {
    const { productHandleOrId } = params;
    const userId = resolveUserId(req);
    await ensureUser(userId);

    const integrationParam = req.nextUrl.searchParams.get("integration_id");
    const integrationRows = integrationParam
      ? [{ id: integrationParam }]
      : await query<{ id: string }>(
          `
          SELECT id
          FROM integrations
          WHERE user_id = $1 AND provider = 'shopify' AND status = 'connected'
          ORDER BY installed_at DESC
          LIMIT 1
          `,
          [userId]
        );

    const integrationId = integrationRows[0]?.id;
    if (!integrationId) {
      return NextResponse.json({ error: "No connected Shopify integration" }, { status: 404 });
    }

    const products = await query<ProductRow>(
      `
      SELECT id, source_id, handle, title, url, image_url, tags, body_html
      FROM site_nodes
      WHERE integration_id = $1
        AND node_type = 'product'
        AND (
          handle = $2
          OR source_id = $2
          OR id::text = $2
        )
      LIMIT 1
      `,
      [integrationId, productHandleOrId]
    );

    const product = products[0];
    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const linkRows = await query<LinkRow>(
      `
      SELECT
        l.score::text AS score,
        l.reason,
        a.id AS article_id,
        a.title AS article_title,
        a.url AS article_url,
        a.published_at AS article_published_at
      FROM product_blog_links l
      JOIN site_nodes a ON a.id = l.article_node_id
      WHERE l.product_node_id = $1
      ORDER BY l.score DESC, a.title ASC
      LIMIT 50
      `,
      [product.id]
    );

    const linkedCount = linkRows.length;
    const reasoningCoverage = Math.max(5, Math.min(100, Math.round((linkedCount / 8) * 100)));

    const linkedBlogs = linkRows.map((row) => {
      const published = Boolean(row.article_published_at);
      return {
        title: row.article_title,
        url: row.article_url,
        status: published ? "Published" : "Linked",
        score: Number(row.score),
        reason: row.reason,
        link_out: row.article_url ?? "-",
        scheduled_blog_post: row.article_title,
      };
    });

    return NextResponse.json({
      product: {
        id: product.id,
        source_id: product.source_id,
        handle: product.handle,
        title: product.title,
        url: product.url,
        image_url: product.image_url,
        tags: product.tags ?? [],
        ingredients: deriveIngredients(product.body_html),
      },
      reasoning_coverage: reasoningCoverage,
      linked_blogs: linkedBlogs,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown reasoning error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

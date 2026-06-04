export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { fail, ok } from "@/app/api/ecomviper/walmart/_utils/response";
import { requireSignedInUser } from "@/lib/auth/requireSignedInUser";
import {
  getShopifyImportStateForUser,
  importShopifyProductsForUser,
  listShopifyProductsForUser,
} from "@/lib/ecomviper/shopify/shopify-import";

export async function POST(req: NextRequest) {
  try {
    const { userId, unauthorizedResponse } = await requireSignedInUser();
    if (unauthorizedResponse) {
      if (unauthorizedResponse.status !== 401) {
        return unauthorizedResponse;
      }
      return fail(401, "Please sign in before importing Shopify products.", "UNAUTHORIZED");
    }
    if (!userId) {
      return fail(401, "Please sign in before importing Shopify products.", "UNAUTHORIZED");
    }

    const body = (await req.json().catch(() => ({}))) as {
      boundedRuntime?: unknown;
      maxPages?: unknown;
    };

    const boundedRuntime = typeof body.boundedRuntime === "boolean" ? body.boundedRuntime : true;
    const maxPages = typeof body.maxPages === "number" && Number.isFinite(body.maxPages)
      ? Math.max(1, Math.trunc(body.maxPages))
      : undefined;

    const result = await importShopifyProductsForUser(userId, {
      boundedRuntime,
      maxPages,
    });

    const importState = await getShopifyImportStateForUser(userId);
    const products = await listShopifyProductsForUser(userId);

    return ok({
      ok: true,
      provider: "shopify",
      importedCount: result.importedCount,
      imageCount: result.imageCount,
      pageCount: result.pageCount,
      hasNextPage: result.hasNextPage,
      fetchedNodeCount: result.fetchedNodeCount,
      lastImportAt: result.lastImportAt,
      diagnostics: result.diagnostics,
      importState,
      productCountStored: products.length,
      message: `Imported ${result.importedCount} Shopify products and ${result.imageCount} images.`,
    });
  } catch (error) {
    return fail(500, error instanceof Error ? error.message : "Failed to import Shopify products.");
  }
}

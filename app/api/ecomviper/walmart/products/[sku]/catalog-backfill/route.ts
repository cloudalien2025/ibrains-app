export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { fail, ok } from "@/app/api/ecomviper/walmart/_utils/response";
import { requireSignedInUser } from "@/lib/auth/requireSignedInUser";
import { hydrateCurrentWalmartState } from "@/lib/ecomviper/walmart/walmart-native-state";
import { getWalmartProductBySkuForUser } from "@/lib/ecomviper/walmart/walmart-products";
import { previewWalmartCatalogBackfillForUser } from "@/lib/ecomviper/walmart/walmart-live-catalog-backfill";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sku: string }> | { sku: string } }
) {
  try {
    const { userId, unauthorizedResponse } = await requireSignedInUser();
    if (unauthorizedResponse) {
      if (unauthorizedResponse.status !== 401) return unauthorizedResponse;
      return fail(401, "Please sign in before refreshing Walmart catalog details.", "UNAUTHORIZED");
    }
    if (!userId) {
      return fail(401, "Please sign in before refreshing Walmart catalog details.", "UNAUTHORIZED");
    }

    const { sku } = await Promise.resolve(params);
    const product = await getWalmartProductBySkuForUser(userId, sku);
    if (!product) {
      return fail(404, `SKU ${sku} was not found in your local EcomViper catalog.`, "PRODUCT_NOT_FOUND");
    }

    const body = (await req.json().catch(() => ({}))) as {
      userDraftPayload?: unknown;
    };
    const userDraftPayload =
      body.userDraftPayload && typeof body.userDraftPayload === "object" && !Array.isArray(body.userDraftPayload)
        ? (body.userDraftPayload as Record<string, unknown>)
        : null;

    const currentWalmartState = hydrateCurrentWalmartState({ product });
    const result = await previewWalmartCatalogBackfillForUser({
      userId,
      product,
      currentWalmartState,
      userDraftPayload,
    });

    return ok({
      ok: true,
      sku: product.sku,
      catalogBackfill: result,
      note: "Refreshes EcomViper's local catalog understanding. This does not publish changes to Walmart.",
    });
  } catch (error) {
    return fail(
      500,
      error instanceof Error ? error.message : "Failed to refresh Walmart catalog details.",
      "CATALOG_BACKFILL_FAILED"
    );
  }
}


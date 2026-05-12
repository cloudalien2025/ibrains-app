export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { fail, ok } from "@/app/api/ecomviper/walmart/_utils/response";
import { requireSignedInUser } from "@/lib/auth/requireSignedInUser";
import { reconcileWalmartImagesFromShopifyForUser } from "@/lib/ecomviper/walmart/walmart-products";

export async function POST(req: NextRequest) {
  try {
    const { userId, unauthorizedResponse } = await requireSignedInUser();
    if (unauthorizedResponse) {
      if (unauthorizedResponse.status !== 401) {
        return unauthorizedResponse;
      }
      return fail(401, "Please sign in before reconciling Walmart images from Shopify.", "UNAUTHORIZED");
    }
    if (!userId) {
      return fail(401, "Please sign in before reconciling Walmart images from Shopify.", "UNAUTHORIZED");
    }

    const body = (await req.json().catch(() => ({}))) as {
      mode?: unknown;
    };

    const requestedMode = typeof body.mode === "string" ? body.mode.trim().toLowerCase() : "";
    const applyMode = requestedMode === "prefer_shopify" ? "prefer_shopify" : "missing_first";

    const result = await reconcileWalmartImagesFromShopifyForUser({
      userId,
      applyMode,
    });

    return ok({
      ok: true,
      provider: "shopify",
      applyMode,
      ...result,
      message: `Shopify reconciliation completed. Matched ${result.walmartProductsMatchedToShopify} Walmart products and applied ${result.imagesAppliedFromShopify} Shopify images.`,
    });
  } catch (error) {
    return fail(500, error instanceof Error ? error.message : "Failed to reconcile Walmart images from Shopify.");
  }
}

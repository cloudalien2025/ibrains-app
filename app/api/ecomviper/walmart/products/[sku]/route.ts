export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { fail, ok } from "@/app/api/ecomviper/walmart/_utils/response";
import { requireSignedInUser } from "@/lib/auth/requireSignedInUser";
import {
  getWalmartProductBySkuForUser,
  removeWalmartProductFromCatalogForUser,
} from "@/lib/ecomviper/walmart/walmart-products";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sku: string }> | { sku: string } }
) {
  try {
    const { userId, unauthorizedResponse } = await requireSignedInUser();
    if (unauthorizedResponse) {
      if (unauthorizedResponse.status !== 401) return unauthorizedResponse;
      return fail(401, "Please sign in before loading Walmart products.", "UNAUTHORIZED");
    }
    if (!userId) {
      return fail(401, "Please sign in before loading Walmart products.", "UNAUTHORIZED");
    }

    const { sku } = await Promise.resolve(params);
    const product = await getWalmartProductBySkuForUser(userId, sku);
    if (!product) {
      return fail(404, `SKU ${sku} not found.`, "NOT_FOUND");
    }

    return ok({ ok: true, product });
  } catch (error) {
    return fail(500, error instanceof Error ? error.message : "Failed to load Walmart product.");
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ sku: string }> | { sku: string } }
) {
  try {
    void req;
    const { userId, unauthorizedResponse } = await requireSignedInUser();
    if (unauthorizedResponse) {
      if (unauthorizedResponse.status !== 401) return unauthorizedResponse;
      return fail(401, "Please sign in before removing Walmart products.", "UNAUTHORIZED");
    }
    if (!userId) {
      return fail(401, "Please sign in before removing Walmart products.", "UNAUTHORIZED");
    }

    const { sku } = await Promise.resolve(params);
    const removal = await removeWalmartProductFromCatalogForUser({ userId, sku });
    if (!removal) {
      return fail(404, `SKU ${sku} not found in your local EcomViper catalog.`, "PRODUCT_NOT_FOUND");
    }
    if (!removal.removed) {
      return fail(500, `Could not remove SKU ${sku} from your local EcomViper catalog.`, "REMOVE_FAILED");
    }

    return ok({
      ok: true,
      sku: removal.sku,
      removed: removal.removed,
      archived: removal.archived,
      affectedDraftCount: removal.affectedDraftCount,
    });
  } catch (error) {
    return fail(500, error instanceof Error ? error.message : "Failed to remove Walmart product.", "REMOVE_FAILED");
  }
}

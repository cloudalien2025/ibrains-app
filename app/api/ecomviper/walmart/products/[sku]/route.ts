export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { fail, ok } from "@/app/api/ecomviper/walmart/_utils/response";
import { requireSignedInUser } from "@/lib/auth/requireSignedInUser";
import { getWalmartProductBySkuForUser } from "@/lib/ecomviper/walmart/walmart-products";

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

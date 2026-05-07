export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { ensureUser, resolveUserId } from "@/app/api/ecomviper/_utils/user";
import { fail, ok } from "@/app/api/ecomviper/walmart/_utils/response";
import { getWalmartProductBySku } from "@/lib/ecomviper/walmart/walmart-products";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sku: string }> | { sku: string } }
) {
  try {
    const userId = resolveUserId(req);
    await ensureUser(userId);

    const { sku } = await Promise.resolve(params);
    const product = getWalmartProductBySku(sku);
    if (!product) {
      return fail(404, `SKU ${sku} not found.`, "NOT_FOUND");
    }

    return ok({ ok: true, product });
  } catch (error) {
    return fail(500, error instanceof Error ? error.message : "Failed to load Walmart product.");
  }
}

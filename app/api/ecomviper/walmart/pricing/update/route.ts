export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { ensureUser, resolveUserId } from "@/app/api/ecomviper/_utils/user";
import { fail, ok } from "@/app/api/ecomviper/walmart/_utils/response";
import { updateWalmartPriceForUser } from "@/lib/ecomviper/walmart/walmart-pricing";

export async function POST(req: NextRequest) {
  try {
    const userId = resolveUserId(req);
    await ensureUser(userId);

    const body = (await req.json().catch(() => ({}))) as {
      sku?: string;
      price?: number;
      saveAsDraft?: boolean;
    };

    if (!body.sku || typeof body.sku !== "string") {
      return fail(400, "sku is required.", "BAD_REQUEST");
    }

    if (typeof body.price !== "number" || !Number.isFinite(body.price) || body.price <= 0) {
      return fail(400, "price must be greater than zero.", "BAD_REQUEST");
    }

    const result = await updateWalmartPriceForUser({
      userId,
      update: {
        sku: body.sku,
        price: Number(body.price.toFixed(2)),
        saveAsDraft: Boolean(body.saveAsDraft),
      },
    });

    return ok(result);
  } catch (error) {
    return fail(500, error instanceof Error ? error.message : "Failed to update pricing.");
  }
}

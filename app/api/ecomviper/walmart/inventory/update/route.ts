export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { ensureUser, resolveUserId } from "@/app/api/ecomviper/_utils/user";
import { fail, ok } from "@/app/api/ecomviper/walmart/_utils/response";
import { updateWalmartInventory } from "@/lib/ecomviper/walmart/walmart-inventory";

export async function POST(req: NextRequest) {
  try {
    const userId = resolveUserId(req);
    await ensureUser(userId);

    const body = (await req.json().catch(() => ({}))) as {
      sku?: string;
      quantity?: number;
      saveAsDraft?: boolean;
    };

    if (!body.sku || typeof body.sku !== "string") {
      return fail(400, "sku is required.", "BAD_REQUEST");
    }
    if (typeof body.quantity !== "number" || !Number.isFinite(body.quantity) || body.quantity < 0) {
      return fail(400, "quantity must be a non-negative number.", "BAD_REQUEST");
    }

    const result = updateWalmartInventory({
      sku: body.sku,
      quantity: body.quantity,
      saveAsDraft: Boolean(body.saveAsDraft),
    });

    return ok(result);
  } catch (error) {
    return fail(500, error instanceof Error ? error.message : "Failed to update inventory.");
  }
}

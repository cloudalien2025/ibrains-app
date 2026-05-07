export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { ensureUser, resolveUserId } from "@/app/api/ecomviper/_utils/user";
import { fail, ok } from "@/app/api/ecomviper/walmart/_utils/response";
import { submitWalmartMaintenanceFeed } from "@/lib/ecomviper/walmart/walmart-feeds";
import { buildMaintenancePayload } from "@/lib/ecomviper/walmart/walmart-maintenance";
import { getDraftById, getProductBySku } from "@/lib/ecomviper/walmart/walmart-store";

export async function POST(req: NextRequest) {
  try {
    const userId = resolveUserId(req);
    await ensureUser(userId);

    const body = (await req.json().catch(() => ({}))) as {
      draftId?: string;
      sku?: string;
      payload?: unknown;
    };

    let payload: unknown = body.payload ?? null;

    if (!payload && body.draftId) {
      const draft = getDraftById(body.draftId);
      if (!draft) return fail(404, "Draft not found.", "NOT_FOUND");
      const product = getProductBySku(draft.sku);
      if (!product) return fail(404, "Product not found for draft.", "NOT_FOUND");
      payload = buildMaintenancePayload({ draft, product });
    }

    if (!payload && body.sku) {
      const product = getProductBySku(body.sku);
      if (!product) return fail(404, "SKU not found.", "NOT_FOUND");
      payload = {
        feedType: "MP_MAINTENANCE",
        sku: product.sku,
        updates: {
          title: product.title,
          price: product.price,
          inventoryQuantity: product.inventoryQuantity,
        },
      };
    }

    if (!payload) {
      return fail(400, "Provide payload, draftId, or sku.", "BAD_REQUEST");
    }

    const submission = submitWalmartMaintenanceFeed(payload);

    return ok({
      ok: true,
      submission,
      message: "Production write disabled until preview/validation is complete.",
    });
  } catch (error) {
    return fail(500, error instanceof Error ? error.message : "Failed to submit feed.");
  }
}

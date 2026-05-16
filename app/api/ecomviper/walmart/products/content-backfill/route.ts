export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { fail, ok } from "@/app/api/ecomviper/walmart/_utils/response";
import { requireSignedInUser } from "@/lib/auth/requireSignedInUser";
import { queueWalmartHistoricalContentBackfillForUser } from "@/lib/ecomviper/walmart/walmart-products";

function parseMaxSkus(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return Math.trunc(parsed);
  }
  return undefined;
}

export async function POST(req: NextRequest) {
  try {
    const { userId, unauthorizedResponse } = await requireSignedInUser();
    if (unauthorizedResponse) {
      if (unauthorizedResponse.status !== 401) return unauthorizedResponse;
      return fail(401, "Please sign in before running Walmart content backfill.", "UNAUTHORIZED");
    }
    if (!userId) {
      return fail(401, "Please sign in before running Walmart content backfill.", "UNAUTHORIZED");
    }

    const body = (await req.json().catch(() => ({}))) as {
      maxSkus?: unknown;
    };

    const queue = await queueWalmartHistoricalContentBackfillForUser({
      userId,
      maxSkus: parseMaxSkus(body.maxSkus),
    });

    if (!queue.queued) {
      if (queue.reason === "no_target_skus") {
        return ok({
          ok: true,
          ...queue,
          message: "No missing-content Walmart products are currently eligible for historical backfill.",
        });
      }

      if (queue.reason === "already_running") {
        return ok({
          ok: true,
          ...queue,
          message: "Historical Walmart content backfill is already running for this workspace.",
        });
      }

      return ok({
        ok: true,
        ...queue,
        message: "Historical Walmart content backfill is unavailable in this runtime.",
      });
    }

    return ok({
      ok: true,
      ...queue,
      message: `Historical Walmart content backfill queued for ${queue.requestedSkuCount} SKU(s).`,
    });
  } catch (error) {
    return fail(
      500,
      error instanceof Error ? error.message : "Failed to queue Walmart historical content backfill.",
      "WALMART_CONTENT_BACKFILL_QUEUE_FAILED"
    );
  }
}

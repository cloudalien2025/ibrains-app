export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { fail, ok } from "@/app/api/ecomviper/walmart/_utils/response";
import { requireSignedInUser } from "@/lib/auth/requireSignedInUser";
import { requestWalmartItemReportBackfillForUser } from "@/lib/ecomviper/walmart/walmart-item-report-backfill";

function asSku(value: unknown): string {
  return typeof value === "string" ? value.trim().toUpperCase() : "";
}

export async function POST(req: NextRequest) {
  try {
    const { userId, unauthorizedResponse } = await requireSignedInUser();
    if (unauthorizedResponse) {
      if (unauthorizedResponse.status !== 401) return unauthorizedResponse;
      return fail(401, "Please sign in before requesting Walmart ITEM reports.", "UNAUTHORIZED");
    }
    if (!userId) {
      return fail(401, "Please sign in before requesting Walmart ITEM reports.", "UNAUTHORIZED");
    }

    const body = (await req.json().catch(() => ({}))) as { sku?: unknown };
    const sku = asSku(body.sku);
    if (!sku) {
      return fail(400, "SKU is required to request an ITEM report.", "SKU_REQUIRED");
    }

    const result = await requestWalmartItemReportBackfillForUser({
      userId,
      sku,
    });

    return ok({
      ok: result.ok,
      sku,
      reportBackfill: result.job,
      freshness: result.freshness,
      message: result.ok
        ? `ITEM report request submitted for ${sku}.`
        : result.job.status === "request_blocked_cooldown"
          ? "ITEM report request blocked by Walmart cooldown window."
          : result.job.status === "request_blocked_no_credentials"
            ? "ITEM report request blocked because Walmart credentials are not configured."
            : "ITEM report request failed. Check diagnostics.",
      note: "On-request reports can take ~15-45 minutes. This route only submits/tracks requests and does not block import/editor rendering.",
    });
  } catch (error) {
    return fail(
      500,
      error instanceof Error ? error.message : "Failed to request Walmart ITEM report.",
      "WALMART_ITEM_REPORT_REQUEST_FAILED"
    );
  }
}

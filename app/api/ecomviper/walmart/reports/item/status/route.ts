export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { fail, ok } from "@/app/api/ecomviper/walmart/_utils/response";
import { requireSignedInUser } from "@/lib/auth/requireSignedInUser";
import { pollWalmartItemReportBackfillForUser } from "@/lib/ecomviper/walmart/walmart-item-report-backfill";

function asSku(value: unknown): string {
  return typeof value === "string" ? value.trim().toUpperCase() : "";
}

function asRequestId(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

export async function POST(req: NextRequest) {
  try {
    const { userId, unauthorizedResponse } = await requireSignedInUser();
    if (unauthorizedResponse) {
      if (unauthorizedResponse.status !== 401) return unauthorizedResponse;
      return fail(401, "Please sign in before checking Walmart ITEM report status.", "UNAUTHORIZED");
    }
    if (!userId) {
      return fail(401, "Please sign in before checking Walmart ITEM report status.", "UNAUTHORIZED");
    }

    const body = (await req.json().catch(() => ({}))) as { sku?: unknown; requestId?: unknown };
    const sku = asSku(body.sku);
    if (!sku) {
      return fail(400, "SKU is required to check ITEM report status.", "SKU_REQUIRED");
    }

    const result = await pollWalmartItemReportBackfillForUser({
      userId,
      sku,
      requestId: asRequestId(body.requestId),
    });

    return ok({
      ok: result.ok,
      sku,
      reportBackfill: result.job,
      freshness: result.freshness,
      message:
        result.job.status === "ready"
          ? "ITEM report is ready for download."
          : result.job.status === "submitted" || result.job.status === "in_progress"
            ? "ITEM report is still generating at Walmart."
            : result.job.status === "request_blocked_no_credentials"
              ? "ITEM report status check blocked because Walmart credentials are not configured."
              : result.job.status === "not_requested"
                ? "ITEM report has not been requested for this SKU yet."
                : "ITEM report status checked.",
      note: "Status is mapped from Walmart request states and never marked ready until Walmart reports READY/PROCESSED/COMPLETE.",
    });
  } catch (error) {
    return fail(
      500,
      error instanceof Error ? error.message : "Failed to check Walmart ITEM report status.",
      "WALMART_ITEM_REPORT_STATUS_FAILED"
    );
  }
}

export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { fail, ok } from "@/app/api/ecomviper/walmart/_utils/response";
import { requireSignedInUser } from "@/lib/auth/requireSignedInUser";
import { downloadWalmartItemReportBackfillForUser } from "@/lib/ecomviper/walmart/walmart-item-report-backfill";

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
      return fail(401, "Please sign in before downloading Walmart ITEM reports.", "UNAUTHORIZED");
    }
    if (!userId) {
      return fail(401, "Please sign in before downloading Walmart ITEM reports.", "UNAUTHORIZED");
    }

    const body = (await req.json().catch(() => ({}))) as { sku?: unknown; requestId?: unknown };
    const sku = asSku(body.sku);
    if (!sku) {
      return fail(400, "SKU is required to download ITEM report content.", "SKU_REQUIRED");
    }

    const result = await downloadWalmartItemReportBackfillForUser({
      userId,
      sku,
      requestId: asRequestId(body.requestId),
    });

    return ok({
      ok: result.ok,
      sku,
      reportBackfill: result.job,
      freshness: result.freshness,
      message: result.ok
        ? `ITEM report downloaded for ${sku}.`
        : result.job.status === "ready"
          ? "ITEM report is ready but download failed. Retry download."
          : "ITEM report download skipped because report is not ready or unavailable.",
      note: "Downloaded report content is stored as a local backfill artifact for explicit apply actions.",
    });
  } catch (error) {
    return fail(
      500,
      error instanceof Error ? error.message : "Failed to download Walmart ITEM report.",
      "WALMART_ITEM_REPORT_DOWNLOAD_FAILED"
    );
  }
}

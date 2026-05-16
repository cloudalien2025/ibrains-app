export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { fail, ok } from "@/app/api/ecomviper/walmart/_utils/response";
import { requireSignedInUser } from "@/lib/auth/requireSignedInUser";
import { applyWalmartItemReportBackfillForUser } from "@/lib/ecomviper/walmart/walmart-item-report-backfill";

function asSku(value: unknown): string {
  return typeof value === "string" ? value.trim().toUpperCase() : "";
}

function asBoolean(value: unknown): boolean {
  return value === true || value === "true";
}

export async function POST(req: NextRequest) {
  try {
    const { userId, unauthorizedResponse } = await requireSignedInUser();
    if (unauthorizedResponse) {
      if (unauthorizedResponse.status !== 401) return unauthorizedResponse;
      return fail(401, "Please sign in before applying Walmart ITEM report rows.", "UNAUTHORIZED");
    }
    if (!userId) {
      return fail(401, "Please sign in before applying Walmart ITEM report rows.", "UNAUTHORIZED");
    }

    const body = (await req.json().catch(() => ({}))) as {
      sku?: unknown;
      applyToCatalog?: unknown;
    };
    const sku = asSku(body.sku);
    const applyToCatalog = asBoolean(body.applyToCatalog);

    if (!applyToCatalog && !sku) {
      return fail(400, "SKU is required unless applyToCatalog=true.", "SKU_REQUIRED");
    }

    const result = await applyWalmartItemReportBackfillForUser({
      userId,
      sku,
      applyToCatalog,
    });

    return ok({
      ok: result.status === "applied" || result.status === "applied_with_warnings",
      sku: sku || null,
      applyToCatalog,
      reportBackfill: result.job,
      applyResult: {
        status: result.status,
        rowCount: result.rowCount,
        appliedSkuCount: result.appliedSkuCount,
        matchedRowCount: result.matchedRowCount,
        unmatchedRowCount: result.unmatchedRowCount,
        duplicateSkuCount: result.duplicateSkuCount,
        warningCount: result.warningCount,
        errorCount: result.errorCount,
        diagnostics: result.diagnostics,
        appliedFields: result.appliedFields,
      },
      freshnessBySku: result.freshnessBySku,
      product: result.updatedProduct,
      message:
        result.status === "applied"
          ? "ITEM report rows applied to local Walmart docket fields."
          : result.status === "applied_with_warnings"
            ? "ITEM report rows applied with warnings. Some fields were intentionally preserved."
            : result.status === "no_matching_rows"
              ? "ITEM report parsed, but no matching rows were found for selected products."
              : "ITEM report apply did not complete successfully.",
      note: "Apply merges ITEM rows into normalized dockets and preserves user_edit/ai_optimized protections.",
    });
  } catch (error) {
    return fail(
      500,
      error instanceof Error ? error.message : "Failed to apply Walmart ITEM report rows.",
      "WALMART_ITEM_REPORT_APPLY_FAILED"
    );
  }
}

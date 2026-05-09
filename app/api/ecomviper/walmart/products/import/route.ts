export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { fail, ok } from "@/app/api/ecomviper/walmart/_utils/response";
import { requireSignedInUser } from "@/lib/auth/requireSignedInUser";
import { importWalmartProducts } from "@/lib/ecomviper/walmart/walmart-products";

export async function POST(req: NextRequest) {
  try {
    const { userId, unauthorizedResponse } = await requireSignedInUser();
    if (unauthorizedResponse) {
      if (unauthorizedResponse.status !== 401) {
        return unauthorizedResponse;
      }
      return fail(401, "Please sign in before importing Walmart products.", "UNAUTHORIZED");
    }
    if (!userId) {
      return fail(401, "Please sign in before importing Walmart products.", "UNAUTHORIZED");
    }

    const result = await importWalmartProducts(userId);
    const fetchedCount = result.importDiagnostics?.fetchedCount ?? result.fetchedCount ?? 0;
    const payloadShape = result.importDiagnostics?.payloadShape ?? "unknown";
    const inventoryUnknownCount = result.importDiagnostics?.inventoryUnknownCount ?? 0;
    const imageFoundCount = result.importDiagnostics?.imageFoundCount ?? 0;
    const imageNotFoundCount = result.importDiagnostics?.imageNotFoundCount ?? 0;
    const imageAmbiguousCount = result.importDiagnostics?.imageAmbiguousCount ?? 0;
    const imageFailedCount = result.importDiagnostics?.imageFailedCount ?? 0;
    const itemReportRequested = result.importDiagnostics?.itemReportRequested ?? false;
    const itemReportDownloaded = result.importDiagnostics?.itemReportDownloaded ?? false;
    const itemReportRowsParsed = result.importDiagnostics?.itemReportRowsParsed ?? 0;
    const sourceBreakdown = result.importDiagnostics?.imageSourceBreakdown;
    const inventoryNote =
      inventoryUnknownCount > 0
        ? ` Inventory pending for ${inventoryUnknownCount} SKU(s); quantity requires Walmart inventory sync.`
        : "";
    const imageNote =
      result.importedCount > 0
        ? ` Image enrichment: found=${imageFoundCount}, notFound=${imageNotFoundCount}, ambiguous=${imageAmbiguousCount}, failed=${imageFailedCount}. ItemReport requested=${itemReportRequested}, downloaded=${itemReportDownloaded}, rows=${itemReportRowsParsed}. Source breakdown: itemReport=${sourceBreakdown?.walmartItemReport ?? 0}, sellerCatalog=${sourceBreakdown?.walmartSellerCatalogSearch ?? 0}, itemSearch=${sourceBreakdown?.walmartItemSearch ?? 0}.`
        : "";
    return ok({
      ok: true,
      ...result,
      message:
        result.importedCount > 0
          ? `Imported ${result.importedCount} Walmart product(s).${inventoryNote}${imageNote}`
          : `Walmart import completed with zero products. fetchedCount=${fetchedCount}, payloadShape=${payloadShape}.`,
    });
  } catch (error) {
    return fail(500, error instanceof Error ? error.message : "Failed to import Walmart products.");
  }
}

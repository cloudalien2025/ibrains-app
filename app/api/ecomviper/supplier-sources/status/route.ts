export const runtime = "nodejs";

import { fail, ok } from "@/app/api/ecomviper/walmart/_utils/response";
import { requireSignedInUser } from "@/lib/auth/requireSignedInUser";
import { getRocktomicSourceIngestionSnapshot } from "@/lib/ecomviper/dropshipping/rocktomic-source-ingestion";

export async function GET() {
  try {
    const auth = await requireSignedInUser();
    if (auth.unauthorizedResponse) return auth.unauthorizedResponse;
    if (!auth.userId) return fail(401, "Please sign in before loading supplier source sync status.", "UNAUTHORIZED");

    const snapshot = await getRocktomicSourceIngestionSnapshot({
      userId: auth.userId,
      allowRefresh: false,
      triggerBackgroundRefresh: false,
    });

    return ok({
      ok: true,
      supplier: snapshot.supplier,
      syncStatus: snapshot.syncStatus,
      lastAttemptedSyncAt: snapshot.lastAttemptedSyncAt,
      lastSuccessfulSyncAt: snapshot.lastSuccessfulSyncAt,
      lastSyncError: snapshot.lastSyncError,
      sourceDiagnostics: snapshot.sourceDiagnostics,
      productsParsedCount: snapshot.syncRunSummary?.productsParsedCount ?? snapshot.productCount,
      inventoryRecordsParsedCount: snapshot.syncRunSummary?.inventoryRecordsParsedCount ?? snapshot.inventorySkuCount,
      pricingRecordsParsedCount: snapshot.syncRunSummary?.pricingRecordsParsedCount ?? snapshot.catalogSkuCount,
      assetRecordsParsedCount: snapshot.syncRunSummary?.assetRecordsParsedCount ?? snapshot.catalogExtractedSkuCount,
    });
  } catch (error) {
    return fail(
      500,
      error instanceof Error ? error.message : "Unexpected supplier source status error."
    );
  }
}

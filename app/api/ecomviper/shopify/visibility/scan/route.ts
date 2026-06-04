export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { fail, ok } from "@/app/api/ecomviper/walmart/_utils/response";
import { requireSignedInUser } from "@/lib/auth/requireSignedInUser";
import { getShopifyConnectionStatusForUser } from "@/lib/ecomviper/shopify/shopify-connection";
import {
  getShopifySerpApiConnectionStatusForUser,
  getShopifySerpApiKeyForUser,
  recordShopifySerpApiScanResultForUser,
  runShopifyVisibilityScanWithSerpApi,
} from "@/lib/ecomviper/shopify/serpapi-connection";

export async function POST(req: NextRequest) {
  try {
    const { userId, unauthorizedResponse } = await requireSignedInUser();
    if (unauthorizedResponse) {
      if (unauthorizedResponse.status !== 401) {
        return unauthorizedResponse;
      }
      return fail(401, "Please sign in before running visibility scan.", "UNAUTHORIZED");
    }
    if (!userId) {
      return fail(401, "Please sign in before running visibility scan.", "UNAUTHORIZED");
    }

    const serpStatus = await getShopifySerpApiConnectionStatusForUser(userId);
    if (!serpStatus.connected) {
      return fail(400, "Connect SerpAPI first, then run visibility scan.", "SERPAPI_NOT_CONNECTED");
    }

    const apiKey = await getShopifySerpApiKeyForUser(userId);
    if (!apiKey) {
      return fail(400, "SerpAPI key is not configured.", "SERPAPI_NOT_CONNECTED");
    }

    const shopifyStatus = await getShopifyConnectionStatusForUser(userId);
    if (!shopifyStatus.connected || !shopifyStatus.storeDomain) {
      return fail(400, "Connect Shopify before running visibility scan.", "SHOPIFY_NOT_CONNECTED");
    }

    const body = (await req.json().catch(() => ({}))) as { query?: unknown };
    const query = typeof body.query === "string" ? body.query.trim() : "";

    const scan = await runShopifyVisibilityScanWithSerpApi({
      apiKey,
      storeDomain: shopifyStatus.storeDomain,
      query: query || null,
    });

    const okProvider = scan.providerStatus === "connected";
    await recordShopifySerpApiScanResultForUser({
      userId,
      ok: okProvider,
      errorMessage: okProvider ? null : scan.statusReason,
    });

    const latestStatus = await getShopifySerpApiConnectionStatusForUser(userId);

    return ok({
      ok: true,
      provider: "serpapi",
      storeDomain: shopifyStatus.storeDomain,
      connected: okProvider,
      providerStatus: scan.providerStatus,
      providerStatusReason: scan.statusReason,
      statusCode: scan.statusCode,
      query: scan.searchQuery,
      totalResults: scan.totalResults,
      resultUrls: scan.resultUrls,
      scannedAt: scan.scannedAt,
      lastScanAt: latestStatus.lastScanAt,
      lastError: latestStatus.lastError,
      message: okProvider
        ? `Visibility scan completed for ${shopifyStatus.storeDomain}.`
        : scan.statusReason,
    });
  } catch (error) {
    return fail(500, error instanceof Error ? error.message : "Failed to run visibility scan.");
  }
}

export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { fail, ok } from "@/app/api/ecomviper/walmart/_utils/response";
import { requireSignedInUser } from "@/lib/auth/requireSignedInUser";
import {
  getShopifySerpApiConnectionStatusForUser,
  getShopifySerpApiKeyForUser,
  isShopifySerpApiStoreAvailable,
  recordShopifySerpApiTestResultForUser,
  testShopifySerpApiKey,
} from "@/lib/ecomviper/shopify/serpapi-connection";

export async function POST(req: NextRequest) {
  try {
    const { userId, unauthorizedResponse } = await requireSignedInUser();
    if (unauthorizedResponse) {
      if (unauthorizedResponse.status !== 401) {
        return unauthorizedResponse;
      }
      return fail(401, "Please sign in before testing Shopify SerpAPI credentials.", "UNAUTHORIZED");
    }
    if (!userId) {
      return fail(401, "Please sign in before testing Shopify SerpAPI credentials.", "UNAUTHORIZED");
    }

    const saveSupported = await isShopifySerpApiStoreAvailable();
    if (!saveSupported) {
      return fail(
        503,
        "Shopify SerpAPI credential saving is not available in this environment.",
        "STORE_UNAVAILABLE"
      );
    }

    const body = (await req.json().catch(() => ({}))) as { apiKey?: unknown };
    const submittedApiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
    const apiKey = submittedApiKey || (await getShopifySerpApiKeyForUser(userId)) || "";

    if (!apiKey) {
      return fail(400, "SerpAPI key is not configured. Save credentials first.", "NOT_CONFIGURED");
    }

    const test = await testShopifySerpApiKey(apiKey);
    const okProvider = test.providerStatus === "connected";

    await recordShopifySerpApiTestResultForUser({
      userId,
      ok: okProvider,
      errorMessage: okProvider ? null : test.statusReason,
    });

    const status = await getShopifySerpApiConnectionStatusForUser(userId);

    return ok({
      ok: true,
      provider: "serpapi",
      connected: status.connected && okProvider,
      status: status.status,
      maskedApiKey: status.maskedApiKey,
      updatedAt: status.updatedAt,
      saveSupported: status.saveSupported,
      lastTestedAt: status.lastTestedAt,
      lastScanAt: status.lastScanAt,
      lastError: status.lastError,
      providerStatus: test.providerStatus,
      providerStatusReason: test.statusReason,
      statusCode: test.statusCode,
      verifiedAt: new Date().toISOString(),
      message: okProvider ? "Connected to SerpAPI." : test.statusReason,
      securityNote: "SerpAPI keys are processed server-side and never returned.",
    });
  } catch (error) {
    return fail(502, error instanceof Error ? error.message : "Failed to test Shopify SerpAPI credentials.", "TEST_FAILED");
  }
}

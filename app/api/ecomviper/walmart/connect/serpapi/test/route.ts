export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { fail, ok } from "@/app/api/ecomviper/walmart/_utils/response";
import { requireSignedInUser } from "@/lib/auth/requireSignedInUser";
import {
  getWalmartSerpApiConnectionStatusForUser,
  getWalmartSerpApiKeyForUser,
  isWalmartSerpApiStoreAvailable,
  testWalmartSerpApiKey,
} from "@/lib/ecomviper/walmart/walmart-serpapi-connection";

export async function POST(req: NextRequest) {
  try {
    const { userId, unauthorizedResponse } = await requireSignedInUser();
    if (unauthorizedResponse) {
      if (unauthorizedResponse.status !== 401) {
        return unauthorizedResponse;
      }
      return fail(401, "Please sign in before testing Walmart SerpApi credentials.", "UNAUTHORIZED");
    }
    if (!userId) {
      return fail(401, "Please sign in before testing Walmart SerpApi credentials.", "UNAUTHORIZED");
    }

    const saveSupported = await isWalmartSerpApiStoreAvailable();
    if (!saveSupported) {
      return fail(
        503,
        "Walmart SerpApi credential saving is not available in this environment.",
        "STORE_UNAVAILABLE"
      );
    }

    const body = (await req.json().catch(() => ({}))) as { apiKey?: unknown };
    const submittedApiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
    const apiKey = submittedApiKey || (await getWalmartSerpApiKeyForUser(userId)) || "";

    if (!apiKey) {
      const status = await getWalmartSerpApiConnectionStatusForUser(userId);
      return ok({
        ok: true,
        provider: "serpapi",
        connected: false,
        status: status.status,
        maskedApiKey: status.maskedApiKey,
        updatedAt: status.updatedAt,
        saveSupported: status.saveSupported,
        providerStatus: "not_connected",
        providerStatusReason: "SerpApi key missing.",
        safeProviderErrorDetail: null,
        statusCode: null,
        usage: null,
        verifiedAt: new Date().toISOString(),
        message: "SerpApi key missing.",
        securityNote: "SerpApi keys are processed server-side and never returned.",
      });
    }

    const diagnostics = await testWalmartSerpApiKey(apiKey);
    const status = await getWalmartSerpApiConnectionStatusForUser(userId);
    const isConnected = diagnostics.providerStatus === "connected";
    const message = isConnected
      ? "Connected to SerpApi."
      : diagnostics.safeProviderErrorDetail
      ? `${diagnostics.statusReason}`
      : diagnostics.statusReason;

    return ok({
      ok: true,
      provider: "serpapi",
      connected: status.connected && isConnected,
      status: status.status,
      maskedApiKey: status.maskedApiKey,
      updatedAt: status.updatedAt,
      saveSupported: status.saveSupported,
      providerStatus: diagnostics.providerStatus,
      providerStatusReason: diagnostics.statusReason,
      safeProviderErrorDetail: diagnostics.safeProviderErrorDetail,
      statusCode: diagnostics.statusCode,
      usage: diagnostics.usage,
      verifiedAt: new Date().toISOString(),
      message,
      securityNote: "SerpApi keys are processed server-side and never returned.",
    });
  } catch (error) {
    return fail(502, error instanceof Error ? error.message : "Failed to test Walmart SerpApi credentials.", "TEST_FAILED");
  }
}

export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { fail, ok } from "@/app/api/ecomviper/walmart/_utils/response";
import { requireSignedInUser } from "@/lib/auth/requireSignedInUser";
import {
  getShopifyOpenAiApiKeyForUser,
  getShopifyOpenAiConnectionStatusForUser,
  isShopifyOpenAiStoreAvailable,
  recordShopifyOpenAiTestResultForUser,
  testShopifyOpenAiApiKey,
} from "@/lib/ecomviper/shopify/openai-connection";

export async function POST(req: NextRequest) {
  try {
    const { userId, unauthorizedResponse } = await requireSignedInUser();
    if (unauthorizedResponse) {
      if (unauthorizedResponse.status !== 401) {
        return unauthorizedResponse;
      }
      return fail(401, "Please sign in before testing Shopify OpenAI API credentials.", "UNAUTHORIZED");
    }
    if (!userId) {
      return fail(401, "Please sign in before testing Shopify OpenAI API credentials.", "UNAUTHORIZED");
    }

    const saveSupported = await isShopifyOpenAiStoreAvailable();
    if (!saveSupported) {
      return fail(
        503,
        "Shopify OpenAI credential saving is not available in this environment.",
        "STORE_UNAVAILABLE"
      );
    }

    const body = (await req.json().catch(() => ({}))) as { apiKey?: unknown };
    const submittedApiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
    const apiKey = submittedApiKey || (await getShopifyOpenAiApiKeyForUser(userId)) || "";

    if (!apiKey) {
      return fail(400, "OpenAI API key is not configured. Save credentials first.", "NOT_CONFIGURED");
    }

    try {
      await testShopifyOpenAiApiKey(apiKey);
      await recordShopifyOpenAiTestResultForUser({ userId, ok: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "OpenAI API test failed.";
      await recordShopifyOpenAiTestResultForUser({ userId, ok: false, errorMessage: message });
      throw error;
    }

    const status = await getShopifyOpenAiConnectionStatusForUser(userId);

    return ok({
      ok: true,
      provider: "openai",
      connected: status.connected,
      status: status.status,
      maskedApiKey: status.maskedApiKey,
      updatedAt: status.updatedAt,
      saveSupported: status.saveSupported,
      lastTestedAt: status.lastTestedAt,
      lastError: status.lastError,
      verifiedAt: new Date().toISOString(),
      message: "Connected to OpenAI API.",
      securityNote: "OpenAI API keys are processed server-side and never returned.",
    });
  } catch (error) {
    return fail(502, error instanceof Error ? error.message : "Failed to test Shopify OpenAI API credentials.", "TEST_FAILED");
  }
}

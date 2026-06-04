export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { fail, ok } from "@/app/api/ecomviper/walmart/_utils/response";
import { requireSignedInUser } from "@/lib/auth/requireSignedInUser";
import {
  getWalmartOpenAiApiKeyForUser,
  getWalmartOpenAiConnectionStatusForUser,
  isWalmartOpenAiStoreAvailable,
  testWalmartOpenAiApiKey,
} from "@/lib/ecomviper/walmart/walmart-openai-connection";

export async function POST(req: NextRequest) {
  try {
    const { userId, unauthorizedResponse } = await requireSignedInUser();
    if (unauthorizedResponse) {
      if (unauthorizedResponse.status !== 401) {
        return unauthorizedResponse;
      }
      return fail(401, "Please sign in before testing Walmart OpenAI API credentials.", "UNAUTHORIZED");
    }
    if (!userId) {
      return fail(401, "Please sign in before testing Walmart OpenAI API credentials.", "UNAUTHORIZED");
    }

    const saveSupported = await isWalmartOpenAiStoreAvailable();
    if (!saveSupported) {
      return fail(
        503,
        "Walmart OpenAI credential saving is not available in this environment.",
        "STORE_UNAVAILABLE"
      );
    }

    const body = (await req.json().catch(() => ({}))) as { apiKey?: unknown };
    const submittedApiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
    const apiKey = submittedApiKey || (await getWalmartOpenAiApiKeyForUser(userId)) || "";

    if (!apiKey) {
      return fail(400, "OpenAI API key is not configured. Save credentials first.", "NOT_CONFIGURED");
    }

    await testWalmartOpenAiApiKey(apiKey);
    const status = await getWalmartOpenAiConnectionStatusForUser(userId);

    return ok({
      ok: true,
      provider: "openai",
      connected: status.connected,
      status: status.status,
      maskedApiKey: status.maskedApiKey,
      updatedAt: status.updatedAt,
      saveSupported: status.saveSupported,
      verifiedAt: new Date().toISOString(),
      message: "Connected to OpenAI API.",
      securityNote: "OpenAI API keys are processed server-side and never returned.",
    });
  } catch (error) {
    return fail(502, error instanceof Error ? error.message : "Failed to test Walmart OpenAI API credentials.", "TEST_FAILED");
  }
}

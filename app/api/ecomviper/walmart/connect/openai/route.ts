export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { fail, ok } from "@/app/api/ecomviper/walmart/_utils/response";
import { requireSignedInUser } from "@/lib/auth/requireSignedInUser";
import {
  deleteWalmartOpenAiConnectionForUser,
  getWalmartOpenAiConnectionStatusForUser,
  isWalmartOpenAiStoreAvailable,
  saveWalmartOpenAiConnectionForUser,
} from "@/lib/ecomviper/walmart/walmart-openai-connection";

export async function GET() {
  try {
    const { userId, unauthorizedResponse } = await requireSignedInUser();
    if (unauthorizedResponse) {
      if (unauthorizedResponse.status !== 401) {
        return unauthorizedResponse;
      }
      return fail(401, "Please sign in before loading Walmart OpenAI API status.", "UNAUTHORIZED");
    }
    if (!userId) {
      return fail(401, "Please sign in before loading Walmart OpenAI API status.", "UNAUTHORIZED");
    }

    const status = await getWalmartOpenAiConnectionStatusForUser(userId);
    return ok({
      ok: true,
      provider: "openai",
      ...status,
      securityNote: "Saved OpenAI API keys are encrypted server-side and never returned.",
    });
  } catch (error) {
    return fail(500, error instanceof Error ? error.message : "Failed to load Walmart OpenAI API status.");
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId, unauthorizedResponse } = await requireSignedInUser();
    if (unauthorizedResponse) {
      if (unauthorizedResponse.status !== 401) {
        return unauthorizedResponse;
      }
      return fail(401, "Please sign in before saving Walmart OpenAI API credentials.", "UNAUTHORIZED");
    }
    if (!userId) {
      return fail(401, "Please sign in before saving Walmart OpenAI API credentials.", "UNAUTHORIZED");
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
    const apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";

    if (!apiKey) {
      return fail(400, "OpenAI API key is required.", "VALIDATION_ERROR");
    }

    const status = await saveWalmartOpenAiConnectionForUser({ userId, apiKey });

    return ok({
      ok: true,
      provider: "openai",
      ...status,
      message: "OpenAI API key saved securely.",
      securityNote: "Saved OpenAI API keys are encrypted server-side and never returned.",
    });
  } catch (error) {
    return fail(500, error instanceof Error ? error.message : "Failed to save Walmart OpenAI API credentials.");
  }
}

export async function DELETE() {
  try {
    const { userId, unauthorizedResponse } = await requireSignedInUser();
    if (unauthorizedResponse) {
      if (unauthorizedResponse.status !== 401) {
        return unauthorizedResponse;
      }
      return fail(401, "Please sign in before disconnecting Walmart OpenAI API.", "UNAUTHORIZED");
    }
    if (!userId) {
      return fail(401, "Please sign in before disconnecting Walmart OpenAI API.", "UNAUTHORIZED");
    }

    const saveSupported = await isWalmartOpenAiStoreAvailable();
    if (!saveSupported) {
      return fail(
        503,
        "Walmart OpenAI credential saving is not available in this environment.",
        "STORE_UNAVAILABLE"
      );
    }

    const status = await deleteWalmartOpenAiConnectionForUser(userId);

    return ok({
      ok: true,
      provider: "openai",
      ...status,
      message: "OpenAI API disconnected.",
    });
  } catch (error) {
    return fail(500, error instanceof Error ? error.message : "Failed to disconnect Walmart OpenAI API.");
  }
}

export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { fail, ok } from "@/app/api/ecomviper/walmart/_utils/response";
import { requireSignedInUser } from "@/lib/auth/requireSignedInUser";
import {
  deleteWalmartSerpApiConnectionForUser,
  getWalmartSerpApiConnectionStatusForUser,
  isWalmartSerpApiStoreAvailable,
  saveWalmartSerpApiConnectionForUser,
} from "@/lib/ecomviper/walmart/walmart-serpapi-connection";

export async function GET() {
  try {
    const { userId, unauthorizedResponse } = await requireSignedInUser();
    if (unauthorizedResponse) {
      if (unauthorizedResponse.status !== 401) {
        return unauthorizedResponse;
      }
      return fail(401, "Please sign in before loading Walmart SerpApi status.", "UNAUTHORIZED");
    }
    if (!userId) {
      return fail(401, "Please sign in before loading Walmart SerpApi status.", "UNAUTHORIZED");
    }

    const status = await getWalmartSerpApiConnectionStatusForUser(userId);
    return ok({
      ok: true,
      provider: "serpapi",
      ...status,
      securityNote: "Saved SerpApi keys are encrypted server-side and never returned.",
    });
  } catch (error) {
    return fail(500, error instanceof Error ? error.message : "Failed to load Walmart SerpApi status.");
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId, unauthorizedResponse } = await requireSignedInUser();
    if (unauthorizedResponse) {
      if (unauthorizedResponse.status !== 401) {
        return unauthorizedResponse;
      }
      return fail(401, "Please sign in before saving Walmart SerpApi credentials.", "UNAUTHORIZED");
    }
    if (!userId) {
      return fail(401, "Please sign in before saving Walmart SerpApi credentials.", "UNAUTHORIZED");
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
    const apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";

    if (!apiKey) {
      return fail(400, "SerpApi key is required.", "VALIDATION_ERROR");
    }

    const status = await saveWalmartSerpApiConnectionForUser({ userId, apiKey });

    return ok({
      ok: true,
      provider: "serpapi",
      ...status,
      message: "SerpApi key saved securely.",
      securityNote: "Saved SerpApi keys are encrypted server-side and never returned.",
    });
  } catch (error) {
    return fail(500, error instanceof Error ? error.message : "Failed to save Walmart SerpApi credentials.");
  }
}

export async function DELETE() {
  try {
    const { userId, unauthorizedResponse } = await requireSignedInUser();
    if (unauthorizedResponse) {
      if (unauthorizedResponse.status !== 401) {
        return unauthorizedResponse;
      }
      return fail(401, "Please sign in before disconnecting Walmart SerpApi.", "UNAUTHORIZED");
    }
    if (!userId) {
      return fail(401, "Please sign in before disconnecting Walmart SerpApi.", "UNAUTHORIZED");
    }

    const saveSupported = await isWalmartSerpApiStoreAvailable();
    if (!saveSupported) {
      return fail(
        503,
        "Walmart SerpApi credential saving is not available in this environment.",
        "STORE_UNAVAILABLE"
      );
    }

    const status = await deleteWalmartSerpApiConnectionForUser(userId);

    return ok({
      ok: true,
      provider: "serpapi",
      ...status,
      message: "SerpApi disconnected.",
    });
  } catch (error) {
    return fail(500, error instanceof Error ? error.message : "Failed to disconnect Walmart SerpApi.");
  }
}

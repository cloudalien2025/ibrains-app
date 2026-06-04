export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { fail, ok } from "@/app/api/ecomviper/walmart/_utils/response";
import { requireSignedInUser } from "@/lib/auth/requireSignedInUser";
import {
  deleteShopifySerpApiConnectionForUser,
  getShopifySerpApiConnectionStatusForUser,
  isShopifySerpApiStoreAvailable,
  saveShopifySerpApiConnectionForUser,
} from "@/lib/ecomviper/shopify/serpapi-connection";

export async function GET() {
  try {
    const { userId, unauthorizedResponse } = await requireSignedInUser();
    if (unauthorizedResponse) {
      if (unauthorizedResponse.status !== 401) {
        return unauthorizedResponse;
      }
      return fail(401, "Please sign in before loading Shopify SerpAPI status.", "UNAUTHORIZED");
    }
    if (!userId) {
      return fail(401, "Please sign in before loading Shopify SerpAPI status.", "UNAUTHORIZED");
    }

    const status = await getShopifySerpApiConnectionStatusForUser(userId);
    return ok({
      ok: true,
      provider: "serpapi",
      ...status,
      securityNote: "Saved SerpAPI keys are encrypted server-side and never returned.",
    });
  } catch (error) {
    return fail(500, error instanceof Error ? error.message : "Failed to load Shopify SerpAPI status.");
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId, unauthorizedResponse } = await requireSignedInUser();
    if (unauthorizedResponse) {
      if (unauthorizedResponse.status !== 401) {
        return unauthorizedResponse;
      }
      return fail(401, "Please sign in before saving Shopify SerpAPI credentials.", "UNAUTHORIZED");
    }
    if (!userId) {
      return fail(401, "Please sign in before saving Shopify SerpAPI credentials.", "UNAUTHORIZED");
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
    const apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";

    if (!apiKey) {
      return fail(400, "SerpAPI key is required.", "VALIDATION_ERROR");
    }

    const status = await saveShopifySerpApiConnectionForUser({ userId, apiKey });

    return ok({
      ok: true,
      provider: "serpapi",
      ...status,
      message: "SerpAPI key saved securely.",
      securityNote: "Saved SerpAPI keys are encrypted server-side and never returned.",
    });
  } catch (error) {
    return fail(500, error instanceof Error ? error.message : "Failed to save Shopify SerpAPI credentials.");
  }
}

export async function DELETE() {
  try {
    const { userId, unauthorizedResponse } = await requireSignedInUser();
    if (unauthorizedResponse) {
      if (unauthorizedResponse.status !== 401) {
        return unauthorizedResponse;
      }
      return fail(401, "Please sign in before disconnecting Shopify SerpAPI.", "UNAUTHORIZED");
    }
    if (!userId) {
      return fail(401, "Please sign in before disconnecting Shopify SerpAPI.", "UNAUTHORIZED");
    }

    const saveSupported = await isShopifySerpApiStoreAvailable();
    if (!saveSupported) {
      return fail(
        503,
        "Shopify SerpAPI credential saving is not available in this environment.",
        "STORE_UNAVAILABLE"
      );
    }

    const status = await deleteShopifySerpApiConnectionForUser(userId);

    return ok({
      ok: true,
      provider: "serpapi",
      ...status,
      message: "SerpAPI disconnected.",
    });
  } catch (error) {
    return fail(500, error instanceof Error ? error.message : "Failed to disconnect Shopify SerpAPI.");
  }
}

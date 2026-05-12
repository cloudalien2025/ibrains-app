export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { fail, ok } from "@/app/api/ecomviper/walmart/_utils/response";
import { requireSignedInUser } from "@/lib/auth/requireSignedInUser";
import {
  deleteShopifyConnectionForUser,
  getShopifyConnectionStatusForUser,
  isShopifyStoreAvailable,
  saveShopifyConnectionForUser,
  testShopifyConnectionForUser,
} from "@/lib/ecomviper/shopify/shopify-connection";
import { getShopifyImportStateForUser } from "@/lib/ecomviper/shopify/shopify-import";

function defaultImportState() {
  return {
    lastImportAt: null,
    lastImportStatus: "unknown" as const,
    lastImportMessage: null,
    productCount: 0,
    imageCount: 0,
    updatedAt: null,
  };
}

export async function GET() {
  try {
    const { userId, unauthorizedResponse } = await requireSignedInUser();
    if (unauthorizedResponse) {
      if (unauthorizedResponse.status !== 401) {
        return unauthorizedResponse;
      }
      return fail(401, "Please sign in before loading Shopify status.", "UNAUTHORIZED");
    }
    if (!userId) {
      return fail(401, "Please sign in before loading Shopify status.", "UNAUTHORIZED");
    }

    const status = await getShopifyConnectionStatusForUser(userId);
    const importState = status.saveSupported
      ? await getShopifyImportStateForUser(userId)
      : defaultImportState();

    return ok({
      ok: true,
      provider: "shopify",
      ...status,
      importState,
      securityNote: "Shopify Client Secret and exchanged access tokens are handled server-side and never returned.",
    });
  } catch (error) {
    return fail(500, error instanceof Error ? error.message : "Failed to load Shopify status.");
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId, unauthorizedResponse } = await requireSignedInUser();
    if (unauthorizedResponse) {
      if (unauthorizedResponse.status !== 401) {
        return unauthorizedResponse;
      }
      return fail(401, "Please sign in before saving Shopify credentials.", "UNAUTHORIZED");
    }
    if (!userId) {
      return fail(401, "Please sign in before saving Shopify credentials.", "UNAUTHORIZED");
    }

    const saveSupported = await isShopifyStoreAvailable();
    if (!saveSupported) {
      return fail(
        503,
        "Shopify credential saving is not available in this environment.",
        "STORE_UNAVAILABLE"
      );
    }

    const body = (await req.json().catch(() => ({}))) as {
      storeDomain?: unknown;
      clientId?: unknown;
      clientSecret?: unknown;
      apiVersion?: unknown;
      adminApiToken?: unknown;
    };

    const storeDomain = typeof body.storeDomain === "string" ? body.storeDomain.trim() : "";
    const clientId = typeof body.clientId === "string" ? body.clientId.trim() : "";
    const clientSecret = typeof body.clientSecret === "string" ? body.clientSecret.trim() : "";
    const apiVersion = typeof body.apiVersion === "string" ? body.apiVersion.trim() : null;
    const adminApiToken = typeof body.adminApiToken === "string" ? body.adminApiToken.trim() : "";

    if (!storeDomain || !clientId || !clientSecret) {
      return fail(400, "Shopify store domain, Client ID, and Client Secret are required.", "VALIDATION_ERROR");
    }

    const test = await testShopifyConnectionForUser({
      userId,
      storeDomain,
      clientId,
      clientSecret,
      apiVersion,
      adminApiToken: adminApiToken || null,
    });

    if (!test.ok && test.missingScope) {
      return fail(400, test.message, "MISSING_REQUIRED_SCOPE");
    }

    if (!test.ok) {
      return fail(502, test.message, "SHOPIFY_TEST_FAILED");
    }

    const status = await saveShopifyConnectionForUser({
      userId,
      storeDomain,
      clientId,
      clientSecret,
      apiVersion,
      connectionTest: test,
    });

    const importState = await getShopifyImportStateForUser(userId);

    return ok({
      ok: true,
      provider: "shopify",
      ...status,
      importState,
      requiredScope: test.requiredScope,
      diagnosticEvent: test.diagnosticEvent,
      message: "Shopify connection saved securely.",
      securityNote: "Shopify Client Secret and exchanged access tokens are handled server-side and never returned.",
    });
  } catch (error) {
    return fail(500, error instanceof Error ? error.message : "Failed to save Shopify credentials.");
  }
}

export async function DELETE() {
  try {
    const { userId, unauthorizedResponse } = await requireSignedInUser();
    if (unauthorizedResponse) {
      if (unauthorizedResponse.status !== 401) {
        return unauthorizedResponse;
      }
      return fail(401, "Please sign in before disconnecting Shopify.", "UNAUTHORIZED");
    }
    if (!userId) {
      return fail(401, "Please sign in before disconnecting Shopify.", "UNAUTHORIZED");
    }

    const saveSupported = await isShopifyStoreAvailable();
    if (!saveSupported) {
      return fail(
        503,
        "Shopify credential saving is not available in this environment.",
        "STORE_UNAVAILABLE"
      );
    }

    const status = await deleteShopifyConnectionForUser(userId);
    const importState = status.saveSupported
      ? await getShopifyImportStateForUser(userId)
      : defaultImportState();

    return ok({
      ok: true,
      provider: "shopify",
      ...status,
      importState,
      message: "Shopify disconnected.",
    });
  } catch (error) {
    return fail(500, error instanceof Error ? error.message : "Failed to disconnect Shopify.");
  }
}

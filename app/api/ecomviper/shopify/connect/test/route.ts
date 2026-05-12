export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { fail, ok } from "@/app/api/ecomviper/walmart/_utils/response";
import { requireSignedInUser } from "@/lib/auth/requireSignedInUser";
import { getShopifyConnectionStatusForUser, testShopifyConnectionForUser } from "@/lib/ecomviper/shopify/shopify-connection";
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

export async function POST(req: NextRequest) {
  try {
    const { userId, unauthorizedResponse } = await requireSignedInUser();
    if (unauthorizedResponse) {
      if (unauthorizedResponse.status !== 401) {
        return unauthorizedResponse;
      }
      return fail(401, "Please sign in before testing Shopify credentials.", "UNAUTHORIZED");
    }
    if (!userId) {
      return fail(401, "Please sign in before testing Shopify credentials.", "UNAUTHORIZED");
    }

    const body = (await req.json().catch(() => ({}))) as {
      storeDomain?: unknown;
      adminApiToken?: unknown;
      apiVersion?: unknown;
    };

    const storeDomain = typeof body.storeDomain === "string" ? body.storeDomain.trim() : "";
    const adminApiToken = typeof body.adminApiToken === "string" ? body.adminApiToken.trim() : "";
    const apiVersion = typeof body.apiVersion === "string" ? body.apiVersion.trim() : null;

    const test = await testShopifyConnectionForUser({
      userId,
      storeDomain,
      adminApiToken,
      apiVersion,
    });

    const status = await getShopifyConnectionStatusForUser(userId);
    const importState = status.saveSupported
      ? await getShopifyImportStateForUser(userId)
      : defaultImportState();

    return ok({
      ok: test.ok,
      provider: "shopify",
      ...status,
      connected: test.ok && status.connected,
      storeDomain: test.storeDomain,
      apiVersion: test.apiVersion,
      importState,
      requiredScope: test.requiredScope,
      missingScope: test.missingScope,
      statusCode: test.statusCode,
      requestId: test.requestId,
      diagnosticEvent: test.diagnosticEvent,
      message: test.message,
      securityNote: "Shopify Admin API tokens are processed server-side and never returned.",
    });
  } catch (error) {
    return fail(502, error instanceof Error ? error.message : "Failed to test Shopify credentials.", "TEST_FAILED");
  }
}

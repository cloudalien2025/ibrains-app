export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { fail, ok } from "@/app/api/ecomviper/walmart/_utils/response";
import { requireSignedInUser } from "@/lib/auth/requireSignedInUser";
import { runShopifyGuardedPublishForUser } from "@/lib/ecomviper/shopify/shopify-product-publish-service";

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(req: NextRequest) {
  try {
    const { userId, unauthorizedResponse } = await requireSignedInUser();
    if (unauthorizedResponse) {
      if (unauthorizedResponse.status !== 401) {
        return unauthorizedResponse;
      }
      return fail(401, "Please sign in before running Shopify publish workflow.", "UNAUTHORIZED");
    }
    if (!userId) {
      return fail(401, "Please sign in before running Shopify publish workflow.", "UNAUTHORIZED");
    }

    const body = asRecord(await req.json().catch(() => ({})));
    const modeRaw = asString(body.mode).toLowerCase();
    const mode = modeRaw === "execute" ? "execute" : modeRaw === "dry_run" ? "dry_run" : "";

    if (!mode) {
      return fail(400, "mode must be dry_run or execute.", "VALIDATION_ERROR");
    }

    const productId = asString(body.productId);
    if (!productId) {
      return fail(400, "productId is required.", "VALIDATION_ERROR");
    }

    const confirmationAccepted = typeof body.confirmationAccepted === "boolean" ? body.confirmationAccepted : false;
    const changes = asRecord(body.changes);

    const result = await runShopifyGuardedPublishForUser({
      userId,
      mode,
      productId,
      confirmationAccepted,
      changes,
      baselineUpdatedAt: asString(body.baselineUpdatedAt) || null,
      confirmationToken: asString(body.confirmationToken) || null,
      idempotencyKey: asString(body.idempotencyKey) || null,
    });

    return ok({
      ok: true,
      publish: result,
    });
  } catch (error) {
    return fail(500, error instanceof Error ? error.message : "Failed to process Shopify guarded publish request.");
  }
}

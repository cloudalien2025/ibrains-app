export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { fail, ok } from "@/app/api/ecomviper/walmart/_utils/response";
import { requireSignedInUser } from "@/lib/auth/requireSignedInUser";
import { getPersistedWalmartProductBySku } from "@/lib/ecomviper/walmart/walmart-product-repository";
import { listDrafts, upsertDraftForSku } from "@/lib/ecomviper/walmart/walmart-store";

function isUnknownSkuError(error: unknown): boolean {
  return error instanceof Error && error.message.startsWith("Unknown SKU:");
}

export async function GET(req: NextRequest) {
  void req;
  try {
    const { userId, unauthorizedResponse } = await requireSignedInUser();
    if (unauthorizedResponse) {
      if (unauthorizedResponse.status !== 401) return unauthorizedResponse;
      return fail(401, "Please sign in before accessing Walmart drafts.", "UNAUTHORIZED");
    }
    if (!userId) {
      return fail(401, "Please sign in before accessing Walmart drafts.", "UNAUTHORIZED");
    }
    const drafts = listDrafts().filter(
      (draft) => !draft.createdBy || draft.createdBy === userId
    );
    return ok({ ok: true, drafts });
  } catch (error) {
    return fail(500, error instanceof Error ? error.message : "Failed to list drafts.");
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId, unauthorizedResponse } = await requireSignedInUser();
    if (unauthorizedResponse) {
      if (unauthorizedResponse.status !== 401) return unauthorizedResponse;
      return fail(401, "Please sign in before saving Walmart drafts.", "UNAUTHORIZED");
    }
    if (!userId) {
      return fail(401, "Please sign in before saving Walmart drafts.", "UNAUTHORIZED");
    }

    const body = (await req.json().catch(() => ({}))) as {
      sku?: string;
      draftPayload?: Record<string, unknown>;
    };

    if (!body.sku || typeof body.sku !== "string") {
      return fail(400, "sku is required.", "BAD_REQUEST");
    }

    if (!body.draftPayload || typeof body.draftPayload !== "object") {
      return fail(400, "draftPayload is required.", "BAD_REQUEST");
    }

    let productOverride = null;
    try {
      productOverride = await getPersistedWalmartProductBySku(userId, body.sku);
    } catch (error) {
      return fail(
        500,
        error instanceof Error
          ? error.message
          : "Draft could not be saved because product lookup failed."
      );
    }

    const allowRuntimeProductLookup = process.env.NODE_ENV === "test";
    if (!productOverride && !allowRuntimeProductLookup) {
      return fail(
        404,
        "Draft could not be saved because the product record was not found.",
        "PRODUCT_NOT_FOUND"
      );
    }

    let draft;
    try {
      draft = upsertDraftForSku({
        sku: body.sku,
        draftPayload: body.draftPayload,
        createdBy: userId,
        productOverride,
      });
    } catch (error) {
      if (isUnknownSkuError(error)) {
        return fail(
          404,
          "Draft could not be saved because the product record was not found.",
          "PRODUCT_NOT_FOUND"
        );
      }
      throw error;
    }
    return ok({ ok: true, draft }, 201);
  } catch (error) {
    return fail(500, error instanceof Error ? error.message : "Failed to save draft.");
  }
}

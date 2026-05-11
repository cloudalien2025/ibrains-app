export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { fail, ok } from "@/app/api/ecomviper/walmart/_utils/response";
import { requireSignedInUser } from "@/lib/auth/requireSignedInUser";
import { getWalmartProductBySkuForUser } from "@/lib/ecomviper/walmart/walmart-products";
import { enrichProductImagesFromPublicWalmartListing } from "@/lib/ecomviper/walmart/serpapi-walmart-images";

function toHttpStatusFromErrorCode(errorCode: string | undefined): number {
  if (!errorCode) return 500;
  if (errorCode === "SERPAPI_NOT_CONNECTED") return 400;
  if (errorCode === "INVALID_PUBLIC_WALMART_URL") return 400;
  if (errorCode === "INVALID_PUBLIC_WALMART_PRODUCT_ID") return 400;
  if (errorCode === "SERPAPI_INVALID_KEY") return 401;
  if (errorCode === "SERPAPI_FORBIDDEN") return 403;
  if (errorCode === "SERPAPI_BAD_REQUEST") return 400;
  if (errorCode === "SERPAPI_AUTH_FAILED") return 502;
  if (errorCode === "SERPAPI_RATE_LIMITED") return 429;
  if (errorCode === "SERPAPI_AMBIGUOUS_MATCH") return 409;
  if (errorCode === "SERPAPI_PROVIDER_ERROR") return 502;
  if (errorCode === "SERPAPI_NETWORK_ERROR") return 503;
  if (errorCode === "SERPAPI_MALFORMED_RESPONSE") return 502;
  if (errorCode === "SERPAPI_NOT_FOUND" || errorCode === "SERPAPI_NO_IMAGES_FOUND") return 404;
  return 502;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sku: string }> | { sku: string } }
) {
  try {
    const { userId, unauthorizedResponse } = await requireSignedInUser();
    if (unauthorizedResponse) {
      if (unauthorizedResponse.status !== 401) return unauthorizedResponse;
      return fail(401, "Please sign in before resolving product images.", "UNAUTHORIZED");
    }
    if (!userId) {
      return fail(401, "Please sign in before resolving product images.", "UNAUTHORIZED");
    }

    const { sku } = await Promise.resolve(params);
    const product = await getWalmartProductBySkuForUser(userId, sku);
    if (!product) {
      return fail(404, `SKU ${sku} was not found in your local EcomViper catalog.`, "PRODUCT_NOT_FOUND");
    }

    const body = (await req.json().catch(() => ({}))) as {
      publicWalmartUrl?: unknown;
      publicWalmartProductId?: unknown;
    };

    const resolution = await enrichProductImagesFromPublicWalmartListing({
      userId,
      product,
      publicWalmartUrl: typeof body.publicWalmartUrl === "string" ? body.publicWalmartUrl : undefined,
      publicWalmartProductId:
        typeof body.publicWalmartProductId === "string" ? body.publicWalmartProductId : undefined,
    });

    if (resolution.imageSyncStatus !== "found") {
      return fail(
        toHttpStatusFromErrorCode(resolution.errorCode),
        resolution.statusReason,
        resolution.errorCode ?? "RESOLVE_FAILED"
      );
    }

    return ok({
      ok: true,
      sku: product.sku,
      resolved: {
        imageSyncStatus: resolution.imageSyncStatus,
        imageSource: resolution.imageSource,
        imageSourceLabel: "Public Walmart listing via SerpApi",
        imageMatchMethod: resolution.imageMatchMethod,
        publicWalmartUrl: resolution.publicWalmartUrl,
        publicWalmartProductId: resolution.publicWalmartProductId,
        primaryImageUrl: resolution.primaryImageUrl,
        galleryImageUrls: resolution.galleryImageUrls,
        variantImageUrls: resolution.variantImageUrls,
        imageCount: resolution.galleryImageUrls.length,
        imageSyncReason: resolution.statusReason,
        lastImageSyncedAt: resolution.lastImageSyncedAt,
        diagnostics: resolution.diagnostics,
      },
    });
  } catch (error) {
    return fail(500, error instanceof Error ? error.message : "Failed to resolve public listing images.", "RESOLVE_FAILED");
  }
}

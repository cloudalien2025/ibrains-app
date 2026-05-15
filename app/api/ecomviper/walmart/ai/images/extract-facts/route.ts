export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { fail, ok } from "@/app/api/ecomviper/walmart/_utils/response";
import { requireSignedInUser } from "@/lib/auth/requireSignedInUser";
import { getWalmartOpenAiApiKeyForUser } from "@/lib/ecomviper/walmart/walmart-openai-connection";
import { getWalmartProductBySkuForUser } from "@/lib/ecomviper/walmart/walmart-products";
import { getProductBySku } from "@/lib/ecomviper/walmart/walmart-store";
import { mergeWalmartDraftPayloadIntoProduct } from "@/lib/ecomviper/walmart/walmart-listing-quality";
import {
  buildVisionExtractionFactPayload,
  deriveSearchBrowseFromVisionExtraction,
  extractWalmartVisionFactsFromProduct,
} from "@/lib/ecomviper/walmart/walmart-vision-label-extraction";

interface ExtractFactsRequestBody {
  sku?: unknown;
  draftPayload?: unknown;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(req: NextRequest) {
  try {
    const { userId, unauthorizedResponse } = await requireSignedInUser();
    if (unauthorizedResponse) {
      if (unauthorizedResponse.status !== 401) return unauthorizedResponse;
      return fail(401, "Please sign in before extracting Walmart label facts.", "UNAUTHORIZED");
    }
    if (!userId) {
      return fail(401, "Please sign in before extracting Walmart label facts.", "UNAUTHORIZED");
    }

    const body = (await req.json().catch(() => ({}))) as ExtractFactsRequestBody;
    const sku = asString(body.sku);
    if (!sku) {
      return fail(400, "sku is required.", "BAD_REQUEST");
    }

    const product =
      (await getWalmartProductBySkuForUser(userId, sku)) ??
      (process.env.NODE_ENV === "test" ? getProductBySku(sku) : null);

    if (!product) {
      return fail(404, `Product not found for SKU: ${sku}`, "NOT_FOUND");
    }

    const mergedProduct = mergeWalmartDraftPayloadIntoProduct(product, body.draftPayload);
    const openAiApiKey = await getWalmartOpenAiApiKeyForUser(userId);

    const extraction = await extractWalmartVisionFactsFromProduct({
      product: mergedProduct,
      openAiApiKey,
    });

    return ok({
      ok: true,
      sku,
      extraction,
      visionFactPayload: buildVisionExtractionFactPayload(extraction),
      mappedSearchBrowseAttributes: deriveSearchBrowseFromVisionExtraction(extraction),
    });
  } catch (error) {
    return fail(
      500,
      error instanceof Error
        ? error.message
        : "Failed to extract label facts from product images.",
      "VISION_EXTRACTION_FAILED"
    );
  }
}

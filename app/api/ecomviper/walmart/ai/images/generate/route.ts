export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { fail, ok } from "@/app/api/ecomviper/walmart/_utils/response";
import { requireSignedInUser } from "@/lib/auth/requireSignedInUser";
import { getWalmartOpenAiApiKeyForUser } from "@/lib/ecomviper/walmart/walmart-openai-connection";
import { getWalmartProductBySkuForUser } from "@/lib/ecomviper/walmart/walmart-products";
import { getProductBySku } from "@/lib/ecomviper/walmart/walmart-store";
import { mergeWalmartDraftPayloadIntoProduct } from "@/lib/ecomviper/walmart/walmart-listing-quality";
import {
  WalmartImageGenerationError,
  generateWalmartProductImage,
} from "@/lib/ecomviper/walmart/walmart-generated-image-generator";
import { saveGeneratedWalmartMediaForUser } from "@/lib/ecomviper/walmart/walmart-generated-media-store";
import type { WalmartGeneratedImageType } from "@/lib/ecomviper/walmart/walmart-types";

interface GenerateWalmartImageRequestBody {
  sku?: unknown;
  imageType?: unknown;
  styleGuidance?: unknown;
  quantity?: unknown;
  draftPayload?: unknown;
}

function asText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  return "";
}

function parseImageType(value: unknown): WalmartGeneratedImageType | null {
  const normalized = asText(value);
  if (
    normalized === "lifestyle" ||
    normalized === "supplement_facts" ||
    normalized === "ingredient_spotlight" ||
    normalized === "product_hero"
  ) {
    return normalized;
  }
  return null;
}

function parseQuantity(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(1, Math.min(3, Math.floor(value)));
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return Math.max(1, Math.min(3, Math.floor(parsed)));
    }
  }
  return 1;
}

export async function POST(req: NextRequest) {
  let requestImageType: WalmartGeneratedImageType | null = null;
  let requestQuantity = 1;
  let requestStyleGuidanceLength = 0;

  try {
    const { userId, unauthorizedResponse } = await requireSignedInUser();
    if (unauthorizedResponse) {
      if (unauthorizedResponse.status !== 401) return unauthorizedResponse;
      return fail(401, "Please sign in before generating Walmart product images.", "UNAUTHORIZED");
    }
    if (!userId) {
      return fail(401, "Please sign in before generating Walmart product images.", "UNAUTHORIZED");
    }

    const body = (await req.json().catch(() => ({}))) as GenerateWalmartImageRequestBody;
    const sku = asText(body.sku);
    if (!sku) {
      return fail(400, "sku is required.", "BAD_REQUEST");
    }

    const imageType = parseImageType(body.imageType);
    if (!imageType) {
      return fail(
        400,
        "imageType must be one of lifestyle, supplement_facts, ingredient_spotlight, or product_hero.",
        "BAD_REQUEST"
      );
    }
    requestImageType = imageType;
    const styleGuidance = asText(body.styleGuidance);
    const quantity = parseQuantity(body.quantity);
    requestQuantity = quantity;
    requestStyleGuidanceLength = styleGuidance.length;

    const openAiApiKey = await getWalmartOpenAiApiKeyForUser(userId);
    if (!openAiApiKey) {
      return fail(
        400,
        "Connect your OpenAI API key first to generate product images.",
        "OPENAI_NOT_CONNECTED"
      );
    }

    const product =
      (await getWalmartProductBySkuForUser(userId, sku)) ??
      (process.env.NODE_ENV === "test" ? getProductBySku(sku) : null);
    if (!product) {
      return fail(404, `Product not found for SKU: ${sku}`, "NOT_FOUND");
    }

    const mergedProduct = mergeWalmartDraftPayloadIntoProduct(product, body.draftPayload);
    const generatedAssets: Array<{
      id: string;
      url: string;
      source: "openai_generated";
      imageType: WalmartGeneratedImageType;
      createdAt: string;
      promptSummary?: string;
      guidance?: string;
      approved: boolean;
    }> = [];

    for (let index = 0; index < quantity; index += 1) {
      const generated = await generateWalmartProductImage({
        openAiApiKey,
        product: mergedProduct,
        imageType,
        styleGuidance,
      });
      const saved = await saveGeneratedWalmartMediaForUser({
        userId,
        sku,
        imageBytes: generated.imageBytes,
        mimeType: generated.mimeType,
        imageType: generated.imageType,
        promptSummary: generated.promptSummary,
        guidance: styleGuidance || undefined,
      });
      generatedAssets.push({
        id: saved.assetId,
        url: `${req.nextUrl.origin}/api/ecomviper/walmart/generated-media/${saved.assetId}`,
        source: "openai_generated",
        imageType: saved.imageType,
        createdAt: saved.createdAt,
        promptSummary: saved.promptSummary,
        guidance: saved.guidance,
        approved: false,
      });
    }

    return ok({
      ok: true,
      sku,
      imageType,
      generated: generatedAssets,
      message: "Generated product image previews are ready.",
    });
  } catch (error) {
    if (error instanceof WalmartImageGenerationError) {
      const status =
        typeof error.statusCode === "number"
          ? error.statusCode
          : error.code === "INSUFFICIENT_SUPPLEMENT_FACTS"
            ? 400
            : 502;
      return NextResponse.json(
        {
          error: {
            code: error.code,
            category: error.category ?? "provider_error",
            statusCode: status,
            message: error.message,
            recommendation:
              error.recommendation ??
              "Retry generation. If this persists, test OpenAI connection settings in Connect.",
            provider: {
              type: error.providerErrorType ?? null,
              param: error.providerErrorParam ?? null,
            },
            requestDiagnostics: {
              imageType: requestImageType,
              quantity: requestQuantity,
              styleGuidanceLength: requestStyleGuidanceLength,
              promptLength: error.promptLength ?? null,
              model: error.requestModel ?? null,
              size: error.requestSize ?? null,
            },
          },
        },
        { status }
      );
    }
    const message =
      error instanceof Error ? error.message : "Failed to generate Walmart product images.";
    return fail(502, message, "IMAGE_GENERATION_FAILED");
  }
}

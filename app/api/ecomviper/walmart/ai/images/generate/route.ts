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
import { resolveEcomViperPublicAppOrigin } from "@/lib/ecomviper/walmart/walmart-public-app-origin";
import { saveGeneratedWalmartMediaForUser } from "@/lib/ecomviper/walmart/walmart-generated-media-store";
import {
  buildGeneratedMediaAltText,
  buildGeneratedMediaPreviewPath,
  buildGeneratedMediaSeoFilename,
} from "@/lib/ecomviper/walmart/walmart-generated-media-seo";
import type {
  WalmartGeneratedImageReferenceInput,
  WalmartGeneratedImageType,
} from "@/lib/ecomviper/walmart/walmart-types";

interface GenerateWalmartImageRequestBody {
  sku?: unknown;
  imageType?: unknown;
  styleGuidance?: unknown;
  quantity?: unknown;
  referenceImages?: unknown;
  draftPayload?: unknown;
}

function asText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  return "";
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function asNonNegativeInteger(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return Math.floor(value);
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return Math.floor(parsed);
    }
  }
  return null;
}

function normalizeMimeType(value: unknown): string {
  const normalized = asText(value).toLowerCase().split(";")[0] || "";
  if (normalized === "image/jpg") return "image/jpeg";
  return normalized;
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

function parseReferenceImages(value: unknown): WalmartGeneratedImageReferenceInput[] {
  if (!Array.isArray(value)) return [];
  const normalized: WalmartGeneratedImageReferenceInput[] = [];
  const seen = new Set<string>();
  for (const candidate of value) {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) continue;
    const row = candidate as Record<string, unknown>;
    const source =
      row.source === "uploaded" || row.source === "product_media"
        ? row.source
        : "uploaded";
    const url = asText(row.url);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    normalized.push({
      source,
      url,
      label: asText(row.label) || undefined,
      mimeType: normalizeMimeType(row.mimeType) || undefined,
      byteSize: (() => {
        const parsed = asNumber(row.byteSize);
        if (parsed === null || parsed <= 0) return undefined;
        return Math.floor(parsed);
      })(),
    });
    if (normalized.length >= 4) break;
  }
  return normalized;
}

export async function POST(req: NextRequest) {
  let requestImageType: WalmartGeneratedImageType | null = null;
  let requestQuantity = 1;
  let requestStyleGuidanceLength = 0;
  let requestReferenceCount = 0;
  let requestReferenceMimeTypes: string[] = [];
  let requestReferenceByteSizes: number[] = [];
  let requestGenerationMode: string | null = null;
  let requestRoutePhase = "route_input";
  let requestModel: string | null = null;
  let requestSize: string | null = null;
  let requestPromptLength: number | null = null;
  let requestLayoutMode: string | null = null;
  let requestUserGuidanceIncluded: boolean | null = null;
  let requestLayoutPreservationInstruction: boolean | null = null;
  let requestProductFactsSource: string | null = null;

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
    const referenceImages = parseReferenceImages(body.referenceImages);
    requestQuantity = quantity;
    requestStyleGuidanceLength = styleGuidance.length;
    requestReferenceCount = referenceImages.length;
    requestReferenceMimeTypes = referenceImages
      .map((entry) => normalizeMimeType(entry.mimeType))
      .filter(Boolean);
    requestReferenceByteSizes = referenceImages
      .map((entry) => entry.byteSize ?? 0)
      .filter((size) => Number.isFinite(size) && size > 0)
      .map((size) => Math.floor(size));

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
    requestRoutePhase = "provider_generation";
    const generatedAssets: Array<{
      id: string;
      url: string;
      previewUrl: string;
      source: "openai_generated";
      imageType: WalmartGeneratedImageType;
      createdAt: string;
      promptSummary?: string;
      guidance?: string;
      seoFilename?: string;
      altText?: string;
      productSku?: string;
      brand?: string;
      approvedForWalmart?: boolean;
      width?: number;
      height?: number;
      isSquare?: boolean;
      squareNormalized?: boolean;
      approved: boolean;
    }> = [];
    let generationDiagnostics: {
      imageType: WalmartGeneratedImageType;
      generationMode: string;
      model: string;
      size: string;
      promptLength: number;
      referenceCount: number;
      referenceMimeTypes: string[];
      referenceByteSizes: number[];
      layoutMode?: string;
      userGuidanceIncluded?: boolean;
      layoutPreservationInstruction?: boolean;
      productFactsSource?: string;
      width?: number;
      height?: number;
      isSquare?: boolean;
      squareNormalized?: boolean;
    } | null = null;
    const publicOrigin = resolveEcomViperPublicAppOrigin(req);
    const productTitle = asText(mergedProduct.title);
    const productBrand = asText(mergedProduct.brand);
    const productSku = asText(mergedProduct.sku) || sku;

    for (let index = 0; index < quantity; index += 1) {
      const generated = await generateWalmartProductImage({
        openAiApiKey,
        product: mergedProduct,
        imageType,
        styleGuidance,
        referenceImages,
      });
      requestGenerationMode = generated.generationMode;
      requestModel = generated.requestModel;
      requestSize = generated.requestSize;
      requestPromptLength = generated.promptLength;
      requestReferenceMimeTypes = generated.referenceMimeTypes;
      requestReferenceByteSizes = generated.referenceByteSizes;
      requestLayoutMode = generated.layoutMode ?? null;
      requestUserGuidanceIncluded =
        typeof generated.userGuidanceIncluded === "boolean"
          ? generated.userGuidanceIncluded
          : null;
      requestLayoutPreservationInstruction =
        typeof generated.layoutPreservationInstruction === "boolean"
          ? generated.layoutPreservationInstruction
          : null;
      requestProductFactsSource = generated.productFactsSource ?? null;
      generationDiagnostics = {
        imageType: generated.imageType,
        generationMode: generated.generationMode,
        model: generated.requestModel,
        size: generated.requestSize,
        promptLength: generated.promptLength,
        referenceCount: generated.referenceCount,
        referenceMimeTypes: generated.referenceMimeTypes,
        referenceByteSizes: generated.referenceByteSizes,
        layoutMode: generated.layoutMode ?? undefined,
        userGuidanceIncluded: generated.userGuidanceIncluded,
        layoutPreservationInstruction: generated.layoutPreservationInstruction,
        productFactsSource: generated.productFactsSource ?? undefined,
        width: asNonNegativeInteger(generated.width) ?? undefined,
        height: asNonNegativeInteger(generated.height) ?? undefined,
        isSquare: generated.isSquare,
        squareNormalized: generated.squareNormalized,
      };
      requestRoutePhase = "storage_persist";
      const seoFilename = buildGeneratedMediaSeoFilename({
        brand: productBrand || undefined,
        productTitle: productTitle || undefined,
        sku: productSku,
        imageType: generated.imageType,
        mimeType: generated.mimeType,
      });
      const altText = buildGeneratedMediaAltText({
        brand: productBrand || undefined,
        productTitle: productTitle || undefined,
        sku: productSku,
        imageType: generated.imageType,
      });
      const saved = await saveGeneratedWalmartMediaForUser({
        userId,
        sku,
        imageBytes: generated.imageBytes,
        mimeType: generated.mimeType,
        imageType: generated.imageType,
        promptSummary: generated.promptSummary,
        guidance: styleGuidance || undefined,
        seoFilename,
        altText,
        productSku,
        brand: productBrand || undefined,
        approvedForWalmart: false,
        width: asNonNegativeInteger(generated.width) ?? undefined,
        height: asNonNegativeInteger(generated.height) ?? undefined,
        isSquare: generated.isSquare,
        squareNormalized: generated.squareNormalized,
      }).catch(() => {
        throw new WalmartImageGenerationError({
          code: "GENERATED_MEDIA_STORAGE_FAILED",
          message:
            "Generated image storage failed after provider success. Retry generation.",
          statusCode: 502,
          category: "storage_error",
          recommendation:
            "Retry generation. If this persists, check generated-media store/database availability.",
          generationMode: generated.generationMode,
          routePhase: "storage_persist",
          promptLength: generated.promptLength,
          requestModel: generated.requestModel,
          requestSize: generated.requestSize,
          referenceCount: generated.referenceCount,
          referenceMimeTypes: generated.referenceMimeTypes,
          referenceByteSizes: generated.referenceByteSizes,
          layoutMode: generated.layoutMode,
          userGuidanceIncluded: generated.userGuidanceIncluded,
          layoutPreservationInstruction: generated.layoutPreservationInstruction,
          productFactsSource: generated.productFactsSource,
        });
      });
      const previewPath = buildGeneratedMediaPreviewPath(saved.assetId, saved.seoFilename);
      generatedAssets.push({
        id: saved.assetId,
        url: `${publicOrigin}${previewPath}`,
        previewUrl: previewPath,
        source: "openai_generated",
        imageType: saved.imageType,
        createdAt: saved.createdAt,
        promptSummary: saved.promptSummary,
        guidance: saved.guidance,
        seoFilename: saved.seoFilename,
        altText: saved.altText,
        productSku: saved.productSku,
        brand: saved.brand,
        approvedForWalmart: saved.approvedForWalmart,
        width: saved.width,
        height: saved.height,
        isSquare: saved.isSquare,
        squareNormalized: saved.squareNormalized,
        approved: false,
      });
    }

    return ok({
      ok: true,
      sku,
      imageType,
      generated: generatedAssets,
      generationDiagnostics,
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
              referenceCount: requestReferenceCount,
              referenceMimeTypes:
                error.referenceMimeTypes ?? requestReferenceMimeTypes,
              referenceByteSizes:
                error.referenceByteSizes ?? requestReferenceByteSizes,
              styleGuidanceLength: requestStyleGuidanceLength,
              promptLength: error.promptLength ?? requestPromptLength,
              model: error.requestModel ?? requestModel,
              size: error.requestSize ?? requestSize,
              generationMode: error.generationMode ?? requestGenerationMode,
              layoutMode: error.layoutMode ?? requestLayoutMode,
              userGuidanceIncluded:
                typeof error.userGuidanceIncluded === "boolean"
                  ? error.userGuidanceIncluded
                  : requestUserGuidanceIncluded,
              layoutPreservationInstruction:
                typeof error.layoutPreservationInstruction === "boolean"
                  ? error.layoutPreservationInstruction
                  : requestLayoutPreservationInstruction,
              productFactsSource:
                error.productFactsSource ?? requestProductFactsSource,
              routePhase: error.routePhase ?? requestRoutePhase,
            },
          },
        },
        { status }
      );
    }
    const message =
      error instanceof Error ? error.message : "Failed to generate Walmart product images.";
    return NextResponse.json(
      {
        error: {
          code: "IMAGE_GENERATION_FAILED",
          category: "server_error",
          statusCode: 502,
          message,
          recommendation:
            "Retry generation. If this persists, test OpenAI connection settings in Connect.",
          requestDiagnostics: {
            imageType: requestImageType,
            quantity: requestQuantity,
            referenceCount: requestReferenceCount,
            referenceMimeTypes: requestReferenceMimeTypes,
            referenceByteSizes: requestReferenceByteSizes,
            styleGuidanceLength: requestStyleGuidanceLength,
            promptLength: requestPromptLength,
            model: requestModel,
            size: requestSize,
            generationMode: requestGenerationMode,
            layoutMode: requestLayoutMode,
            userGuidanceIncluded: requestUserGuidanceIncluded,
            layoutPreservationInstruction: requestLayoutPreservationInstruction,
            productFactsSource: requestProductFactsSource,
            routePhase: requestRoutePhase,
          },
        },
      },
      { status: 502 }
    );
  }
}

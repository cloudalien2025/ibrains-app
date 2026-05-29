export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { fail, ok } from "@/app/api/ecomviper/walmart/_utils/response";
import { requireSignedInUser } from "@/lib/auth/requireSignedInUser";
import { matchRocktomicBySkus } from "@/lib/ecomviper/dropshipping/rocktomic-supplier-intelligence";
import { getShopifyOpenAiApiKeyForUser } from "@/lib/ecomviper/shopify/openai-connection";
import { generateShopifyPdpIntelligence } from "@/lib/ecomviper/shopify/shopify-pdp-intelligence-generator";
import { evaluateShopifyPdpCompliance } from "@/lib/ecomviper/shopify/shopify-pdp-intelligence-compliance";
import {
  createEmptyShopifyPdpIntelligenceRecord,
  sanitizeShopifyPdpIntelligenceRecord,
  type ShopifyPdpIntelligenceRecord,
} from "@/lib/ecomviper/shopify/shopify-pdp-intelligence";
import {
  getPersistedShopifyPdpIntelligenceForProduct,
  savePersistedShopifyPdpIntelligence,
} from "@/lib/ecomviper/shopify/shopify-pdp-intelligence-repository";
import { buildShopifyProductEditorStateForUser } from "@/lib/ecomviper/shopify/shopify-product-editor-state";

interface PdpIntelligenceRequestBody {
  action?: unknown;
  productReference?: unknown;
  record?: unknown;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function asErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unexpected PDP intelligence error.";
}

async function resolveCurrentProduct(input: { userId: string; productReference: string }) {
  const initialState = await buildShopifyProductEditorStateForUser({
    userId: input.userId,
    productReference: input.productReference,
    demoMode: false,
  });
  if (!initialState.currentShopifyListing) {
    return null;
  }
  return initialState.currentShopifyListing;
}

async function resolvePersistedRecord(input: {
  userId: string;
  productId: string;
  productHandle: string | null;
}): Promise<ShopifyPdpIntelligenceRecord | null> {
  return getPersistedShopifyPdpIntelligenceForProduct({
    userId: input.userId,
    shopifyProductId: input.productId,
    productHandle: input.productHandle,
  });
}

export async function GET(req: NextRequest) {
  try {
    const { userId, unauthorizedResponse } = await requireSignedInUser();
    if (unauthorizedResponse) {
      if (unauthorizedResponse.status !== 401) return unauthorizedResponse;
      return fail(401, "Please sign in before loading PDP intelligence.", "UNAUTHORIZED");
    }
    if (!userId) return fail(401, "Please sign in before loading PDP intelligence.", "UNAUTHORIZED");

    const productReference = asString(req.nextUrl.searchParams.get("productReference"));
    if (!productReference) {
      return fail(400, "productReference is required.", "VALIDATION_ERROR");
    }

    const product = await resolveCurrentProduct({ userId, productReference });
    if (!product) {
      return fail(404, "Product not found for this workspace.", "NOT_FOUND");
    }

    const record = await resolvePersistedRecord({
      userId,
      productId: product.productId,
      productHandle: product.handle || null,
    });

    return ok({
      ok: true,
      productReference,
      intelligence: record,
    });
  } catch (error) {
    return fail(500, asErrorMessage(error));
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId, unauthorizedResponse } = await requireSignedInUser();
    if (unauthorizedResponse) {
      if (unauthorizedResponse.status !== 401) return unauthorizedResponse;
      return fail(401, "Please sign in before updating PDP intelligence.", "UNAUTHORIZED");
    }
    if (!userId) return fail(401, "Please sign in before updating PDP intelligence.", "UNAUTHORIZED");

    const body = (await req.json().catch(() => ({}))) as PdpIntelligenceRequestBody;
    const action = asString(body.action).toLowerCase();
    const productReference = asString(body.productReference);
    if (!productReference) {
      return fail(400, "productReference is required.", "VALIDATION_ERROR");
    }
    if (action !== "generate" && action !== "save") {
      return fail(400, "action must be generate or save.", "VALIDATION_ERROR");
    }

    const product = await resolveCurrentProduct({ userId, productReference });
    if (!product) {
      return fail(404, "Product not found for this workspace.", "NOT_FOUND");
    }

    const existing = await resolvePersistedRecord({
      userId,
      productId: product.productId,
      productHandle: product.handle || null,
    });
    const fallbackRecord = createEmptyShopifyPdpIntelligenceRecord({
      shopifyProductId: product.productId,
      productHandle: product.handle || null,
      supplier: null,
      supplierSku: null,
    });

    if (action === "save") {
      const recordInput = asObject(body.record);
      const sanitized = sanitizeShopifyPdpIntelligenceRecord(
        {
          ...(existing ?? fallbackRecord),
          ...recordInput,
          shopify_product_id: product.productId,
          product_handle: product.handle || null,
          generation_status: "saved",
          last_edited_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        existing ?? fallbackRecord
      );
      const complianceReview = evaluateShopifyPdpCompliance(sanitized);
      const persisted = await savePersistedShopifyPdpIntelligence({
        userId,
        shopifyProductId: product.productId,
        productHandle: product.handle || null,
        record: {
          ...sanitized,
          compliance_review: complianceReview,
        },
      });

      return ok({
        ok: true,
        action: "save",
        intelligence: persisted,
      });
    }

    const skuList = product.variants.map((entry) => entry.sku.trim()).filter(Boolean);
    const supplierMatch = matchRocktomicBySkus(skuList);
    const openAiApiKey = await getShopifyOpenAiApiKeyForUser(userId);

    const generated = await generateShopifyPdpIntelligence({
      product,
      supplierMatch: {
        supplier: supplierMatch.product?.supplier ?? null,
        supplierSku: supplierMatch.matchedSku,
        product: supplierMatch.product,
      },
      existing,
      openAiApiKey,
    });

    const persisted = await savePersistedShopifyPdpIntelligence({
      userId,
      shopifyProductId: product.productId,
      productHandle: product.handle || null,
      record: generated,
    });

    return ok({
      ok: true,
      action: "generate",
      intelligence: persisted,
      generationUnavailable: persisted.generation_status === "generation_unavailable",
      message:
        persisted.generation_status === "generation_unavailable"
          ? "generation unavailable: missing server configuration"
          : null,
    });
  } catch (error) {
    return fail(500, asErrorMessage(error));
  }
}

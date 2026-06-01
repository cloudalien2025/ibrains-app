export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { fail, ok } from "@/app/api/ecomviper/walmart/_utils/response";
import { requireSignedInUser } from "@/lib/auth/requireSignedInUser";
import { getShopifyOpenAiApiKeyForUser } from "@/lib/ecomviper/shopify/openai-connection";
import { buildProductCopywritingInputFromShopifyEditorState } from "@/lib/ecomviper/copywriting-agent/copywriting-agent-input-builder";
import { runProductCopywritingAgent } from "@/lib/ecomviper/copywriting-agent/copywriting-agent-runner";
import type { ProductCopywritingOutput } from "@/lib/ecomviper/copywriting-agent/copywriting-agent-types";
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

function toArray(value: string[] | null | undefined): string[] {
  return Array.isArray(value) ? value.map((entry) => asString(entry)).filter(Boolean) : [];
}

function mapRunStatusToGenerationStatus(
  status: "success" | "validation_error" | "model_error" | "unavailable" | "blocked"
): ShopifyPdpIntelligenceRecord["generation_status"] {
  if (status === "success") return "generated";
  if (status === "unavailable") return "generation_unavailable";
  return "failed";
}

function toReviewRecord(input: {
  base: ShopifyPdpIntelligenceRecord;
  output: ProductCopywritingOutput | null;
  status: "success" | "validation_error" | "model_error" | "unavailable" | "blocked";
  safeMessage: string;
  missingDataNotices: string[];
  complianceWarnings: string[];
  generatedAt: string;
}): ShopifyPdpIntelligenceRecord {
  const output = input.output;
  const mergedNotes = toArray([
    ...input.complianceWarnings,
    ...input.missingDataNotices,
    input.safeMessage,
  ]);

  if (!output) {
    return sanitizeShopifyPdpIntelligenceRecord(
      {
        ...input.base,
        generation_status: mapRunStatusToGenerationStatus(input.status),
        compliance_notes: mergedNotes,
        warnings_text: toArray([...input.base.warnings_text, ...input.complianceWarnings]),
        last_generated_at: input.generatedAt,
        updated_at: input.generatedAt,
      },
      input.base
    );
  }

  return sanitizeShopifyPdpIntelligenceRecord(
    {
      ...input.base,
      ai_product_summary: output.shortDescription || output.fullDescription || output.listingSubtitle,
      key_features: output.benefitBullets,
      ingredient_highlights: output.ingredientHighlights,
      use_cases: output.agenticVisibilitySignals.primaryIntents,
      trust_signals: output.agenticVisibilitySignals.trustSignals,
      compliance_safe_claims: output.benefitBullets,
      comparison_content: output.agenticVisibilitySignals.comparisonHooks.join("; "),
      agentic_selection_notes: output.agenticVisibilitySignals.faqCoverage.join("; "),
      warnings_text: toArray([...output.complianceWarnings, ...input.complianceWarnings]),
      compliance_notes: mergedNotes,
      seo_title: output.metaTitle,
      meta_description: output.metaDescription,
      faqs: output.faqSuggestions.map((faq) => ({
        question: faq.question,
        answer: faq.answer,
        category: "review",
        schema_eligible: true,
        compliance_status: "review_required",
      })),
      generation_status: mapRunStatusToGenerationStatus(input.status),
      last_generated_at: input.generatedAt,
      updated_at: input.generatedAt,
    },
    input.base
  );
}

async function resolveCurrentEditorState(input: { userId: string; productReference: string }) {
  const initialState = await buildShopifyProductEditorStateForUser({
    userId: input.userId,
    productReference: input.productReference,
    demoMode: false,
  });
  if (!initialState.currentShopifyListing) {
    return null;
  }
  return initialState;
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

    const editorState = await resolveCurrentEditorState({ userId, productReference });
    if (!editorState?.currentShopifyListing) {
      return fail(404, "Product not found for this workspace.", "NOT_FOUND");
    }
    const product = editorState.currentShopifyListing;

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

    const editorState = await resolveCurrentEditorState({ userId, productReference });
    if (!editorState?.currentShopifyListing) {
      return fail(404, "Product not found for this workspace.", "NOT_FOUND");
    }
    const product = editorState.currentShopifyListing;
    const sourceFacts = editorState.sourceFacts ?? null;
    const supplierProduct = editorState.supplierContext?.product ?? null;

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

    const supplierFactsSynced = Boolean(sourceFacts?.supplierProductRecordFound && supplierProduct);
    const openAiApiKey = await getShopifyOpenAiApiKeyForUser(userId);
    const generatedAt = new Date().toISOString();
    const copywritingInput = buildProductCopywritingInputFromShopifyEditorState(editorState);
    if (!copywritingInput) {
      return fail(400, "Product copywriting input could not be prepared.", "VALIDATION_ERROR");
    }
    const runResult = await runProductCopywritingAgent({
      copywritingInput,
      openAiApiKey,
    });
    const reviewRecord = toReviewRecord({
      base: existing ?? fallbackRecord,
      output: runResult.output,
      status: runResult.status,
      safeMessage: runResult.safeMessage,
      missingDataNotices: runResult.missingDataNotices,
      complianceWarnings: runResult.complianceWarnings,
      generatedAt,
    });

    return ok({
      ok: true,
      action: "generate",
      intelligence: reviewRecord,
      reviewOnly: true,
      copywriting: {
        status: runResult.status,
        output: runResult.output,
        missingDataNotices: runResult.missingDataNotices,
        complianceWarnings: runResult.complianceWarnings,
        errorCode: runResult.errorCode,
        safeMessage: runResult.safeMessage,
        generationMetadata: runResult.generationMetadata,
      },
      diagnostics: {
        normalized_sku: sourceFacts?.normalizedSku || null,
        supplier_product_record_status: sourceFacts?.supplierProductRecordFound ? "synced" : "missing",
        pricing_record_status: sourceFacts?.pricingRecordFound ? "synced" : "missing",
        inventory_record_status: sourceFacts?.inventoryRecordFound ? "synced" : "missing",
        asset_record_status: sourceFacts?.assetsRecordFound ? "synced" : "missing",
        selected_membership_tier: sourceFacts?.selectedMembershipTier || null,
        source_facts_used: supplierFactsSynced,
        supplement_facts_status: sourceFacts?.supplementFacts?.status || "missing",
        coa_link_status: sourceFacts?.assets?.coaLinkStatus || "not_present",
        generated_from_source_version: supplierProduct?.sourceVersion || "shopify_limited",
        stale_intelligence_before_generation: sourceFacts?.staleIntelligence || false,
      },
      sourceFactsUsed: supplierFactsSynced,
      supplierProductRecordStatus: sourceFacts?.supplierProductRecordFound ? "synced" : "missing",
      pricingRecordStatus: sourceFacts?.pricingRecordFound ? "synced" : "missing",
      inventoryRecordStatus: sourceFacts?.inventoryRecordFound ? "synced" : "missing",
      assetRecordStatus: sourceFacts?.assetsRecordFound ? "synced" : "missing",
      supplementFactsStatus: sourceFacts?.supplementFacts?.status ?? "missing",
      coaStatus: sourceFacts?.assets?.coaStatus ?? "missing",
      generationUnavailable: runResult.status === "unavailable",
      message:
        !supplierFactsSynced
          ? "Supplier facts not synced. Generated proposal uses available Shopify facts."
          : runResult.safeMessage,
    });
  } catch (error) {
    return fail(500, asErrorMessage(error));
  }
}

import { applySelectionFilters, loadAllRocktomicProductInputs } from "../../lib/ecomviper/copywriting-agent/copywriting-agent-data";
import { buildProductCopywritingInputFromShopifyEditorState } from "../../lib/ecomviper/copywriting-agent/copywriting-agent-input-builder";
import { hydrateLiveSupplierFactsForCopywriting } from "../../lib/ecomviper/copywriting-agent/live-supplier-facts-hydration";
import type { ShopifyProductEditorInitialState } from "../../lib/ecomviper/shopify/shopify-product-editor-state";

interface CliOptions {
  skus: string[];
}

function parseArgs(argv: string[]): CliOptions {
  let sku = "ROC123";
  let compareSku: string | null = null;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--sku" && argv[i + 1]) {
      sku = argv[i + 1].trim();
      i += 1;
    } else if (argv[i] === "--compare-sku" && argv[i + 1]) {
      compareSku = argv[i + 1].trim();
      i += 1;
    }
  }
  return { skus: compareSku ? [sku, compareSku] : [sku] };
}

function normalizeSku(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function buildDegradedLiveStateFromInput(input: NonNullable<Awaited<ReturnType<typeof loadAllRocktomicProductInputs>>[number]["input"]>): ShopifyProductEditorInitialState {
  const sku = input.variants[0]?.sku || null;
  const hasImageEvidence = input.sourceEvidence.supplementFactsImagePresent || input.sourceEvidence.labelEvidencePresent;

  return {
    productReference: input.productIdentity.handle || input.productIdentity.productId,
    productFound: true,
    notFoundMessage: null,
    source: "live_shopify",
    sourceLabel: "Live Shopify API",
    hydrationMode: "live",
    currentShopifyListing: {
      productId: input.productIdentity.productId,
      title: input.productIdentity.title,
      handle: input.productIdentity.handle || "",
      status: "active",
      vendor: input.productIdentity.vendor || "",
      productType: input.productIdentity.productType || "",
      tags: input.productIdentity.tags,
      collections: [],
      descriptionText: input.currentListing.descriptionText,
      descriptionHtml: input.currentListing.descriptionHtml,
      seoTitle: input.currentListing.metaTitle,
      seoDescription: input.currentListing.metaDescription,
      productUrl: "",
      canonicalUrl: "",
      primaryImageUrl: input.images.selectedPrimaryImageUrl || "",
      images: input.images.items.map((item) => ({
        id: item.id,
        url: item.url,
        altText: item.altText || "",
        source: "product" as const,
      })),
      variants: input.variants.map((variant, index) => ({
        id: `v${index}`,
        title: "Default",
        sku: variant.sku || "",
        barcode: variant.barcode || "",
        price: variant.price,
        compareAtPrice: variant.compareAtPrice,
        inventoryQuantity: variant.inventory,
      })),
      metafields: [],
      source: "live_shopify",
      sourceLabel: "Live Shopify API",
      hydrationMode: "live",
      lastSyncedAt: null,
      fetchedAt: new Date().toISOString(),
    },
    optimizedShopifyProposal: null,
    editableShopifyDraft: null,
    openAiConnected: false,
    openAiStatusLabel: "Not connected",
    lastSyncedAt: null,
    warnings: [],
    pdpIntelligence: null,
    supplierFactsPanel: null,
    supplierContext: {
      matched: true,
      matchedSku: sku,
      matchConfidence: 1,
      matchReason: "exact_supplier_sku_match",
      platform: "rocktomic",
      syncStatus: "synced",
      syncRequired: false,
      syncMessage: null,
      inventoryAvailable: true,
      lastSupplierCheckAt: null,
      product: {
        supplier: "Rocktomic",
        sku: sku || "",
        productName: input.supplierContext.supplierProductName || input.productIdentity.title,
        category: input.productIdentity.category || "",
        labelSize: null,
        containerSize: null,
        productWeight: null,
        servingSize: null,
        servingsPerContainer: null,
        activeIngredients: [],
        amountPerServing: null,
        ingredientHighlights: [],
        productFeatures: [],
        otherIngredients: null,
        allergenDietaryAttributes: [],
        sourceDiagnostics: [],
        coaLinkStatus: input.sourceEvidence.coaPresent ? "extracted" : "not_present",
        coaLinkError: null,
        coa: { status: input.sourceEvidence.coaPresent ? "available" : "pending_source", url: input.sourceEvidence.coaUrl },
        labelTemplate: { status: hasImageEvidence ? "available" : "pending_source", url: null },
        mockup: { status: hasImageEvidence ? "available" : "pending_source", url: null },
        certifications: [],
        dietaryAttributes: [],
        manufacturingClaims: [],
        supplementFacts: { status: hasImageEvidence ? "ocr_required" : "not_available", value: null },
        suggestedUse: { status: "pending_source", value: null },
        warnings: { status: "pending_source", value: null },
        inventoryStatus: "in_stock",
        discontinuedStatus: "active",
        pricingStatus: "current",
        policyStatus: "available",
        lastSyncedAt: new Date().toISOString(),
        sourceVersion: "live-parity-check",
        sourceUpdatedAt: new Date().toISOString(),
      },
    },
    sourceFacts: {
      shopifyProductId: input.productIdentity.productId,
      shopifyProductHandle: input.productIdentity.handle || null,
      shopifySku: sku,
      normalizedSku: sku ? normalizeSku(sku) : "",
      supplierProductRecordFound: true,
      pricingRecordFound: !input.missingData.pricingMissing,
      inventoryRecordFound: !input.missingData.inventoryMissing,
      assetsRecordFound: hasImageEvidence || input.sourceEvidence.coaPresent,
      selectedMembershipTier: null,
      effectiveMembershipTier: null,
      usingDefaultMembershipTier: false,
      detectedMembershipTiers: [],
      lastGlobalSupplierSyncAt: null,
      lastGeneratedIntelligenceAt: null,
      staleIntelligence: false,
      supplementFacts: { status: hasImageEvidence ? "ocr_required" : "source_missing", value: "", displayText: "" },
      activeIngredients: { status: "ocr_required", values: [], displayText: "" },
      amountPerServing: { status: "ocr_required", value: "", displayText: "" },
      otherIngredients: { status: "source_missing", value: "", displayText: "" },
      servingSize: { status: "source_missing", value: "", displayText: "" },
      servingsPerContainer: { status: "source_missing", value: "", displayText: "" },
      dietaryAllergenAttributes: { status: "source_missing", values: [], displayText: "" },
      keyProductFeatures: { status: "source_missing", values: [], displayText: "" },
      certifications: { status: "source_missing", values: [], displayText: "" },
      manufacturingClaims: { status: "source_missing", values: [], displayText: "" },
      testingClaims: { status: "source_missing", values: [], displayText: "" },
      commerce: {
        shopifyPrice: input.variants[0]?.price ?? null,
        compareAtPrice: input.variants[0]?.compareAtPrice ?? null,
        wholesaleCost: null,
        msrp: null,
        estimatedProfit: null,
        marginPercent: null,
        currency: "USD",
        pricingStatusLabel: "unknown",
        message: "parity check",
      },
      inventory: { status: "in_stock", displayText: "in stock" },
      assets: {
        coaUrl: input.sourceEvidence.coaUrl,
        labelTemplateUrl: null,
        mockupUrl: null,
        coaStatus: input.sourceEvidence.coaPresent ? "available" : "missing",
        coaLinkStatus: "not_present",
        message: "parity check",
      },
      missingFields: [],
      diagnostics: [],
    },
  };
}

function imageOnlyReason(input: NonNullable<ReturnType<typeof buildProductCopywritingInputFromShopifyEditorState>>): string | null {
  if (input.sourceEvidence.supplementFactsSource !== "image_only") return null;
  if (!input.sourceEvidence.supplementFactsImagePresent) return "image_only_without_image_evidence";
  if (input.sourceEvidence.structuredSupplementFactsPresent) return "image_only_conflict_structured_present";
  if (input.sourceEvidence.aiLabelTextEvidencePresent) return "image_only_text_evidence_present_but_unstructured";
  return "structured_supplement_facts_not_found";
}

function summarize(
  input: ReturnType<typeof buildProductCopywritingInputFromShopifyEditorState>,
  hydration: Awaited<ReturnType<typeof hydrateLiveSupplierFactsForCopywriting>> | null
) {
  if (!input) return null;
  const imageReason = imageOnlyReason(input);
  return {
    supplierSku: input.supplierContext.supplierSku,
    productHandle: input.productIdentity.handle,
    productTitle: input.productIdentity.title,
    dbReadStatus: hydration
      ? {
          attempted: hydration.readDiagnostics.db.attempted,
          found: hydration.readDiagnostics.db.found,
          errorCode: hydration.readDiagnostics.db.errorCode,
        }
      : null,
    artifactReadStatus: hydration
      ? {
          attempted: hydration.readDiagnostics.artifact.attempted,
          found: hydration.readDiagnostics.artifact.found,
          errorCode: hydration.readDiagnostics.artifact.errorCode,
        }
      : null,
    aiLabelTextStatus: input.sourceEvidence.aiLabelTextEvidenceStatus || "unavailable",
    factsImageStatus: input.sourceEvidence.supplementFactsImagePresent ? "present" : "absent",
    supplementFactsSource: input.sourceEvidence.supplementFactsSource,
    structuredSupplementFactsPresent: input.sourceEvidence.structuredSupplementFactsPresent,
    counts: {
      activeIngredients: input.supplementFacts.activeIngredients.length,
      ingredientAmounts: input.supplementFacts.ingredientAmounts.length,
      otherIngredients: input.supplementFacts.otherIngredients.length,
    },
    servingSizePresent: Boolean(input.supplementFacts.servingSize),
    servingsPerContainerPresent: Boolean(input.supplementFacts.servingsPerContainer),
    missingData: input.missingData,
    sourceFactsUsed: input.sourceEvidence.sourceFactsUsed,
    imageOnlyReason: imageReason,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const records = await loadAllRocktomicProductInputs();
  const reports = await Promise.all(
    options.skus.map(async (sku) => {
      const selected = applySelectionFilters(records, { sku, handle: null, limit: 1 })[0];
      if (!selected) {
        throw new Error(`SKU ${sku} not found in all-product source data.`);
      }

      const offlineSummary = summarize(selected.input, null);
      const degradedState = buildDegradedLiveStateFromInput(selected.input);
      const hydration = await hydrateLiveSupplierFactsForCopywriting(degradedState);
      const liveSummary = summarize(buildProductCopywritingInputFromShopifyEditorState(hydration.state), hydration);

      return {
        sku: normalizeSku(sku),
        offlinePreparePath: offlineSummary,
        liveRouteBuilderPath: liveSummary,
        hydration: {
          supplierFactsReadSource: hydration.supplierFactsReadSource,
          supplierFactsReadFound: hydration.supplierFactsReadFound,
          supplierFactsReadErrorCode: hydration.supplierFactsReadErrorCode,
          dbReadStatus: hydration.readDiagnostics.db,
          artifactReadStatus: hydration.readDiagnostics.artifact,
        },
      };
    })
  );

  console.log(JSON.stringify(reports.length === 1 ? reports[0] : { compare: reports }, null, 2));
}

void main().catch((error) => {
  console.error(`[live-supplier-facts-parity-check] failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});

import "server-only";

import { buildShopifyAgenticDemoWorkspaceState } from "@/lib/ecomviper/shopify/shopify-agentic-demo-data";
import { getShopifyConnectionStatusForUser } from "@/lib/ecomviper/shopify/shopify-connection";
import { hydrateShopifyLiveWorkspaceForUser } from "@/lib/ecomviper/shopify/shopify-live-hydrator";
import { getShopifyOpenAiConnectionStatusForUser } from "@/lib/ecomviper/shopify/openai-connection";
import {
  normalizeRocktomicSku,
  type RocktomicSupplierProduct,
} from "@/lib/ecomviper/dropshipping/rocktomic-supplier-intelligence";
import { matchPrimarySupplierBySkus } from "@/lib/ecomviper/suppliers/supplier-intelligence";
import {
  buildCurrentShopifyListingDocket,
  buildEditableShopifyDraft,
  type ShopifyCurrentListingDocket,
  type ShopifyEditableDraftDocket,
  type ShopifyOptimizedProposalDocket,
} from "@/lib/ecomviper/shopify/shopify-product-docket";
import type { ShopifyPdpIntelligenceRecord } from "@/lib/ecomviper/shopify/shopify-pdp-intelligence";
import { getPersistedShopifyPdpIntelligenceForProduct } from "@/lib/ecomviper/shopify/shopify-pdp-intelligence-repository";
import {
  sourceLabel,
  sourceToHydrationMode,
  type ShopifyWorkspaceHydrationMode,
  type ShopifyWorkspaceSource,
  type ShopifyWorkspaceSourceLabel,
} from "@/lib/ecomviper/shopify/shopify-source-provenance";
import { listShopifyProductsForUser } from "@/lib/ecomviper/shopify/shopify-import";
import type { ShopifyProductRecord } from "@/lib/ecomviper/shopify/shopify-types";

interface BuildProductEditorStateOptions {
  userId: string | null;
  productReference: string;
  demoMode?: boolean;
}

interface ResolvedProduct {
  product: ShopifyProductRecord | null;
  source: ShopifyWorkspaceSource;
  sourceLabel: ShopifyWorkspaceSourceLabel;
  hydrationMode: ShopifyWorkspaceHydrationMode;
  lastSyncedAt: string | null;
  warnings: string[];
}

export interface ShopifyProductEditorInitialState {
  productReference: string;
  productFound: boolean;
  notFoundMessage: string | null;
  source: ShopifyWorkspaceSource;
  sourceLabel: ShopifyWorkspaceSourceLabel;
  hydrationMode: ShopifyWorkspaceHydrationMode;
  currentShopifyListing: ShopifyCurrentListingDocket | null;
  optimizedShopifyProposal: ShopifyOptimizedProposalDocket | null;
  editableShopifyDraft: ShopifyEditableDraftDocket | null;
  openAiConnected: boolean;
  openAiStatusLabel: string;
  lastSyncedAt: string | null;
  warnings: string[];
  pdpIntelligence: ShopifyPdpIntelligenceRecord | null;
  sourceFacts?: ShopifyProductEditorSourceFacts | null;
  supplierContext: {
    matched: boolean;
    matchedSku: string | null;
    matchConfidence: number;
    matchReason: string;
    platform: string | null;
    syncStatus: string | null;
    syncRequired: boolean;
    syncMessage: string | null;
    inventoryAvailable: boolean;
    lastSupplierCheckAt: string | null;
    product: RocktomicSupplierProduct | null;
  };
}

export type ShopifyProductEditorSourceFieldStatus =
  | "extracted"
  | "partial"
  | "ocr_required"
  | "source_sync_required"
  | "source_missing"
  | "extraction_failed"
  | "not_applicable";

export interface ShopifyProductEditorSourceFacts {
  shopifyProductId: string | null;
  shopifyProductHandle: string | null;
  shopifySku: string | null;
  normalizedSku: string;
  supplierProductRecordFound: boolean;
  pricingRecordFound: boolean;
  inventoryRecordFound: boolean;
  assetsRecordFound: boolean;
  selectedMembershipTier: string | null;
  effectiveMembershipTier: string | null;
  usingDefaultMembershipTier: boolean;
  detectedMembershipTiers: string[];
  lastGlobalSupplierSyncAt: string | null;
  lastGeneratedIntelligenceAt: string | null;
  staleIntelligence: boolean;
  supplementFacts: {
    status: ShopifyProductEditorSourceFieldStatus;
    value: string;
    displayText: string;
  };
  activeIngredients: {
    status: ShopifyProductEditorSourceFieldStatus;
    values: string[];
    displayText: string;
  };
  amountPerServing: {
    status: ShopifyProductEditorSourceFieldStatus;
    value: string;
    displayText: string;
  };
  otherIngredients: {
    status: ShopifyProductEditorSourceFieldStatus;
    value: string;
    displayText: string;
  };
  servingSize: {
    status: ShopifyProductEditorSourceFieldStatus;
    value: string;
    displayText: string;
  };
  servingsPerContainer: {
    status: ShopifyProductEditorSourceFieldStatus;
    value: string;
    displayText: string;
  };
  dietaryAllergenAttributes: {
    status: ShopifyProductEditorSourceFieldStatus;
    values: string[];
    displayText: string;
  };
  keyProductFeatures: {
    status: ShopifyProductEditorSourceFieldStatus;
    values: string[];
    displayText: string;
  };
  certifications: {
    status: ShopifyProductEditorSourceFieldStatus;
    values: string[];
    displayText: string;
  };
  manufacturingClaims: {
    status: ShopifyProductEditorSourceFieldStatus;
    values: string[];
    displayText: string;
  };
  testingClaims: {
    status: ShopifyProductEditorSourceFieldStatus;
    values: string[];
    displayText: string;
  };
  commerce: {
    shopifyPrice: number | null;
    compareAtPrice: number | null;
    wholesaleCost: number | null;
    msrp: number | null;
    estimatedProfit: number | null;
    marginPercent: number | null;
    currency: string;
    pricingStatusLabel: string;
    message: string;
  };
  inventory: {
    status: string;
    displayText: string;
  };
  assets: {
    coaUrl: string | null;
    labelTemplateUrl: string | null;
    mockupUrl: string | null;
    coaStatus: string;
    coaLinkStatus: string;
    message: string;
  };
  missingFields: string[];
  diagnostics: string[];
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeReference(value: string): string {
  try {
    return decodeURIComponent(value).trim();
  } catch {
    return value.trim();
  }
}

function fallbackDemoHandle(title: string, fallbackId: string): string {
  const slug = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || fallbackId || "demo-product";
}

function toDemoProductRecord(input: {
  id: string;
  handle?: string;
  title: string;
  category: string;
}): ShopifyProductRecord {
  const handle = asString(input.handle) || fallbackDemoHandle(input.title, input.id);
  return {
    id: asString(input.id) || handle,
    storeDomain: "opanutrition.myshopify.com",
    title: asString(input.title) || "Demo product",
    handle,
    vendor: "OPA Nutrition",
    productType: asString(input.category) || "Supplements",
    status: "ACTIVE",
    tags: ["demo"],
    description: "Demo product listing. Connect Shopify for live product content.",
    descriptionHtml: "<p>Demo product listing. Connect Shopify for live product content.</p>",
    seoTitle: asString(input.title) || "Demo product",
    seoDescription: "Demo listing used only when demo mode is explicitly enabled.",
    metafields: [],
    onlineStoreUrl: `https://opanutrition.myshopify.com/products/${encodeURIComponent(handle)}`,
    primaryImageUrl: "",
    galleryImageUrls: [],
    galleryImages: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    variants: [],
  };
}

function resolveByReference(
  products: ShopifyProductRecord[],
  reference: string
): ShopifyProductRecord | null {
  const normalized = normalizeReference(reference);
  if (!normalized) return null;
  const normalizedLower = normalized.toLowerCase();

  const byId = products.find((product) => asString(product.id) === normalized);
  if (byId) return byId;

  const byHandle = products.find((product) => asString(product.handle).toLowerCase() === normalizedLower);
  if (byHandle) return byHandle;

  const byGidTail = products.find((product) => {
    const id = asString(product.id);
    if (!id) return false;
    const tail = id.split("/").pop();
    return tail ? tail === normalized : false;
  });
  if (byGidTail) return byGidTail;

  return null;
}

function computeShopifyInventoryStatus(product: ShopifyProductRecord): "in_stock" | "low_stock" | "out_of_stock" | "unknown" {
  const quantities = product.variants
    .map((variant) => variant.inventoryQuantity)
    .filter((quantity): quantity is number => typeof quantity === "number" && Number.isFinite(quantity));

  if (!quantities.length) return "unknown";
  const inStockCount = quantities.filter((quantity) => quantity > 0).length;
  if (inStockCount === 0) return "out_of_stock";
  if (inStockCount === quantities.length) return "in_stock";
  return "low_stock";
}

function firstVariantPrice(product: ShopifyProductRecord): number | null {
  const priced = product.variants.find((variant) => typeof variant.price === "number" && Number.isFinite(variant.price));
  return priced?.price ?? null;
}

function firstVariantCompareAtPrice(product: ShopifyProductRecord): number | null {
  const priced = product.variants.find(
    (variant) => typeof variant.compareAtPrice === "number" && Number.isFinite(variant.compareAtPrice)
  );
  return priced?.compareAtPrice ?? null;
}

function firstVariantSku(product: ShopifyProductRecord): string | null {
  return product.variants.map((variant) => asString(variant.sku)).find(Boolean) || null;
}

function diagnosticHas(product: RocktomicSupplierProduct | null, needle: string): boolean {
  return Boolean(product?.sourceDiagnostics?.some((entry) => entry.includes(needle)));
}

function normalizedRecordFound(product: RocktomicSupplierProduct | null, recordName: "pricing" | "inventory" | "asset"): boolean {
  if (!product) return false;
  const diagnosticKey = `normalized_${recordName}_record_status: found`;
  const missingDiagnosticKey = `normalized_${recordName}_record_status: missing`;
  if (diagnosticHas(product, diagnosticKey)) return true;
  if (diagnosticHas(product, missingDiagnosticKey)) return false;
  if (recordName === "pricing") {
    return Boolean(product.pricing?.membershipTiersDetected?.length || Object.keys(product.pricing?.membershipTierCosts || {}).length);
  }
  if (recordName === "inventory") {
    return Boolean(product.inventoryStatus && String(product.inventoryStatus) !== "source_unavailable");
  }
  return Boolean(product.coa?.url || product.labelTemplate?.url || product.mockup?.url);
}

function sourceStatusForScalar(input: {
  product: RocktomicSupplierProduct | null;
  value: string | null | undefined;
  fieldName: string;
}): { status: ShopifyProductEditorSourceFieldStatus; value: string; displayText: string } {
  const value = asString(input.value);
  if (value) return { status: "extracted", value, displayText: value };
  if (!input.product) {
    return { status: "source_sync_required", value: "", displayText: "Run source sync to extract supplier facts." };
  }
  if (input.product.supplementFacts?.status === "ocr_required") {
    return {
      status: "ocr_required",
      value: "",
      displayText: `${input.fieldName} require OCR extraction from catalog label image.`,
    };
  }
  if (diagnosticHas(input.product, "extraction_failed")) {
    return { status: "extraction_failed", value: "", displayText: `${input.fieldName} extraction failed.` };
  }
  return { status: "source_missing", value: "", displayText: `${input.fieldName} not found in normalized source record.` };
}

function sourceStatusForArray(input: {
  product: RocktomicSupplierProduct | null;
  values: string[] | null | undefined;
  fieldName: string;
}): { status: ShopifyProductEditorSourceFieldStatus; values: string[]; displayText: string } {
  const values = Array.from(new Set((input.values || []).map((entry) => entry.trim()).filter(Boolean)));
  if (values.length) return { status: "extracted", values, displayText: values.join(", ") };
  if (!input.product) {
    return { status: "source_sync_required", values: [], displayText: "Run source sync to extract supplier facts." };
  }
  if (input.product.supplementFacts?.status === "ocr_required") {
    return {
      status: "ocr_required",
      values: [],
      displayText: `${input.fieldName} require OCR extraction from catalog label image.`,
    };
  }
  return {
    status: "source_missing",
    values: [],
    displayText: `${input.fieldName} not found in normalized source record.`,
  };
}

function supplementFactsStatus(product: RocktomicSupplierProduct | null) {
  if (product?.supplementFacts?.value) {
    return {
      status: "extracted" as const,
      value: product.supplementFacts.value,
      displayText: product.supplementFacts.value,
    };
  }
  if (!product) {
    return {
      status: "source_sync_required" as const,
      value: "",
      displayText: "Run source sync to extract supplier facts.",
    };
  }
  if (product.supplementFacts?.status === "ocr_required") {
    return {
      status: "ocr_required" as const,
      value: "",
      displayText: "Supplement Facts require OCR extraction from catalog label image.",
    };
  }
  if (diagnosticHas(product, "extraction_failed")) {
    return {
      status: "extraction_failed" as const,
      value: "",
      displayText: "Supplement Facts extraction failed.",
    };
  }
  return {
    status: "source_missing" as const,
    value: "",
    displayText: "Supplement Facts not found in normalized source record.",
  };
}

function availabilityFromInventoryStatus(status: string): string {
  if (status === "in_stock") return "Available";
  if (status === "low_stock") return "Action Required: Mark Out of Stock";
  if (status === "out_of_stock") return "Currently Unavailable";
  if (status === "source_unavailable") return "Inventory Status Unavailable";
  return "Availability Unknown";
}

function buildPricingMessage(input: {
  pricingRecordFound: boolean;
  selectedMembershipTier: string | null;
  effectiveMembershipTier: string | null;
  usingDefaultMembershipTier: boolean;
  wholesaleCost: number | null;
}): string {
  if (!input.pricingRecordFound) return "Pricing record not found for SKU.";
  if (!input.selectedMembershipTier && !input.usingDefaultMembershipTier) {
    return "Select membership tier in Settings to calculate cost and profit.";
  }
  if (input.usingDefaultMembershipTier && input.effectiveMembershipTier) {
    return `Pricing Tier: ${input.effectiveMembershipTier} (default)`;
  }
  if (input.wholesaleCost == null) return "Cost not found for selected tier.";
  return "Selected membership tier pricing mapped.";
}

function resolveDefaultMembershipTier(input: {
  selectedMembershipTier: string | null;
  membershipTierCosts: Record<string, number> | null | undefined;
  detectedMembershipTiers: string[] | null | undefined;
}): string | null {
  if (input.selectedMembershipTier) return input.selectedMembershipTier;
  const costs = input.membershipTierCosts ?? {};
  const fromDetected = Array.from(new Set((input.detectedMembershipTiers || []).map((entry) => entry.trim()).filter(Boolean)));
  const fromCosts = Object.keys(costs).map((entry) => entry.trim()).filter(Boolean);
  const all = Array.from(new Set([...fromDetected, ...fromCosts]));
  if (!all.length) return null;
  const nonMember = all.find((entry) => entry.toLowerCase() === "non member pricing");
  return nonMember || all[0] || null;
}

function computeStaleIntelligence(input: {
  pdpIntelligence: ShopifyPdpIntelligenceRecord | null;
  latestSupplierSyncAt: string | null;
}): boolean {
  const generatedAt = input.pdpIntelligence?.last_generated_at;
  if (!generatedAt || !input.latestSupplierSyncAt) return false;
  const generatedMs = Date.parse(generatedAt);
  const syncMs = Date.parse(input.latestSupplierSyncAt);
  return Number.isFinite(generatedMs) && Number.isFinite(syncMs) && generatedMs < syncMs;
}

function buildSourceFacts(input: {
  product: ShopifyProductRecord;
  currentShopifyListing: ShopifyCurrentListingDocket;
  supplierProduct: RocktomicSupplierProduct | null;
  pdpIntelligence: ShopifyPdpIntelligenceRecord | null;
  syncStatus: string | null;
  lastSupplierCheckAt: string | null;
}): ShopifyProductEditorSourceFacts {
  const supplierProduct = input.supplierProduct;
  const shopifySku = firstVariantSku(input.product);
  const normalizedSku = normalizeRocktomicSku(shopifySku || "");
  const pricingRecordFound = normalizedRecordFound(supplierProduct, "pricing");
  const inventoryRecordFound = normalizedRecordFound(supplierProduct, "inventory");
  const assetsRecordFound = normalizedRecordFound(supplierProduct, "asset");
  const selectedMembershipTier = supplierProduct?.pricing?.membershipTier || null;
  const effectiveMembershipTier = resolveDefaultMembershipTier({
    selectedMembershipTier,
    membershipTierCosts: supplierProduct?.pricing?.membershipTierCosts,
    detectedMembershipTiers: supplierProduct?.pricing?.membershipTiersDetected,
  });
  const usingDefaultMembershipTier = Boolean(!selectedMembershipTier && effectiveMembershipTier);
  const wholesaleCost =
    effectiveMembershipTier && supplierProduct?.pricing?.membershipTierCosts
      ? supplierProduct.pricing.membershipTierCosts[effectiveMembershipTier] ?? null
      : null;
  const shopifyPrice = firstVariantPrice(input.product);
  const compareAtPrice = firstVariantCompareAtPrice(input.product);
  const estimatedProfit =
    shopifyPrice != null && wholesaleCost != null ? Number((shopifyPrice - wholesaleCost).toFixed(2)) : null;
  const marginPercent =
    shopifyPrice != null && wholesaleCost != null && shopifyPrice > 0
      ? Number((((shopifyPrice - wholesaleCost) / shopifyPrice) * 100).toFixed(2))
      : null;
  const latestSupplierSyncAt = supplierProduct?.lastSyncedAt || input.lastSupplierCheckAt;
  const staleIntelligence = computeStaleIntelligence({
    pdpIntelligence: input.pdpIntelligence,
    latestSupplierSyncAt,
  });
  const supplementFacts = supplementFactsStatus(supplierProduct);
  const activeIngredients = sourceStatusForArray({
    product: supplierProduct,
    values: supplierProduct?.activeIngredients,
    fieldName: "Active Ingredients",
  });
  const amountPerServing = sourceStatusForScalar({
    product: supplierProduct,
    value: supplierProduct?.amountPerServing,
    fieldName: "Amount Per Serving",
  });
  const otherIngredients = sourceStatusForScalar({
    product: supplierProduct,
    value: supplierProduct?.otherIngredients,
    fieldName: "Other Ingredients",
  });
  const servingSize = sourceStatusForScalar({
    product: supplierProduct,
    value: supplierProduct?.servingSize,
    fieldName: "Serving Size",
  });
  const servingsPerContainer = sourceStatusForScalar({
    product: supplierProduct,
    value: supplierProduct?.servingsPerContainer,
    fieldName: "Servings Per Container",
  });
  const dietaryAllergenAttributes = sourceStatusForArray({
    product: supplierProduct,
    values: supplierProduct?.allergenDietaryAttributes || supplierProduct?.dietaryAttributes,
    fieldName: "Dietary / Allergen Attributes",
  });
  const keyProductFeatures = sourceStatusForArray({
    product: supplierProduct,
    values: supplierProduct?.productFeatures,
    fieldName: "Key Product Features",
  });
  const certifications = sourceStatusForArray({
    product: supplierProduct,
    values: supplierProduct?.certifications,
    fieldName: "Certifications",
  });
  const manufacturingClaims = sourceStatusForArray({
    product: supplierProduct,
    values: supplierProduct?.manufacturingClaims,
    fieldName: "Manufacturing Claims",
  });
  const testingClaims = sourceStatusForArray({
    product: supplierProduct,
    values: (supplierProduct?.manufacturingClaims || []).filter((entry) =>
      /third-?party|tested|nsf|fda|gmp/i.test(entry)
    ),
    fieldName: "Testing Claims",
  });
  const inventoryStatus = inventoryRecordFound
    ? supplierProduct?.inventoryStatus || "unknown"
    : supplierProduct
      ? "unknown"
      : "source_unavailable";
  const pricingMessage = buildPricingMessage({
    pricingRecordFound,
    selectedMembershipTier,
    effectiveMembershipTier,
    usingDefaultMembershipTier,
    wholesaleCost,
  });
  const missingFields = [
    !supplierProduct ? "supplier_product_record" : null,
    !pricingRecordFound ? "pricing_record" : null,
    !inventoryRecordFound ? "inventory_record" : null,
    !assetsRecordFound ? "assets_record" : null,
    supplementFacts.status !== "extracted" ? `supplement_facts:${supplementFacts.status}` : null,
    activeIngredients.status !== "extracted" ? `active_ingredients:${activeIngredients.status}` : null,
    servingSize.status !== "extracted" ? `serving_size:${servingSize.status}` : null,
    servingsPerContainer.status !== "extracted" ? `servings_per_container:${servingsPerContainer.status}` : null,
  ].filter((entry): entry is string => Boolean(entry));
  const diagnostics = [
    `shopify_product_id: ${input.currentShopifyListing.productId}`,
    `shopify_handle: ${input.currentShopifyListing.handle || "none"}`,
    `shopify_sku: ${shopifySku || "none"}`,
    `normalized_sku: ${normalizedSku || "none"}`,
    `global_supplier_product_record_found: ${supplierProduct ? "true" : "false"}`,
    `global_pricing_record_found: ${pricingRecordFound ? "true" : "false"}`,
    `global_inventory_record_found: ${inventoryRecordFound ? "true" : "false"}`,
    `global_assets_record_found: ${assetsRecordFound ? "true" : "false"}`,
    `selected_membership_tier: ${selectedMembershipTier || "none"}`,
    `effective_membership_tier: ${effectiveMembershipTier || "none"}`,
    `using_default_membership_tier: ${usingDefaultMembershipTier ? "true" : "false"}`,
    `last_global_supplier_sync: ${latestSupplierSyncAt || "never"}`,
    `last_generated_intelligence: ${input.pdpIntelligence?.last_generated_at || "never"}`,
    `stale_intelligence: ${staleIntelligence ? "true" : "false"}`,
    `supplier_sync_status: ${input.syncStatus || "unknown"}`,
    `supplement_facts_status: ${supplementFacts.status}`,
    `missing_fields: ${missingFields.length ? missingFields.join(",") : "none"}`,
    ...(supplierProduct?.sourceDiagnostics || []),
  ];

  return {
    shopifyProductId: input.currentShopifyListing.productId,
    shopifyProductHandle: input.currentShopifyListing.handle || null,
    shopifySku,
    normalizedSku,
    supplierProductRecordFound: Boolean(supplierProduct),
    pricingRecordFound,
    inventoryRecordFound,
    assetsRecordFound,
    selectedMembershipTier,
    effectiveMembershipTier,
    usingDefaultMembershipTier,
    detectedMembershipTiers: supplierProduct?.pricing?.membershipTiersDetected || [],
    lastGlobalSupplierSyncAt: latestSupplierSyncAt,
    lastGeneratedIntelligenceAt: input.pdpIntelligence?.last_generated_at || null,
    staleIntelligence,
    supplementFacts,
    activeIngredients,
    amountPerServing,
    otherIngredients,
    servingSize,
    servingsPerContainer,
    dietaryAllergenAttributes,
    keyProductFeatures,
    certifications,
    manufacturingClaims,
    testingClaims,
    commerce: {
      shopifyPrice,
      compareAtPrice,
      wholesaleCost,
      msrp: supplierProduct?.pricing?.msrp ?? null,
      estimatedProfit,
      marginPercent,
      currency: supplierProduct?.pricing?.currency || "USD",
      pricingStatusLabel: supplierProduct?.pricing?.pricingStatusLabel
        || (usingDefaultMembershipTier ? "default_tier_pricing_mapped" : pricingRecordFound ? "membership_tier_not_selected" : "pricing_record_not_found"),
      message: pricingMessage,
    },
    inventory: {
      status: inventoryStatus,
      displayText: availabilityFromInventoryStatus(inventoryStatus),
    },
    assets: {
      coaUrl: supplierProduct?.coa?.url || null,
      labelTemplateUrl: supplierProduct?.labelTemplate?.url || null,
      mockupUrl: supplierProduct?.mockup?.url || null,
      coaStatus: supplierProduct?.coa?.url ? "available" : supplierProduct?.coa?.status || "pending_source",
      coaLinkStatus: supplierProduct?.coaLinkStatus || "not_present",
      message: supplierProduct?.coa?.url
        ? "available/extracted"
        : !supplierProduct
          ? "Source sync required."
        : supplierProduct?.coaLinkStatus === "extraction_failed"
          ? "COA Link: extraction failed"
          : supplierProduct?.coaLinkStatus === "not_present"
            ? "COA Link: not found in catalog row"
            : "Source sync required.",
    },
    missingFields,
    diagnostics,
  };
}

async function resolveProduct(
  options: BuildProductEditorStateOptions
): Promise<ResolvedProduct> {
  const reference = normalizeReference(options.productReference);

  if (options.demoMode) {
    const demoWorkspace = buildShopifyAgenticDemoWorkspaceState();
    const demoProducts = demoWorkspace.products.map((product) =>
      toDemoProductRecord({
        id: product.id,
        handle: product.handle,
        title: product.title,
        category: product.category,
      })
    );
    const demoProduct = resolveByReference(demoProducts, reference);
    return {
      product: demoProduct,
      source: "demo",
      sourceLabel: sourceLabel("demo"),
      hydrationMode: sourceToHydrationMode("demo"),
      lastSyncedAt: null,
      warnings: [],
    };
  }

  if (!options.userId) {
    return {
      product: null,
      source: "unavailable",
      sourceLabel: sourceLabel("unavailable"),
      hydrationMode: sourceToHydrationMode("unavailable"),
      lastSyncedAt: null,
      warnings: ["Sign in and connect Shopify to open product editors."],
    };
  }

  const warnings: string[] = [];

  try {
    const status = await getShopifyConnectionStatusForUser(options.userId);
    if (status.connected && status.storeDomain) {
      try {
        const live = await hydrateShopifyLiveWorkspaceForUser({
          userId: options.userId,
          productsFirst: 180,
          collectionsFirst: 40,
          pagesFirst: 20,
          blogsFirst: 10,
          articlesFirst: 10,
        });
        const liveProduct = resolveByReference(live.products, reference);
        if (liveProduct) {
          return {
            product: liveProduct,
            source: "live_shopify",
            sourceLabel: sourceLabel("live_shopify"),
            hydrationMode: sourceToHydrationMode("live_shopify"),
            lastSyncedAt: live.fetchedAt,
            warnings: live.warnings,
          };
        }
        warnings.push("Live Shopify workspace loaded, but this product was not found in the current live window.");
      } catch (error) {
        warnings.push(
          error instanceof Error && error.message.trim()
            ? error.message.trim()
            : "Live Shopify hydration failed for product editor lookup."
        );
      }
    }
  } catch {
    warnings.push("Could not load Shopify connection status.");
  }

  try {
    const fallbackProducts = await listShopifyProductsForUser(options.userId);
    const fallbackProduct = resolveByReference(fallbackProducts, reference);
    if (fallbackProduct) {
      return {
        product: fallbackProduct,
        source: "fallback_snapshot",
        sourceLabel: sourceLabel("fallback_snapshot"),
        hydrationMode: sourceToHydrationMode("fallback_snapshot"),
        lastSyncedAt: fallbackProduct.updatedAt || null,
        warnings,
      };
    }
  } catch (error) {
    warnings.push(
      error instanceof Error && error.message.trim()
        ? error.message.trim()
        : "Fallback Shopify product lookup failed."
    );
  }

  return {
    product: null,
    source: "unavailable",
    sourceLabel: sourceLabel("unavailable"),
    hydrationMode: sourceToHydrationMode("unavailable"),
    lastSyncedAt: null,
    warnings,
  };
}

export async function buildShopifyProductEditorStateForUser(
  options: BuildProductEditorStateOptions
): Promise<ShopifyProductEditorInitialState> {
  const reference = normalizeReference(options.productReference);
  const resolved = await resolveProduct(options);

  let openAiConnected = false;
  let openAiStatusLabel = "Not connected";
  if (options.userId) {
    try {
      const openAiStatus = await getShopifyOpenAiConnectionStatusForUser(options.userId);
      openAiConnected = openAiStatus.connected;
      openAiStatusLabel = openAiStatus.connected ? "Connected" : "Not connected";
    } catch {
      openAiConnected = false;
      openAiStatusLabel = "Not connected";
    }
  }

  if (!resolved.product) {
    return {
      productReference: reference,
      productFound: false,
      notFoundMessage:
        "Product not found. Sync Shopify products and confirm the product id/handle from the Products table.",
      source: resolved.source,
      sourceLabel: resolved.sourceLabel,
      hydrationMode: resolved.hydrationMode,
      currentShopifyListing: null,
      optimizedShopifyProposal: null,
      editableShopifyDraft: null,
      openAiConnected,
      openAiStatusLabel,
      lastSyncedAt: resolved.lastSyncedAt,
      warnings: resolved.warnings,
      pdpIntelligence: null,
      sourceFacts: null,
      supplierContext: {
        matched: false,
        matchedSku: null,
        matchConfidence: 0,
        matchReason: "no_supplier_sku_match",
        platform: null,
        syncStatus: null,
        syncRequired: false,
        syncMessage: null,
        inventoryAvailable: false,
        lastSupplierCheckAt: null,
        product: null,
      },
    };
  }

  const currentShopifyListing = buildCurrentShopifyListingDocket(resolved.product, {
    source: resolved.source,
    sourceLabel: resolved.sourceLabel,
    hydrationMode: resolved.hydrationMode,
    lastSyncedAt: resolved.lastSyncedAt,
  });

  let pdpIntelligence: ShopifyPdpIntelligenceRecord | null = null;
  if (options.userId) {
    try {
      pdpIntelligence = await getPersistedShopifyPdpIntelligenceForProduct({
        userId: options.userId,
        shopifyProductId: currentShopifyListing.productId,
        productHandle: currentShopifyListing.handle || null,
      });
    } catch {
      pdpIntelligence = null;
    }
  }

  const skus = currentShopifyListing.variants.map((entry) => entry.sku.trim()).filter(Boolean);
  const supplierSnapshot = await matchPrimarySupplierBySkus(skus, {
    userId: options.userId,
    allowRefresh: false,
    triggerBackgroundRefresh: false,
  }).catch(() => null);
  const supplierMatch = supplierSnapshot?.match;
  const supplierProductRaw = supplierMatch?.product ?? null;
  const shopifyPrice = firstVariantPrice(resolved.product);
  const rawPricing = supplierProductRaw?.pricing;
  const supplierProduct = supplierProductRaw
    ? {
        ...supplierProductRaw,
        pricing: {
          wholesaleCost: rawPricing?.wholesaleCost ?? null,
          msrp: rawPricing?.msrp ?? null,
          estimatedProfit:
            rawPricing?.wholesaleCost != null && shopifyPrice != null
              ? Number((shopifyPrice - rawPricing.wholesaleCost).toFixed(2))
              : null,
          marginPercent:
            rawPricing?.wholesaleCost != null && shopifyPrice != null && shopifyPrice > 0
              ? Number((((shopifyPrice - rawPricing.wholesaleCost) / shopifyPrice) * 100).toFixed(2))
              : null,
          currency: rawPricing?.currency ?? "USD",
          sourceStatus: rawPricing?.sourceStatus ?? "unknown",
          membershipTier: rawPricing?.membershipTier ?? null,
          membershipTiersDetected: rawPricing?.membershipTiersDetected ?? [],
          membershipTierCosts: rawPricing?.membershipTierCosts ?? {},
          sourceSheet: rawPricing?.sourceSheet ?? null,
          sourceColumn: rawPricing?.sourceColumn ?? null,
          lastCheckedAt: rawPricing?.lastCheckedAt ?? null,
          pricingStatusLabel:
            !rawPricing?.membershipTier
              ? "membership_tier_not_selected"
              : rawPricing?.wholesaleCost == null
                ? "source_unavailable_for_selected_membership_tier"
                : rawPricing?.pricingStatusLabel || "tier_pricing_mapped",
        },
      }
    : null;
  const inventoryAvailable = supplierSnapshot?.inventoryAvailable ?? false;
  const syncStatus = supplierSnapshot?.syncStatus || null;
  const sourceFacts = buildSourceFacts({
    product: resolved.product,
    currentShopifyListing,
    supplierProduct,
    pdpIntelligence,
    syncStatus,
    lastSupplierCheckAt: supplierSnapshot?.lastCheckedAt ?? null,
  });
  const supplierInventoryStatus = sourceFacts.inventory.status;
  const syncRequired = !supplierProduct;
  const syncMessage = syncRequired
    ? "Supplier data has not been synced for this SKU. Run source sync."
    : null;

  return {
    productReference: reference,
    productFound: true,
    notFoundMessage: null,
    source: resolved.source,
    sourceLabel: resolved.sourceLabel,
    hydrationMode: resolved.hydrationMode,
    currentShopifyListing,
    optimizedShopifyProposal: null,
    editableShopifyDraft: buildEditableShopifyDraft(currentShopifyListing, null),
    openAiConnected,
    openAiStatusLabel,
    lastSyncedAt: resolved.lastSyncedAt,
    warnings: resolved.warnings,
    pdpIntelligence:
      pdpIntelligence && supplierProduct
        ? {
            ...pdpIntelligence,
            supplier: supplierProduct.supplier,
            supplier_sku: supplierProduct.sku,
            inventory_status: supplierInventoryStatus,
          }
        : pdpIntelligence,
    sourceFacts,
    supplierContext: {
      matched: supplierMatch?.status === "rocktomic",
      matchedSku: supplierMatch?.matchedSku ?? null,
      matchConfidence: supplierMatch?.matchConfidence ?? 0,
      matchReason: supplierMatch?.matchReason ?? "no_supplier_sku_match",
      platform: supplierSnapshot?.platform ?? null,
      syncStatus,
      syncRequired,
      syncMessage,
      inventoryAvailable,
      lastSupplierCheckAt: supplierSnapshot?.lastCheckedAt ?? null,
      product: supplierProduct,
    },
  };
}

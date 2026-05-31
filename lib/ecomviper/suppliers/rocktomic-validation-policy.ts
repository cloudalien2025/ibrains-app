import type { AssetsRecord, InventoryRecord, PricingRecord, SourceFactRecord } from "@/lib/ecomviper/suppliers/rocktomic-offline-audit";

export const ROCKTOMIC_VALIDATION_POLICY_VERSION = "rocktomic_phase3_5_v1";
const PACKAGE_SOURCE_ERROR_FAIL_THRESHOLD = 0;

export type RocktomicSkuType = "supplement" | "apparel" | "unknown";
export type RocktomicSkuValidationStatus = "usable" | "usable_with_warnings" | "blocked" | "not_applicable" | "extraction_error";
export type RocktomicPackageValidationStatus = "pass" | "pass_with_warnings" | "fail";

export interface RocktomicValidationDefect {
  field: string;
  code: string;
  message: string;
}

export interface RocktomicReadinessFlags {
  usableForProductEditor: boolean;
  usableForGenerateIntelligence: boolean;
  usableForImageStudio: boolean;
  usableForOptiPixel: boolean;
  usableForOptiBay: boolean;
  usableForOptiWal: boolean;
  usableForOptizon: boolean;
  readyForChannelImageGeneration: boolean;
}

export interface RocktomicSkuValidationResult {
  sku: string;
  productName: string | null;
  skuType: RocktomicSkuType;
  status: RocktomicSkuValidationStatus;
  blockingDefects: RocktomicValidationDefect[];
  warningDefects: RocktomicValidationDefect[];
  notApplicableFields: string[];
  sourceNotes: string[];
  missingFields: string[];
  readiness: RocktomicReadinessFlags;
  readinessSummary: string[];
  requiredBlockingFields: string[];
  satisfiedBlockingFields: string[];
  requiredWarningFields: string[];
  satisfiedWarningFields: string[];
}

export interface RocktomicFieldCoverageSummary {
  requiredSkuCount: number;
  presentSkuCount: number;
  missingSkuCount: number;
}

export interface RocktomicPackageValidationResult {
  generatedAt: string;
  supplierId: "rocktomic";
  packageVersion: number | null;
  validationPolicyVersion: string;
  totalSkusDiscovered: number;
  totalSkusValidated: number;
  packageStatus: RocktomicPackageValidationStatus;
  usableSkuCount: number;
  usableWithWarningsSkuCount: number;
  blockedSkuCount: number;
  extractionErrorSkuCount: number;
  ocrNeedsReviewSkuCount: number;
  usableForOptiPixelSkuCount: number;
  readyForChannelImageGenerationSkuCount: number;
  fieldCoverageSummary: Record<string, RocktomicFieldCoverageSummary>;
  blockingFieldCoverageSummary: Record<string, RocktomicFieldCoverageSummary>;
  warningFieldCoverageSummary: Record<string, RocktomicFieldCoverageSummary>;
  skuValidationResults: RocktomicSkuValidationResult[];
  packageDefects: RocktomicValidationDefect[];
  sourceErrors: Array<{ sourceId: string; error: string }>;
}

interface EvaluatePackageInput {
  generatedAt: string;
  packageVersion: number | null;
  sourceFactsBySku: Record<string, SourceFactRecord>;
  pricingBySku: Record<string, PricingRecord>;
  inventoryBySku: Record<string, InventoryRecord>;
  assetsBySku: Record<string, AssetsRecord>;
  sourceErrors: Array<{ sourceId: string; error: string }>;
}

interface SupplementFactsSignals {
  hasServingSize: boolean;
  hasServingsPerContainer: boolean;
  hasActiveIngredients: boolean;
  hasOtherIngredients: boolean;
  containerSize: string | null;
  productWeight: string | null;
}

const APPAREL_KEYWORDS = [
  "apparel",
  "shirt",
  "t-shirt",
  "tee",
  "hoodie",
  "jogger",
  "legging",
  "tank",
  "hat",
  "cap",
  "beanie",
  "short",
  "sweatshirt",
  "jacket",
];

const BLOCKING_FIELDS = [
  "sku",
  "productName",
  "source.catalogRow",
  "pricing.record",
  "pricing.wholesaleCostOrMembership",
  "inventory.record",
  "inventory.availability",
  "assets.record",
  "supplementFacts.servingSize",
  "supplementFacts.servingsPerContainer",
  "supplementFacts.activeIngredients",
  "supplementFacts.otherIngredients",
  "supplementFacts.containerSize",
  "supplementFacts.productWeight",
  "assets.coaUrl",
  "assets.labelTemplateAiUrl",
  "assets.mockupTemplateTifUrl",
  "supplementFacts.ocrEvidence",
  "assets.labelTemplateOrEquivalent",
  "assets.usableProductAsset",
] as const;

const WARNING_FIELDS = [
  "quality.keyFeatures",
  "quality.dietaryAttributes",
  "quality.certifications",
  "quality.manufacturingClaims",
  "quality.marketingBullets",
  "assets.mockupUrl",
  "readiness.usableForOptiPixel",
  "readiness.readyForChannelImageGeneration",
  "assets.secondaryAssetLinks",
  "apparel.sizingFields",
] as const;

function normalizeText(value: string | null | undefined): string {
  return (value || "").trim().toLowerCase();
}

function makeDefect(field: string, code: string, message: string): RocktomicValidationDefect {
  return { field, code, message };
}

function inferSkuType(params: { productName: string | null; category: string | null }): RocktomicSkuType {
  const combined = `${params.productName || ""} ${params.category || ""}`.toLowerCase();
  if (!combined.trim()) return "unknown";
  if (APPAREL_KEYWORDS.some((keyword) => combined.includes(keyword))) {
    return "apparel";
  }
  return "supplement";
}

function extractSizeToken(text: string): string | null {
  const sizePattern = /(\d+(?:\.\d+)?\s?(?:g|kg|mg|mcg|lb|lbs|oz|fl\s?oz|ml|capsules?|softgels?|tablets?|ct|count))/i;
  return text.match(sizePattern)?.[1]?.trim() || null;
}

function extractSupplementFactsSignals(params: {
  productName: string | null;
  supplementFactsText: string | null;
  supplementFactsStructured?: SourceFactRecord["supplementFacts"] | null;
}): SupplementFactsSignals {
  const facts = params.supplementFactsText || "";
  const structured = params.supplementFactsStructured || null;
  const combined = `${params.productName || ""} ${facts}`;
  return {
    hasServingSize: Boolean(structured?.servingSize) || /serving\s*size/i.test(facts),
    hasServingsPerContainer:
      Boolean(structured?.servingsPerContainer) || /servings?\s*per\s*(container|bottle)|servings?\s*\/\s*container/i.test(facts),
    hasActiveIngredients:
      (structured?.activeIngredients.length || 0) > 0 ||
      (structured?.amountPerServing.length || 0) > 0 ||
      /active\s+ingredients?/i.test(facts) ||
      /amount\s+per\s+serving/i.test(facts) ||
      /[0-9]+\s?(mg|mcg|g)\b/i.test(facts),
    hasOtherIngredients: (structured?.otherIngredients.length || 0) > 0 || /other\s+ingredients?/i.test(facts),
    containerSize: extractSizeToken(combined),
    productWeight: extractSizeToken(params.productName || ""),
  };
}

function boolSummary(value: boolean, trueText: string, falseText: string): string {
  return value ? trueText : falseText;
}

function evaluateSku(params: {
  sku: string;
  sourceFacts: SourceFactRecord | undefined;
  pricing: PricingRecord | undefined;
  inventory: InventoryRecord | undefined;
  assets: AssetsRecord | undefined;
  sourceErrors: Array<{ sourceId: string; error: string }>;
}): RocktomicSkuValidationResult {
  const productName = params.sourceFacts?.productName || params.pricing?.productName || null;
  const skuType = inferSkuType({ productName, category: params.sourceFacts?.category || null });

  const blockingDefects: RocktomicValidationDefect[] = [];
  const warningDefects: RocktomicValidationDefect[] = [];
  const notApplicableFields: string[] = [];
  const sourceNotes = params.sourceErrors.map((entry) => `${entry.sourceId}: ${entry.error}`);

  const requiredBlockingFields = new Set<string>();
  const satisfiedBlockingFields = new Set<string>();
  const requiredWarningFields = new Set<string>();
  const satisfiedWarningFields = new Set<string>();

  requiredBlockingFields.add("sku");
  if (params.sku.trim()) {
    satisfiedBlockingFields.add("sku");
  } else {
    blockingDefects.push(makeDefect("sku", "missing_sku", "SKU is missing from the package row."));
  }

  requiredBlockingFields.add("productName");
  if (productName?.trim()) {
    satisfiedBlockingFields.add("productName");
  } else {
    blockingDefects.push(makeDefect("productName", "missing_product_name", "Product name is required for downstream usability."));
  }

  requiredBlockingFields.add("source.catalogRow");
  if (params.sourceFacts) {
    satisfiedBlockingFields.add("source.catalogRow");
  } else {
    blockingDefects.push(makeDefect("source.catalogRow", "missing_catalog_row", "Catalog/source facts row is missing for SKU."));
  }

  requiredBlockingFields.add("pricing.record");
  if (params.pricing) {
    satisfiedBlockingFields.add("pricing.record");
  } else {
    blockingDefects.push(makeDefect("pricing.record", "missing_pricing_record", "Pricing record is required."));
  }

  requiredBlockingFields.add("pricing.wholesaleCostOrMembership");
  if (
    params.pricing &&
    (params.pricing.wholesaleCost != null || Object.keys(params.pricing.membershipTierCosts || {}).length > 0)
  ) {
    satisfiedBlockingFields.add("pricing.wholesaleCostOrMembership");
  } else {
    blockingDefects.push(
      makeDefect(
        "pricing.wholesaleCostOrMembership",
        "missing_pricing_values",
        "Pricing record must include wholesale or membership tier cost data."
      )
    );
  }

  requiredBlockingFields.add("inventory.record");
  if (params.inventory) {
    satisfiedBlockingFields.add("inventory.record");
  } else {
    blockingDefects.push(makeDefect("inventory.record", "missing_inventory_record", "Inventory record is required."));
  }

  requiredBlockingFields.add("inventory.availability");
  if (params.inventory && params.inventory.inventoryStatus !== "missing") {
    satisfiedBlockingFields.add("inventory.availability");
  } else {
    blockingDefects.push(makeDefect("inventory.availability", "missing_inventory_availability", "Inventory availability value is missing."));
  }

  requiredBlockingFields.add("assets.record");
  if (params.assets) {
    satisfiedBlockingFields.add("assets.record");
  } else {
    blockingDefects.push(makeDefect("assets.record", "missing_assets_record", "Assets record is required when validating SKU readiness."));
  }

  if (skuType === "supplement") {
    const supplementSignals = extractSupplementFactsSignals({
      productName,
      supplementFactsText: params.sourceFacts?.supplementFactsText || null,
      supplementFactsStructured: params.sourceFacts?.supplementFacts || null,
    });

    requiredBlockingFields.add("supplementFacts.servingSize");
    if (supplementSignals.hasServingSize) {
      satisfiedBlockingFields.add("supplementFacts.servingSize");
    } else {
      blockingDefects.push(makeDefect("supplementFacts.servingSize", "missing_serving_size", "Supplement serving size was not detected."));
    }

    requiredBlockingFields.add("supplementFacts.servingsPerContainer");
    if (supplementSignals.hasServingsPerContainer) {
      satisfiedBlockingFields.add("supplementFacts.servingsPerContainer");
    } else {
      blockingDefects.push(
        makeDefect(
          "supplementFacts.servingsPerContainer",
          "missing_servings_per_container",
          "Supplement servings-per-container value was not detected."
        )
      );
    }

    requiredBlockingFields.add("supplementFacts.activeIngredients");
    if (supplementSignals.hasActiveIngredients) {
      satisfiedBlockingFields.add("supplementFacts.activeIngredients");
    } else {
      blockingDefects.push(
        makeDefect(
          "supplementFacts.activeIngredients",
          "missing_active_ingredients",
          "Active ingredient facts were not detected for supplement SKU."
        )
      );
    }

    requiredBlockingFields.add("supplementFacts.otherIngredients");
    if (supplementSignals.hasOtherIngredients) {
      satisfiedBlockingFields.add("supplementFacts.otherIngredients");
    } else {
      notApplicableFields.push("supplementFacts.otherIngredients");
      requiredBlockingFields.delete("supplementFacts.otherIngredients");
    }

    requiredBlockingFields.add("supplementFacts.containerSize");
    if (supplementSignals.containerSize) {
      satisfiedBlockingFields.add("supplementFacts.containerSize");
    } else {
      notApplicableFields.push("supplementFacts.containerSize");
      requiredBlockingFields.delete("supplementFacts.containerSize");
    }

    requiredBlockingFields.add("supplementFacts.productWeight");
    if (supplementSignals.productWeight) {
      satisfiedBlockingFields.add("supplementFacts.productWeight");
    } else {
      notApplicableFields.push("supplementFacts.productWeight");
      requiredBlockingFields.delete("supplementFacts.productWeight");
    }

    requiredBlockingFields.add("assets.coaUrl");
    if (params.assets?.coaUrl) {
      satisfiedBlockingFields.add("assets.coaUrl");
    } else {
      blockingDefects.push(makeDefect("assets.coaUrl", "missing_coa_url", "COA URL is required for supplement SKU validation."));
    }

    requiredBlockingFields.add("assets.labelTemplateOrEquivalent");
    if (
      params.assets?.labelTemplateAiUrl ||
      params.assets?.mockupTemplateTifUrl ||
      params.assets?.catalogTemplateUrl ||
      params.assets?.labelTemplateUrl ||
      params.assets?.mockupUrl
    ) {
      satisfiedBlockingFields.add("assets.labelTemplateOrEquivalent");
    } else {
      blockingDefects.push(
        makeDefect(
          "assets.labelTemplateOrEquivalent",
          "missing_label_template",
          "Supplement SKU requires a label template or equivalent design asset."
        )
      );
    }

    requiredBlockingFields.add("assets.usableProductAsset");
    if (
      params.assets?.labelTemplateAiUrl ||
      params.assets?.mockupTemplateTifUrl ||
      params.assets?.catalogTemplateUrl ||
      params.assets?.labelTemplateUrl ||
      params.assets?.mockupUrl ||
      params.assets?.coaUrl
    ) {
      satisfiedBlockingFields.add("assets.usableProductAsset");
    } else {
      blockingDefects.push(makeDefect("assets.usableProductAsset", "missing_usable_asset", "No usable product/source asset detected."));
    }

    requiredBlockingFields.add("assets.labelTemplateAiUrl");
    if (params.assets?.labelTemplateAiUrl || params.assets?.labelTemplateUrl || params.assets?.catalogTemplateUrl) {
      satisfiedBlockingFields.add("assets.labelTemplateAiUrl");
    } else {
      blockingDefects.push(
        makeDefect("assets.labelTemplateAiUrl", "missing_label_template_ai", "Label template (.ai/equivalent) is required for supplement SKU.")
      );
    }

    requiredBlockingFields.add("assets.mockupTemplateTifUrl");
    if (params.assets?.mockupTemplateTifUrl || params.assets?.mockupUrl || params.assets?.catalogTemplateUrl) {
      satisfiedBlockingFields.add("assets.mockupTemplateTifUrl");
    } else {
      blockingDefects.push(
        makeDefect("assets.mockupTemplateTifUrl", "missing_mockup_template_tif", "3D mockup template (.tif/equivalent) is required for supplement SKU.")
      );
    }

    requiredBlockingFields.add("supplementFacts.ocrEvidence");
    const hasOcrEvidence = Boolean(params.sourceFacts?.sourceEvidence?.supplementFacts);
    if (hasOcrEvidence) {
      satisfiedBlockingFields.add("supplementFacts.ocrEvidence");
    } else if (params.sourceFacts?.supplementFactsText) {
      warningDefects.push(
        makeDefect(
          "supplementFacts.ocrEvidence",
          "missing_ocr_provenance",
          "Supplement facts text exists but OCR provenance/evidence is missing."
        )
      );
      requiredBlockingFields.delete("supplementFacts.ocrEvidence");
      requiredWarningFields.add("supplementFacts.ocrEvidence");
    } else {
      blockingDefects.push(
        makeDefect(
          "supplementFacts.ocrEvidence",
          "missing_ocr_evidence",
          "OCR supplement facts evidence is required for image-based supplement facts panels."
        )
      );
    }
  } else {
    notApplicableFields.push(
      "supplementFacts.servingSize",
      "supplementFacts.servingsPerContainer",
      "supplementFacts.activeIngredients",
      "supplementFacts.otherIngredients",
      "supplementFacts.ocrEvidence"
    );
  }

  requiredWarningFields.add("quality.keyFeatures");
  notApplicableFields.push("quality.keyFeatures");
  requiredWarningFields.delete("quality.keyFeatures");

  requiredWarningFields.add("quality.dietaryAttributes");
  notApplicableFields.push("quality.dietaryAttributes");
  requiredWarningFields.delete("quality.dietaryAttributes");

  requiredWarningFields.add("quality.certifications");
  notApplicableFields.push("quality.certifications");
  requiredWarningFields.delete("quality.certifications");

  requiredWarningFields.add("quality.manufacturingClaims");
  notApplicableFields.push("quality.manufacturingClaims");
  requiredWarningFields.delete("quality.manufacturingClaims");

  requiredWarningFields.add("quality.marketingBullets");
  notApplicableFields.push("quality.marketingBullets");
  requiredWarningFields.delete("quality.marketingBullets");

  requiredWarningFields.add("assets.mockupUrl");
  if (params.assets?.mockupUrl || params.assets?.mockupTemplateTifUrl) {
    satisfiedWarningFields.add("assets.mockupUrl");
  } else if (params.assets?.labelTemplateUrl || params.assets?.labelTemplateAiUrl) {
    warningDefects.push(
      makeDefect("assets.mockupUrl", "missing_mockup_url", "Mockup URL is recommended when a label template exists.")
    );
  } else {
    notApplicableFields.push("assets.mockupUrl");
    requiredWarningFields.delete("assets.mockupUrl");
  }

  requiredWarningFields.add("assets.secondaryAssetLinks");
  if (
    (params.assets?.labelTemplateUrl || params.assets?.labelTemplateAiUrl) &&
    (params.assets?.mockupUrl || params.assets?.mockupTemplateTifUrl)
  ) {
    satisfiedWarningFields.add("assets.secondaryAssetLinks");
  } else if (
    params.assets?.labelTemplateUrl ||
    params.assets?.labelTemplateAiUrl ||
    params.assets?.mockupUrl ||
    params.assets?.mockupTemplateTifUrl
  ) {
    warningDefects.push(
      makeDefect("assets.secondaryAssetLinks", "missing_secondary_assets", "Secondary asset links are recommended for merchandising quality.")
    );
  } else {
    notApplicableFields.push("assets.secondaryAssetLinks");
    requiredWarningFields.delete("assets.secondaryAssetLinks");
  }

  requiredWarningFields.add("apparel.sizingFields");
  if (skuType === "apparel") {
    warningDefects.push(makeDefect("apparel.sizingFields", "missing_optional_apparel_size_fields", "Apparel sizing fields are recommended when available."));
  } else {
    notApplicableFields.push("apparel.sizingFields");
    requiredWarningFields.delete("apparel.sizingFields");
  }

  requiredWarningFields.add("readiness.usableForOptiPixel");
  requiredWarningFields.add("readiness.readyForChannelImageGeneration");

  let status: RocktomicSkuValidationStatus = "usable";
  const missingFields = Array.from(new Set([...blockingDefects.map((defect) => defect.field), ...warningDefects.map((defect) => defect.field)])).sort(
    (left, right) => left.localeCompare(right)
  );

  const recordAbsence = !params.sourceFacts && !params.pricing && !params.inventory && !params.assets;
  if (recordAbsence && params.sourceErrors.length > 0) {
    status = "extraction_error";
  } else if (recordAbsence) {
    status = "not_applicable";
  } else if (blockingDefects.length > 0) {
    status = "blocked";
  } else if (warningDefects.length > 0) {
    status = "usable_with_warnings";
  }

  const hasCoreFacts = Boolean(productName && params.pricing && params.inventory);
  const hasAssetForImage = Boolean(
    params.assets?.labelTemplateUrl ||
      params.assets?.mockupUrl ||
      params.assets?.labelTemplateAiUrl ||
      params.assets?.mockupTemplateTifUrl
  );
  const hasOptiPixelAssets = Boolean(params.assets?.labelTemplateAiUrl && params.assets?.mockupTemplateTifUrl);
  const ocrNeedsReview = Boolean(params.sourceFacts?.sourceEvidence?.supplementFacts?.needsReview);
  const isSkuUsable = status === "usable" || status === "usable_with_warnings";
  const hasExtractionError = status === "extraction_error";

  const readiness: RocktomicReadinessFlags = {
    usableForProductEditor: isSkuUsable && hasCoreFacts,
    usableForGenerateIntelligence: isSkuUsable && hasCoreFacts,
    usableForImageStudio: isSkuUsable && hasAssetForImage,
    usableForOptiPixel: isSkuUsable && hasOptiPixelAssets && !ocrNeedsReview,
    usableForOptiBay: isSkuUsable && hasCoreFacts,
    usableForOptiWal: isSkuUsable && hasCoreFacts,
    usableForOptizon: isSkuUsable && hasCoreFacts,
    readyForChannelImageGeneration: isSkuUsable && hasAssetForImage && !ocrNeedsReview,
  };

  if (readiness.usableForOptiPixel) {
    satisfiedWarningFields.add("readiness.usableForOptiPixel");
  } else {
    warningDefects.push(
      makeDefect("readiness.usableForOptiPixel", "not_ready_for_optipixel", "SKU is not yet ready for OptiPixel asset workflows.")
    );
  }
  if (readiness.readyForChannelImageGeneration) {
    satisfiedWarningFields.add("readiness.readyForChannelImageGeneration");
  } else {
    warningDefects.push(
      makeDefect(
        "readiness.readyForChannelImageGeneration",
        "not_ready_for_channel_image_generation",
        "SKU is not yet ready for channel image generation."
      )
    );
  }

  const readinessSummary = [
    boolSummary(readiness.usableForProductEditor, "product_editor_ready", "product_editor_not_ready"),
    boolSummary(readiness.usableForGenerateIntelligence, "generate_intelligence_ready", "generate_intelligence_not_ready"),
    boolSummary(readiness.usableForImageStudio, "image_studio_ready", "image_studio_not_ready"),
    boolSummary(readiness.usableForOptiPixel, "optipixel_ready", "optipixel_not_ready"),
    boolSummary(readiness.usableForOptiBay, "optibay_ready", "optibay_not_ready"),
    boolSummary(readiness.usableForOptiWal, "optiwal_ready", "optiwal_not_ready"),
    boolSummary(readiness.usableForOptizon, "optizon_ready", "optizon_not_ready"),
    boolSummary(readiness.readyForChannelImageGeneration, "channel_image_generation_ready", "channel_image_generation_not_ready"),
    boolSummary(hasExtractionError, "extraction_error_detected", "no_extraction_error"),
  ];

  return {
    sku: params.sku,
    productName,
    skuType,
    status,
    blockingDefects,
    warningDefects,
    notApplicableFields: Array.from(new Set(notApplicableFields)).sort((left, right) => left.localeCompare(right)),
    sourceNotes,
    missingFields,
    readiness,
    readinessSummary,
    requiredBlockingFields: Array.from(requiredBlockingFields).sort((left, right) => left.localeCompare(right)),
    satisfiedBlockingFields: Array.from(satisfiedBlockingFields).sort((left, right) => left.localeCompare(right)),
    requiredWarningFields: Array.from(requiredWarningFields).sort((left, right) => left.localeCompare(right)),
    satisfiedWarningFields: Array.from(satisfiedWarningFields).sort((left, right) => left.localeCompare(right)),
  };
}

function summarizeFieldCoverage(
  skuResults: RocktomicSkuValidationResult[],
  allFields: readonly string[],
  fieldType: "blocking" | "warning"
): Record<string, RocktomicFieldCoverageSummary> {
  const summary: Record<string, RocktomicFieldCoverageSummary> = {};

  for (const field of allFields) {
    let requiredSkuCount = 0;
    let presentSkuCount = 0;

    for (const sku of skuResults) {
      const required = fieldType === "blocking" ? sku.requiredBlockingFields.includes(field) : sku.requiredWarningFields.includes(field);
      if (!required) continue;
      requiredSkuCount += 1;
      const present = fieldType === "blocking" ? sku.satisfiedBlockingFields.includes(field) : sku.satisfiedWarningFields.includes(field);
      if (present) presentSkuCount += 1;
    }

    summary[field] = {
      requiredSkuCount,
      presentSkuCount,
      missingSkuCount: Math.max(0, requiredSkuCount - presentSkuCount),
    };
  }

  return summary;
}

export function evaluateRocktomicPackageValidation(input: EvaluatePackageInput): RocktomicPackageValidationResult {
  const allSkus = Array.from(
    new Set([
      ...Object.keys(input.sourceFactsBySku),
      ...Object.keys(input.pricingBySku),
      ...Object.keys(input.inventoryBySku),
      ...Object.keys(input.assetsBySku),
    ])
  ).sort((left, right) => left.localeCompare(right));

  const skuValidationResults = allSkus.map((sku) =>
    evaluateSku({
      sku,
      sourceFacts: input.sourceFactsBySku[sku],
      pricing: input.pricingBySku[sku],
      inventory: input.inventoryBySku[sku],
      assets: input.assetsBySku[sku],
      sourceErrors: input.sourceErrors,
    })
  );

  const usableSkuCount = skuValidationResults.filter((sku) => sku.status === "usable").length;
  const usableWithWarningsSkuCount = skuValidationResults.filter((sku) => sku.status === "usable_with_warnings").length;
  const blockedSkuCount = skuValidationResults.filter((sku) => sku.status === "blocked").length;
  const extractionErrorSkuCount = skuValidationResults.filter((sku) => sku.status === "extraction_error").length;
  const ocrNeedsReviewSkuCount = skuValidationResults.filter((sku) =>
    sku.warningDefects.some((defect) => defect.field === "supplementFacts.ocrEvidence")
  ).length;
  const usableForOptiPixelSkuCount = skuValidationResults.filter((sku) => sku.readiness.usableForOptiPixel).length;
  const readyForChannelImageGenerationSkuCount = skuValidationResults.filter(
    (sku) => sku.readiness.readyForChannelImageGeneration
  ).length;

  let packageStatus: RocktomicPackageValidationStatus = "pass";
  if (
    blockedSkuCount > 0 ||
    extractionErrorSkuCount > 0 ||
    input.sourceErrors.length > PACKAGE_SOURCE_ERROR_FAIL_THRESHOLD
  ) {
    packageStatus = "fail";
  } else if (skuValidationResults.some((sku) => sku.warningDefects.length > 0)) {
    packageStatus = "pass_with_warnings";
  }

  const packageDefects: RocktomicValidationDefect[] = [];
  if (blockedSkuCount > 0) {
    packageDefects.push(
      makeDefect("package.blockedSkus", "blocked_skus_present", `Package has ${blockedSkuCount} blocked SKU(s).`)
    );
  }
  if (extractionErrorSkuCount > 0) {
    packageDefects.push(
      makeDefect(
        "package.extractionErrors",
        "sku_extraction_errors_present",
        `Package has ${extractionErrorSkuCount} extraction-error SKU(s).`
      )
    );
  }
  if (input.sourceErrors.length > PACKAGE_SOURCE_ERROR_FAIL_THRESHOLD) {
    packageDefects.push(
      makeDefect(
        "package.sourceErrors",
        "source_errors_above_threshold",
        `Source errors (${input.sourceErrors.length}) exceed fail threshold (${PACKAGE_SOURCE_ERROR_FAIL_THRESHOLD}).`
      )
    );
  }

  const blockingFieldCoverageSummary = summarizeFieldCoverage(skuValidationResults, BLOCKING_FIELDS, "blocking");
  const warningFieldCoverageSummary = summarizeFieldCoverage(skuValidationResults, WARNING_FIELDS, "warning");

  const fieldCoverageSummary: Record<string, RocktomicFieldCoverageSummary> = {
    ...blockingFieldCoverageSummary,
    ...warningFieldCoverageSummary,
  };

  return {
    generatedAt: input.generatedAt,
    supplierId: "rocktomic",
    packageVersion: input.packageVersion,
    validationPolicyVersion: ROCKTOMIC_VALIDATION_POLICY_VERSION,
    totalSkusDiscovered: allSkus.length,
    totalSkusValidated: skuValidationResults.length,
    packageStatus,
    usableSkuCount,
    usableWithWarningsSkuCount,
    blockedSkuCount,
    extractionErrorSkuCount,
    ocrNeedsReviewSkuCount,
    usableForOptiPixelSkuCount,
    readyForChannelImageGenerationSkuCount,
    fieldCoverageSummary,
    blockingFieldCoverageSummary,
    warningFieldCoverageSummary,
    skuValidationResults,
    packageDefects,
    sourceErrors: input.sourceErrors,
  };
}

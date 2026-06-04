import type { AssetsRecord, InventoryRecord, PricingRecord, SourceFactRecord } from "@/lib/ecomviper/suppliers/rocktomic-offline-audit";

export const ROCKTOMIC_VALIDATION_POLICY_VERSION = "rocktomic_phase4_3_v1";
const PACKAGE_SOURCE_ERROR_FAIL_THRESHOLD = 0;

export type RocktomicSkuType = "supplement" | "apparel" | "unknown";
export type RocktomicSkuValidationStatus = "usable" | "usable_with_warnings" | "blocked" | "not_applicable" | "extraction_error";
export type RocktomicPackageValidationStatus = "pass" | "pass_with_warnings" | "fail";
export type RocktomicReadinessStatus = "ready" | "ready_with_warnings" | "blocked" | "not_applicable" | "needs_review";

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
  ingredientMatchingReadiness: RocktomicReadinessStatus;
  productEditorFactsReadiness: RocktomicReadinessStatus;
  complianceEvidenceReadiness: RocktomicReadinessStatus;
  optiPixelAssetReadiness: RocktomicReadinessStatus;
  channelImageGenerationReadiness: RocktomicReadinessStatus;
  generateIntelligenceReadiness: RocktomicReadinessStatus;
  optiBayReadiness: RocktomicReadinessStatus;
  optiWalReadiness: RocktomicReadinessStatus;
  optiZonReadiness: RocktomicReadinessStatus;
}

export interface RocktomicSkuValidationResult {
  sku: string;
  productName: string | null;
  skuType: RocktomicSkuType;
  status: RocktomicSkuValidationStatus;
  blockingDefects: RocktomicValidationDefect[];
  warningDefects: RocktomicValidationDefect[];
  complianceEvidenceDefects: RocktomicValidationDefect[];
  assetReadinessDefects: RocktomicValidationDefect[];
  ingredientMatchingDefects: RocktomicValidationDefect[];
  productEditorFactsDefects: RocktomicValidationDefect[];
  notApplicableFields: string[];
  sourceNotes: string[];
  missingFields: string[];
  readiness: RocktomicReadinessFlags;
  readinessDefects: Record<string, RocktomicValidationDefect[]>;
  readinessWarnings: Record<string, RocktomicValidationDefect[]>;
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

export interface RocktomicValidationPolicyCalibrationReport {
  generatedAt: string;
  topGlobalBlockingDefectTypes: Array<{ defectField: string; count: number; sampleSkus: string[] }>;
  blockedOnlyByCoaCount: number;
  blockedOnlyByCoaSkus: string[];
  blockedBySupplementFactsOrIngredientsCount: number;
  blockedBySupplementFactsOrIngredientsSkus: string[];
  blockedByPricingDefectsCount: number;
  blockedByPricingDefectsSkus: string[];
  blockedByInventoryDefectsCount: number;
  blockedByInventoryDefectsSkus: string[];
  blockedByAssetDefectsCount: number;
  blockedByAssetDefectsSkus: string[];
  blockedByIdentityOrTypeDefectsCount: number;
  blockedByIdentityOrTypeDefectsSkus: string[];
  globalBlockedBeforeCalibration: number;
  globalBlockedAfterCalibration: number;
  missingCoaWarningCount: number;
  missingCoaNoLongerGlobalBlockCount: number;
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
  aiTextFactsCoverage: RocktomicFieldCoverageSummary;
  ocrFactsCoverage: RocktomicFieldCoverageSummary;
  supplementFactsCoverageTotal: RocktomicFieldCoverageSummary;
  aiLabelTextExtractionAttempted: number;
  aiLabelTextExtractionSucceeded: number;
  aiLabelTextNeedsReview: number;
  aiLabelTextNonPdfCompatible: number;
  aiLabelTextNoExtractableText: number;
  aiLabelTextExtractionErrors: number;
  usableForOptiPixelSkuCount: number;
  readyForChannelImageGenerationSkuCount: number;
  ingredientMatchingReadyCount: number;
  ingredientMatchingReadyWithWarningsCount: number;
  ingredientMatchingBlockedCount: number;
  productEditorFactsReadyCount: number;
  productEditorFactsReadyWithWarningsCount: number;
  productEditorFactsBlockedCount: number;
  complianceEvidenceReadyCount: number;
  complianceEvidenceReadyWithWarningsCount: number;
  complianceEvidenceBlockedCount: number;
  optiPixelAssetReadyCount: number;
  optiPixelAssetReadyWithWarningsCount: number;
  optiPixelAssetBlockedCount: number;
  missingCoaWarningCount: number;
  missingCoaNoLongerGlobalBlockCount: number;
  globalBlockedBeforeCalibration: number;
  globalBlockedAfterCalibration: number;
  topBlockingDefectTypes: Array<{ defectField: string; count: number }>;
  topWarningDefectTypes: Array<{ defectField: string; count: number }>;
  readinessBreakdown: Record<string, { ready: number; readyWithWarnings: number; blocked: number; notApplicable: number; needsReview: number }>;
  fieldCoverageSummary: Record<string, RocktomicFieldCoverageSummary>;
  blockingFieldCoverageSummary: Record<string, RocktomicFieldCoverageSummary>;
  warningFieldCoverageSummary: Record<string, RocktomicFieldCoverageSummary>;
  skuValidationResults: RocktomicSkuValidationResult[];
  packageDefects: RocktomicValidationDefect[];
  sourceErrors: Array<{ sourceId: string; error: string }>;
  validationPolicyCalibrationReport: RocktomicValidationPolicyCalibrationReport;
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
  hasFactsText: boolean;
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
  "supplementFacts.aiOrOcrEvidence",
  "assets.labelTemplateOrEquivalent",
  "assets.usableProductAsset",
] as const;

const WARNING_FIELDS = [
  "assets.coaUrl",
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
  "supplementFacts.aiNeedsReview",
] as const;

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
    hasFactsText: Boolean((structured && Object.keys(structured).length > 0) || facts.trim()),
    containerSize: extractSizeToken(combined),
    productWeight: extractSizeToken(params.productName || ""),
  };
}

function pushFieldCoverage(
  requiredSet: Set<string>,
  satisfiedSet: Set<string>,
  defects: RocktomicValidationDefect[],
  field: string,
  satisfied: boolean,
  code: string,
  message: string
): void {
  requiredSet.add(field);
  if (satisfied) {
    satisfiedSet.add(field);
  } else {
    defects.push(makeDefect(field, code, message));
  }
}

function toReadinessStatus(input: {
  blocked: RocktomicValidationDefect[];
  warnings: RocktomicValidationDefect[];
  applicable?: boolean;
  needsReview?: boolean;
}): RocktomicReadinessStatus {
  if (input.applicable === false) return "not_applicable";
  if (input.blocked.length > 0) return "blocked";
  if (input.needsReview) return "needs_review";
  if (input.warnings.length > 0) return "ready_with_warnings";
  return "ready";
}

function readinessStatusToBool(status: RocktomicReadinessStatus): boolean {
  return status === "ready" || status === "ready_with_warnings" || status === "needs_review";
}

function summarizeDefectTypes(rows: RocktomicSkuValidationResult[], key: "blockingDefects" | "warningDefects", limit = 12): Array<{ defectField: string; count: number }> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    for (const defect of row[key]) {
      counts.set(defect.field, (counts.get(defect.field) || 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([defectField, count]) => ({ defectField, count }));
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

function summarizeCalibrationReport(input: {
  generatedAt: string;
  skuValidationResults: RocktomicSkuValidationResult[];
  globalBlockedBeforeCalibration: number;
  globalBlockedAfterCalibration: number;
  missingCoaWarningCount: number;
  missingCoaNoLongerGlobalBlockCount: number;
}): RocktomicValidationPolicyCalibrationReport {
  const blockedRows = input.skuValidationResults.filter((row) => row.status === "blocked");
  const sampleLimit = 12;

  const topCounts = new Map<string, { count: number; sampleSkus: string[] }>();
  for (const row of blockedRows) {
    for (const defect of row.blockingDefects) {
      const existing = topCounts.get(defect.field) || { count: 0, sampleSkus: [] };
      existing.count += 1;
      if (existing.sampleSkus.length < sampleLimit && !existing.sampleSkus.includes(row.sku)) {
        existing.sampleSkus.push(row.sku);
      }
      topCounts.set(defect.field, existing);
    }
  }

  const topGlobalBlockingDefectTypes = Array.from(topCounts.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 12)
    .map(([defectField, value]) => ({ defectField, count: value.count, sampleSkus: value.sampleSkus }));

  const blockedOnlyByCoaRows = input.skuValidationResults.filter((row) => {
    const coaAsWarning = row.warningDefects.some((defect) => defect.field === "assets.coaUrl");
    return coaAsWarning && row.blockingDefects.length === 0;
  });

  const hasField = (row: RocktomicSkuValidationResult, checker: (field: string) => boolean) =>
    row.blockingDefects.some((defect) => checker(defect.field));

  return {
    generatedAt: input.generatedAt,
    topGlobalBlockingDefectTypes,
    blockedOnlyByCoaCount: blockedOnlyByCoaRows.length,
    blockedOnlyByCoaSkus: blockedOnlyByCoaRows.slice(0, sampleLimit).map((row) => row.sku),
    blockedBySupplementFactsOrIngredientsCount: blockedRows.filter((row) => hasField(row, (field) => field.startsWith("supplementFacts."))).length,
    blockedBySupplementFactsOrIngredientsSkus: blockedRows
      .filter((row) => hasField(row, (field) => field.startsWith("supplementFacts.")))
      .slice(0, sampleLimit)
      .map((row) => row.sku),
    blockedByPricingDefectsCount: blockedRows.filter((row) => hasField(row, (field) => field.startsWith("pricing."))).length,
    blockedByPricingDefectsSkus: blockedRows
      .filter((row) => hasField(row, (field) => field.startsWith("pricing.")))
      .slice(0, sampleLimit)
      .map((row) => row.sku),
    blockedByInventoryDefectsCount: blockedRows.filter((row) => hasField(row, (field) => field.startsWith("inventory."))).length,
    blockedByInventoryDefectsSkus: blockedRows
      .filter((row) => hasField(row, (field) => field.startsWith("inventory.")))
      .slice(0, sampleLimit)
      .map((row) => row.sku),
    blockedByAssetDefectsCount: blockedRows.filter((row) => hasField(row, (field) => field.startsWith("assets."))).length,
    blockedByAssetDefectsSkus: blockedRows
      .filter((row) => hasField(row, (field) => field.startsWith("assets.")))
      .slice(0, sampleLimit)
      .map((row) => row.sku),
    blockedByIdentityOrTypeDefectsCount: blockedRows.filter((row) => hasField(row, (field) => field === "sku" || field === "productName" || field === "productType")).length,
    blockedByIdentityOrTypeDefectsSkus: blockedRows
      .filter((row) => hasField(row, (field) => field === "sku" || field === "productName" || field === "productType"))
      .slice(0, sampleLimit)
      .map((row) => row.sku),
    globalBlockedBeforeCalibration: input.globalBlockedBeforeCalibration,
    globalBlockedAfterCalibration: input.globalBlockedAfterCalibration,
    missingCoaWarningCount: input.missingCoaWarningCount,
    missingCoaNoLongerGlobalBlockCount: input.missingCoaNoLongerGlobalBlockCount,
  };
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
  const complianceEvidenceDefects: RocktomicValidationDefect[] = [];
  const assetReadinessDefects: RocktomicValidationDefect[] = [];
  const ingredientMatchingDefects: RocktomicValidationDefect[] = [];
  const productEditorFactsDefects: RocktomicValidationDefect[] = [];
  const notApplicableFields: string[] = [];
  const sourceNotes = params.sourceErrors.map((entry) => `${entry.sourceId}: ${entry.error}`);

  const requiredBlockingFields = new Set<string>();
  const satisfiedBlockingFields = new Set<string>();
  const requiredWarningFields = new Set<string>();
  const satisfiedWarningFields = new Set<string>();

  pushFieldCoverage(requiredBlockingFields, satisfiedBlockingFields, blockingDefects, "sku", Boolean(params.sku.trim()), "missing_sku", "SKU is missing from the package row.");

  pushFieldCoverage(
    requiredBlockingFields,
    satisfiedBlockingFields,
    blockingDefects,
    "productName",
    Boolean(productName?.trim()),
    "missing_product_name",
    "Product name is required for downstream usability."
  );

  pushFieldCoverage(
    requiredBlockingFields,
    satisfiedBlockingFields,
    blockingDefects,
    "source.catalogRow",
    Boolean(params.sourceFacts),
    "missing_catalog_row",
    "Catalog/source facts row is missing for SKU."
  );

  pushFieldCoverage(requiredBlockingFields, satisfiedBlockingFields, blockingDefects, "pricing.record", Boolean(params.pricing), "missing_pricing_record", "Pricing record is required.");

  pushFieldCoverage(
    requiredBlockingFields,
    satisfiedBlockingFields,
    blockingDefects,
    "pricing.wholesaleCostOrMembership",
    Boolean(params.pricing && (params.pricing.wholesaleCost != null || Object.keys(params.pricing.membershipTierCosts || {}).length > 0)),
    "missing_pricing_values",
    "Pricing record must include wholesale or membership tier cost data."
  );

  pushFieldCoverage(requiredBlockingFields, satisfiedBlockingFields, blockingDefects, "inventory.record", Boolean(params.inventory), "missing_inventory_record", "Inventory record is required.");

  pushFieldCoverage(
    requiredBlockingFields,
    satisfiedBlockingFields,
    blockingDefects,
    "inventory.availability",
    Boolean(params.inventory && params.inventory.inventoryStatus !== "missing"),
    "missing_inventory_availability",
    "Inventory availability value is missing."
  );

  pushFieldCoverage(
    requiredBlockingFields,
    satisfiedBlockingFields,
    blockingDefects,
    "assets.record",
    Boolean(params.assets),
    "missing_assets_record",
    "Assets record is required when validating SKU readiness."
  );

  const supplementSignals = extractSupplementFactsSignals({
    productName,
    supplementFactsText: params.sourceFacts?.supplementFactsText || null,
    supplementFactsStructured: params.sourceFacts?.supplementFacts || null,
  });

  if (skuType === "supplement") {
    pushFieldCoverage(
      requiredBlockingFields,
      satisfiedBlockingFields,
      blockingDefects,
      "supplementFacts.servingSize",
      supplementSignals.hasServingSize,
      "missing_serving_size",
      "Supplement serving size was not detected."
    );

    pushFieldCoverage(
      requiredBlockingFields,
      satisfiedBlockingFields,
      blockingDefects,
      "supplementFacts.servingsPerContainer",
      supplementSignals.hasServingsPerContainer,
      "missing_servings_per_container",
      "Supplement servings-per-container value was not detected."
    );

    pushFieldCoverage(
      requiredBlockingFields,
      satisfiedBlockingFields,
      blockingDefects,
      "supplementFacts.activeIngredients",
      supplementSignals.hasActiveIngredients,
      "missing_active_ingredients",
      "Active ingredient facts were not detected for supplement SKU."
    );

    requiredWarningFields.add("supplementFacts.otherIngredients");
    if (supplementSignals.hasOtherIngredients) {
      satisfiedWarningFields.add("supplementFacts.otherIngredients");
    } else {
      warningDefects.push(
        makeDefect(
          "supplementFacts.otherIngredients",
          "missing_other_ingredients",
          "Other ingredients were not detected; this does not block ingredient matching."
        )
      );
    }

    if (!supplementSignals.containerSize) {
      notApplicableFields.push("supplementFacts.containerSize");
    }
    if (!supplementSignals.productWeight) {
      notApplicableFields.push("supplementFacts.productWeight");
    }

    const evidenceMethod = params.sourceFacts?.sourceEvidence?.supplementFacts?.sourceMethod || null;
    const hasAiOrOcrEvidence = evidenceMethod === "ai_pdf_text" || evidenceMethod === "ocr";
    pushFieldCoverage(
      requiredBlockingFields,
      satisfiedBlockingFields,
      blockingDefects,
      "supplementFacts.aiOrOcrEvidence",
      hasAiOrOcrEvidence,
      "missing_ai_or_ocr_evidence",
      "AI/OCR supplement facts evidence is required for supplement SKU provenance."
    );

    const aiNeedsReview = evidenceMethod === "ai_pdf_text" && Boolean(params.sourceFacts?.sourceEvidence?.supplementFacts?.needsReview);
    requiredWarningFields.add("supplementFacts.aiNeedsReview");
    if (aiNeedsReview) {
      warningDefects.push(
        makeDefect(
          "supplementFacts.aiNeedsReview",
          "ai_facts_review_needed",
          "AI-derived supplement facts were extracted but still require review."
        )
      );
    } else if (evidenceMethod === "ai_pdf_text") {
      satisfiedWarningFields.add("supplementFacts.aiNeedsReview");
    } else {
      notApplicableFields.push("supplementFacts.aiNeedsReview");
      requiredWarningFields.delete("supplementFacts.aiNeedsReview");
    }
  } else {
    notApplicableFields.push(
      "supplementFacts.servingSize",
      "supplementFacts.servingsPerContainer",
      "supplementFacts.activeIngredients",
      "supplementFacts.otherIngredients",
      "supplementFacts.aiOrOcrEvidence",
      "supplementFacts.aiNeedsReview"
    );
  }

  // COA moved to warning/compliance evidence defect, not global blocker.
  requiredWarningFields.add("assets.coaUrl");
  if (params.assets?.coaUrl) {
    satisfiedWarningFields.add("assets.coaUrl");
  } else {
    const coaDefect = makeDefect("assets.coaUrl", "missing_coa", "COA is missing; compliance evidence is incomplete.");
    warningDefects.push(coaDefect);
    complianceEvidenceDefects.push(coaDefect);
  }

  pushFieldCoverage(
    requiredBlockingFields,
    satisfiedBlockingFields,
    blockingDefects,
    "assets.labelTemplateOrEquivalent",
    Boolean(
      params.assets?.labelTemplateAiUrl ||
        params.assets?.mockupTemplateTifUrl ||
        params.assets?.catalogTemplateUrl ||
        params.assets?.labelTemplateUrl ||
        params.assets?.mockupUrl
    ),
    "missing_label_template",
    "SKU requires a label template or equivalent design asset."
  );

  pushFieldCoverage(
    requiredBlockingFields,
    satisfiedBlockingFields,
    blockingDefects,
    "assets.usableProductAsset",
    Boolean(
      params.assets?.labelTemplateAiUrl ||
        params.assets?.mockupTemplateTifUrl ||
        params.assets?.catalogTemplateUrl ||
        params.assets?.labelTemplateUrl ||
        params.assets?.mockupUrl ||
        params.assets?.coaUrl
    ),
    "missing_usable_asset",
    "No usable product/source asset detected."
  );

  requiredWarningFields.add("assets.labelTemplateAiUrl");
  if (!params.assets?.labelTemplateAiUrl) {
    const defect = makeDefect(
      "assets.labelTemplateAiUrl",
      "missing_label_template_ai",
      "Label template (.ai/equivalent) is missing; asset workflows may be degraded."
    );
    warningDefects.push(defect);
    assetReadinessDefects.push(defect);
  } else {
    satisfiedWarningFields.add("assets.labelTemplateAiUrl");
  }

  requiredWarningFields.add("assets.mockupTemplateTifUrl");
  if (!params.assets?.mockupTemplateTifUrl) {
    const defect = makeDefect(
      "assets.mockupTemplateTifUrl",
      "missing_mockup_template_tif",
      "3D mockup template (.tif/equivalent) is missing; image workflows may be degraded."
    );
    warningDefects.push(defect);
    assetReadinessDefects.push(defect);
  } else {
    satisfiedWarningFields.add("assets.mockupTemplateTifUrl");
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
    warningDefects.push(makeDefect("assets.mockupUrl", "missing_mockup_url", "Mockup URL is recommended when a label template exists."));
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

  const missingFields = Array.from(new Set([...blockingDefects.map((defect) => defect.field), ...warningDefects.map((defect) => defect.field)])).sort(
    (left, right) => left.localeCompare(right)
  );

  const recordAbsence = !params.sourceFacts && !params.pricing && !params.inventory && !params.assets;
  let status: RocktomicSkuValidationStatus = "usable";
  if (recordAbsence && params.sourceErrors.length > 0) {
    status = "extraction_error";
  } else if (recordAbsence) {
    status = "not_applicable";
  } else if (blockingDefects.length > 0) {
    status = "blocked";
  } else if (warningDefects.length > 0) {
    status = "usable_with_warnings";
  }

  const aiNeedsReview =
    params.sourceFacts?.sourceEvidence?.supplementFacts?.sourceMethod === "ai_pdf_text" &&
    Boolean(params.sourceFacts?.sourceEvidence?.supplementFacts?.needsReview);
  const ocrNeedsReview =
    params.sourceFacts?.sourceEvidence?.supplementFacts?.sourceMethod === "ocr" &&
    Boolean(params.sourceFacts?.sourceEvidence?.supplementFacts?.needsReview);
  const hasReviewFlag = aiNeedsReview || ocrNeedsReview;

  const ingredientBlocking: RocktomicValidationDefect[] = [];
  const ingredientWarnings: RocktomicValidationDefect[] = [];
  const productFactsBlocking: RocktomicValidationDefect[] = [];
  const productFactsWarnings: RocktomicValidationDefect[] = [];
  const complianceBlocking: RocktomicValidationDefect[] = [];
  const complianceWarnings: RocktomicValidationDefect[] = [];
  const optiPixelBlocking: RocktomicValidationDefect[] = [];
  const optiPixelWarnings: RocktomicValidationDefect[] = [];

  if (!params.sku.trim()) ingredientBlocking.push(makeDefect("sku", "missing_sku", "SKU is required for ingredient matching."));
  if (!productName?.trim()) ingredientBlocking.push(makeDefect("productName", "missing_product_name", "Product name is required for ingredient matching."));
  if (status === "extraction_error") ingredientBlocking.push(makeDefect("extraction", "extraction_error", "Extraction error prevents ingredient matching."));

  if (skuType === "supplement") {
    if (!supplementSignals.hasFactsText) {
      ingredientBlocking.push(makeDefect("supplementFacts", "missing_supplement_facts", "Supplement facts are required for ingredient matching."));
    }
    if (!supplementSignals.hasActiveIngredients) {
      ingredientBlocking.push(makeDefect("supplementFacts.activeIngredients", "missing_active_ingredients", "Active ingredients are required for ingredient matching."));
    }
    if (hasReviewFlag) {
      ingredientWarnings.push(
        makeDefect(
          "supplementFacts.review",
          "facts_needs_review",
          "Ingredient facts are usable but extraction confidence indicates review is recommended."
        )
      );
    }
  } else if (skuType === "unknown") {
    ingredientWarnings.push(makeDefect("productType", "unknown_product_type", "Product type is unknown; ingredient matching confidence may be reduced."));
  }

  if (warningDefects.some((defect) => defect.field === "assets.coaUrl")) {
    ingredientWarnings.push(makeDefect("assets.coaUrl", "missing_coa", "COA is missing; does not block ingredient matching."));
  }

  if (!params.sku.trim()) productFactsBlocking.push(makeDefect("sku", "missing_sku", "SKU is required for Product Editor facts readiness."));
  if (!productName?.trim()) productFactsBlocking.push(makeDefect("productName", "missing_product_name", "Product name is required for Product Editor facts readiness."));
  if (!params.sourceFacts) {
    productFactsBlocking.push(makeDefect("source.catalogRow", "missing_catalog_row", "Source facts row is required for Product Editor facts readiness."));
  }

  if (skuType === "supplement") {
    if (!supplementSignals.hasServingSize) {
      productFactsBlocking.push(makeDefect("supplementFacts.servingSize", "missing_serving_size", "Serving size is required for supplement Product Editor facts."));
    }
    if (!supplementSignals.hasServingsPerContainer) {
      productFactsBlocking.push(
        makeDefect("supplementFacts.servingsPerContainer", "missing_servings_per_container", "Servings per container is required for supplement Product Editor facts.")
      );
    }
    if (!supplementSignals.hasActiveIngredients) {
      productFactsBlocking.push(
        makeDefect("supplementFacts.activeIngredients", "missing_active_ingredients", "Active ingredients are required for supplement Product Editor facts.")
      );
    }
    if (!(params.sourceFacts?.sourceEvidence?.supplementFacts?.sourceMethod === "ai_pdf_text" || params.sourceFacts?.sourceEvidence?.supplementFacts?.sourceMethod === "ocr")) {
      productFactsWarnings.push(
        makeDefect("supplementFacts.aiOrOcrEvidence", "missing_facts_provenance", "Facts provenance is missing; Product Editor facts are less trustworthy.")
      );
    }
  }

  if (warningDefects.some((defect) => defect.field === "assets.coaUrl")) {
    productFactsWarnings.push(makeDefect("assets.coaUrl", "missing_coa", "COA is missing; does not block Product Editor facts readiness."));
  }

  if (!params.assets?.coaUrl) {
    complianceWarnings.push(makeDefect("assets.coaUrl", "missing_coa", "COA is missing for compliance evidence."));
  }
  if (!(params.sourceFacts?.sourceEvidence?.supplementFacts?.sourceMethod === "ai_pdf_text" || params.sourceFacts?.sourceEvidence?.supplementFacts?.sourceMethod === "ocr")) {
    complianceBlocking.push(makeDefect("supplementFacts.aiOrOcrEvidence", "missing_facts_provenance", "Facts provenance is required for compliance evidence readiness."));
  }

  if (!params.assets?.labelTemplateAiUrl) {
    optiPixelBlocking.push(makeDefect("assets.labelTemplateAiUrl", "missing_label_template_ai", "Label template AI asset is required for OptiPixel asset readiness."));
  }
  if (!params.assets?.mockupTemplateTifUrl) {
    optiPixelBlocking.push(makeDefect("assets.mockupTemplateTifUrl", "missing_mockup_template_tif", "Mockup template TIF asset is required for OptiPixel asset readiness."));
  }
  if (status === "extraction_error") {
    optiPixelWarnings.push(makeDefect("extraction", "extraction_error", "Extraction error may reduce confidence in OptiPixel asset metadata."));
  }

  ingredientMatchingDefects.push(...ingredientBlocking);
  productEditorFactsDefects.push(...productFactsBlocking);

  const ingredientStatus = toReadinessStatus({
    blocked: ingredientBlocking,
    warnings: ingredientWarnings,
    applicable: status !== "not_applicable" && status !== "extraction_error",
    needsReview: hasReviewFlag && ingredientBlocking.length === 0,
  });
  const productEditorFactsStatus = toReadinessStatus({
    blocked: productFactsBlocking,
    warnings: productFactsWarnings,
    applicable: status !== "not_applicable" && status !== "extraction_error",
    needsReview: hasReviewFlag && productFactsBlocking.length === 0,
  });
  const complianceStatus = toReadinessStatus({
    blocked: complianceBlocking,
    warnings: complianceWarnings,
    applicable: status !== "not_applicable",
  });
  const optiPixelStatus = toReadinessStatus({
    blocked: optiPixelBlocking,
    warnings: optiPixelWarnings,
    applicable: status !== "not_applicable",
  });

  const channelImageStatus = toReadinessStatus({
    blocked: optiPixelBlocking,
    warnings: [...optiPixelWarnings, ...ingredientWarnings],
    applicable: status !== "not_applicable",
    needsReview: hasReviewFlag && optiPixelBlocking.length === 0,
  });

  const genIntelligenceStatus = toReadinessStatus({
    blocked: productFactsBlocking,
    warnings: [...productFactsWarnings, ...ingredientWarnings],
    applicable: status !== "not_applicable" && status !== "extraction_error",
    needsReview: hasReviewFlag && productFactsBlocking.length === 0,
  });

  const optiBayStatus = toReadinessStatus({
    blocked: ingredientBlocking,
    warnings: ingredientWarnings,
    applicable: status !== "not_applicable" && status !== "extraction_error",
    needsReview: hasReviewFlag && ingredientBlocking.length === 0,
  });
  const optiWalStatus = optiBayStatus;
  const optiZonStatus = optiBayStatus;

  const readinessDefects = {
    ingredientMatching: ingredientBlocking,
    productEditorFacts: productFactsBlocking,
    complianceEvidence: complianceBlocking,
    optiPixelAssets: optiPixelBlocking,
    channelImageGeneration: optiPixelBlocking,
    generateIntelligence: productFactsBlocking,
    optiBay: ingredientBlocking,
    optiWal: ingredientBlocking,
    optiZon: ingredientBlocking,
  };

  const readinessWarnings = {
    ingredientMatching: ingredientWarnings,
    productEditorFacts: productFactsWarnings,
    complianceEvidence: complianceWarnings,
    optiPixelAssets: optiPixelWarnings,
    channelImageGeneration: [...optiPixelWarnings, ...ingredientWarnings],
    generateIntelligence: [...productFactsWarnings, ...ingredientWarnings],
    optiBay: ingredientWarnings,
    optiWal: ingredientWarnings,
    optiZon: ingredientWarnings,
  };

  const readiness: RocktomicReadinessFlags = {
    usableForProductEditor: readinessStatusToBool(productEditorFactsStatus),
    usableForGenerateIntelligence: readinessStatusToBool(genIntelligenceStatus),
    usableForImageStudio: readinessStatusToBool(channelImageStatus),
    usableForOptiPixel: readinessStatusToBool(optiPixelStatus),
    usableForOptiBay: readinessStatusToBool(optiBayStatus),
    usableForOptiWal: readinessStatusToBool(optiWalStatus),
    usableForOptizon: readinessStatusToBool(optiZonStatus),
    readyForChannelImageGeneration: readinessStatusToBool(channelImageStatus),
    ingredientMatchingReadiness: ingredientStatus,
    productEditorFactsReadiness: productEditorFactsStatus,
    complianceEvidenceReadiness: complianceStatus,
    optiPixelAssetReadiness: optiPixelStatus,
    channelImageGenerationReadiness: channelImageStatus,
    generateIntelligenceReadiness: genIntelligenceStatus,
    optiBayReadiness: optiBayStatus,
    optiWalReadiness: optiWalStatus,
    optiZonReadiness: optiZonStatus,
  };

  if (readiness.usableForOptiPixel) {
    satisfiedWarningFields.add("readiness.usableForOptiPixel");
  } else {
    warningDefects.push(
      makeDefect("readiness.usableForOptiPixel", "not_ready_for_optipixel", "SKU is not yet ready for OptiPixel asset workflows.")
    );
    assetReadinessDefects.push(
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
    assetReadinessDefects.push(
      makeDefect(
        "readiness.readyForChannelImageGeneration",
        "not_ready_for_channel_image_generation",
        "SKU is not yet ready for channel image generation."
      )
    );
  }

  const readinessSummary = [
    `ingredient_matching:${ingredientStatus}`,
    `product_editor_facts:${productEditorFactsStatus}`,
    `compliance_evidence:${complianceStatus}`,
    `optipixel_assets:${optiPixelStatus}`,
    `channel_images:${channelImageStatus}`,
    `generate_intelligence:${genIntelligenceStatus}`,
    `optibay:${optiBayStatus}`,
    `optiwal:${optiWalStatus}`,
    `optizon:${optiZonStatus}`,
  ];

  return {
    sku: params.sku,
    productName,
    skuType,
    status,
    blockingDefects,
    warningDefects,
    complianceEvidenceDefects,
    assetReadinessDefects,
    ingredientMatchingDefects,
    productEditorFactsDefects,
    notApplicableFields: Array.from(new Set(notApplicableFields)).sort((left, right) => left.localeCompare(right)),
    sourceNotes,
    missingFields,
    readiness,
    readinessDefects,
    readinessWarnings,
    readinessSummary,
    requiredBlockingFields: Array.from(requiredBlockingFields).sort((left, right) => left.localeCompare(right)),
    satisfiedBlockingFields: Array.from(satisfiedBlockingFields).sort((left, right) => left.localeCompare(right)),
    requiredWarningFields: Array.from(requiredWarningFields).sort((left, right) => left.localeCompare(right)),
    satisfiedWarningFields: Array.from(satisfiedWarningFields).sort((left, right) => left.localeCompare(right)),
  };
}

function summarizeReadiness(
  rows: RocktomicSkuValidationResult[],
  key: keyof Pick<
    RocktomicReadinessFlags,
    | "ingredientMatchingReadiness"
    | "productEditorFactsReadiness"
    | "complianceEvidenceReadiness"
    | "optiPixelAssetReadiness"
    | "channelImageGenerationReadiness"
    | "generateIntelligenceReadiness"
    | "optiBayReadiness"
    | "optiWalReadiness"
    | "optiZonReadiness"
  >
): { ready: number; readyWithWarnings: number; blocked: number; notApplicable: number; needsReview: number } {
  const out = { ready: 0, readyWithWarnings: 0, blocked: 0, notApplicable: 0, needsReview: 0 };
  for (const row of rows) {
    const status = row.readiness[key];
    if (status === "ready") out.ready += 1;
    if (status === "ready_with_warnings") out.readyWithWarnings += 1;
    if (status === "blocked") out.blocked += 1;
    if (status === "not_applicable") out.notApplicable += 1;
    if (status === "needs_review") out.needsReview += 1;
  }
  return out;
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
    sku.warningDefects.some((defect) => defect.field === "supplementFacts.aiNeedsReview" || defect.field === "supplementFacts.aiOrOcrEvidence")
  ).length;

  const supplementRequiredSkus = skuValidationResults.filter((sku) => sku.skuType === "supplement");
  const sourceFactsBySku = input.sourceFactsBySku;

  const aiEvidencePresentCount = supplementRequiredSkus.filter(
    (sku) => sourceFactsBySku[sku.sku]?.sourceEvidence?.supplementFacts?.sourceMethod === "ai_pdf_text"
  ).length;
  const ocrEvidencePresentCount = supplementRequiredSkus.filter(
    (sku) => sourceFactsBySku[sku.sku]?.sourceEvidence?.supplementFacts?.sourceMethod === "ocr"
  ).length;
  const totalEvidencePresentCount = supplementRequiredSkus.filter((sku) => {
    const method = sourceFactsBySku[sku.sku]?.sourceEvidence?.supplementFacts?.sourceMethod;
    return method === "ai_pdf_text" || method === "ocr";
  }).length;

  const aiLabelTextExtractionAttempted = Object.values(input.assetsBySku).filter(
    (asset) =>
      asset?.extractionStatus === "success" ||
      asset?.extractionStatus === "reused_cached" ||
      asset?.extractionStatus === "non_pdf_ai" ||
      asset?.extractionStatus === "no_extractable_text" ||
      asset?.extractionStatus === "extraction_error"
  ).length;
  const aiLabelTextExtractionSucceeded = Object.values(input.assetsBySku).filter(
    (asset) => asset?.extractionStatus === "success" || asset?.extractionStatus === "reused_cached"
  ).length;
  const aiLabelTextNeedsReview = Object.values(input.sourceFactsBySku).filter(
    (fact) => fact?.sourceEvidence?.supplementFacts?.sourceMethod === "ai_pdf_text" && fact.sourceEvidence?.supplementFacts?.needsReview
  ).length;
  const aiLabelTextNonPdfCompatible = Object.values(input.assetsBySku).filter((asset) => asset?.extractionStatus === "non_pdf_ai").length;
  const aiLabelTextNoExtractableText = Object.values(input.assetsBySku).filter((asset) => asset?.extractionStatus === "no_extractable_text").length;
  const aiLabelTextExtractionErrors = Object.values(input.assetsBySku).filter((asset) => asset?.extractionStatus === "extraction_error").length;
  const usableForOptiPixelSkuCount = skuValidationResults.filter((sku) => sku.readiness.usableForOptiPixel).length;
  const readyForChannelImageGenerationSkuCount = skuValidationResults.filter(
    (sku) => sku.readiness.readyForChannelImageGeneration
  ).length;

  const ingredientBreakdown = summarizeReadiness(skuValidationResults, "ingredientMatchingReadiness");
  const productEditorBreakdown = summarizeReadiness(skuValidationResults, "productEditorFactsReadiness");
  const complianceBreakdown = summarizeReadiness(skuValidationResults, "complianceEvidenceReadiness");
  const optiPixelBreakdown = summarizeReadiness(skuValidationResults, "optiPixelAssetReadiness");

  // Before-calibration simulation: COA was a global blocking condition for supplement SKUs.
  const globalBlockedBeforeCalibration = skuValidationResults.filter((row) => {
    if (row.status === "blocked" || row.status === "extraction_error") return true;
    return row.skuType === "supplement" && row.warningDefects.some((defect) => defect.field === "assets.coaUrl");
  }).length;
  const globalBlockedAfterCalibration = blockedSkuCount;

  const missingCoaWarningCount = skuValidationResults.filter((row) => row.warningDefects.some((defect) => defect.field === "assets.coaUrl")).length;
  const missingCoaNoLongerGlobalBlockCount = skuValidationResults.filter((row) => {
    const hasMissingCoa = row.warningDefects.some((defect) => defect.field === "assets.coaUrl");
    return hasMissingCoa && row.status !== "blocked" && row.status !== "extraction_error";
  }).length;

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

  const topBlockingDefectTypes = summarizeDefectTypes(skuValidationResults, "blockingDefects");
  const topWarningDefectTypes = summarizeDefectTypes(skuValidationResults, "warningDefects");

  const readinessBreakdown = {
    ingredientMatching: ingredientBreakdown,
    productEditorFacts: productEditorBreakdown,
    complianceEvidence: complianceBreakdown,
    optiPixelAssets: optiPixelBreakdown,
    channelImageGeneration: summarizeReadiness(skuValidationResults, "channelImageGenerationReadiness"),
    generateIntelligence: summarizeReadiness(skuValidationResults, "generateIntelligenceReadiness"),
    optiBay: summarizeReadiness(skuValidationResults, "optiBayReadiness"),
    optiWal: summarizeReadiness(skuValidationResults, "optiWalReadiness"),
    optiZon: summarizeReadiness(skuValidationResults, "optiZonReadiness"),
  };

  const calibrationReport = summarizeCalibrationReport({
    generatedAt: input.generatedAt,
    skuValidationResults,
    globalBlockedBeforeCalibration,
    globalBlockedAfterCalibration,
    missingCoaWarningCount,
    missingCoaNoLongerGlobalBlockCount,
  });

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
    aiTextFactsCoverage: {
      requiredSkuCount: supplementRequiredSkus.length,
      presentSkuCount: aiEvidencePresentCount,
      missingSkuCount: Math.max(0, supplementRequiredSkus.length - aiEvidencePresentCount),
    },
    ocrFactsCoverage: {
      requiredSkuCount: supplementRequiredSkus.length,
      presentSkuCount: ocrEvidencePresentCount,
      missingSkuCount: Math.max(0, supplementRequiredSkus.length - ocrEvidencePresentCount),
    },
    supplementFactsCoverageTotal: {
      requiredSkuCount: supplementRequiredSkus.length,
      presentSkuCount: totalEvidencePresentCount,
      missingSkuCount: Math.max(0, supplementRequiredSkus.length - totalEvidencePresentCount),
    },
    aiLabelTextExtractionAttempted,
    aiLabelTextExtractionSucceeded,
    aiLabelTextNeedsReview,
    aiLabelTextNonPdfCompatible,
    aiLabelTextNoExtractableText,
    aiLabelTextExtractionErrors,
    usableForOptiPixelSkuCount,
    readyForChannelImageGenerationSkuCount,
    ingredientMatchingReadyCount: ingredientBreakdown.ready,
    ingredientMatchingReadyWithWarningsCount: ingredientBreakdown.readyWithWarnings + ingredientBreakdown.needsReview,
    ingredientMatchingBlockedCount: ingredientBreakdown.blocked,
    productEditorFactsReadyCount: productEditorBreakdown.ready,
    productEditorFactsReadyWithWarningsCount: productEditorBreakdown.readyWithWarnings + productEditorBreakdown.needsReview,
    productEditorFactsBlockedCount: productEditorBreakdown.blocked,
    complianceEvidenceReadyCount: complianceBreakdown.ready,
    complianceEvidenceReadyWithWarningsCount: complianceBreakdown.readyWithWarnings + complianceBreakdown.needsReview,
    complianceEvidenceBlockedCount: complianceBreakdown.blocked,
    optiPixelAssetReadyCount: optiPixelBreakdown.ready,
    optiPixelAssetReadyWithWarningsCount: optiPixelBreakdown.readyWithWarnings + optiPixelBreakdown.needsReview,
    optiPixelAssetBlockedCount: optiPixelBreakdown.blocked,
    missingCoaWarningCount,
    missingCoaNoLongerGlobalBlockCount,
    globalBlockedBeforeCalibration,
    globalBlockedAfterCalibration,
    topBlockingDefectTypes,
    topWarningDefectTypes,
    readinessBreakdown,
    fieldCoverageSummary,
    blockingFieldCoverageSummary,
    warningFieldCoverageSummary,
    skuValidationResults,
    packageDefects,
    sourceErrors: input.sourceErrors,
    validationPolicyCalibrationReport: calibrationReport,
  };
}

import {
  assertRecordProvenance,
  calculateRecordSourceStatus,
  ensureUniqueMissingFields,
  type NormalizedSupplierIntelligencePackage,
  type NormalizedSupplierIntelligenceRecord,
} from "@/lib/ecomviper/suppliers/rocktomic/supplier-intelligence-schema";

export interface SupplierIntelligenceValidationSummary {
  generatedAt: string;
  supplierId: string;
  totalSkus: number;
  structuredSupplementFactsCount: number;
  imageTextOnlyCount: number;
  missingSupplementFactsCount: number;
  coaAvailableCount: number;
  pricingAvailableCount: number;
  inventoryAvailableCount: number;
  assetsAvailableCount: number;
  needsReviewCount: number;
  topMissingFields: Array<{ field: string; count: number }>;
  topParseExtractionErrors: Array<{ error: string; count: number }>;
  perSku: Array<{
    sku: string;
    productName: string | null;
    sourceStatus: string;
    hasServingSize: boolean;
    hasServingsPerContainer: boolean;
    hasActiveIngredients: boolean;
    hasAmountPerServing: boolean;
    coaStatus: "available" | "missing";
    pricingStatus: string;
    inventoryStatus: string;
    assetsStatus: string;
    missingFields: string[];
    issues: string[];
  }>;
}

function tally(list: string[]): Array<{ key: string; count: number }> {
  const counts = new Map<string, number>();
  for (const entry of list) {
    counts.set(entry, (counts.get(entry) || 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

function recordAssetsStatus(record: NormalizedSupplierIntelligenceRecord): string {
  if (record.labelTemplateUrl && record.mockupUrl) return "available";
  if (record.labelTemplateUrl || record.mockupUrl || record.imageUrls.length > 0) return "partial";
  return "missing";
}

export function validateSupplierIntelligencePackage(
  supplierPackage: NormalizedSupplierIntelligencePackage
): SupplierIntelligenceValidationSummary {
  const missingFieldPool: string[] = [];
  const parseErrorPool: string[] = [];

  let structuredSupplementFactsCount = 0;
  let imageTextOnlyCount = 0;
  let missingSupplementFactsCount = 0;
  let coaAvailableCount = 0;
  let pricingAvailableCount = 0;
  let inventoryAvailableCount = 0;
  let assetsAvailableCount = 0;
  let needsReviewCount = 0;

  const perSku = supplierPackage.records
    .map((record) => {
      const sourceStatus = calculateRecordSourceStatus(record);
      const hasAmountPerServing = record.activeIngredients.some((entry) => entry.amount != null)
        || record.nutrientFacts.some((entry) => entry.amount != null);

      if (sourceStatus === "structured" || sourceStatus === "partial") structuredSupplementFactsCount += 1;
      if (sourceStatus === "image_text_only") imageTextOnlyCount += 1;
      if (sourceStatus === "missing") missingSupplementFactsCount += 1;
      if (sourceStatus === "needs_review") needsReviewCount += 1;

      if (record.coaUrl) coaAvailableCount += 1;
      if (record.pricing.sourceStatus !== "missing") pricingAvailableCount += 1;
      if (record.inventory.sourceStatus !== "missing") inventoryAvailableCount += 1;
      if (recordAssetsStatus(record) !== "missing") assetsAvailableCount += 1;

      missingFieldPool.push(...record.missingFields);
      parseErrorPool.push(...assertRecordProvenance(record).map((entry) => `missing_${entry}`));

      if (sourceStatus === "image_text_only" && record.provenance.every((entry) => entry.confidence >= 0.7)) {
        parseErrorPool.push("image_text_only_without_low_confidence_evidence");
      }

      return {
        sku: record.sku,
        productName: record.productName,
        sourceStatus,
        hasServingSize: Boolean(record.servingSize),
        hasServingsPerContainer: record.servingsPerContainer != null,
        hasActiveIngredients: record.activeIngredients.length > 0,
        hasAmountPerServing,
        coaStatus: (record.coaUrl ? "available" : "missing") as "available" | "missing",
        pricingStatus: record.pricing.sourceStatus,
        inventoryStatus: record.inventory.sourceStatus,
        assetsStatus: recordAssetsStatus(record),
        missingFields: ensureUniqueMissingFields(record.missingFields),
        issues: assertRecordProvenance(record),
      };
    })
    .sort((a, b) => a.sku.localeCompare(b.sku));

  return {
    generatedAt: new Date().toISOString(),
    supplierId: supplierPackage.supplierId,
    totalSkus: supplierPackage.records.length,
    structuredSupplementFactsCount,
    imageTextOnlyCount,
    missingSupplementFactsCount,
    coaAvailableCount,
    pricingAvailableCount,
    inventoryAvailableCount,
    assetsAvailableCount,
    needsReviewCount,
    topMissingFields: tally(missingFieldPool).slice(0, 15).map((entry) => ({ field: entry.key, count: entry.count })),
    topParseExtractionErrors: tally(parseErrorPool).slice(0, 15).map((entry) => ({ error: entry.key, count: entry.count })),
    perSku,
  };
}

export function toSupplierIntelligenceAuditCsv(
  summary: SupplierIntelligenceValidationSummary
): string {
  const header = [
    "sku",
    "productName",
    "sourceStatus",
    "coaStatus",
    "pricingStatus",
    "inventoryStatus",
    "assetsStatus",
    "missingFields",
    "issues",
  ];

  const rows = summary.perSku.map((record) => [
    record.sku,
    record.productName || "",
    record.sourceStatus,
    record.coaStatus,
    record.pricingStatus,
    record.inventoryStatus,
    record.assetsStatus,
    record.missingFields.join("|"),
    record.issues.join("|"),
  ]);

  const escapeCsv = (value: string): string => {
    if (/[",\n]/.test(value)) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  };

  return `${header.join(",")}\n${rows.map((row) => row.map((entry) => escapeCsv(entry)).join(",")).join("\n")}\n`;
}

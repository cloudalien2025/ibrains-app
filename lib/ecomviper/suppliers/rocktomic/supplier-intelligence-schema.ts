export type SupplierIntelligenceSourceType =
  | "catalog_pdf"
  | "supplier_page"
  | "coa"
  | "label_template"
  | "pricing_sheet"
  | "inventory_sheet"
  | "policy_page"
  | "manual_fixture";

export type SupplierSourceStatus =
  | "structured"
  | "partial"
  | "image_text_only"
  | "missing"
  | "needs_review";

export interface SupplierFactProvenance {
  sourceType: SupplierIntelligenceSourceType;
  sourceUrl: string;
  pageNumber: number | null;
  extractedAt: string;
  extractor: string;
  rawSnippet: string;
  confidence: number;
}

export interface SupplierNutrientFact {
  name: string;
  amount: number | null;
  dailyValue: string | null;
  unit: string | null;
  rawText: string;
  confidence?: number;
  provenance: SupplierFactProvenance[];
}

export interface SupplierActiveIngredient {
  name: string;
  amount: number | null;
  unit: string | null;
  standardization: string | null;
  rawText: string;
  confidence?: number;
  provenance: SupplierFactProvenance[];
}

export interface SupplierPolicyRecord {
  sourceUrl: string | null;
  summary: string | null;
  provenance: SupplierFactProvenance[];
}

export interface NormalizedSupplierIntelligenceRecord {
  supplierId: string;
  supplierName: string;
  sku: string;
  productName: string | null;
  productType: string | null;
  brand: string | null;
  labelSize: string | null;
  containerSize: string | null;
  productWeight: string | null;
  servingSize: string | null;
  servingsPerContainer: number | null;
  nutrientFacts: SupplierNutrientFact[];
  activeIngredients: SupplierActiveIngredient[];
  otherIngredients: string[];
  suggestedUse: string | null;
  warnings: string | null;
  dietaryAttributes: string[];
  certifications: string[];
  manufacturingClaims: string[];
  coaUrl: string | null;
  labelTemplateUrl: string | null;
  mockupUrl: string | null;
  imageUrls: string[];
  pricing: {
    wholesaleCost: number | null;
    msrp: number | null;
    currency: string | null;
    sourceStatus: SupplierSourceStatus;
    provenance: SupplierFactProvenance[];
  };
  inventory: {
    status: string | null;
    quantityText: string | null;
    sourceStatus: SupplierSourceStatus;
    provenance: SupplierFactProvenance[];
  };
  shippingPolicy: SupplierPolicyRecord;
  returnPolicy: SupplierPolicyRecord;
  sourceStatus: SupplierSourceStatus;
  missingFields: string[];
  extractionWarnings?: string[];
  confidence: number;
  provenance: SupplierFactProvenance[];
}

export interface NormalizedSupplierIntelligencePackage {
  supplierId: string;
  supplierName: string;
  generatedAt: string;
  extractor: string;
  sourceManifestVersion: number;
  records: NormalizedSupplierIntelligenceRecord[];
}

export function normalizeSku(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "").trim();
}

export function ensureUniqueMissingFields(fields: string[]): string[] {
  return Array.from(new Set(fields.map((entry) => entry.trim()).filter(Boolean))).sort();
}

export function hasProvenance(entries: SupplierFactProvenance[] | null | undefined): boolean {
  return Boolean(entries && entries.length > 0 && entries.some((entry) => Boolean(entry.sourceUrl)));
}

export function calculateRecordSourceStatus(record: NormalizedSupplierIntelligenceRecord): SupplierSourceStatus {
  const hasStructuredNutrition = record.nutrientFacts.length > 0 || record.activeIngredients.length > 0;
  const hasServingSize = Boolean(record.servingSize);
  const hasServingsPerContainer = record.servingsPerContainer != null;
  const hasTextOnlyEvidence = record.provenance.some((entry) => entry.confidence < 0.7);
  if (!hasStructuredNutrition && hasTextOnlyEvidence) return "image_text_only";
  if (record.missingFields.length >= 8) return "missing";
  if (record.sourceStatus === "needs_review") return "needs_review";
  if (hasStructuredNutrition && hasServingSize && hasServingsPerContainer && record.missingFields.length <= 3) return "structured";
  if (hasStructuredNutrition) return "partial";
  return "missing";
}

export function assertRecordProvenance(record: NormalizedSupplierIntelligenceRecord): string[] {
  const issues: string[] = [];
  if (!record.sku) issues.push("sku");
  if (!record.productName) issues.push("productName");
  if (!hasProvenance(record.provenance)) issues.push("provenance");
  if (record.nutrientFacts.some((entry) => !hasProvenance(entry.provenance))) issues.push("nutrientFacts.provenance");
  if (record.activeIngredients.some((entry) => !hasProvenance(entry.provenance))) issues.push("activeIngredients.provenance");
  return issues;
}

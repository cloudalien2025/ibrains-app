export type SupplementFactsStatus = "structured" | "partial" | "visual_only" | "missing" | "not_applicable";
export type InventoryStatus = "in_stock" | "low_stock" | "out_of_stock" | "backordered" | "unknown";
export type PackageValidationStatus = "pass" | "pass_with_warnings" | "fail";

export interface FieldProvenanceEntry {
  source: string;
  row?: number;
  page?: number;
  column?: string;
  linkIndex?: number;
  url?: string;
  extractedAt?: string;
}

export interface NutrientFactEntry {
  name: string;
  amount: number | null;
  unit: string | null;
  dailyValue: string | null;
  rawText: string;
}

export interface ActiveIngredientEntry {
  name: string;
  amount: number | null;
  unit: string | null;
  rawText: string;
}

export interface SupplementFactsBlock {
  status: SupplementFactsStatus;
  servingSize: string | null;
  servingsPerContainer: number | null;
  nutrientFacts: NutrientFactEntry[];
  activeIngredients: ActiveIngredientEntry[];
  otherIngredients: string[];
}

export interface PricingTiers {
  t1?: number | null;
  t2?: number | null;
  t3?: number | null;
  t4?: number | null;
  t5?: number | null;
  t6?: number | null;
  t7?: number | null;
}

export interface PricingBlock {
  msrp: number | null;
  wholesaleCost: number | null;
  estimatedProfit: number | null;
  estimatedMarginPct: number | null;
  currency: string;
  tiers: PricingTiers;
}

export interface InventoryBlock {
  status: InventoryStatus;
  rawInventoryValue: string | null;
  replenishmentEta: string | null;
  replenishmentComments: string | null;
}

export interface MissingDataFlags {
  productName: boolean;
  category: boolean;
  pricing: boolean;
  msrp: boolean;
  inventory: boolean;
  coaUrl: boolean;
  labelTemplateUrl: boolean;
  mockupUrl: boolean;
  supplementFacts: boolean;
  provenance: boolean;
}

export interface RocktomicProductRecord {
  sku: string;
  productName: string | null;
  category: string | null;
  membershipAccess: string;
  labelSize: string | null;
  containerSize: string | null;
  productWeight: string | null;
  pricing: PricingBlock;
  inventory: InventoryBlock;
  coaUrl: string | null;
  labelTemplateUrl: string | null;
  mockupUrl: string | null;
  catalogPage: number | null;
  policyDocxParsed: boolean;
  policyDocxUrl: string | null;
  policyNormalizedSummary: string | null;
  supplementFacts: SupplementFactsBlock;
  productFeatures: string[];
  certifications: string[];
  missingData: MissingDataFlags;
  warnings: string[];
  provenance: Record<string, FieldProvenanceEntry>;
}

export interface RocktomicMasterPackage {
  packageVersion: string;
  generatedAt: string;
  sourceBundleId: string;
  sourceHashes: Record<string, string>;
  productCount: number;
  countsByCategory: Record<string, number>;
  countsByInventoryStatus: Record<string, number>;
  countsBySupplementFactsStatus: Record<string, number>;
  countsByMissingDataType: Record<string, number>;
  sourceIdentityReport: {
    overallValid: boolean;
    duplicateUrlCount: number;
    duplicateSheetIdCount: number;
    mislabelCount: number;
  };
  products: RocktomicProductRecord[];
}

export interface ProductValidationResult {
  sku: string;
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface PackageValidationReport {
  generatedAt: string;
  packageVersion: string;
  packageStatus: PackageValidationStatus;
  productCount: number;
  validProductCount: number;
  warningProductCount: number;
  invalidProductCount: number;
  supplementFactsCounts: Record<SupplementFactsStatus, number>;
  inventoryStatusCounts: Record<InventoryStatus | "unknown", number>;
  missingDataCounts: Partial<Record<keyof MissingDataFlags, number>>;
  perProduct: ProductValidationResult[];
}

function isValidUrl(value: string | null): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export function validateProductRecord(record: RocktomicProductRecord): ProductValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!record.sku || !/^ROC[A-Z0-9]+$/i.test(record.sku)) errors.push(`invalid_sku: "${record.sku}"`);
  if (!record.productName) warnings.push("missing_productName");
  if (!record.category) warnings.push("missing_category");
  if (record.membershipAccess === "unknown") warnings.push("unknown_membershipAccess");

  const { pricing } = record;
  if (pricing.msrp === null && pricing.wholesaleCost === null && Object.values(pricing.tiers).every((v) => v === null)) {
    warnings.push("missing_all_pricing");
  }

  if (record.inventory.status === "unknown") warnings.push("inventory_status_unknown");

  if (record.coaUrl && !isValidUrl(record.coaUrl)) errors.push(`invalid_coaUrl: "${record.coaUrl}"`);
  if (record.labelTemplateUrl && !isValidUrl(record.labelTemplateUrl)) errors.push(`invalid_labelTemplateUrl`);
  if (record.mockupUrl && !isValidUrl(record.mockupUrl)) errors.push(`invalid_mockupUrl`);

  const { supplementFacts } = record;
  if (supplementFacts.status === "structured") {
    if (!supplementFacts.servingSize) errors.push("structured_supplement_facts_missing_servingSize");
    if (supplementFacts.servingsPerContainer === null) errors.push("structured_supplement_facts_missing_servingsPerContainer");
    if (supplementFacts.nutrientFacts.length === 0 && supplementFacts.activeIngredients.length === 0) {
      errors.push("structured_supplement_facts_missing_facts");
    }
  }

  if (Object.keys(record.provenance).length === 0) warnings.push("missing_provenance");

  return { sku: record.sku, valid: errors.length === 0, errors, warnings };
}

export function validateMasterPackage(pkg: RocktomicMasterPackage): PackageValidationReport {
  const perProduct = pkg.products.map(validateProductRecord);

  let validProductCount = 0;
  let warningProductCount = 0;
  let invalidProductCount = 0;
  const supplementFactsCounts: Record<SupplementFactsStatus, number> = { structured: 0, partial: 0, visual_only: 0, missing: 0, not_applicable: 0 };
  const inventoryStatusCounts: Record<InventoryStatus | "unknown", number> = { in_stock: 0, low_stock: 0, out_of_stock: 0, backordered: 0, unknown: 0 };
  const missingDataCounts: Partial<Record<keyof MissingDataFlags, number>> = {};

  for (const result of perProduct) {
    if (!result.valid) invalidProductCount += 1;
    else if (result.warnings.length > 0) warningProductCount += 1;
    else validProductCount += 1;
  }

  for (const product of pkg.products) {
    supplementFactsCounts[product.supplementFacts.status] = (supplementFactsCounts[product.supplementFacts.status] ?? 0) + 1;
    const invStatus = product.inventory.status in inventoryStatusCounts ? product.inventory.status : "unknown";
    inventoryStatusCounts[invStatus] = (inventoryStatusCounts[invStatus] ?? 0) + 1;

    for (const [key, isMissing] of Object.entries(product.missingData) as Array<[keyof MissingDataFlags, boolean]>) {
      if (isMissing) {
        missingDataCounts[key] = (missingDataCounts[key] ?? 0) + 1;
      }
    }
  }

  let packageStatus: PackageValidationStatus = "pass";
  if (invalidProductCount > 0) packageStatus = "fail";
  else if (warningProductCount > 0) packageStatus = "pass_with_warnings";

  return {
    generatedAt: new Date().toISOString(),
    packageVersion: pkg.packageVersion,
    packageStatus,
    productCount: pkg.products.length,
    validProductCount,
    warningProductCount,
    invalidProductCount,
    supplementFactsCounts,
    inventoryStatusCounts,
    missingDataCounts,
    perProduct,
  };
}

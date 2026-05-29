export type RocktomicDataStatus =
  | "available"
  | "configured"
  | "pending_source"
  | "not_available"
  | "not_applicable";

export type RocktomicInventoryStatus = "in_stock" | "low_stock" | "out_of_stock" | "unknown";
export type RocktomicPricingStatus = "current" | "stale" | "pending_source";
export type RocktomicPolicyStatus = "available" | "pending_source";
export type RocktomicDiscontinuedStatus = "active" | "discontinued" | "unknown";

export interface RocktomicSupplierProduct {
  supplier: "Rocktomic";
  sku: string;
  productName: string;
  category: string;
  labelSize: string | null;
  containerSize: string | null;
  productWeight: string | null;
  coa: {
    status: RocktomicDataStatus;
    url: string | null;
  };
  labelTemplate: {
    status: RocktomicDataStatus;
    url: string | null;
  };
  mockup: {
    status: RocktomicDataStatus;
    url: string | null;
  };
  certifications: string[];
  dietaryAttributes: string[];
  manufacturingClaims: string[];
  supplementFacts: {
    status: RocktomicDataStatus;
    value: string | null;
  };
  suggestedUse: {
    status: RocktomicDataStatus;
    value: string | null;
  };
  warnings: {
    status: RocktomicDataStatus;
    value: string | null;
  };
  inventoryStatus: RocktomicInventoryStatus;
  discontinuedStatus: RocktomicDiscontinuedStatus;
  pricingStatus: RocktomicPricingStatus;
  policyStatus: RocktomicPolicyStatus;
  lastSyncedAt: string;
  sourceVersion: string;
  sourceUpdatedAt: string;
}

export type RocktomicMatchStatus = "rocktomic" | "unmatched";

export interface RocktomicSkuLookupResult {
  skuInput: string;
  normalizedSku: string;
  status: RocktomicMatchStatus;
  product: RocktomicSupplierProduct | null;
  matchConfidence: number;
  matchReason: "exact_supplier_sku_match" | "no_supplier_sku_match";
}

export interface RocktomicSkuMatchResult {
  status: RocktomicMatchStatus;
  matchedSku: string | null;
  product: RocktomicSupplierProduct | null;
  matchConfidence: number;
  matchReason: "exact_supplier_sku_match" | "no_supplier_sku_match";
}

const ROCKTOMIC_SOURCE_VERSION = "rocktomic_seed_fallback_2026_05_29";
const ROCKTOMIC_SOURCE_UPDATED_AT = "2026-05-29T00:00:00.000Z";
const ROCKTOMIC_LAST_SYNCED_AT = "2026-05-29T00:00:00.000Z";

const ROCKTOMIC_PRODUCTS: RocktomicSupplierProduct[] = [
  {
    supplier: "Rocktomic",
    sku: "ROC817",
    productName: "Sleep Formula",
    category: "Sleep Support",
    labelSize: null,
    containerSize: "60 count",
    productWeight: null,
    coa: { status: "pending_source", url: null },
    labelTemplate: { status: "configured", url: null },
    mockup: { status: "pending_source", url: null },
    certifications: ["GMP Facility"],
    dietaryAttributes: ["Gluten-Free"],
    manufacturingClaims: ["Third-party tested ingredients"],
    supplementFacts: { status: "pending_source", value: null },
    suggestedUse: { status: "pending_source", value: null },
    warnings: { status: "pending_source", value: null },
    inventoryStatus: "unknown",
    discontinuedStatus: "active",
    pricingStatus: "pending_source",
    policyStatus: "available",
    lastSyncedAt: ROCKTOMIC_LAST_SYNCED_AT,
    sourceVersion: ROCKTOMIC_SOURCE_VERSION,
    sourceUpdatedAt: ROCKTOMIC_SOURCE_UPDATED_AT,
  },
  {
    supplier: "Rocktomic",
    sku: "ROC949",
    productName: "Premium Magnesium Glycinate Gummies",
    category: "Premium Gummies",
    labelSize: null,
    containerSize: "60 gummies",
    productWeight: null,
    coa: { status: "pending_source", url: null },
    labelTemplate: { status: "configured", url: null },
    mockup: { status: "pending_source", url: null },
    certifications: ["GMP Facility"],
    dietaryAttributes: ["Vegan", "Non-GMO"],
    manufacturingClaims: ["Made in USA"],
    supplementFacts: { status: "pending_source", value: null },
    suggestedUse: { status: "pending_source", value: null },
    warnings: { status: "pending_source", value: null },
    inventoryStatus: "unknown",
    discontinuedStatus: "active",
    pricingStatus: "pending_source",
    policyStatus: "available",
    lastSyncedAt: ROCKTOMIC_LAST_SYNCED_AT,
    sourceVersion: ROCKTOMIC_SOURCE_VERSION,
    sourceUpdatedAt: ROCKTOMIC_SOURCE_UPDATED_AT,
  },
  {
    supplier: "Rocktomic",
    sku: "ROC948",
    productName: "Premium Nitric Oxide Gummies",
    category: "Premium Gummies",
    labelSize: null,
    containerSize: "60 gummies",
    productWeight: null,
    coa: { status: "pending_source", url: null },
    labelTemplate: { status: "configured", url: null },
    mockup: { status: "pending_source", url: null },
    certifications: ["GMP Facility"],
    dietaryAttributes: ["Vegan"],
    manufacturingClaims: ["Made in USA"],
    supplementFacts: { status: "pending_source", value: null },
    suggestedUse: { status: "pending_source", value: null },
    warnings: { status: "pending_source", value: null },
    inventoryStatus: "unknown",
    discontinuedStatus: "active",
    pricingStatus: "pending_source",
    policyStatus: "available",
    lastSyncedAt: ROCKTOMIC_LAST_SYNCED_AT,
    sourceVersion: ROCKTOMIC_SOURCE_VERSION,
    sourceUpdatedAt: ROCKTOMIC_SOURCE_UPDATED_AT,
  },
  {
    supplier: "Rocktomic",
    sku: "ROC920",
    productName: "Sleep Well Gummies",
    category: "Premium Gummies",
    labelSize: null,
    containerSize: "60 gummies",
    productWeight: null,
    coa: { status: "pending_source", url: null },
    labelTemplate: { status: "configured", url: null },
    mockup: { status: "pending_source", url: null },
    certifications: ["GMP Facility"],
    dietaryAttributes: ["Vegan"],
    manufacturingClaims: ["No melatonin crash blend"],
    supplementFacts: { status: "pending_source", value: null },
    suggestedUse: { status: "pending_source", value: null },
    warnings: { status: "pending_source", value: null },
    inventoryStatus: "unknown",
    discontinuedStatus: "active",
    pricingStatus: "pending_source",
    policyStatus: "available",
    lastSyncedAt: ROCKTOMIC_LAST_SYNCED_AT,
    sourceVersion: ROCKTOMIC_SOURCE_VERSION,
    sourceUpdatedAt: ROCKTOMIC_SOURCE_UPDATED_AT,
  },
  {
    supplier: "Rocktomic",
    sku: "ROC801",
    productName: "Anxiety Formula",
    category: "Nootropics",
    labelSize: null,
    containerSize: null,
    productWeight: null,
    coa: { status: "pending_source", url: null },
    labelTemplate: { status: "configured", url: null },
    mockup: { status: "pending_source", url: null },
    certifications: ["GMP Facility"],
    dietaryAttributes: [],
    manufacturingClaims: [],
    supplementFacts: { status: "pending_source", value: null },
    suggestedUse: { status: "pending_source", value: null },
    warnings: { status: "pending_source", value: null },
    inventoryStatus: "unknown",
    discontinuedStatus: "active",
    pricingStatus: "pending_source",
    policyStatus: "available",
    lastSyncedAt: ROCKTOMIC_LAST_SYNCED_AT,
    sourceVersion: ROCKTOMIC_SOURCE_VERSION,
    sourceUpdatedAt: ROCKTOMIC_SOURCE_UPDATED_AT,
  },
  {
    supplier: "Rocktomic",
    sku: "ROC507",
    productName: "Ultra Multivitamin For Men",
    category: "Men's Health",
    labelSize: null,
    containerSize: null,
    productWeight: null,
    coa: { status: "pending_source", url: null },
    labelTemplate: { status: "configured", url: null },
    mockup: { status: "pending_source", url: null },
    certifications: ["GMP Facility"],
    dietaryAttributes: [],
    manufacturingClaims: [],
    supplementFacts: { status: "pending_source", value: null },
    suggestedUse: { status: "pending_source", value: null },
    warnings: { status: "pending_source", value: null },
    inventoryStatus: "unknown",
    discontinuedStatus: "active",
    pricingStatus: "pending_source",
    policyStatus: "available",
    lastSyncedAt: ROCKTOMIC_LAST_SYNCED_AT,
    sourceVersion: ROCKTOMIC_SOURCE_VERSION,
    sourceUpdatedAt: ROCKTOMIC_SOURCE_UPDATED_AT,
  },
  {
    supplier: "Rocktomic",
    sku: "ROC937",
    productName: "Organic Super Greens - Watermelon",
    category: "Greens & Detox",
    labelSize: null,
    containerSize: "30 servings",
    productWeight: null,
    coa: { status: "pending_source", url: null },
    labelTemplate: { status: "configured", url: null },
    mockup: { status: "pending_source", url: null },
    certifications: ["USDA Organic"],
    dietaryAttributes: ["Vegan", "Gluten-Free"],
    manufacturingClaims: ["No artificial colors"],
    supplementFacts: { status: "pending_source", value: null },
    suggestedUse: { status: "pending_source", value: null },
    warnings: { status: "pending_source", value: null },
    inventoryStatus: "unknown",
    discontinuedStatus: "active",
    pricingStatus: "pending_source",
    policyStatus: "available",
    lastSyncedAt: ROCKTOMIC_LAST_SYNCED_AT,
    sourceVersion: ROCKTOMIC_SOURCE_VERSION,
    sourceUpdatedAt: ROCKTOMIC_SOURCE_UPDATED_AT,
  },
  {
    supplier: "Rocktomic",
    sku: "ROC2251",
    productName: "Berberine Plus",
    category: "Metabolic Support",
    labelSize: null,
    containerSize: "60 capsules",
    productWeight: null,
    coa: { status: "pending_source", url: null },
    labelTemplate: { status: "configured", url: null },
    mockup: { status: "pending_source", url: null },
    certifications: ["GMP Facility"],
    dietaryAttributes: ["Non-GMO"],
    manufacturingClaims: ["Small batch"],
    supplementFacts: { status: "pending_source", value: null },
    suggestedUse: { status: "pending_source", value: null },
    warnings: { status: "pending_source", value: null },
    inventoryStatus: "unknown",
    discontinuedStatus: "active",
    pricingStatus: "pending_source",
    policyStatus: "available",
    lastSyncedAt: ROCKTOMIC_LAST_SYNCED_AT,
    sourceVersion: ROCKTOMIC_SOURCE_VERSION,
    sourceUpdatedAt: ROCKTOMIC_SOURCE_UPDATED_AT,
  },
];

function indexProducts(products: RocktomicSupplierProduct[]): Record<string, RocktomicSupplierProduct> {
  return Object.fromEntries(products.map((product) => [normalizeRocktomicSku(product.sku), product]));
}

export function normalizeRocktomicSku(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

export function listRocktomicSupplierProducts(products?: RocktomicSupplierProduct[]): RocktomicSupplierProduct[] {
  return [...(products ?? ROCKTOMIC_PRODUCTS)];
}

export function getRocktomicCatalogSkus(products?: RocktomicSupplierProduct[]): string[] {
  return (products ?? ROCKTOMIC_PRODUCTS).map((product) => product.sku);
}

export function lookupRocktomicSupplierProductBySku(
  skuInput: string,
  products?: RocktomicSupplierProduct[]
): RocktomicSkuLookupResult {
  const normalizedSku = normalizeRocktomicSku(skuInput);
  if (!normalizedSku) {
    return {
      skuInput,
      normalizedSku,
      status: "unmatched",
      product: null,
      matchConfidence: 0,
      matchReason: "no_supplier_sku_match",
    };
  }

  const productBySku = indexProducts(products ?? ROCKTOMIC_PRODUCTS);
  const product = productBySku[normalizedSku] ?? null;
  if (!product) {
    return {
      skuInput,
      normalizedSku,
      status: "unmatched",
      product: null,
      matchConfidence: 0,
      matchReason: "no_supplier_sku_match",
    };
  }

  return {
    skuInput,
    normalizedSku,
    status: "rocktomic",
    product,
    matchConfidence: 1,
    matchReason: "exact_supplier_sku_match",
  };
}

export function matchRocktomicBySkus(skus: string[], products?: RocktomicSupplierProduct[]): RocktomicSkuMatchResult {
  for (const sku of skus) {
    const result = lookupRocktomicSupplierProductBySku(sku, products);
    if (result.status === "rocktomic") {
      return {
        status: result.status,
        matchedSku: result.product?.sku ?? null,
        product: result.product,
        matchConfidence: result.matchConfidence,
        matchReason: result.matchReason,
      };
    }
  }

  return {
    status: "unmatched",
    matchedSku: null,
    product: null,
    matchConfidence: 0,
    matchReason: "no_supplier_sku_match",
  };
}

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
  servingSize?: string | null;
  servingsPerContainer?: string | null;
  ingredientHighlights?: string[];
  productFeatures?: string[];
  otherIngredients?: string | null;
  coa: {
    status: RocktomicDataStatus;
    url: string | null;
    expiresAt?: string | null;
    testingCategories?: string[];
    verificationStatus?: "verified" | "pending" | "unavailable";
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
  pricing?: {
    wholesaleCost: number | null;
    msrp: number | null;
    estimatedProfit: number | null;
    marginPercent: number | null;
    currency: string | null;
    sourceStatus: "available" | "unknown" | "source_unavailable";
  };
  shipping?: {
    shipsFrom: string | null;
    processingTime: string | null;
    shippingTime: string | null;
    returnPolicy: string | null;
    fulfillmentStatus: string | null;
  };
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

const BASE_SHIPPING = {
  shipsFrom: "US",
  processingTime: "1-3 business days",
  shippingTime: "3-7 business days",
  returnPolicy: "See configured supplier order/refund template.",
  fulfillmentStatus: "platform_managed",
} as const;

const BASE_PRODUCT: Omit<RocktomicSupplierProduct, "sku" | "productName" | "category" | "containerSize"> = {
  supplier: "Rocktomic",
  labelSize: null,
  productWeight: null,
  servingSize: null,
  servingsPerContainer: null,
  ingredientHighlights: [],
  productFeatures: [],
  otherIngredients: null,
  coa: { status: "pending_source", url: null, expiresAt: null, testingCategories: [], verificationStatus: "pending" },
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
  pricing: {
    wholesaleCost: null,
    msrp: null,
    estimatedProfit: null,
    marginPercent: null,
    currency: "USD",
    sourceStatus: "unknown",
  },
  shipping: BASE_SHIPPING,
  lastSyncedAt: ROCKTOMIC_LAST_SYNCED_AT,
  sourceVersion: ROCKTOMIC_SOURCE_VERSION,
  sourceUpdatedAt: ROCKTOMIC_SOURCE_UPDATED_AT,
};

const ROCKTOMIC_PRODUCTS: RocktomicSupplierProduct[] = [
  {
    ...BASE_PRODUCT,
    sku: "ROC949",
    productName: "Premium Magnesium Glycinate Gummies",
    category: "Premium Gummies",
    containerSize: "60 gummies",
    dietaryAttributes: ["Vegan", "Non-GMO"],
    manufacturingClaims: ["Made in USA"],
    ingredientHighlights: ["Magnesium glycinate"],
  },
  {
    ...BASE_PRODUCT,
    sku: "ROC948",
    productName: "Premium Nitric Oxide Gummies",
    category: "Premium Gummies",
    containerSize: "60 gummies",
    dietaryAttributes: ["Vegan"],
    ingredientHighlights: ["Beet root support blend"],
  },
  {
    ...BASE_PRODUCT,
    sku: "ROC920",
    productName: "Sleep Well Gummies",
    category: "Premium Gummies",
    containerSize: "60 gummies",
    dietaryAttributes: ["Vegan"],
    manufacturingClaims: ["No melatonin crash blend"],
  },
  {
    ...BASE_PRODUCT,
    sku: "ROC801",
    productName: "Anxiety Formula",
    category: "Nootropics",
    containerSize: null,
  },
  {
    ...BASE_PRODUCT,
    sku: "ROC507",
    productName: "Ultra Multivitamin For Men",
    category: "Men's Health",
    containerSize: null,
  },
  {
    ...BASE_PRODUCT,
    sku: "ROC817",
    productName: "Sleep Formula",
    category: "Sleep Support",
    containerSize: "60 count",
    dietaryAttributes: ["Gluten-Free"],
    manufacturingClaims: ["Third-party tested ingredients"],
  },
  {
    ...BASE_PRODUCT,
    sku: "ROC937",
    productName: "Organic Super Greens - Watermelon",
    category: "Greens & Detox",
    containerSize: "30 servings",
    dietaryAttributes: ["Vegan", "Gluten-Free"],
    certifications: ["USDA Organic"],
    manufacturingClaims: ["No artificial colors"],
  },
  {
    ...BASE_PRODUCT,
    sku: "ROC2251",
    productName: "Berberine Plus",
    category: "Metabolic Support",
    containerSize: "60 capsules",
    dietaryAttributes: ["Non-GMO"],
    manufacturingClaims: ["Small batch"],
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

export interface RocktomicSupplierIntelligence {
  sku: string;
  productName: string;
  category: string | null;
  labelSize: string | null;
  containerSize: string | null;
  productWeight: string | null;
  coaLink: string | null;
  mockupTemplateLink: string | null;
  certifications: string[];
  dietaryAttributes: string[];
  manufacturingClaims: string[];
  supplementFacts: string | null;
  suggestedUse: string | null;
  warnings: string | null;
  inventory: number | null;
  pricing: number | null;
  discontinued: boolean;
  shipping: string | null;
  returns: string | null;
}

export type RocktomicMatchStatus = "rocktomic" | "unmatched";

export interface RocktomicSkuMatchResult {
  status: RocktomicMatchStatus;
  matchedSku: string | null;
  intelligence: RocktomicSupplierIntelligence | null;
}

const ROCKTOMIC_CATALOG_BY_SKU: Record<string, RocktomicSupplierIntelligence> = {
  ROC817: {
    sku: "ROC817",
    productName: "Rocktomic Magnesium Glycinate Gummies",
    category: "Supplements",
    labelSize: null,
    containerSize: "60 count",
    productWeight: null,
    coaLink: null,
    mockupTemplateLink: null,
    certifications: ["GMP"],
    dietaryAttributes: ["Vegan", "Gluten-Free"],
    manufacturingClaims: ["Third-party tested"],
    supplementFacts: null,
    suggestedUse: null,
    warnings: null,
    inventory: null,
    pricing: null,
    discontinued: false,
    shipping: null,
    returns: null,
  },
  ROC949: {
    sku: "ROC949",
    productName: "Rocktomic Hydration Electrolyte Blend",
    category: "Hydration",
    labelSize: null,
    containerSize: null,
    productWeight: null,
    coaLink: null,
    mockupTemplateLink: null,
    certifications: [],
    dietaryAttributes: [],
    manufacturingClaims: [],
    supplementFacts: null,
    suggestedUse: null,
    warnings: null,
    inventory: null,
    pricing: null,
    discontinued: false,
    shipping: null,
    returns: null,
  },
  ROC937: {
    sku: "ROC937",
    productName: "Rocktomic Sleep Support Formula",
    category: "Sleep",
    labelSize: null,
    containerSize: null,
    productWeight: null,
    coaLink: null,
    mockupTemplateLink: null,
    certifications: [],
    dietaryAttributes: [],
    manufacturingClaims: [],
    supplementFacts: null,
    suggestedUse: null,
    warnings: null,
    inventory: null,
    pricing: null,
    discontinued: false,
    shipping: null,
    returns: null,
  },
};

function normalizeSku(value: string): string {
  return value.trim().toUpperCase();
}

export function getRocktomicCatalogSkus(): string[] {
  return Object.keys(ROCKTOMIC_CATALOG_BY_SKU);
}

export function matchRocktomicBySkus(skus: string[]): RocktomicSkuMatchResult {
  for (const rawSku of skus) {
    const sku = normalizeSku(rawSku);
    if (!sku) continue;
    const intelligence = ROCKTOMIC_CATALOG_BY_SKU[sku];
    if (intelligence) {
      return {
        status: "rocktomic",
        matchedSku: intelligence.sku,
        intelligence,
      };
    }
  }

  return {
    status: "unmatched",
    matchedSku: null,
    intelligence: null,
  };
}

export const CURRENT_SCHEMA_VERSION = "1.0";

export type FileIqProductType =
  | "supplement"
  | "beauty"
  | "cbd"
  | "apparel"
  | "food"
  | "general";

export type FileIqInventoryStatus =
  | "in_stock"
  | "out_of_stock"
  | "low_stock"
  | "discontinued"
  | "preorder"
  | "rd_in_progress";

export type FileIqCertification =
  | "usa_made"
  | "clean_vegan"
  | "organic"
  | "non_gmo"
  | "grass_fed"
  | "keto"
  | "gluten_free";

export type FileIqRefundType =
  | "refund"
  | "credit_only"
  | "exchange_only"
  | "none";

export interface FileIqSupplier {
  supplierId: string;
  supplierName: string;
  website: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
}

export interface FileIqIngredient {
  name: string;
  amount: string | null;
  unit: string | null;
  dailyValue: string | null;
}

export interface FileIqSupplementFacts {
  servingSize: string | null;
  servingsPerContainer: number | null;
  ingredients: FileIqIngredient[];
  otherIngredients: string | null;
  allergenWarning: string | null;
  raw: string | null;
}

export interface FileIqWholesaleTiers {
  nonMember: number | null;
  standard: number | null;
  vipPlus: number | null;
  basic: number | null;
  launch: number | null;
  scale: number | null;
}

export interface FileIqPricing {
  msrp: number | null;
  wholesaleCost: number | null;
  currency: string | null;
  wholesaleTiers: FileIqWholesaleTiers | null;
  mapPrice: number | null;
  salePrice: number | null;
}

export interface FileIqInventory {
  status: FileIqInventoryStatus;
  quantityOnHand: number | null;
  reorderPoint: number | null;
  leadTimeDays: number | null;
  moq: number | null;
}

export interface FileIqPhysical {
  weightLbs: number | null;
  weightOz: number | null;
  heightIn: number | null;
  widthIn: number | null;
  depthIn: number | null;
  unitCount: number | null;
  unitCountType: string | null;
}

export interface FileIqDetails {
  description: string | null;
  shortDescription: string | null;
  suggestedUse: string | null;
  warnings: string | null;
  storageInstructions: string | null;
  countryOfOrigin: string | null;
  certifications: FileIqCertification[];
  flavor: string | null;
  form: string | null;
  coaUrl: string | null;
}

export interface FileIqAssets {
  imageUrls: string[];
  labelUrls: string[];
  coaUrls: string[];
  sheetUrls: string[];
  videoUrls: string[];
}

export interface FileIqShippingRoute {
  carriers: string[];
  fulfillmentDays: number | null;
  transitDays: number | null;
  totalEstimatedDays: number | null;
}

export interface FileIqShipping {
  shipsFromState: string | null;
  shipsFromCountry: string | null;
  freeShippingThreshold: number | null;
  standardRoute: FileIqShippingRoute | null;
  expeditedRoute: FileIqShippingRoute | null;
  internationalAvailable: boolean | null;
  hazmat: boolean | null;
}

export interface FileIqAgenticVisibility {
  priorityScore: number | null;
  tags: string[];
  relatedSkus: string[];
  bundleSuggestions: string[];
  notes: string | null;
}

export interface FileIqSeo {
  metaTitle: string | null;
  metaDescription: string | null;
  keywords: string[];
  canonicalUrl: string | null;
}

export interface FileIqPolicy {
  refundWindowDays: number | null;
  refundType: FileIqRefundType | null;
  returnShippingPaidBy: string | null;
  policyNotes: string | null;
}

export interface FileIqExtraction {
  sourceRef: string | null;
  sourceFileId: string | null;
  extractedAt: string | null;
  confidence: number | null;
  extractionNotes: string | null;
}

export interface FileIqProduct {
  sku: string;
  productName: string;
  productType: FileIqProductType | null;
  category: string | null;
  subcategory: string | null;
  brand: string | null;
  upc: string | null;
  asin: string | null;
  inventory: FileIqInventory | null;
  pricing: FileIqPricing | null;
  physical: FileIqPhysical | null;
  details: FileIqDetails | null;
  supplementFacts: FileIqSupplementFacts | null;
  assets: FileIqAssets | null;
  shipping: FileIqShipping | null;
  agenticVisibility: FileIqAgenticVisibility | null;
  seo: FileIqSeo | null;
  policy: FileIqPolicy | null;
  extraction: FileIqExtraction | null;
}

export interface FileIqProductCatalogV1 {
  schemaType: "product_catalog";
  schemaVersion: string;
  supplier: FileIqSupplier | null;
  products: FileIqProduct[];
  totalProductsFound: number;
  sourcesProcessed: number;
  extractionNotes: string | null;
}

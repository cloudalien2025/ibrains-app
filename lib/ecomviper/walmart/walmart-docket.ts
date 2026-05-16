import type {
  WalmartDocketFieldConfidence,
  WalmartDocketFieldMetadata,
  WalmartDocketFieldSource,
} from "@/lib/ecomviper/walmart/walmart-docket-source-metadata";
import { createWalmartDocketFieldMetadata } from "@/lib/ecomviper/walmart/walmart-docket-source-metadata";

export type WalmartDocketHydrationStatus =
  | "imported_docket_ready"
  | "detail_hydrated"
  | "report_backfill_pending"
  | "report_unavailable"
  | "live_refresh_unavailable_no_credentials"
  | "live_refresh_failed";

export interface WalmartDocketField<T> extends WalmartDocketFieldMetadata {
  value: T;
}

export interface WalmartNormalizedDocket {
  version: 1;
  sku: string;
  hydratedAt: string;
  statuses: WalmartDocketHydrationStatus[];
  content: {
    title: WalmartDocketField<string>;
    shortDescription: WalmartDocketField<string>;
    longDescription: WalmartDocketField<string>;
    bullets: WalmartDocketField<string[]>;
    brand: WalmartDocketField<string>;
    manufacturer: WalmartDocketField<string>;
    richMediaStatus: WalmartDocketField<string>;
    complianceNotes: WalmartDocketField<string[]>;
  };
  media: {
    primaryImage: WalmartDocketField<string>;
    galleryImages: WalmartDocketField<string[]>;
    publicListingUrl: WalmartDocketField<string>;
    confirmedItemId: WalmartDocketField<string>;
    imageSourceLane: WalmartDocketField<string>;
    imageDerivedFactsStatus: WalmartDocketField<string>;
    generateProductImagesMetadata: WalmartDocketField<Record<string, unknown> | null>;
    altTextGuidance: WalmartDocketField<string>;
  };
  pricingInventory: {
    price: WalmartDocketField<number | null>;
    salePrice: WalmartDocketField<number | null>;
    currency: WalmartDocketField<string>;
    inventoryQuantity: WalmartDocketField<number | null>;
    inventoryStatus: WalmartDocketField<string>;
    fulfillmentData: WalmartDocketField<Record<string, unknown>>;
    freshnessTimestamps: WalmartDocketField<Record<string, string | null>>;
  };
  searchBrowse: {
    productType: WalmartDocketField<string>;
    category: WalmartDocketField<string>;
    taxonomy: WalmartDocketField<string>;
    sku: WalmartDocketField<string>;
    gtin: WalmartDocketField<string>;
    upc: WalmartDocketField<string>;
    lookupIdentifiers: WalmartDocketField<string[]>;
    productForm: WalmartDocketField<string>;
    flavor: WalmartDocketField<string>;
    mainIngredients: WalmartDocketField<string>;
    ingredientsList: WalmartDocketField<string>;
    servingSize: WalmartDocketField<string>;
    servings: WalmartDocketField<string>;
    dosageStrength: WalmartDocketField<string>;
    countPerPack: WalmartDocketField<string>;
    dimensions: WalmartDocketField<string>;
    suggestedUse: WalmartDocketField<string>;
    safetyWarnings: WalmartDocketField<string>;
    targetAudience: WalmartDocketField<string>;
    searchKeywords: WalmartDocketField<string>;
    benefits: WalmartDocketField<string>;
    allergenFree: WalmartDocketField<string>;
    attributes: WalmartDocketField<Record<string, string>>;
    complianceSearchNotes: WalmartDocketField<string[]>;
  };
}

export function createWalmartDocketField<T>(
  value: T,
  input?: {
    source?: WalmartDocketFieldSource;
    sourceLabel?: string;
    retrievedAt?: string | null;
    updatedAt?: string | null;
    confidence?: WalmartDocketFieldConfidence;
    warnings?: string[];
  }
): WalmartDocketField<T> {
  return {
    value,
    ...createWalmartDocketFieldMetadata(input),
  };
}

export function createEmptyWalmartDocket(input: {
  sku: string;
  hydratedAt?: string;
  statuses?: WalmartDocketHydrationStatus[];
}): WalmartNormalizedDocket {
  const hydratedAt = input.hydratedAt ?? new Date().toISOString();
  return {
    version: 1,
    sku: input.sku,
    hydratedAt,
    statuses: [...(input.statuses ?? ["imported_docket_ready"])],
    content: {
      title: createWalmartDocketField("", { source: "unknown" }),
      shortDescription: createWalmartDocketField("", { source: "unknown" }),
      longDescription: createWalmartDocketField("", { source: "unknown" }),
      bullets: createWalmartDocketField([], { source: "unknown" }),
      brand: createWalmartDocketField("", { source: "unknown" }),
      manufacturer: createWalmartDocketField("", { source: "unknown" }),
      richMediaStatus: createWalmartDocketField("unknown", { source: "unknown" }),
      complianceNotes: createWalmartDocketField([], { source: "unknown" }),
    },
    media: {
      primaryImage: createWalmartDocketField("", { source: "unknown" }),
      galleryImages: createWalmartDocketField([], { source: "unknown" }),
      publicListingUrl: createWalmartDocketField("", { source: "unknown" }),
      confirmedItemId: createWalmartDocketField("", { source: "unknown" }),
      imageSourceLane: createWalmartDocketField("unknown", { source: "unknown" }),
      imageDerivedFactsStatus: createWalmartDocketField("unknown", { source: "unknown" }),
      generateProductImagesMetadata: createWalmartDocketField<Record<string, unknown> | null>(null, {
        source: "unknown",
      }),
      altTextGuidance: createWalmartDocketField("", { source: "unknown" }),
    },
    pricingInventory: {
      price: createWalmartDocketField<number | null>(null, { source: "unknown" }),
      salePrice: createWalmartDocketField<number | null>(null, { source: "unknown" }),
      currency: createWalmartDocketField("USD", { source: "fallback" }),
      inventoryQuantity: createWalmartDocketField<number | null>(null, { source: "unknown" }),
      inventoryStatus: createWalmartDocketField("unknown", { source: "unknown" }),
      fulfillmentData: createWalmartDocketField<Record<string, unknown>>({}, { source: "unknown" }),
      freshnessTimestamps: createWalmartDocketField<Record<string, string | null>>({}, {
        source: "fallback",
      }),
    },
    searchBrowse: {
      productType: createWalmartDocketField("", { source: "unknown" }),
      category: createWalmartDocketField("", { source: "unknown" }),
      taxonomy: createWalmartDocketField("", { source: "unknown" }),
      sku: createWalmartDocketField(input.sku, { source: "fallback" }),
      gtin: createWalmartDocketField("", { source: "unknown" }),
      upc: createWalmartDocketField("", { source: "unknown" }),
      lookupIdentifiers: createWalmartDocketField<string[]>([], { source: "unknown" }),
      productForm: createWalmartDocketField("", { source: "unknown" }),
      flavor: createWalmartDocketField("", { source: "unknown" }),
      mainIngredients: createWalmartDocketField("", { source: "unknown" }),
      ingredientsList: createWalmartDocketField("", { source: "unknown" }),
      servingSize: createWalmartDocketField("", { source: "unknown" }),
      servings: createWalmartDocketField("", { source: "unknown" }),
      dosageStrength: createWalmartDocketField("", { source: "unknown" }),
      countPerPack: createWalmartDocketField("", { source: "unknown" }),
      dimensions: createWalmartDocketField("", { source: "unknown" }),
      suggestedUse: createWalmartDocketField("", { source: "unknown" }),
      safetyWarnings: createWalmartDocketField("", { source: "unknown" }),
      targetAudience: createWalmartDocketField("", { source: "unknown" }),
      searchKeywords: createWalmartDocketField("", { source: "unknown" }),
      benefits: createWalmartDocketField("", { source: "unknown" }),
      allergenFree: createWalmartDocketField("", { source: "unknown" }),
      attributes: createWalmartDocketField<Record<string, string>>({}, { source: "unknown" }),
      complianceSearchNotes: createWalmartDocketField<string[]>([], { source: "unknown" }),
    },
  };
}

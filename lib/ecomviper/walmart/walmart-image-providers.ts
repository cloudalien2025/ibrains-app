import type { WalmartImageSource, WalmartImageStatus } from "@/lib/ecomviper/walmart/walmart-types";

export interface WalmartImageResolutionResult {
  imageUrl: string;
  imageStatus: WalmartImageStatus;
  imageStatusMessage:
    | "Image available"
    | "Image not provided by Walmart catalog"
    | "Image enrichment source not configured"
    | "Image not provided by Walmart Item Search"
    | "Image match ambiguous"
    | "Image sync failed"
    | "Image enrichment not synced";
  imageSource: WalmartImageSource;
  enrichmentProvider: "walmartCatalogImageProvider" | "futureShopifyImageProvider" | "manualImageProvider" | "none";
}

interface WalmartImageProviderInput {
  sku: string;
}

interface WalmartImageProviderResult {
  imageUrl: string;
  imageSource: WalmartImageSource;
}

interface WalmartImageProvider {
  id: "futureShopifyImageProvider" | "manualImageProvider";
  enabled: boolean;
  resolve(input: WalmartImageProviderInput): WalmartImageProviderResult | null;
}

const futureShopifyImageProvider: WalmartImageProvider = {
  id: "futureShopifyImageProvider",
  enabled: false,
  resolve() {
    return null;
  },
};

const manualImageProvider: WalmartImageProvider = {
  id: "manualImageProvider",
  enabled: false,
  resolve() {
    return null;
  },
};

const enrichmentProviders: WalmartImageProvider[] = [futureShopifyImageProvider, manualImageProvider];

function asHttpUrl(value: unknown): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : "";
}

export function resolveWalmartCatalogImage(input: {
  sku: string;
  catalogImageUrl: unknown;
}): WalmartImageResolutionResult {
  const catalogImageUrl = asHttpUrl(input.catalogImageUrl);
  if (catalogImageUrl) {
    return {
      imageUrl: catalogImageUrl,
      imageStatus: "image_available",
      imageStatusMessage: "Image available",
      imageSource: "walmart_catalog",
      enrichmentProvider: "walmartCatalogImageProvider",
    };
  }

  for (const provider of enrichmentProviders) {
    if (!provider.enabled) continue;
    const enriched = provider.resolve({ sku: input.sku });
    if (!enriched?.imageUrl) continue;
    return {
      imageUrl: enriched.imageUrl,
      imageStatus: "image_available",
      imageStatusMessage: "Image available",
      imageSource: enriched.imageSource,
      enrichmentProvider: provider.id,
    };
  }

  return {
    imageUrl: "",
    imageStatus: "enrichment_unconfigured",
    imageStatusMessage: "Image enrichment source not configured",
    imageSource: "none",
    enrichmentProvider: "none",
  };
}

export const walmartImageProviderSeam = {
  walmartCatalogImageProvider: "walmartCatalogImageProvider",
  futureShopifyImageProvider: "futureShopifyImageProvider",
  manualImageProvider: "manualImageProvider",
} as const;

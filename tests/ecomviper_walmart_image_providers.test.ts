import { describe, expect, it } from "vitest";
import { resolveWalmartCatalogImage, walmartImageProviderSeam } from "@/lib/ecomviper/walmart/walmart-image-providers";

describe("Walmart image enrichment providers", () => {
  it("returns image available when Walmart catalog payload includes image URL", () => {
    const result = resolveWalmartCatalogImage({
      sku: "30066-841",
      catalogImageUrl: "https://images.example.com/30066-841.jpg",
    });

    expect(result.imageUrl).toBe("https://images.example.com/30066-841.jpg");
    expect(result.imageStatus).toBe("image_available");
    expect(result.imageStatusMessage).toBe("Image available");
    expect(result.enrichmentProvider).toBe("walmartCatalogImageProvider");
    expect(result.imageSource).toBe("walmart_catalog");
  });

  it("returns enrichment-not-configured when catalog has no image and no enrichment provider is enabled", () => {
    const result = resolveWalmartCatalogImage({
      sku: "NO-IMAGE-1",
      catalogImageUrl: "",
    });

    expect(result.imageUrl).toBe("");
    expect(result.imageStatus).toBe("enrichment_unconfigured");
    expect(result.imageStatusMessage).toBe("Image enrichment source not configured");
    expect(result.enrichmentProvider).toBe("none");
  });

  it("exposes the provider seam for future non-Walmart image sources", () => {
    expect(walmartImageProviderSeam).toEqual({
      walmartCatalogImageProvider: "walmartCatalogImageProvider",
      futureShopifyImageProvider: "futureShopifyImageProvider",
      manualImageProvider: "manualImageProvider",
    });
  });
});

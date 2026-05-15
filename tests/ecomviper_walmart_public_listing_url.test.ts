import { describe, expect, it } from "vitest";
import {
  buildWalmartPublicListingUrlFromItemId,
  extractWalmartItemIdFromUrl,
  normalizeWalmartPublicListingUrl,
  resolveCanonicalWalmartPublicListingUrl,
} from "@/lib/ecomviper/walmart/walmart-public-listing-url";

describe("Walmart public listing URL normalization", () => {
  it("normalizes a canonical Walmart PDP URL", () => {
    expect(normalizeWalmartPublicListingUrl("https://www.walmart.com/ip/2791205430")).toBe(
      "https://www.walmart.com/ip/2791205430"
    );
  });

  it("normalizes slug and query Walmart PDP URLs to canonical item-id URL", () => {
    expect(
      normalizeWalmartPublicListingUrl(
        "https://www.walmart.com/ip/OPA-Enzymes-Prebiotic-Probiotics-60-Ct/2791205430?athbdg=L1600&utm_source=abc"
      )
    ).toBe("https://www.walmart.com/ip/2791205430");
  });

  it("builds canonical Walmart PDP URL from numeric item ID", () => {
    expect(buildWalmartPublicListingUrlFromItemId("2791205430")).toBe(
      "https://www.walmart.com/ip/2791205430"
    );
    expect(buildWalmartPublicListingUrlFromItemId(2791205430)).toBe(
      "https://www.walmart.com/ip/2791205430"
    );
  });

  it("returns null for null/blank/placeholder inputs", () => {
    expect(normalizeWalmartPublicListingUrl(null)).toBeNull();
    expect(normalizeWalmartPublicListingUrl("")).toBeNull();
    expect(normalizeWalmartPublicListingUrl("   ")).toBeNull();
    expect(normalizeWalmartPublicListingUrl("unknown")).toBeNull();
    expect(normalizeWalmartPublicListingUrl("Not available")).toBeNull();
    expect(normalizeWalmartPublicListingUrl("850054016119")).toBeNull();
  });

  it("rejects non-Walmart domains", () => {
    expect(normalizeWalmartPublicListingUrl("https://example.com/ip/2791205430")).toBeNull();
    expect(extractWalmartItemIdFromUrl("https://example.com/ip/2791205430")).toBeNull();
  });

  it("resolves canonical product-level URL from detail-level media source URL", () => {
    const resolution = resolveCanonicalWalmartPublicListingUrl({
      mediaSource: {
        publicListingSource:
          "https://www.walmart.com/ip/OPA-Enzymes-Prebiotic-Probiotics-60-Ct/2791205430?classType=REGULAR",
      },
    });

    expect(resolution.url).toBe("https://www.walmart.com/ip/2791205430");
    expect(resolution.itemId).toBe("2791205430");
    expect(resolution.source).toBe("media_source");
    expect(resolution.confidence).toBe("derived");
  });

  it("does not build public Walmart listing URL from untrusted bare numeric item candidates", () => {
    const resolution = resolveCanonicalWalmartPublicListingUrl({
      itemIdCandidates: ["2791205430"],
    });

    expect(resolution.url).toBeNull();
    expect(resolution.itemId).toBeNull();
    expect(resolution.source).toBe("unavailable");
    expect(resolution.warnings.join(" | ")).toContain("lacked trusted Walmart ITEM_ID provenance");
  });

  it("builds public Walmart listing URL from confirmed ITEM_ID provenance", () => {
    const resolution = resolveCanonicalWalmartPublicListingUrl({
      itemIdCandidates: [
        {
          value: "2791205430",
          provenance: "rawPayload.productId",
          productIdType: "ITEM_ID",
        },
      ],
    });

    expect(resolution.url).toBe("https://www.walmart.com/ip/2791205430");
    expect(resolution.itemId).toBe("2791205430");
    expect(resolution.source).toBe("item_id");
    expect(resolution.confidence).toBe("exact");
  });

  it("does not build public Walmart listing URL from GTIN/UPC productId types", () => {
    const gtinResolution = resolveCanonicalWalmartPublicListingUrl({
      itemIdCandidates: [
        {
          value: "0850054016119",
          provenance: "rawPayload.productId",
          productIdType: "GTIN",
        },
      ],
    });
    const upcResolution = resolveCanonicalWalmartPublicListingUrl({
      itemIdCandidates: [
        {
          value: "850054016119",
          provenance: "rawPayload.productId",
          productIdType: "UPC",
        },
      ],
    });

    expect(gtinResolution.url).toBeNull();
    expect(gtinResolution.itemId).toBeNull();
    expect(gtinResolution.warnings.join(" | ")).toContain(
      "GTIN/UPC is a lookup identifier, not a Walmart public item ID."
    );

    expect(upcResolution.url).toBeNull();
    expect(upcResolution.itemId).toBeNull();
    expect(upcResolution.warnings.join(" | ")).toContain(
      "GTIN/UPC is a lookup identifier, not a Walmart public item ID."
    );
  });

  it("does not build public Walmart listing URL from SKU or GTIN provenance-only identifiers", () => {
    const skuResolution = resolveCanonicalWalmartPublicListingUrl({
      itemIdCandidates: [{ value: "2791205430", provenance: "sku" }],
    });
    const gtinResolution = resolveCanonicalWalmartPublicListingUrl({
      itemIdCandidates: [{ value: "0850054016119", provenance: "gtin" }],
    });

    expect(skuResolution.url).toBeNull();
    expect(skuResolution.itemId).toBeNull();
    expect(gtinResolution.url).toBeNull();
    expect(gtinResolution.itemId).toBeNull();
    expect(gtinResolution.warnings.join(" | ")).toContain(
      "GTIN/UPC is a lookup identifier, not a Walmart public item ID."
    );
  });
});

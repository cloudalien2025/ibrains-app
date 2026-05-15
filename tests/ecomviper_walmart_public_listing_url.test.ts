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
});

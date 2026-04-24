import { describe, expect, it } from "vitest";
import { fetchListing, normalizeProviderListing } from "@/lib/studio/domara/listing-provider";

describe("Domara listing provider", () => {
  it("fetches a deterministic mock listing without external credentials", async () => {
    const resultA = await fetchListing({
      provider: "mock",
      listingRef: "https://example.com/listings/abc123",
      country: "Italy",
      fallbackToMock: true,
    });
    const resultB = await fetchListing({
      provider: "mock",
      listingRef: "https://example.com/listings/abc123",
      country: "Italy",
      fallbackToMock: true,
    });

    expect(resultA.providerUsed).toBe("mock");
    expect(resultA.fetchStatus).toBe("success");
    expect(resultA.listing.title).toBe(resultB.listing.title);
    expect(resultA.listing.imageUrls).toEqual(resultB.listing.imageUrls);
  });

  it("normalizes provider listing shape with optional field gaps handled", () => {
    const normalized = normalizeProviderListing({
      listingId: "raw-1",
      provider: "mock",
      title: "Minimal Listing",
      imageUrls: [],
    });

    expect(normalized.country).toBe("Italy");
    expect(normalized.price).toBeUndefined();
    expect(normalized.bedrooms).toBeUndefined();
    expect(normalized.imageUrls).toEqual([]);
  });

  it("preserves accepted image order and skips unsafe image URLs", () => {
    const normalized = normalizeProviderListing({
      listingId: "raw-2",
      provider: "mock",
      title: "Image Order Listing",
      imageUrls: [
        "https://example.com/1.jpg",
        "javascript:alert(1)",
        "https://example.com/2.jpg",
        "http://localhost/internal.jpg",
      ],
    });

    expect(normalized.imageUrls).toEqual(["https://example.com/1.jpg", "https://example.com/2.jpg"]);
    expect(normalized.providerMetadata?.skippedImageCount).toBe(2);
  });

  it("includes source attribution metadata for fetched listings", async () => {
    const result = await fetchListing({
      provider: "mock",
      listingRef: "id-9988",
      country: "Italy",
      fallbackToMock: true,
    });

    expect(result.listing.sourceAttribution).toContain("Mock Listing Feed");
    expect(result.listing.providerMetadata?.listingId).toBeDefined();
    expect(result.listing.fetchedAt).toBeDefined();
  });

  it("returns safe fallback when provider fetch fails", async () => {
    const result = await fetchListing({
      provider: "idealista",
      listingRef: "idealista-42",
      country: "Italy",
      fallbackToMock: true,
    });

    expect(result.fetchStatus).toBe("fallback");
    expect(result.fallbackUsed).toBe(true);
    expect(result.providerUsed).toBe("mock");
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});

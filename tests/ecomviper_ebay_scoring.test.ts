import { describe, expect, it } from "vitest";
import { getMockEbayAspectMetadata, loadDeterministicMockEbayListings } from "@/lib/ecomviper/ebay/mock-ebay-provider";
import { scoreEbayListing } from "@/lib/ecomviper/ebay/listing-score";

describe("EcomViper eBay listing scoring", () => {
  it("returns deterministic score profiles for strong, medium, and weak mock listings", () => {
    const listings = loadDeterministicMockEbayListings();

    const strong = listings.find((listing) => listing.sku === "EV-EB-STRONG-001");
    const medium = listings.find((listing) => listing.sku === "EV-EB-MEDIUM-001");
    const weak = listings.find((listing) => listing.sku === "EV-EB-WEAK-001");

    expect(strong).toBeTruthy();
    expect(medium).toBeTruthy();
    expect(weak).toBeTruthy();

    const strongScore = scoreEbayListing(strong!, getMockEbayAspectMetadata(strong!.categoryId));
    const mediumScore = scoreEbayListing(medium!, getMockEbayAspectMetadata(medium!.categoryId));
    const weakScore = scoreEbayListing(weak!, getMockEbayAspectMetadata(weak!.categoryId));

    expect(strongScore).toMatchObject({
      titleScore: 100,
      descriptionScore: 92,
      aspectScore: 100,
      imageScore: 100,
      identifierScore: 100,
      inventoryScore: 100,
      overallScore: 98,
      priority: "low",
      status: "Healthy",
    });

    expect(mediumScore).toMatchObject({
      titleScore: 74,
      descriptionScore: 74,
      aspectScore: 78,
      imageScore: 65,
      identifierScore: 60,
      inventoryScore: 100,
      overallScore: 74,
      priority: "medium",
      status: "Improve",
    });

    expect(weakScore).toMatchObject({
      titleScore: 34,
      descriptionScore: 9,
      aspectScore: 23,
      imageScore: 25,
      identifierScore: 20,
      inventoryScore: 30,
      overallScore: 23,
      priority: "high",
      status: "Needs Attention",
    });

    expect(strongScore.overallScore).toBeGreaterThan(mediumScore.overallScore);
    expect(mediumScore.overallScore).toBeGreaterThan(weakScore.overallScore);
  });

  it("detects missing required and recommended aspects", () => {
    const listings = loadDeterministicMockEbayListings();
    const medium = listings.find((listing) => listing.sku === "EV-EB-MEDIUM-001");
    const weak = listings.find((listing) => listing.sku === "EV-EB-WEAK-001");

    expect(medium).toBeTruthy();
    expect(weak).toBeTruthy();

    const mediumScore = scoreEbayListing(medium!, getMockEbayAspectMetadata(medium!.categoryId));
    const weakScore = scoreEbayListing(weak!, getMockEbayAspectMetadata(weak!.categoryId));

    expect(mediumScore.missingRequiredAspects).toEqual([]);
    expect(mediumScore.missingRecommendedAspects).toEqual(["Color", "Material", "Compatible Model"]);

    expect(weakScore.missingRequiredAspects).toEqual(["Brand", "Platform"]);
    expect(weakScore.missingRecommendedAspects).toEqual(["Color", "Connectivity", "Material", "Compatible Model"]);
  });
});

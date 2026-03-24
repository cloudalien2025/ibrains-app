import { describe, expect, it } from "vitest";
import { resolveListingFacts } from "@/lib/directoryiq/faq/listingFactResolver";

describe("listing fact resolver", () => {
  it("resolves confirmed and unknown facts with confidence map", () => {
    const context = resolveListingFacts({
      listingId: "listing-1",
      siteId: "site-1",
      listingName: "Alpine Cabin",
      listingType: "vacation rental",
      listingArchetype: "vacation_rental",
      canonicalUrl: "https://example.com/listings/alpine-cabin",
      title: "Alpine Cabin",
      description: "Mountain stay",
      raw: {
        city: "Vail",
        region: "Colorado",
        amenities: ["wifi", "hot tub"],
        bedrooms: "3",
        bathrooms: "2",
        checkin_info: "Self check-in after 4pm",
      },
    });

    expect(context.city).toBe("Vail");
    expect(context.amenities).toContain("wifi");
    expect(context.fact_confidence_map.bedrooms).toBe("confirmed");
    expect(context.fact_confidence_map.cancellation_policy).toBe("unknown");
    expect(context.unknown_facts).toContain("cancellation_policy");
  });

  it("marks inferred family suitability when bedrooms imply family use", () => {
    const context = resolveListingFacts({
      listingId: "listing-2",
      siteId: null,
      listingName: "Ridge House",
      listingType: "vacation rental",
      listingArchetype: "vacation_rental",
      canonicalUrl: "https://example.com/listings/ridge-house",
      title: "Ridge House",
      description: "",
      raw: {
        bedrooms: "4",
      },
    });

    expect(context.fact_confidence_map.family_friendly).toBe("inferred");
    expect(context.inferred_facts.length).toBeGreaterThan(0);
  });
});

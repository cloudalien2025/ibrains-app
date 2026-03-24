import { describe, expect, it } from "vitest";
import { classifyListingArchetype } from "@/lib/directoryiq/faq/listingArchetypeClassifier";

describe("listing archetype classifier", () => {
  it("classifies vacation rentals", () => {
    const result = classifyListingArchetype({
      listingType: "short-term rental",
      category: "Vacation Rental",
      title: "Alpine Cabin",
    });

    expect(result.archetype).toBe("vacation_rental");
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it("falls back when confidence is low", () => {
    const result = classifyListingArchetype({
      listingType: "misc",
      category: "general",
      title: "Acme",
    });

    expect(result.fallbackReason).toBeTruthy();
  });
});

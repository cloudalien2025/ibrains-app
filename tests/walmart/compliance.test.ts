import { describe, expect, it } from "vitest";
import { validateDraftPayload } from "@/lib/ecomviper/core/draft-workflow";
import { evaluateWalmartListingCompliance } from "@/lib/ecomviper/walmart/walmart-compliance";

describe("Walmart compliance guardrails", () => {
  it("blocks medical and drug-like claims", () => {
    const result = evaluateWalmartListingCompliance({
      title: "Natural Viagra capsules",
      longDescription: "This formula cures erectile dysfunction quickly.",
      bulletPoints: ["Works like Cialis", "Guaranteed results"],
    });

    expect(result.valid).toBe(false);
    expect(result.violations.some((entry) => entry.includes("medical/drug claim"))).toBe(true);
    expect(result.suggestions.length).toBeGreaterThan(0);
  });

  it("blocks URLs and contact info in listing copy", () => {
    const result = evaluateWalmartListingCompliance({
      title: "Daily wellness support",
      longDescription: "Call 555-123-4567 or visit https://example.com for details.",
    });

    expect(result.valid).toBe(false);
    expect(result.violations.some((entry) => entry.includes("URL/contact"))).toBe(true);
  });

  it("accepts clean supportive language", () => {
    const result = evaluateWalmartListingCompliance({
      title: "Daily Wellness Support Supplement for Routine Balance",
      shortDescription: "Supports everyday wellness goals.",
      longDescription:
        "Crafted for routine wellness support and daily consistency with factual ingredient-focused language.",
      bulletPoints: [
        "Daily wellness support profile",
        "Simple routine-friendly format",
        "Designed for clear, factual listing copy",
      ],
    });

    expect(result.valid).toBe(true);
    expect(result.violations).toEqual([]);
  });
});

describe("Draft payload validation", () => {
  it("returns blocking violations when required data is invalid", () => {
    const validation = validateDraftPayload({
      title: " ",
      price: 0,
      inventoryQuantity: -1,
      imageUrl: "",
    });

    expect(validation.valid).toBe(false);
    expect(validation.violations).toEqual(
      expect.arrayContaining([
        "Title cannot be empty.",
        "Price must be greater than zero.",
        "Inventory must be zero or greater.",
        "Primary image URL cannot be empty.",
      ])
    );
  });
});

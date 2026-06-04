import { describe, expect, it } from "vitest";
import {
  detectWalmartFlavorClaims,
  normalizeWalmartFlavor,
  resolveWalmartFlavorFromFacts,
} from "@/lib/ecomviper/walmart/walmart-flavor-normalizer";

describe("Walmart flavor normalizer", () => {
  it("normalizes explicit trusted flavor values", () => {
    expect(normalizeWalmartFlavor("Berry")).toBe("Berry");
    expect(normalizeWalmartFlavor("Natural Flavor (strawberry)")).toBe("Strawberry");
    expect(normalizeWalmartFlavor("Unflavored")).toBe("Unflavored");
  });

  it("returns null for placeholder and ingredient-only candidates", () => {
    expect(normalizeWalmartFlavor("e.g., Citrus")).toBeNull();
    expect(normalizeWalmartFlavor("Goji")).toBeNull();
    expect(normalizeWalmartFlavor("Wolfberry")).toBeNull();
  });

  it("defaults to Unflavored when no trusted explicit flavor exists", () => {
    const resolved = resolveWalmartFlavorFromFacts({
      candidates: [{ value: "", source: "search_browse.flavor" }],
      labelTextCandidates: [
        {
          value: "Ingredients: goji (wolfberry), chamomile, lemon balm.",
          source: "label_text",
        },
      ],
    });

    expect(resolved).toEqual({
      flavor: "Unflavored",
      source: "default_unflavored",
      confidence: "default_unflavored",
    });
  });

  it("detects copy-level flavor claims for unsupported claim removal", () => {
    const claims = detectWalmartFlavorClaims(
      "OPA Sleep Aid Capsules, Berry flavor, 60 capsules, designed for evening routines."
    );
    expect(claims).toContain("Berry flavor");
  });

  it("detects unsupported unflavored flavor phrasing", () => {
    const claims = detectWalmartFlavorClaims(
      "OPA Sleep Aid Capsules, Unflavored flavor, 60 capsules."
    );
    expect(claims).toContain("Unflavored flavor");
  });
});

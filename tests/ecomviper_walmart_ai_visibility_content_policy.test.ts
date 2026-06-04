import { describe, expect, it } from "vitest";
import type { WalmartProductRecord } from "@/lib/ecomviper/walmart/walmart-types";
import {
  buildAiAnswerShortDescription,
  buildCompliantSearchKeywords,
  buildDefaultAltText,
  buildEntityRichTitle,
  buildStructuredLongDescription,
  buildWalmartVisibilityEntitySet,
  detectRiskyClaims,
  ensureSingleSupplementDisclaimer,
  sanitizeRiskyClaims,
  SUPPLEMENT_FDA_DISCLAIMER,
} from "@/lib/ecomviper/walmart/walmart-ai-visibility-content-policy";

function createProduct(overrides?: Partial<WalmartProductRecord>): WalmartProductRecord {
  return {
    id: "walmart_opa_joint",
    marketplace: "walmart",
    sku: "ROC949",
    externalItemId: "wm_roc949",
    title: "OPA Joint Platinum Turmeric, Glucosamine & Chondroitin Joint Support Supplement, 60 Capsules",
    brand: "OPA",
    category: "Supplements",
    price: 29.99,
    inventoryQuantity: 8,
    inventoryStatus: "known",
    status: "attention",
    imageUrl: "",
    attributes: {
      product_form: "Capsules",
      count: "60",
      main_ingredients: "Turmeric, Glucosamine, Chondroitin",
      target_audience: "Adults",
      support_areas: "Joint comfort, flexibility, mobility",
      directions_suggested_use: "Take 2 capsules daily.",
    },
    shortDescription: "",
    longDescription: "",
    bulletPoints: [],
    issues: [],
    rawPayload: {},
    normalizedPayload: {},
    lastSyncedAt: "2026-05-10T00:00:00.000Z",
    createdAt: "2026-05-10T00:00:00.000Z",
    updatedAt: "2026-05-10T00:00:00.000Z",
    ...overrides,
  };
}

describe("Walmart AI visibility content policy", () => {
  it("builds entity-rich title in expected order", () => {
    const entitySet = buildWalmartVisibilityEntitySet(createProduct());
    const title = buildEntityRichTitle(entitySet);

    expect(title.startsWith("OPA")).toBe(true);
    expect(title.toLowerCase()).toContain("supplement");
    expect(title).toContain("60");
  });

  it("builds AI-answer style short description", () => {
    const shortDescription = buildAiAnswerShortDescription(
      buildWalmartVisibilityEntitySet(createProduct())
    );

    expect(shortDescription.toLowerCase()).toContain("is a daily");
    expect(shortDescription.toLowerCase()).toContain("each bottle includes");
  });

  it("adds supplement FDA disclaimer once in long description", () => {
    const entitySet = buildWalmartVisibilityEntitySet(createProduct());
    const longDescription = buildStructuredLongDescription({ entitySet });

    expect(longDescription).toContain(SUPPLEMENT_FDA_DISCLAIMER);
    expect(longDescription.split(SUPPLEMENT_FDA_DISCLAIMER).length - 1).toBe(1);

    const preserved = ensureSingleSupplementDisclaimer(longDescription);
    expect(preserved.split(SUPPLEMENT_FDA_DISCLAIMER).length - 1).toBe(1);
  });

  it("detects and sanitizes risky supplement claims", () => {
    const unsafe = "Treats arthritis pain and works like medication";
    const detected = detectRiskyClaims(unsafe);
    const sanitized = sanitizeRiskyClaims(unsafe);

    expect(detected.length).toBeGreaterThan(0);
    expect(sanitized.rejectedRiskyClaims.length).toBeGreaterThan(0);
    expect(sanitized.sanitized.toLowerCase()).not.toContain("arthritis");
    expect(sanitized.sanitized.toLowerCase()).not.toContain("medication");
  });

  it("preserves FDA disclaimer wording during sanitization", () => {
    const sanitized = sanitizeRiskyClaims(SUPPLEMENT_FDA_DISCLAIMER);
    expect(sanitized.sanitized).toBe(SUPPLEMENT_FDA_DISCLAIMER);
    expect(sanitized.rejectedRiskyClaims).toEqual([]);
  });

  it("builds long description without repetitive supports-wellness filler", () => {
    const entitySet = buildWalmartVisibilityEntitySet(
      createProduct({
        attributes: {
          product_form: "Capsules",
          count: "60",
          main_ingredients: "Turmeric, Glucosamine, Chondroitin",
          support_areas: "supports wellness, supports wellness, mobility support",
        },
      })
    );
    const longDescription = buildStructuredLongDescription({ entitySet });

    expect(longDescription.toLowerCase()).not.toContain("supports wellness, supports wellness");
    expect(longDescription.split(SUPPLEMENT_FDA_DISCLAIMER).length - 1).toBe(1);
  });

  it("builds compliant search keywords from product entities", () => {
    const keywords = buildCompliantSearchKeywords(buildWalmartVisibilityEntitySet(createProduct()));
    expect(keywords.some((entry) => entry.toLowerCase().includes("opa"))).toBe(true);
    expect(keywords.some((entry) => entry.toLowerCase().includes("turmeric"))).toBe(true);
    expect(keywords.some((entry) => /erectile dysfunction|viagra|cialis/i.test(entry))).toBe(false);
  });

  it("builds entity-rich alt text", () => {
    const alt = buildDefaultAltText(buildWalmartVisibilityEntitySet(createProduct()));
    expect(alt).toContain("OPA");
    expect(alt.toLowerCase()).toContain("supplement");
  });
});

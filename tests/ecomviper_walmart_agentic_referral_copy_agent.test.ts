import { describe, expect, it } from "vitest";
import type { WalmartProductRecord } from "@/lib/ecomviper/walmart/walmart-types";
import {
  buildLabelFactsFixtureForRoc949,
  extractCanonicalProductFacts,
} from "@/lib/ecomviper/walmart/product-facts-agent";
import { buildAgenticReferralCopy } from "@/lib/ecomviper/walmart/agentic-referral-copy-agent";
import { SUPPLEMENT_FDA_DISCLAIMER } from "@/lib/ecomviper/walmart/walmart-ai-visibility-content-policy";

function createProduct(overrides?: Partial<WalmartProductRecord>): WalmartProductRecord {
  return {
    id: "walmart_roc949",
    marketplace: "walmart",
    sku: "ROC949",
    externalItemId: "wm_roc949",
    title: "OPA Nutrition Magnesium Glycinate Gummies",
    brand: "OPA Nutrition",
    category: "Supplements",
    price: 29.99,
    inventoryQuantity: 8,
    inventoryStatus: "known",
    status: "attention",
    imageUrl: "",
    issues: [],
    attributes: {},
    shortDescription: "",
    longDescription: "",
    bulletPoints: [],
    rawPayload: {},
    normalizedPayload: {},
    lastSyncedAt: "2026-05-12T00:00:00.000Z",
    createdAt: "2026-05-12T00:00:00.000Z",
    updatedAt: "2026-05-12T00:00:00.000Z",
    ...overrides,
  };
}

describe("Agentic Referral Copy Agent", () => {
  it("generates product-specific copy and AI visibility fields", () => {
    const product = createProduct({
      normalizedPayload: { labelFacts: buildLabelFactsFixtureForRoc949() },
    });
    const facts = extractCanonicalProductFacts({ product }).facts;

    const copy = buildAgenticReferralCopy({ facts, product });

    expect(copy.title).toContain("OPA Nutrition");
    expect(copy.title).toContain("Magnesium Glycinate Gummies");
    expect(copy.title).toContain("60");

    expect(copy.shortDescription.toLowerCase()).toContain("supports");
    expect(copy.longDescription).toContain(SUPPLEMENT_FDA_DISCLAIMER);
    expect(copy.longDescription.split(SUPPLEMENT_FDA_DISCLAIMER).length - 1).toBe(1);
    expect(copy.longDescription.toLowerCase()).not.toContain(
      "diagnose, support, support, or support any disease"
    );
    expect(copy.longDescription.toLowerCase()).not.toMatch(
      /\berectile dysfunction|viagra|cialis|works like medication\b/
    );

    expect(copy.bullets.length).toBeGreaterThanOrEqual(4);
    expect(copy.bullets.length).toBeLessThanOrEqual(6);
    expect(copy.bullets.join(" ").toLowerCase()).not.toContain("supports wellness, supports wellness");

    expect(copy.searchKeywords.join(" ").toLowerCase()).toContain("magnesium");
    expect(copy.searchKeywords.join(" ").toLowerCase()).not.toMatch(
      /erectile dysfunction|viagra|cialis|treat|cure|prevent/
    );

    expect(copy.aiVisibilitySummary.length).toBeGreaterThan(20);
    expect(copy.structuredProductFactsSummary).toContain("Serving size");
    expect(copy.customerFitDescriptors.length).toBeGreaterThan(0);
    expect(copy.compliantBenefitClusters.length).toBeGreaterThan(0);
    expect(copy.faqSnippets.length).toBeGreaterThanOrEqual(5);
    expect(copy.faqSnippets.length).toBeLessThanOrEqual(8);
    expect(copy.faqSnippets.join(" ").toLowerCase()).toContain("opa nutrition");
    expect(copy.faqSnippets.join(" ").toLowerCase()).toContain("magnesium glycinate");
  });
});

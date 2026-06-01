import { describe, expect, it } from "vitest";
import { buildProductCopywritingInput } from "@/lib/ecomviper/copywriting-agent/copywriting-agent-input-builder";
import { evaluateProductCopywritingOutput } from "@/lib/ecomviper/copywriting-agent/copywriting-agent-evals";

function validOutput() {
  return {
    optimizedTitle: "Test Supplement",
    listingSubtitle: "Source-backed support",
    shortDescription: "Short source-backed description for daily wellness support.",
    fullDescription: "This product provides source-backed ingredient transparency and clear usage guidance for daily routine support.",
    benefitBullets: ["Source-backed facts", "Clear usage", "Transparent notices"],
    ingredientHighlights: ["Magnesium"],
    usageSummary: "Use as directed.",
    faqSuggestions: [
      { question: "How should I use this?", answer: "Use as directed." },
      { question: "Is COA available?", answer: "COA missing." },
    ],
    imageAltTextSuggestions: [{ imageId: "img-1", altText: "Front bottle image" }],
    metaTitle: "Test Supplement",
    metaDescription: "Source-backed supplement listing.",
    agenticVisibilitySignals: {
      primaryIntents: ["what is this"],
      comparisonHooks: ["serving size"],
      trustSignals: ["source facts"],
      faqCoverage: ["usage", "missing data"],
    },
    complianceWarnings: [],
    missingDataNotices: ["COA missing", "Pricing missing", "Supplier match not found", "Supplement Facts missing"],
    sourceFactsUsed: ["supplement_facts:missing"],
    claimsRejected: ["No disease-treatment claims"],
    qualityScores: {
      schemaValidity: 100,
      factualGrounding: 85,
      supplementCompliance: 95,
      agenticVisibility: 80,
      conversionQuality: 80,
      missingDataBehavior: 100,
      brandVoice: 90,
      sourceUseTransparency: 90,
    },
    channelVariants: {
      shopify: "Shopify variant",
      optibay: null,
      optiwal: null,
      optizon: null,
      genericMarketplace: null,
    },
    generationMetadata: {
      contractVersion: "phase_6_1",
      generatedAt: "2026-06-01T00:00:00.000Z",
      sourceMode: "fixture",
      model: null,
    },
  };
}

describe("ecomviper copywriting agent eval rubric", () => {
  it("hard-fails prohibited claims", () => {
    const input = buildProductCopywritingInput({
      productIdentity: { productId: "p-1", title: "Eval Product", productType: "Supplements" },
      sourceEvidence: { coaPresent: true, sourceFactsUsed: ["supplement_facts:extracted"] },
      supplementFacts: { activeIngredients: ["Magnesium"] },
    });

    const output = {
      ...validOutput(),
      fullDescription: "This product treats insomnia and is a drug alternative.",
      ingredientHighlights: ["Magnesium"],
      missingDataNotices: [],
      sourceFactsUsed: ["supplement_facts:extracted"],
    };

    const result = evaluateProductCopywritingOutput(input, output);
    expect(result.passed).toBe(false);
    expect(result.hardFailures.join(" ").toLowerCase()).toContain("prohibited claim pattern");
  });

  it("hard-fails invented ingredients not in source facts", () => {
    const input = buildProductCopywritingInput({
      productIdentity: { productId: "p-2", title: "Eval Product", productType: "Supplements" },
      supplementFacts: { activeIngredients: ["Magnesium"] },
      sourceEvidence: { coaPresent: true, sourceFactsUsed: ["supplement_facts:extracted"] },
    });

    const output = {
      ...validOutput(),
      ingredientHighlights: ["Unicorn Root"],
      sourceFactsUsed: ["supplement_facts:extracted"],
      missingDataNotices: ["COA missing", "Pricing missing", "Supplier match not found", "Supplement Facts missing"],
    };

    const result = evaluateProductCopywritingOutput(input, output);
    expect(result.passed).toBe(false);
    expect(result.hardFailures.join(" ").toLowerCase()).toContain("invented ingredient highlight");
  });

  it("hard-fails when required missing-data notices are absent", () => {
    const input = buildProductCopywritingInput({
      productIdentity: { productId: "p-3", title: "Missing Data Product", productType: "Supplements" },
      variants: [{ sku: "SKU-1", barcode: null, upc: null, gtin: null, price: null, compareAtPrice: null, inventory: null }],
      sourceEvidence: { coaPresent: false, sourceFactsUsed: ["supplement_facts:missing"] },
      supplierContext: { matchStatus: "no_match" },
      supplementFacts: { activeIngredients: [] },
    });

    const output = {
      ...validOutput(),
      ingredientHighlights: [],
      missingDataNotices: [],
      sourceFactsUsed: ["supplement_facts:missing"],
    };

    const result = evaluateProductCopywritingOutput(input, output);
    expect(result.passed).toBe(false);
    const combined = result.hardFailures.join(" ").toLowerCase();
    expect(combined).toContain("coa missing");
    expect(combined).toContain("pricing missing");
    expect(combined).toContain("supplier match not found");
    expect(combined).toContain("supplement facts missing");
  });
});

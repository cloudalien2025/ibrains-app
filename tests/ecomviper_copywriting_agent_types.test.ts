import { describe, expect, it } from "vitest";
import {
  parseProductCopywritingOutput,
  validateProductCopywritingOutput,
} from "@/lib/ecomviper/copywriting-agent/copywriting-agent-types";

function validOutput() {
  return {
    optimizedTitle: "Sample Optimized Title",
    listingSubtitle: "Sample subtitle",
    shortDescription: "Short description",
    fullDescription: "Full source-backed description.",
    benefitBullets: ["Benefit one", "Benefit two"],
    ingredientHighlights: ["Magnesium"],
    usageSummary: "Use as directed.",
    faqSuggestions: [{ question: "How to use?", answer: "Use as directed." }],
    imageAltTextSuggestions: [{ imageId: "img-1", altText: "Front bottle image" }],
    metaTitle: "Meta title",
    metaDescription: "Meta description",
    agenticVisibilitySignals: {
      primaryIntents: ["what is this"],
      comparisonHooks: ["serving size"],
      trustSignals: ["source-backed"],
      faqCoverage: ["usage"],
    },
    complianceWarnings: [],
    missingDataNotices: [],
    sourceFactsUsed: ["supplement_facts:extracted"],
    claimsRejected: ["No disease claims"],
    qualityScores: {
      schemaValidity: 100,
      factualGrounding: 95,
      supplementCompliance: 98,
      agenticVisibility: 87,
      conversionQuality: 86,
      missingDataBehavior: 100,
      brandVoice: 90,
      sourceUseTransparency: 92,
    },
    channelVariants: {
      shopify: "Shopify variant",
      optibay: null,
      optiwal: null,
      optizon: null,
      genericMarketplace: "Marketplace variant",
    },
    generationMetadata: {
      contractVersion: "phase_6_1",
      generatedAt: "2026-06-01T00:00:00.000Z",
      sourceMode: "fixture",
      model: null,
    },
  };
}

describe("ecomviper copywriting agent output contract", () => {
  it("accepts a valid ProductCopywritingOutput payload", () => {
    const result = validateProductCopywritingOutput(validOutput());
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
    expect(parseProductCopywritingOutput(validOutput()).optimizedTitle).toContain("Sample");
  });

  it("rejects invalid payloads with required field errors", () => {
    const invalid = {
      ...validOutput(),
      optimizedTitle: 42,
      qualityScores: {
        ...validOutput().qualityScores,
        schemaValidity: 400,
      },
      generationMetadata: {
        ...validOutput().generationMetadata,
        generatedAt: "not-an-iso",
      },
    };

    const result = validateProductCopywritingOutput(invalid);
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("optimizedTitle");
    expect(result.errors.join(" ")).toContain("qualityScores.schemaValidity");
    expect(result.errors.join(" ")).toContain("generationMetadata.generatedAt");
  });
});

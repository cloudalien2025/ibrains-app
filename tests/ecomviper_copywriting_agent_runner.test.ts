import { describe, expect, it, vi } from "vitest";
import { buildProductCopywritingInput } from "@/lib/ecomviper/copywriting-agent/copywriting-agent-input-builder";
import { runProductCopywritingAgent, type ProductCopywritingModelClient } from "@/lib/ecomviper/copywriting-agent/copywriting-agent-runner";

function baseInput() {
  return buildProductCopywritingInput({
    channel: "shopify",
    productIdentity: {
      productId: "gid://shopify/Product/1",
      handle: "test-product",
      title: "Test Product",
      productType: "Supplements",
    },
    variants: [{ sku: "SKU-1", barcode: null, upc: null, gtin: null, price: 19.99, compareAtPrice: null, inventory: 3 }],
    supplementFacts: {
      servingSize: "1 capsule",
      servingsPerContainer: "30",
      activeIngredients: ["Magnesium"],
      ingredientAmounts: ["Magnesium 30mg"],
      otherIngredients: ["Cellulose"],
    },
    sourceEvidence: {
      coaPresent: true,
      sourceFactsUsed: ["supplement_facts:extracted"],
    },
    supplierContext: {
      matchStatus: "matched",
    },
  });
}

function validOutput() {
  return {
    optimizedTitle: "Test Product Optimized",
    listingSubtitle: "Source-backed support",
    shortDescription: "Short source-backed description.",
    fullDescription: "Full source-backed description with clear usage and trust details for review.",
    benefitBullets: ["Source-backed facts", "Clear usage", "Review-first workflow"],
    ingredientHighlights: ["Magnesium"],
    usageSummary: "Use as directed.",
    faqSuggestions: [{ question: "How to use?", answer: "Use as directed." }],
    imageAltTextSuggestions: [{ imageId: "img-1", altText: "Front bottle image" }],
    metaTitle: "Test Product Optimized",
    metaDescription: "Source-backed listing copy.",
    agenticVisibilitySignals: {
      primaryIntents: ["what is this"],
      comparisonHooks: ["serving size"],
      trustSignals: ["source facts"],
      faqCoverage: ["usage"],
    },
    complianceWarnings: [],
    missingDataNotices: [],
    sourceFactsUsed: ["supplement_facts:extracted"],
    claimsRejected: ["No disease-treatment claims"],
    qualityScores: {
      schemaValidity: 100,
      factualGrounding: 90,
      supplementCompliance: 95,
      agenticVisibility: 80,
      conversionQuality: 80,
      missingDataBehavior: 100,
      brandVoice: 90,
      sourceUseTransparency: 95,
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
      sourceMode: "manual",
      model: null,
    },
  };
}

describe("ecomviper copywriting agent runner", () => {
  it("builds structured model request and validates successful output", async () => {
    const capture = vi.fn();
    const modelClient: ProductCopywritingModelClient = {
      async generateStructuredOutput(input) {
        capture(input);
        return {
          content: JSON.stringify(validOutput()),
          model: "gpt-4.1-mini",
        };
      },
    };

    const result = await runProductCopywritingAgent({
      copywritingInput: baseInput(),
      openAiApiKey: "sk-test",
      modelClient,
    });

    expect(result.status).toBe("success");
    expect(result.output?.optimizedTitle).toContain("Optimized");
    expect(capture).toHaveBeenCalledTimes(1);
    const call = capture.mock.calls[0]?.[0] as { outputSchema?: unknown; user?: string };
    expect(call.outputSchema).toBeTruthy();
    expect(String(call.user || "")).toContain("SOURCE FACTS:");
  });

  it("returns validation_error when output schema is invalid", async () => {
    const modelClient: ProductCopywritingModelClient = {
      async generateStructuredOutput() {
        return { content: JSON.stringify({ optimizedTitle: 123 }), model: "gpt-4.1-mini" };
      },
    };

    const result = await runProductCopywritingAgent({
      copywritingInput: baseInput(),
      openAiApiKey: "sk-test",
      modelClient,
    });

    expect(result.status).toBe("validation_error");
    expect(result.errorCode).toBe("OUTPUT_SCHEMA_MISMATCH");
    expect(result.safeMessage).toBe("Generated response could not be validated.");
  });

  it("repairs unsupported ingredient claims without blocking the full proposal", async () => {
    const modelClient: ProductCopywritingModelClient = {
      async generateStructuredOutput() {
        return {
          content: JSON.stringify({
            ...validOutput(),
            ingredientHighlights: ["Unicorn Root"],
          }),
          model: "gpt-4.1-mini",
        };
      },
    };

    const result = await runProductCopywritingAgent({
      copywritingInput: baseInput(),
      openAiApiKey: "sk-test",
      modelClient,
    });

    expect(result.status).toBe("success");
    expect(result.errorCode).toBeNull();
    expect(result.output?.ingredientHighlights).toEqual([]);
    expect(result.complianceWarnings.join(" ").toLowerCase()).toContain("removed");
  });

  it("keeps title-backed ingredient highlights with safe structure/function phrasing", async () => {
    const input = buildProductCopywritingInput({
      channel: "shopify",
      productIdentity: {
        productId: "gid://shopify/Product/2",
        handle: "nitric-oxide",
        title: "Nitric Oxide Gummies L-Arginine Citrulline",
        productType: "Supplements",
      },
      variants: [{ sku: "SKU-2", barcode: null, upc: null, gtin: null, price: 24.99, compareAtPrice: null, inventory: 2 }],
      supplementFacts: {
        activeIngredients: ["Calcium"],
        ingredientAmounts: ["Calcium 18 mg", "Magnesium 13 mg"],
      },
      sourceEvidence: {
        coaPresent: true,
        sourceFactsUsed: ["supplement_facts:extracted"],
      },
      supplierContext: {
        matchStatus: "matched",
      },
    });

    const modelClient: ProductCopywritingModelClient = {
      async generateStructuredOutput() {
        return {
          content: JSON.stringify({
            ...validOutput(),
            ingredientHighlights: [
              "L-Arginine - supports nitric oxide pathways",
              "Calcium (18 mg) - supports bone and muscle function",
            ],
          }),
          model: "gpt-4.1-mini",
        };
      },
    };

    const result = await runProductCopywritingAgent({
      copywritingInput: input,
      openAiApiKey: "sk-test",
      modelClient,
    });

    expect(result.status).toBe("success");
    expect(result.output?.ingredientHighlights).toContain("L-Arginine - supports nitric oxide pathways");
  });

  it("removes unsupported dosage highlights while keeping safe supported highlights", async () => {
    const modelClient: ProductCopywritingModelClient = {
      async generateStructuredOutput() {
        return {
          content: JSON.stringify({
            ...validOutput(),
            ingredientHighlights: [
              "Magnesium (30mg) - supports muscle and nerve function",
              "Magnesium (300mg) - supports cardiovascular function",
            ],
          }),
          model: "gpt-4.1-mini",
        };
      },
    };

    const result = await runProductCopywritingAgent({
      copywritingInput: baseInput(),
      openAiApiKey: "sk-test",
      modelClient,
    });

    expect(result.status).toBe("success");
    expect(result.output?.ingredientHighlights).toContain("Magnesium (30mg) - supports muscle and nerve function");
    expect(result.output?.ingredientHighlights).not.toContain("Magnesium (300mg) - supports cardiovascular function");
  });

  it("blocks prohibited disease/treatment claims", async () => {
    const modelClient: ProductCopywritingModelClient = {
      async generateStructuredOutput() {
        return {
          content: JSON.stringify({
            ...validOutput(),
            fullDescription: "This supplement treats insomnia and is a drug alternative.",
          }),
          model: "gpt-4.1-mini",
        };
      },
    };

    const result = await runProductCopywritingAgent({
      copywritingInput: baseInput(),
      openAiApiKey: "sk-test",
      modelClient,
    });

    expect(result.status).toBe("blocked");
    expect(result.complianceWarnings.join(" ").toLowerCase()).toContain("prohibited claim pattern");
  });

  it("returns unavailable when api key is missing and does not require OPENAI_API_KEY", async () => {
    const result = await runProductCopywritingAgent({
      copywritingInput: baseInput(),
      openAiApiKey: null,
    });

    expect(result.status).toBe("unavailable");
    expect(result.safeMessage).toBe("AI generation is unavailable right now.");
  });

  it("maps model timeout errors to plain timeout message", async () => {
    const modelClient: ProductCopywritingModelClient = {
      async generateStructuredOutput() {
        throw new Error("request timed out");
      },
    };

    const result = await runProductCopywritingAgent({
      copywritingInput: baseInput(),
      openAiApiKey: "sk-test",
      modelClient,
    });

    expect(result.status).toBe("model_error");
    expect(result.errorCode).toBe("MODEL_TIMEOUT");
    expect(result.safeMessage).toBe("AI generation timed out. Try again.");
  });

  it("maps unexpected model failures to unavailable message", async () => {
    const modelClient: ProductCopywritingModelClient = {
      async generateStructuredOutput() {
        throw new Error("openai_http_500");
      },
    };

    const result = await runProductCopywritingAgent({
      copywritingInput: baseInput(),
      openAiApiKey: "sk-test",
      modelClient,
    });

    expect(result.status).toBe("model_error");
    expect(result.errorCode).toBe("MODEL_ERROR");
    expect(result.safeMessage).toBe("AI generation is unavailable right now.");
  });

  it("enforces Supplement Facts missing notice and removes ingredient highlights", async () => {
    const input = buildProductCopywritingInput({
      productIdentity: { productId: "p-2", title: "Missing Facts Product", productType: "Supplements" },
      variants: [{ sku: "SKU-2", barcode: null, upc: null, gtin: null, price: 10, compareAtPrice: null, inventory: 1 }],
      sourceEvidence: { coaPresent: false, sourceFactsUsed: [] },
      supplierContext: { matchStatus: "no_match" },
      supplementFacts: { activeIngredients: [] },
    });

    const modelClient: ProductCopywritingModelClient = {
      async generateStructuredOutput() {
        return {
          content: JSON.stringify({
            ...validOutput(),
            ingredientHighlights: ["Magnesium"],
            missingDataNotices: [],
            sourceFactsUsed: [],
          }),
          model: "gpt-4.1-mini",
        };
      },
    };

    const result = await runProductCopywritingAgent({
      copywritingInput: input,
      openAiApiKey: "sk-test",
      modelClient,
    });

    expect(result.status).toBe("success");
    expect(result.output?.ingredientHighlights).toEqual([]);
    expect(result.missingDataNotices).toContain("Supplement Facts missing.");
    expect(result.missingDataNotices).toContain("Serving size missing.");
    expect(result.missingDataNotices).toContain("Servings per container missing.");
    expect(result.missingDataNotices).toContain("COA missing.");
    expect(result.missingDataNotices).toContain("Supplier match not found.");
  });

  it("returns specific serving-field notices without blanket Supplement Facts missing when ingredient facts exist", async () => {
    const input = buildProductCopywritingInput({
      productIdentity: { productId: "p-3", title: "Partial Facts Product", productType: "Supplements" },
      variants: [{ sku: "SKU-3", barcode: null, upc: null, gtin: null, price: 25, compareAtPrice: null, inventory: 5 }],
      supplementFacts: {
        activeIngredients: ["L-Citrulline"],
        ingredientAmounts: ["L-Citrulline 1500mg"],
      },
      sourceEvidence: {
        coaPresent: true,
        labelEvidencePresent: true,
        supplementFactsImagePresent: true,
        aiLabelTextEvidencePresent: true,
        aiLabelTextEvidenceStatus: "reused_cached",
      },
      supplierContext: { matchStatus: "matched" },
    });

    const modelClient: ProductCopywritingModelClient = {
      async generateStructuredOutput() {
        return {
          content: JSON.stringify({
            ...validOutput(),
            ingredientHighlights: ["L-Citrulline"],
            missingDataNotices: [],
          }),
          model: "gpt-4.1-mini",
        };
      },
    };

    const result = await runProductCopywritingAgent({
      copywritingInput: input,
      openAiApiKey: "sk-test",
      modelClient,
    });

    expect(result.status).toBe("success");
    expect(result.missingDataNotices).toContain("Serving size missing.");
    expect(result.missingDataNotices).toContain("Servings per container missing.");
    expect(result.missingDataNotices).not.toContain("Supplement Facts missing.");
    expect(result.missingDataNotices).not.toContain("Ingredient amounts missing.");
  });

  it("sanitizes internal/debug warnings from merchant-facing output", async () => {
    const modelClient: ProductCopywritingModelClient = {
      async generateStructuredOutput() {
        return {
          content: JSON.stringify({
            ...validOutput(),
            complianceWarnings: [
              "source fact references include non-listed facts",
              "ingredientMatchingReadiness: blocked",
              "requires OCR extraction from catalog label image",
            ],
            missingDataNotices: [
              "requires OCR extraction from catalog label image",
              "source fact references include non-listed facts",
            ],
          }),
          model: "gpt-4.1-mini",
        };
      },
    };

    const result = await runProductCopywritingAgent({
      copywritingInput: baseInput(),
      openAiApiKey: "sk-test",
      modelClient,
    });

    expect(result.status).toBe("success");
    expect(result.complianceWarnings.join(" ")).not.toMatch(/non-listed facts|ingredientMatchingReadiness|OCR/i);
    expect(result.missingDataNotices.join(" ")).not.toMatch(/non-listed facts|OCR/i);
  });

  it("drops model-claimed blanket missing notices when input has structured facts", async () => {
    const modelClient: ProductCopywritingModelClient = {
      async generateStructuredOutput() {
        return {
          content: JSON.stringify({
            ...validOutput(),
            missingDataNotices: ["Supplement Facts missing.", "Ingredient amounts missing."],
            complianceWarnings: ["Supplement Facts missing. Ingredient-backed claims were limited."],
          }),
          model: "gpt-4.1-mini",
        };
      },
    };

    const result = await runProductCopywritingAgent({
      copywritingInput: baseInput(),
      openAiApiKey: "sk-test",
      modelClient,
    });

    expect(result.status).toBe("success");
    expect(result.missingDataNotices).not.toContain("Supplement Facts missing.");
    expect(result.missingDataNotices).not.toContain("Ingredient amounts missing.");
    expect(result.complianceWarnings.join(" ")).not.toContain("Supplement Facts missing");
  });
});

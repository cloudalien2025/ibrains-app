import { describe, expect, it } from "vitest";
import { buildProductCopywritingInput } from "@/lib/ecomviper/copywriting-agent/copywriting-agent-input-builder";
import {
  buildCopywritingPromptPayload,
  buildProductCopywritingPromptContract,
} from "@/lib/ecomviper/copywriting-agent/copywriting-agent-prompt";

describe("ecomviper copywriting agent prompt contract", () => {
  it("includes strict no-invention and compliance constraints", () => {
    const input = buildProductCopywritingInput({
      channel: "shopify",
      productIdentity: {
        productId: "p-1",
        handle: "test",
        title: "Test Product",
        productType: "Supplements",
      },
      variants: [{ sku: "SKU1", barcode: null, upc: null, gtin: null, price: null, compareAtPrice: null, inventory: null }],
      sourceEvidence: {
        coaPresent: false,
        sourceFactsUsed: ["supplement_facts:missing"],
      },
    });

    const contract = buildProductCopywritingPromptContract(input);
    const combined = [
      contract.systemInstruction,
      contract.outputInstruction,
      ...contract.complianceConstraints,
    ].join("\n").toLowerCase();

    expect(combined).toContain("do not invent ingredients");
    expect(combined).toContain("do not invent");
    expect(combined).toContain("coa");
    expect(combined).toContain("pricing");
    expect(combined).toContain("inventory");
    expect(combined).toContain("disease claims");
    expect(combined).toContain("treatment claims");
    expect(combined).toContain("drug comparison");
    expect(combined).toContain("missingdatanotices");
    expect(contract.outputJsonSchema.type).toBe("object");
  });

  it("builds payload without any model call requirement or secret dependency", () => {
    const input = buildProductCopywritingInput({
      productIdentity: {
        productId: "p-2",
        title: "No Secret Product",
        productType: "Supplements",
      },
      sourceEvidence: {
        coaPresent: false,
      },
    });

    const payload = buildCopywritingPromptPayload(input);
    expect(payload.system.toLowerCase()).toContain("never fabricate facts");
    expect(payload.user).toContain("SOURCE FACTS:");
    expect(payload.outputJsonSchema.required).toContain("optimizedTitle");
  });
});

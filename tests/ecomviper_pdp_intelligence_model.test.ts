import { describe, expect, it } from "vitest";
import {
  createEmptyShopifyPdpIntelligenceRecord,
  sanitizeShopifyPdpIntelligenceRecord,
} from "@/lib/ecomviper/shopify/shopify-pdp-intelligence";

describe("shopify PDP intelligence model", () => {
  it("creates required Sprint 008 fields", () => {
    const record = createEmptyShopifyPdpIntelligenceRecord({
      shopifyProductId: "gid://shopify/Product/123",
      productHandle: "sleep-formula",
      supplier: "Rocktomic",
      supplierSku: "ROC817",
    });

    expect(record).toHaveProperty("product_intelligence_id");
    expect(record).toHaveProperty("shopify_product_id");
    expect(record).toHaveProperty("supplier");
    expect(record).toHaveProperty("supplier_sku");
    expect(record).toHaveProperty("ai_product_summary");
    expect(record).toHaveProperty("best_for");
    expect(record).toHaveProperty("not_best_for");
    expect(record).toHaveProperty("use_cases");
    expect(record).toHaveProperty("ingredient_highlights");
    expect(record).toHaveProperty("trust_signals");
    expect(record).toHaveProperty("certifications");
    expect(record).toHaveProperty("compliance_safe_claims");
    expect(record).toHaveProperty("comparison_content");
    expect(record).toHaveProperty("agentic_selection_notes");
    expect(record).toHaveProperty("faqs");
    expect(record).toHaveProperty("compliance_notes");
    expect(record).toHaveProperty("generation_status");
    expect(record).toHaveProperty("last_generated_at");
    expect(record).toHaveProperty("last_edited_at");
    expect(record).toHaveProperty("updated_at");
  });

  it("sanitizes FAQ entries with schema/compliance fields", () => {
    const fallback = createEmptyShopifyPdpIntelligenceRecord({
      shopifyProductId: "gid://shopify/Product/123",
      productHandle: "sleep-formula",
      supplier: "Rocktomic",
      supplierSku: "ROC817",
    });

    const sanitized = sanitizeShopifyPdpIntelligenceRecord(
      {
        ...fallback,
        faqs: [
          {
            question: "What is this product?",
            answer: "A daily wellness supplement.",
            category: "overview",
            schema_eligible: true,
            compliance_status: "approved",
          },
        ],
      },
      fallback
    );

    expect(sanitized.faqs).toHaveLength(1);
    expect(sanitized.faqs[0]).toEqual({
      question: "What is this product?",
      answer: "A daily wellness supplement.",
      category: "overview",
      schema_eligible: true,
      compliance_status: "approved",
    });
  });
});

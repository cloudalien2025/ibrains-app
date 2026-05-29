import { describe, expect, it } from "vitest";
import {
  createEmptyShopifyPdpIntelligenceRecord,
} from "@/lib/ecomviper/shopify/shopify-pdp-intelligence";
import {
  evaluateShopifyPdpCompliance,
  sanitizeShopifyPdpFaqs,
} from "@/lib/ecomviper/shopify/shopify-pdp-intelligence-compliance";

describe("shopify PDP intelligence compliance", () => {
  it("detects risky supplement phrases deterministically", () => {
    const record = createEmptyShopifyPdpIntelligenceRecord({
      shopifyProductId: "gid://shopify/Product/123",
      productHandle: "sleep-formula",
      supplier: "Rocktomic",
      supplierSku: "ROC817",
    });

    record.ai_product_summary =
      "Natural Viagra formula that treats anxiety and prevents insomnia.";
    record.compliance_safe_claims = ["Clinically proven to treat high blood pressure."];

    const review = evaluateShopifyPdpCompliance(record);
    expect(review.risk_level).toBe("high");
    expect(review.risky_phrases_found).toEqual(
      expect.arrayContaining(["natural viagra", "treat", "anxiety", "prevent", "insomnia", "high blood pressure"])
    );
    expect(review.safer_rewrite_notes.length).toBeGreaterThan(0);
  });

  it("marks flagged FAQ entries as review_required and schema-ineligible", () => {
    const sanitized = sanitizeShopifyPdpFaqs(
      [
        {
          question: "Does this cure insomnia?",
          answer: "It can treat insomnia quickly.",
          category: "medical",
          schema_eligible: true,
          compliance_status: "approved",
        },
      ],
      ["insomnia", "cure", "treat"]
    );
    expect(sanitized[0]?.schema_eligible).toBe(false);
    expect(sanitized[0]?.compliance_status).toBe("review_required");
  });
});

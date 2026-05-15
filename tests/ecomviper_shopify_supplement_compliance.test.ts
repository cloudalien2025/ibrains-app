import { describe, expect, it } from "vitest";
import {
  SHOPIFY_SUPPLEMENT_FDA_DISCLAIMER,
  buildSupplementSafeFaqBundle,
  validateShopifySupplementCompliance,
} from "@/lib/ecomviper/shopify/shopify-supplement-compliance";

describe("Shopify supplement compliance", () => {
  it("blocks risky supplement phrases", () => {
    const result = validateShopifySupplementCompliance(
      "This formula can treat insomnia and works like Cialis for ED symptoms."
    );

    expect(result.safe).toBe(false);
    expect(result.blockedPhrases).toEqual(
      expect.arrayContaining(["insomnia", "works like Cialis", "ED", "treat"])
    );
  });

  it("includes FDA disclaimer exactly once in generated FAQ bundle", () => {
    const bundle = buildSupplementSafeFaqBundle([
      {
        question: "Are these products intended to diagnose, treat, cure, or prevent disease?",
        answer: "No. These products support daily wellness only.",
      },
      {
        question: "How should I describe supplement benefits?",
        answer: `Use structure/function language and avoid disease claims. ${SHOPIFY_SUPPLEMENT_FDA_DISCLAIMER}`,
      },
    ]);

    expect(bundle.disclaimerCount).toBe(1);
    expect(bundle.bundleText.split(SHOPIFY_SUPPLEMENT_FDA_DISCLAIMER).length - 1).toBe(1);
  });
});

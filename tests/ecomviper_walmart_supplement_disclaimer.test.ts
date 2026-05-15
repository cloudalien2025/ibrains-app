import { describe, expect, it } from "vitest";
import { evaluateWalmartListingCompliance } from "@/lib/ecomviper/walmart/walmart-compliance";
import {
  countCanonicalSupplementDisclaimer,
  detectMalformedSupplementDisclaimerFragments,
  normalizeSupplementDisclaimerText,
  SUPPLEMENT_FDA_DISCLAIMER,
} from "@/lib/ecomviper/walmart/walmart-supplement-disclaimer";

describe("Walmart supplement disclaimer normalization", () => {
  it("inserts the canonical FDA disclaimer exactly once", () => {
    const result = normalizeSupplementDisclaimerText("Supports relaxation and daily wellness.");

    expect(result.normalizedText).toContain(SUPPLEMENT_FDA_DISCLAIMER);
    expect(countCanonicalSupplementDisclaimer(result.normalizedText)).toBe(1);
    expect(result.normalizedText.trim().endsWith(SUPPLEMENT_FDA_DISCLAIMER)).toBe(true);
    expect(result.status).toBe("inserted");
  });

  it("removes duplicate disclaimer variants and keeps one canonical disclaimer", () => {
    const duplicate = `${SUPPLEMENT_FDA_DISCLAIMER}\n\n${SUPPLEMENT_FDA_DISCLAIMER}`;
    const result = normalizeSupplementDisclaimerText(duplicate);

    expect(countCanonicalSupplementDisclaimer(result.normalizedText)).toBe(1);
    expect(result.status).toBe("deduped");
  });

  it("repairs malformed disclaimer variants", () => {
    const malformed =
      "Daily wellness support. This product is not intended to diagnose, support, support, or support any disease.";

    const result = normalizeSupplementDisclaimerText(malformed);

    expect(result.status).toBe("repaired");
    expect(result.normalizedText.toLowerCase()).not.toContain("diagnose, support, support, or support any disease");
    expect(countCanonicalSupplementDisclaimer(result.normalizedText)).toBe(1);
  });

  it("removes FDA disclaimer heading labels before appending canonical disclaimer", () => {
    const result = normalizeSupplementDisclaimerText(
      "**FDA Disclaimer:** These statements have not been evaluated by the Food and Drug Administration. This product is not intended to diagnose, treat, cure, or prevent any disease."
    );

    expect(result.normalizedText).not.toContain("FDA Disclaimer");
    expect(result.normalizedText).not.toContain("**");
    expect(result.normalizedText).toContain(SUPPLEMENT_FDA_DISCLAIMER);
    expect(result.normalizedText.trim().endsWith(SUPPLEMENT_FDA_DISCLAIMER)).toBe(true);
    expect(countCanonicalSupplementDisclaimer(result.normalizedText)).toBe(1);
  });

  it("flags malformed disclaimer text in validation", () => {
    const malformed =
      "Supports daily wellness. This product is not intended to diagnose, support, support, or support any disease.";

    expect(detectMalformedSupplementDisclaimerFragments(malformed).length).toBeGreaterThan(0);

    const compliance = evaluateWalmartListingCompliance({
      title: "Magnesium Supplement Gummies 60 Count",
      category: "Supplements",
      shortDescription: "Supports daily wellness.",
      longDescription: malformed,
      bulletPoints: ["Supports relaxation", "60 count", "Use as directed"],
      faqSnippets: [
        "Q: What is it? A: A magnesium gummy supplement.",
        "Q: Who is it for? A: Adults.",
        "Q: How do I take it? A: Use as directed.",
        "Q: What are the ingredients? A: See label.",
        "Q: What should I know before use? A: See label warnings.",
      ],
    });

    expect(compliance.violations.some((entry) => entry.includes("Malformed FDA disclaimer"))).toBe(true);
  });
});

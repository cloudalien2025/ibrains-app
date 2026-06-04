import { describe, expect, it } from "vitest";
import {
  buildWalmartSourceConfidenceRows,
  classifyWalmartFieldSourceConfidence,
  summarizeWalmartSourceConfidence,
} from "@/lib/ecomviper/walmart/walmart-source-confidence";

describe("Walmart source confidence helpers", () => {
  it("classifies missing description filled by public catalog as filled_missing", () => {
    const row = classifyWalmartFieldSourceConfidence({
      field: "siteDescription",
      currentValue: "",
      currentSource: "fallback",
      proposedValue: "OPA Gut Enzyme & Probiotic Digestive Balance support.",
      proposedSource: "walmart_public_catalog",
      candidateConfidence: "strong",
      sellerNativePresent: false,
      userEdited: false,
    });

    expect(row.action).toBe("filled_missing");
  });

  it("classifies seller-native field as kept_seller_native", () => {
    const row = classifyWalmartFieldSourceConfidence({
      field: "brand",
      currentValue: "OPA Nutrition",
      currentSource: "seller_native",
      proposedValue: "OPA Nutrition",
      proposedSource: "walmart_item_api",
      candidateConfidence: "exact",
      sellerNativePresent: true,
      userEdited: false,
    });

    expect(row.action).toBe("kept_seller_native");
  });

  it("classifies conflicting value as skipped_conflict", () => {
    const row = classifyWalmartFieldSourceConfidence({
      field: "brand",
      currentValue: "Existing Brand",
      currentSource: "fallback",
      proposedValue: "Different Brand",
      proposedSource: "walmart_item_search",
      candidateConfidence: "moderate",
      sellerNativePresent: false,
      userEdited: false,
    });

    expect(row.action).toBe("skipped_conflict");
  });

  it("summarizes confidence/action counts", () => {
    const rows = buildWalmartSourceConfidenceRows({
      fieldPatches: [
        classifyWalmartFieldSourceConfidence({
          field: "siteDescription",
          currentValue: "",
          currentSource: "fallback",
          proposedValue: "Description",
          proposedSource: "walmart_public_catalog",
          candidateConfidence: "strong",
          sellerNativePresent: false,
          userEdited: false,
        }),
        classifyWalmartFieldSourceConfidence({
          field: "brand",
          currentValue: "OPA Nutrition",
          currentSource: "seller_native",
          proposedValue: "OPA Nutrition",
          proposedSource: "walmart_item_api",
          candidateConfidence: "exact",
          sellerNativePresent: true,
          userEdited: false,
        }),
      ],
    });

    const summary = summarizeWalmartSourceConfidence({
      fieldPatches: rows,
      overallConfidence: "strong",
    });

    expect(summary.totalFields).toBe(2);
    expect(summary.byAction.filled_missing).toBe(1);
    expect(summary.byAction.kept_seller_native).toBe(1);
    expect(summary.overallConfidence).toBe("strong");
  });
});


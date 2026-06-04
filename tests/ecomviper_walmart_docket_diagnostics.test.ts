import { describe, expect, it } from "vitest";
import { hydrateWalmartDocketFromSources } from "@/lib/ecomviper/walmart/walmart-docket-hydration";
import { buildWalmartDocketDiagnostics } from "@/lib/ecomviper/walmart/walmart-docket-diagnostics";

describe("Walmart docket diagnostics helper", () => {
  it("reports raw keys, alias hits, populated fields, missing fields, and field sources", () => {
    const payload = {
      sku: "ROC948",
      productName: "ROC948 Joint Support",
      raw: {
        content: {
          siteDescription: "Fast short summary",
          fullDescription: "Detailed long copy",
          keyFeatures: ["Feature one", "Feature two"],
        },
      },
      primaryImage: "https://images.example.com/roc948-primary.jpg",
      additionalImages: ["https://images.example.com/roc948-gallery.jpg"],
      price: { amount: "29.99" },
      inventoryQuantity: 4,
      attributes: {
        product_form: "Capsule",
      },
    };

    const docket = hydrateWalmartDocketFromSources({
      sku: "ROC948",
      sources: [
        {
          source: "item_detail",
          payload,
          retrievedAt: "2026-05-16T00:00:00.000Z",
          confidence: "high",
        },
      ],
    });
    const diagnostics = buildWalmartDocketDiagnostics({
      sku: "ROC948",
      payload,
      docket,
    });

    expect(diagnostics.sku).toBe("ROC948");
    expect(diagnostics.rawKeys).toEqual(expect.arrayContaining(["raw.content.siteDescription", "primaryImage"]));
    expect(diagnostics.aliasHits.shortDescription).toContain("raw.content.siteDescription");
    expect(diagnostics.aliasHits.longDescription).toContain("raw.content.fullDescription");
    expect(diagnostics.aliasHits.bullets).toContain("raw.content.keyFeatures");
    expect(diagnostics.aliasHits.images).toContain("primaryImage");
    expect(diagnostics.populatedFields).toEqual(
      expect.arrayContaining([
        "title",
        "shortDescription",
        "longDescription",
        "bullets",
        "primaryImage",
        "galleryImages",
        "price",
        "inventoryQuantity",
        "searchBrowseAttributes",
      ])
    );
    expect(diagnostics.missingFields).not.toContain("searchBrowseAttributes");
    expect(diagnostics.fieldSources.shortDescription).toMatchObject({
      populated: true,
      source: "item_detail",
    });
  });
});

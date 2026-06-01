import fs from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  mergeSupplierRecordsBySku,
  parseRocktomicCatalogMarkdown,
} from "@/lib/ecomviper/suppliers/rocktomic/firecrawl-catalog-markdown-parser";

describe("rocktomic firecrawl catalog markdown parser", () => {
  it("extracts ROC948 from live-cache markdown fixture as needs_review", async () => {
    const body = await fs.readFile(
      "data/ecomviper/suppliers/rocktomic/fixtures/firecrawl/roc948-live-cache-markdown.json",
      "utf8"
    );
    const fixture = JSON.parse(body) as { markdown: string; sourceUrl: string };

    const result = parseRocktomicCatalogMarkdown({
      markdown: fixture.markdown,
      sourceUrl: fixture.sourceUrl,
      supplierId: "rocktomic",
      supplierName: "Rocktomic",
      skuFilter: ["ROC948"],
    });

    expect(result.reason).toBe("ok");
    expect(result.records).toHaveLength(1);

    const record = result.records[0];
    expect(record.sku).toBe("ROC948");
    expect(record.productName).toBe("Premium Nitric Oxide Gummies");
    expect(record.labelSize).toBe("2.25 x 6.75 in");
    expect(record.containerSize).toBe("4.69 x 2.72 in");
    expect(record.productWeight).toBe("8 oz");
    expect(record.sourceStatus).toBe("needs_review");
    expect(record.missingFields).toContain("activeIngredients");
    expect(record.extractionWarnings).toContain("supplement_facts_incomplete_markdown");
    expect(record.provenance[0]?.rawSnippet).toContain("ROC948");
  });

  it("returns sku_not_found when requested sku does not exist", async () => {
    const body = await fs.readFile(
      "data/ecomviper/suppliers/rocktomic/fixtures/firecrawl/roc948-live-cache-markdown.json",
      "utf8"
    );
    const fixture = JSON.parse(body) as { markdown: string; sourceUrl: string };

    const result = parseRocktomicCatalogMarkdown({
      markdown: fixture.markdown,
      sourceUrl: fixture.sourceUrl,
      supplierId: "rocktomic",
      supplierName: "Rocktomic",
      skuFilter: ["ROC000"],
    });

    expect(result.records).toHaveLength(0);
    expect(result.reason).toBe("sku_not_found");
  });

  it("does not hardcode ROC948 and can parse another ROC SKU", () => {
    const markdown =
      "| Name: SKU: Label Size: Container Size: Product Weight: | Test Blend Gummies ROC777 2 x 6 in 2 x 4 in 5 oz |";
    const result = parseRocktomicCatalogMarkdown({
      markdown,
      sourceUrl: "https://example.com/catalog.pdf",
      supplierId: "rocktomic",
      supplierName: "Rocktomic",
      skuFilter: ["ROC777"],
    });

    expect(result.records).toHaveLength(1);
    expect(result.records[0].sku).toBe("ROC777");
  });

  it("merges JSON primary and markdown fallback records by sku", () => {
    const merged = mergeSupplierRecordsBySku({
      primary: [
        {
          supplierId: "rocktomic",
          supplierName: "Rocktomic",
          sku: "ROC101",
          productName: null,
          productType: "supplement",
          brand: "Rocktomic",
          labelSize: null,
          containerSize: null,
          productWeight: null,
          servingSize: "1 Capsule",
          servingsPerContainer: 60,
          nutrientFacts: [],
          activeIngredients: [{
            name: "L-Arginine",
            amount: 10,
            unit: "mg",
            standardization: null,
            rawText: "L-Arginine 10mg",
            provenance: [],
          }],
          otherIngredients: [],
          suggestedUse: null,
          warnings: null,
          dietaryAttributes: [],
          certifications: [],
          manufacturingClaims: [],
          coaUrl: null,
          labelTemplateUrl: null,
          mockupUrl: null,
          imageUrls: [],
          pricing: { wholesaleCost: null, msrp: null, currency: "USD", sourceStatus: "missing", provenance: [] },
          inventory: { status: null, quantityText: null, sourceStatus: "missing", provenance: [] },
          shippingPolicy: { sourceUrl: null, summary: null, provenance: [] },
          returnPolicy: { sourceUrl: null, summary: null, provenance: [] },
          sourceStatus: "partial",
          missingFields: ["productName"],
          confidence: 0.8,
          provenance: [],
        },
      ],
      fallback: [
        {
          supplierId: "rocktomic",
          supplierName: "Rocktomic",
          sku: "ROC101",
          productName: "Test Product",
          productType: "supplement",
          brand: "Rocktomic",
          labelSize: "2 x 6 in",
          containerSize: "2 x 4 in",
          productWeight: "8 oz",
          servingSize: null,
          servingsPerContainer: null,
          nutrientFacts: [],
          activeIngredients: [],
          otherIngredients: [],
          suggestedUse: null,
          warnings: null,
          dietaryAttributes: [],
          certifications: [],
          manufacturingClaims: [],
          coaUrl: null,
          labelTemplateUrl: null,
          mockupUrl: null,
          imageUrls: [],
          pricing: { wholesaleCost: null, msrp: null, currency: "USD", sourceStatus: "missing", provenance: [] },
          inventory: { status: null, quantityText: null, sourceStatus: "missing", provenance: [] },
          shippingPolicy: { sourceUrl: null, summary: null, provenance: [] },
          returnPolicy: { sourceUrl: null, summary: null, provenance: [] },
          sourceStatus: "needs_review",
          missingFields: ["activeIngredients"],
          extractionWarnings: ["supplement_facts_incomplete_markdown"],
          confidence: 0.7,
          provenance: [],
        },
      ],
    });

    expect(merged).toHaveLength(1);
    expect(merged[0].sku).toBe("ROC101");
    expect(merged[0].productName).toBe("Test Product");
    expect(merged[0].servingSize).toBe("1 Capsule");
  });
});

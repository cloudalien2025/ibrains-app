import { describe, expect, it } from "vitest";
import {
  assertRecordProvenance,
  calculateRecordSourceStatus,
  normalizeSku,
  type NormalizedSupplierIntelligenceRecord,
} from "@/lib/ecomviper/suppliers/rocktomic/supplier-intelligence-schema";

function baseRecord(): NormalizedSupplierIntelligenceRecord {
  return {
    supplierId: "rocktomic",
    supplierName: "Rocktomic",
    sku: "ROC001",
    productName: "Sample",
    productType: "supplement",
    brand: "Rocktomic",
    labelSize: null,
    containerSize: null,
    productWeight: null,
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
    sourceStatus: "missing",
    missingFields: ["servingSize", "activeIngredients", "coaUrl"],
    confidence: 0.5,
    provenance: [],
  };
}

describe("supplier intelligence schema", () => {
  it("normalizes SKU values", () => {
    expect(normalizeSku(" roc-948 ")).toBe("ROC948");
  });

  it("requires provenance for generated facts", () => {
    const record = baseRecord();
    const issues = assertRecordProvenance(record);
    expect(issues).toContain("provenance");
  });

  it("detects structured status when ingredient data exists", () => {
    const record = baseRecord();
    record.activeIngredients = [
      {
        name: "Vitamin C",
        amount: 30,
        unit: "mg",
        standardization: null,
        rawText: "Vitamin C 30mg",
        provenance: [
          {
            sourceType: "catalog_pdf",
            sourceUrl: "https://example.com",
            pageNumber: 1,
            extractedAt: "2026-06-01T00:00:00.000Z",
            extractor: "test",
            rawSnippet: "Vitamin C 30mg",
            confidence: 0.99,
          },
        ],
      },
    ];
    record.provenance = record.activeIngredients[0].provenance;
    record.missingFields = [];
    record.servingSize = "2 Gummies";
    record.servingsPerContainer = 30;

    expect(calculateRecordSourceStatus(record)).toBe("structured");
  });

  it("keeps partial status when serving metadata is missing", () => {
    const record = baseRecord();
    record.activeIngredients = [
      {
        name: "Vitamin C",
        amount: 30,
        unit: "mg",
        standardization: null,
        rawText: "Vitamin C 30mg",
        provenance: [
          {
            sourceType: "catalog_pdf",
            sourceUrl: "https://example.com",
            pageNumber: 1,
            extractedAt: "2026-06-01T00:00:00.000Z",
            extractor: "test",
            rawSnippet: "Vitamin C 30mg",
            confidence: 0.99,
          },
        ],
      },
    ];
    record.provenance = record.activeIngredients[0].provenance;
    record.missingFields = [];
    record.servingSize = null;
    record.servingsPerContainer = null;
    expect(calculateRecordSourceStatus(record)).toBe("partial");
  });
});

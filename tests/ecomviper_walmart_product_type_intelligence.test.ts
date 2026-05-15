import { describe, expect, it } from "vitest";
import {
  analyzeWalmartProductTypeFieldCoverage,
  getComplianceFieldsForProductType,
  getDiscoverabilityFieldsForProductType,
  getRequiredFieldsForProductType,
  getSearchableFieldsForProductType,
  getWritableFieldsForProductType,
  resolveWalmartProductTypeIntelligence,
} from "@/lib/ecomviper/walmart/walmart-product-type-intelligence";

describe("Walmart product type intelligence", () => {
  it("resolves supplement product type metadata and helper field groups", () => {
    const intelligence = resolveWalmartProductTypeIntelligence({
      productType: "Supplement",
      supplementType: "Vitamin",
      category: "Supplements",
      taxonomyPlacement: "Health/Nutrition/Supplements",
      title: "Vitamin C Gummies",
    });

    expect(intelligence.supplementSchema).toBe(true);
    expect(intelligence.productTypeGroup).toBe("Health & Wellness");
    expect(intelligence.taxonomyConfidence).toBe("high");
    expect(intelligence.requiredFields).toEqual(
      expect.arrayContaining(["product_name", "serving_size", "servings_per_container"])
    );
    expect(intelligence.searchableFields).toEqual(
      expect.arrayContaining(["product_name", "primary_ingredient", "nutrients"])
    );
    expect(intelligence.complianceFields).toEqual(
      expect.arrayContaining(["warning_text", "country_of_origin"])
    );
    expect(intelligence.writableFields).toEqual(
      expect.arrayContaining(["ingredients_statement", "dimensions", "weight"])
    );
    expect(intelligence.discoverabilityFields).toEqual(
      expect.arrayContaining(["supplement_type", "dietary_need", "product_form"])
    );
  });

  it("falls back to generic field intelligence for non-supplement product types", () => {
    const required = getRequiredFieldsForProductType("Electronics");
    const searchable = getSearchableFieldsForProductType("Electronics");
    const compliance = getComplianceFieldsForProductType("Electronics");
    const writable = getWritableFieldsForProductType("Electronics");
    const discoverability = getDiscoverabilityFieldsForProductType("Electronics");

    expect(required).toEqual(expect.arrayContaining(["product_name", "product_type", "brand"]));
    expect(required).not.toContain("serving_size");
    expect(searchable).toEqual(expect.arrayContaining(["search_keywords", "search_terms"]));
    expect(compliance).toEqual(expect.arrayContaining(["country_of_origin"]));
    expect(writable).toEqual(expect.arrayContaining(["product_line"]));
    expect(discoverability).toEqual(expect.arrayContaining(["product_name", "product_type"]));
  });

  it("computes missing required/searchable/compliance/discoverability and non-writable fields", () => {
    const intelligence = resolveWalmartProductTypeIntelligence({
      productType: "Supplement",
      category: "Supplements",
      title: "Daily Wellness Capsules",
    });

    const coverage = analyzeWalmartProductTypeFieldCoverage({
      intelligence,
      attributes: {
        product_name: "Daily Wellness Capsules",
        product_type: "Supplement",
        brand: "Wellness Labs",
        custom_locked_field: "legacy-value",
      },
    });

    expect(coverage.missingRequiredFields).toEqual(
      expect.arrayContaining(["serving_size", "supplement_type", "ingredients_statement"])
    );
    expect(coverage.missingSearchableFields).toContain("primary_ingredient");
    expect(coverage.missingComplianceFields).toContain("warning_text");
    expect(coverage.missingDiscoverabilityFields).toContain("supplement_type");
    expect(coverage.nonWritableFieldsPresent).toContain("custom_locked_field");
  });
});

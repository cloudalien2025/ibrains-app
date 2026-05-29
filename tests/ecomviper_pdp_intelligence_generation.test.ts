import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateShopifyPdpIntelligence } from "@/lib/ecomviper/shopify/shopify-pdp-intelligence-generator";
import type { ShopifyCurrentListingDocket } from "@/lib/ecomviper/shopify/shopify-product-docket";
import type { RocktomicSupplierProduct } from "@/lib/ecomviper/dropshipping/rocktomic-supplier-intelligence";

function productFixture(): ShopifyCurrentListingDocket {
  return {
    productId: "gid://shopify/Product/123",
    title: "Sleep Formula Gummies",
    handle: "sleep-formula-gummies",
    status: "active",
    vendor: "OPA Nutrition",
    productType: "Supplements",
    tags: ["sleep", "wellness"],
    collections: [],
    descriptionText: "Daily wellness gummies for bedtime routine support.",
    descriptionHtml: "<p>Daily wellness gummies for bedtime routine support.</p>",
    seoTitle: "Sleep Formula Gummies",
    seoDescription: "Daily wellness support",
    productUrl: "https://example.myshopify.com/products/sleep-formula-gummies",
    canonicalUrl: "https://example.myshopify.com/products/sleep-formula-gummies",
    images: [],
    variants: [{ id: "v1", title: "Default", sku: "ROC817", barcode: "", price: 20, compareAtPrice: null, inventoryQuantity: 3 }],
    metafields: [],
    source: "live_shopify",
    sourceLabel: "Live Shopify API",
    hydrationMode: "live",
    lastSyncedAt: "2026-05-29T00:00:00.000Z",
    fetchedAt: "2026-05-29T00:00:00.000Z",
  };
}

function supplierFixture(): RocktomicSupplierProduct {
  return {
    supplier: "Rocktomic",
    sku: "ROC817",
    productName: "Sleep Formula",
    category: "Sleep Support",
    labelSize: null,
    containerSize: "60 gummies",
    productWeight: null,
    coa: { status: "pending_source", url: null },
    labelTemplate: { status: "configured", url: null },
    mockup: { status: "pending_source", url: null },
    certifications: ["GMP Facility"],
    dietaryAttributes: ["Gluten-Free"],
    manufacturingClaims: ["Third-party tested ingredients"],
    supplementFacts: { status: "pending_source", value: null },
    suggestedUse: { status: "pending_source", value: null },
    warnings: { status: "pending_source", value: null },
    inventoryStatus: "unknown",
    discontinuedStatus: "active",
    pricingStatus: "pending_source",
    policyStatus: "available",
    lastSyncedAt: "2026-05-29T00:00:00.000Z",
    sourceVersion: "rocktomic_catalog_seed_2026_05_29",
    sourceUpdatedAt: "2026-05-29T00:00:00.000Z",
  };
}

describe("shopify PDP intelligence generation", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns generation_unavailable when OpenAI key is missing", async () => {
    const result = await generateShopifyPdpIntelligence({
      product: productFixture(),
      supplierMatch: { supplier: "Rocktomic", supplierSku: "ROC817", product: supplierFixture() },
      existing: null,
      openAiApiKey: null,
    });
    expect(result.generation_status).toBe("generation_unavailable");
    expect(result.compliance_notes.join(" ")).toContain("missing server configuration");
  });

  it("passes supplier context to OpenAI and returns structured JSON", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  ai_product_summary: "SKU-matched summary.",
                  best_for: ["Gluten-Free shoppers"],
                  not_best_for: ["Customers expecting disease claims"],
                  use_cases: ["Daily bedtime routine"],
                  ingredient_highlights: ["Third-party tested ingredients"],
                  trust_signals: ["GMP Facility"],
                  certifications: ["GMP Facility"],
                  compliance_safe_claims: ["Supports nightly routine consistency."],
                  comparison_content: "No drug comparisons.",
                  agentic_selection_notes: "Fact-grounded.",
                  faqs: [
                    {
                      question: "What is this?",
                      answer: "A daily wellness product.",
                      category: "overview",
                      schema_eligible: true,
                      compliance_status: "approved",
                    },
                  ],
                  compliance_notes: ["Review before publishing."],
                }),
              },
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );

    const result = await generateShopifyPdpIntelligence({
      product: productFixture(),
      supplierMatch: { supplier: "Rocktomic", supplierSku: "ROC817", product: supplierFixture() },
      existing: null,
      openAiApiKey: "sk-test",
    });

    expect(result.generation_status).toBe("generated");
    expect(result.ai_product_summary).toContain("SKU-matched");
    expect(result.certifications).toContain("GMP Facility");

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    const userContent = JSON.stringify(body);
    expect(userContent).toContain("Supplier SKU: ROC817");
    expect(userContent).toContain("Supplier certifications: GMP Facility");
    expect(result.ai_product_summary.toLowerCase()).not.toContain("cure");
  });
});

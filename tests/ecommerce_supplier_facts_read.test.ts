import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ShopifyProductRecord } from "@/lib/ecomviper/shopify/shopify-types";
import {
  buildRocktomicSupplierIntelligence,
  loadRocktomicSourceManifest,
} from "@/lib/ecomviper/suppliers/rocktomic/firecrawl-supplier-intelligence";
import { toSupplierFactsReadModelProjection } from "@/lib/ecomviper/suppliers/rocktomic/supplier-intelligence-read-model";

const mocks = vi.hoisted(() => ({
  queryEcommerce: vi.fn(),
}));

vi.mock("@/lib/ecommerce/database", () => ({
  queryEcommerce: mocks.queryEcommerce,
}));

function createProduct(overrides: Partial<ShopifyProductRecord> = {}): ShopifyProductRecord {
  return {
    id: "gid://shopify/Product/900",
    storeDomain: "opanutrition.myshopify.com",
    title: "OPA Magnesium Gummies",
    handle: "opa-magnesium-gummies",
    vendor: "OPA Nutrition",
    productType: "Supplements",
    status: "ACTIVE",
    tags: [],
    description: "Supplement product",
    descriptionHtml: "<p>Supplement product</p>",
    seoTitle: "OPA Magnesium Gummies",
    seoDescription: "Supplement product",
    metafields: [],
    onlineStoreUrl: "https://opanutrition.myshopify.com/products/opa-magnesium-gummies",
    primaryImageUrl: "",
    galleryImageUrls: [],
    galleryImages: [],
    createdAt: "2026-05-31T00:00:00.000Z",
    updatedAt: "2026-05-31T00:00:00.000Z",
    variants: [
      {
        id: "gid://shopify/ProductVariant/901",
        productId: "gid://shopify/Product/900",
        title: "Default",
        sku: "ROC011",
        barcode: "",
        price: 29.99,
        compareAtPrice: null,
        inventoryQuantity: 8,
        selectedOptions: [],
        imageUrl: "",
        imageAltText: null,
        imageUrls: [],
      },
    ],
    ...overrides,
  };
}

function createRow(overrides: Record<string, unknown> = {}) {
  return {
    supplier_slug: "rocktomic",
    supplier_name: "Rocktomic",
    sku: "ROC011",
    product_name: "OPA Magnesium Gummies",
    validation_status: "blocked",
    product_readiness: { ingredientMatchingReadiness: "ready_with_warnings" },
    source_facts: {
      productType: "supplement",
      category: "gummies",
      supplementFacts: {
        servingSize: "1 gummy",
        servingsPerContainer: "60",
      },
    },
    facts_supplement_facts: {
      servingSize: "1 gummy",
      servingsPerContainer: "60",
      activeIngredients: ["Magnesium 30mg"],
      amountPerServing: ["Magnesium 30mg"],
      otherIngredients: ["Glucose syrup"],
    },
    facts_directions: "Take one gummy daily",
    facts_warnings: "Keep out of reach of children",
    facts_source_evidence: { supplementFacts: { sourceMethod: "ai_pdf_text", needsReview: true } },
    facts_needs_review: true,
    pricing_payload: {},
    pricing_tiers: {},
    pricing_currency: "USD",
    inventory_status: "in_stock",
    inventory_raw: "42",
    inventory_comments: null,
    assets_coa_url: null,
    assets_label_template_ai_url: "https://example.com/ROC011.ai",
    assets_mockup_template_tif_url: "https://example.com/ROC011.tif",
    assets_readiness: { readyForOptiPixelAssets: true },
    assets_ai_label_text_evidence: { extractionStatus: "success" },
    validation_readiness: {
      ingredientMatchingReadiness: "ready_with_warnings",
      productEditorFactsReadiness: "ready_with_warnings",
      complianceEvidenceReadiness: "blocked",
      optiPixelAssetReadiness: "ready",
      channelImageGenerationReadiness: "ready",
    },
    validation_blocking_defects: [],
    validation_warning_defects: ["missing_coa"],
    validation_result: {},
    validation_needs_review: true,
    ...overrides,
  };
}

describe("supplier facts read model", () => {
  const originalEcom = process.env.ECOMMERCE_DATABASE_URL;
  const originalCore = process.env.DATABASE_URL;

  beforeEach(() => {
    mocks.queryEcommerce.mockReset();
  });

  afterEach(() => {
    if (originalEcom == null) {
      delete process.env.ECOMMERCE_DATABASE_URL;
    } else {
      process.env.ECOMMERCE_DATABASE_URL = originalEcom;
    }

    if (originalCore == null) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = originalCore;
    }
  });

  it("returns unavailable when ECOMMERCE_DATABASE_URL is missing and does not fallback", async () => {
    delete process.env.ECOMMERCE_DATABASE_URL;
    process.env.DATABASE_URL = "postgres://core-only";

    const { readSupplierFactsForShopifyProduct } = await import("@/lib/ecommerce/supplier-facts-read");
    const result = await readSupplierFactsForShopifyProduct({ product: createProduct() });

    expect(result.status).toBe("unavailable");
    expect(result.message).toContain("ECOMMERCE_DATABASE_URL");
    expect(mocks.queryEcommerce).not.toHaveBeenCalled();
  });

  it("maps missing COA as compliance warning without blocking ingredient matching", async () => {
    process.env.ECOMMERCE_DATABASE_URL = "postgres://ecommerce";

    mocks.queryEcommerce.mockResolvedValueOnce([createRow()]).mockResolvedValueOnce([]);

    const { readSupplierFactsForShopifyProduct } = await import("@/lib/ecommerce/supplier-facts-read");
    const result = await readSupplierFactsForShopifyProduct({ product: createProduct() });

    expect(result.status).toBe("matched");
    expect(result.readiness.ingredientMatching).toBe("ready_with_warnings");
    expect(result.readiness.complianceEvidence).toBe("blocked");
    expect(result.ingredientAmounts).toContain("Magnesium 30mg");
    expect(result.evidence.missingCoaWarning).toBe(true);
  });

  it("maps missing pricing separately from ingredient readiness", async () => {
    process.env.ECOMMERCE_DATABASE_URL = "postgres://ecommerce";

    mocks.queryEcommerce.mockResolvedValueOnce([createRow({ pricing_payload: {} })]).mockResolvedValueOnce([]);

    const { readSupplierFactsForShopifyProduct } = await import("@/lib/ecommerce/supplier-facts-read");
    const result = await readSupplierFactsForShopifyProduct({ product: createProduct() });

    expect(result.status).toBe("matched");
    expect(result.readiness.ingredientMatching).toBe("ready_with_warnings");
    expect(result.readiness.pricing).toBe("ready_with_warnings");
  });

  it("maps snake_case supplement facts fields without degrading ingredient amounts", async () => {
    process.env.ECOMMERCE_DATABASE_URL = "postgres://ecommerce";
    mocks.queryEcommerce.mockResolvedValueOnce([
      createRow({
        facts_supplement_facts: {
          active_ingredients: ["L-Carnitine"],
          amount_per_serving: ["L-Carnitine 500mg"],
        },
        source_facts: {
          supplementFacts: {
            active_ingredients: ["Green Tea Extract"],
            amount_per_serving: ["Green Tea Extract 300mg"],
          },
        },
      }),
    ]).mockResolvedValueOnce([]);

    const { readSupplierFactsForShopifyProduct } = await import("@/lib/ecommerce/supplier-facts-read");
    const result = await readSupplierFactsForShopifyProduct({ product: createProduct() });

    expect(result.matchStatus).toBe("matched");
    expect(result.activeIngredients.length).toBeGreaterThan(0);
    expect(result.ingredientAmounts.length).toBeGreaterThan(0);
  });

  it("returns unavailable state when DB query fails", async () => {
    process.env.ECOMMERCE_DATABASE_URL = "postgres://ecommerce";
    mocks.queryEcommerce.mockRejectedValueOnce(new Error("db down"));

    const { readSupplierFactsForShopifyProduct } = await import("@/lib/ecommerce/supplier-facts-read");
    const result = await readSupplierFactsForShopifyProduct({ product: createProduct() });

    expect(result.status).toBe("unavailable");
    expect(result.message).toContain("unavailable");
  });

  it("maps normalized fixture package to read-model compatibility shape", async () => {
    const manifest = await loadRocktomicSourceManifest("data/ecomviper/suppliers/rocktomic/sources.json");
    const built = await buildRocktomicSupplierIntelligence({
      manifest,
      skuFilter: ["ROC948"],
      useFixtures: true,
      useFirecrawl: false,
      useCache: true,
    });

    const projection = toSupplierFactsReadModelProjection(built.package.records[0]);
    expect(projection.supplementFacts.activeIngredients.length).toBeGreaterThan(0);
    expect(projection.supplementFacts.active_ingredients.length).toBeGreaterThan(0);
    expect(projection.supplementFacts.amountPerServing.length).toBeGreaterThan(0);
    expect(projection.supplementFacts.amount_per_serving.length).toBeGreaterThan(0);
    expect(projection.sourceFactsUsed.every((entry) => entry.status !== "missing")).toBe(true);
    expect(projection.sourceFactsUsed.map((entry) => entry.status).includes("image_text_only")).toBe(false);
  });
});

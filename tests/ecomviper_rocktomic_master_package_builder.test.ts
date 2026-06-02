import { describe, it, expect, vi } from "vitest";
import { buildRocktomicMasterPackage } from "@/lib/ecomviper/suppliers/rocktomic/master-package-builder";
import type { SourceBundle } from "@/lib/ecomviper/suppliers/rocktomic/master-package-builder";

const CATALOG_PDF_URL = "https://rocktomicplatform.blob.core.windows.net/client-resources/Supplement-%26-Apparel-Catalog.pdf?t=1780083599627";
const TEMPLATES_URL = "https://rocktomicplatform.blob.core.windows.net/client-resources/templates.html?t=1780083599627";
const POLICY_URL = "https://rocktomicplatform.blob.core.windows.net/client-resources/Order-Refund-Policy-Template.docx?t=1780083599627";
const MSRP_SHEET_URL = "https://docs.google.com/spreadsheets/d/15lZ6M5SqNby_uOIzZEhBYEn6rtLZYQmVUVF4yWzKIbU/edit?usp=sharing";
const PLDS_SHEET_URL = "https://docs.google.com/spreadsheets/d/15lZ6M5SqNby_uOIzZEhBYEn6rtLZYQmVUVF4yWzKIbU/edit?usp=sharing";
const INVENTORY_SHEET_URL = "https://docs.google.com/spreadsheets/d/1oOjqXsaCAjSOkA1lXrasNtUVtrsxvyxcFcolD8n6YXY/edit?usp=sharing";

function makeSourceBundle(overrides: Partial<SourceBundle> = {}): SourceBundle {
  return {
    sourceBundleId: "test-bundle-v1",
    sourceDir: "/test",
    manifest: {
      bundleId: "test-bundle-v1",
      sourceManifestVersion: 3,
      sources: [
        { id: "catalog_pdf", name: "Supplement & Apparel Catalog", url: CATALOG_PDF_URL, type: "pdf" },
        { id: "label_mockup_templates", name: "Label & 3D Mockup Templates", url: TEMPLATES_URL, type: "html" },
        { id: "order_refund_policy", name: "Order Refund Policy Template", url: POLICY_URL, type: "docx" },
        { id: "msrp_profit_margins_report", name: "Full MSRP Report", url: MSRP_SHEET_URL, type: "google_sheet" },
        { id: "plds_catalog", name: "PLDS Catalog", url: PLDS_SHEET_URL, type: "google_sheet" },
        { id: "inventory_report", name: "Inventory Report", url: INVENTORY_SHEET_URL, type: "google_sheet" },
      ],
    },
    existingSourceFacts: [
      {
        sku: "ROC010",
        productName: "Pump Non-Stim Pre-Workout",
        category: "Supplement",
        supplementFacts: {
          servingSize: "1 scoop (10g)",
          servingsPerContainer: 30,
          nutrientFacts: [{ name: "Sodium", amount: 50, unit: "mg", dailyValue: null, rawText: "Sodium 50mg" }],
          activeIngredients: [{ name: "L-Citrulline", amount: 4000, unit: "mg", rawText: "L-Citrulline 4000mg" }],
          otherIngredients: [],
        },
      },
    ],
    existingPricing: [
      {
        sku: "ROC010",
        productName: "Pump Non-Stim Pre-Workout",
        wholesaleCost: 23.97,
        msrp: 29.99,
        estimatedProfit: 6.02,
        membershipTierCosts: {
          "Non Member Pricing\n(T1)": 23.97,
          "Standard & VIP\nLifetime Memberships (T4)": 21.97,
        },
      },
    ],
    existingInventory: [
      { sku: "ROC010", rawInventoryValue: "500", inventoryStatus: "in_stock" },
    ],
    existingAssets: [
      {
        sku: "ROC010",
        coaUrl: "https://dropbox.com/roc010-coa.pdf",
        labelTemplateAiUrl: "https://rocktomicplatform.blob.core.windows.net/roc010/ROC010.ai",
        mockupTemplateTifUrl: "https://rocktomicplatform.blob.core.windows.net/roc010/ROC010.tif",
      },
    ],
    ...overrides,
  };
}

describe("buildRocktomicMasterPackage", () => {
  it("produces a master package with correct product count", async () => {
    const bundle = makeSourceBundle();
    const pkg = await buildRocktomicMasterPackage({ sourceBundle: bundle });
    expect(pkg.productCount).toBe(1);
    expect(pkg.products).toHaveLength(1);
  });

  it("merges existing source facts into the canonical product record", async () => {
    const pkg = await buildRocktomicMasterPackage({ sourceBundle: makeSourceBundle() });
    const product = pkg.products.find((p) => p.sku === "ROC010");
    expect(product?.productName).toBe("Pump Non-Stim Pre-Workout");
    expect(product?.category).toBe("Supplement");
  });

  it("populates pricing from existing pricing records", async () => {
    const pkg = await buildRocktomicMasterPackage({ sourceBundle: makeSourceBundle() });
    const product = pkg.products.find((p) => p.sku === "ROC010");
    expect(product?.pricing.msrp).toBe(29.99);
    expect(product?.pricing.wholesaleCost).toBe(23.97);
    expect(product?.pricing.tiers.t1).toBe(23.97);
    expect(product?.pricing.tiers.t4).toBe(21.97);
  });

  it("normalizes tier costs from embedded-newline tier column names", async () => {
    const pkg = await buildRocktomicMasterPackage({ sourceBundle: makeSourceBundle() });
    const product = pkg.products.find((p) => p.sku === "ROC010");
    expect(product?.pricing.tiers).toMatchObject({ t1: 23.97, t4: 21.97 });
  });

  it("populates inventory status from existing inventory records", async () => {
    const pkg = await buildRocktomicMasterPackage({ sourceBundle: makeSourceBundle() });
    const product = pkg.products.find((p) => p.sku === "ROC010");
    expect(product?.inventory.status).toBe("in_stock");
  });

  it("populates COA URL and template URLs from existing assets", async () => {
    const pkg = await buildRocktomicMasterPackage({ sourceBundle: makeSourceBundle() });
    const product = pkg.products.find((p) => p.sku === "ROC010");
    expect(product?.coaUrl).toBe("https://dropbox.com/roc010-coa.pdf");
    expect(product?.labelTemplateUrl).toBeTruthy();
    expect(product?.mockupUrl).toBeTruthy();
  });

  it("includes field-level provenance for merged fields", async () => {
    const pkg = await buildRocktomicMasterPackage({ sourceBundle: makeSourceBundle() });
    const product = pkg.products.find((p) => p.sku === "ROC010");
    expect(product?.provenance).toBeDefined();
    expect(Object.keys(product?.provenance ?? {})).toContain("coaUrl");
    expect(product?.provenance.coaUrl?.source).toMatch(/existing_assets/);
  });

  it("does not default membershipAccess when source does not confirm it", async () => {
    const pkg = await buildRocktomicMasterPackage({ sourceBundle: makeSourceBundle() });
    const product = pkg.products.find((p) => p.sku === "ROC010");
    expect(product?.membershipAccess).toBe("unknown");
  });

  it("classifies supplement facts status as structured when structured data is present", async () => {
    const pkg = await buildRocktomicMasterPackage({ sourceBundle: makeSourceBundle() });
    const product = pkg.products.find((p) => p.sku === "ROC010");
    expect(product?.supplementFacts.status).toBe("structured");
    expect(product?.supplementFacts.servingSize).toBe("1 scoop (10g)");
    expect(product?.supplementFacts.servingsPerContainer).toBe(30);
    expect(product?.supplementFacts.nutrientFacts).toHaveLength(1);
    expect(product?.supplementFacts.activeIngredients).toHaveLength(1);
  });

  it("classifies supplement facts status as missing when no facts data exists", async () => {
    const bundle = makeSourceBundle({
      existingSourceFacts: [{ sku: "ROC020", productName: "Test Product", supplementFacts: null }],
      existingPricing: [],
      existingInventory: [],
      existingAssets: [],
    });
    const pkg = await buildRocktomicMasterPackage({ sourceBundle: bundle });
    const product = pkg.products.find((p) => p.sku === "ROC020");
    expect(product?.supplementFacts.status).toBe("missing");
  });

  it("marks apparel SKUs as not_applicable for supplement facts", async () => {
    const bundle = makeSourceBundle({
      existingSourceFacts: [{ sku: "ROC030", productName: "Black Tee", category: "Apparel", supplementFacts: null }],
      existingPricing: [],
      existingInventory: [],
      existingAssets: [],
    });
    const pkg = await buildRocktomicMasterPackage({ sourceBundle: bundle });
    const product = pkg.products.find((p) => p.sku === "ROC030");
    expect(product?.supplementFacts.status).toBe("not_applicable");
  });

  it("populates missingData flags correctly", async () => {
    const bundle = makeSourceBundle({
      existingSourceFacts: [{ sku: "ROC020", productName: null, supplementFacts: null }],
      existingPricing: [],
      existingInventory: [],
      existingAssets: [],
    });
    const pkg = await buildRocktomicMasterPackage({ sourceBundle: bundle });
    const product = pkg.products.find((p) => p.sku === "ROC020");
    expect(product?.missingData.productName).toBe(true);
    expect(product?.missingData.pricing).toBe(true);
    expect(product?.missingData.inventory).toBe(true);
    expect(product?.missingData.coaUrl).toBe(true);
    expect(product?.missingData.supplementFacts).toBe(true);
  });

  it("produces sourceIdentityReport showing duplicate sheet ID warning", async () => {
    const bundle = makeSourceBundle();
    const pkg = await buildRocktomicMasterPackage({ sourceBundle: bundle });
    expect(pkg.sourceIdentityReport.duplicateSheetIdCount).toBeGreaterThan(0);
    expect(pkg.sourceIdentityReport.overallValid).toBe(false);
  });

  it("does not require live internet, Firecrawl, or OpenAI", async () => {
    const bundle = makeSourceBundle();
    await expect(buildRocktomicMasterPackage({ sourceBundle: bundle })).resolves.toBeTruthy();
  });

  it("merges SKUs from all source buckets (union)", async () => {
    const bundle = makeSourceBundle({
      existingSourceFacts: [{ sku: "ROC010", productName: "Product A", supplementFacts: null }],
      existingPricing: [{ sku: "ROC020", productName: "Product B", wholesaleCost: 19.99, msrp: null, estimatedProfit: null }],
      existingInventory: [{ sku: "ROC030", inventoryStatus: "in_stock", rawInventoryValue: "100" }],
      existingAssets: [],
    });
    const pkg = await buildRocktomicMasterPackage({ sourceBundle: bundle });
    const skus = pkg.products.map((p) => p.sku).sort();
    expect(skus).toContain("ROC010");
    expect(skus).toContain("ROC020");
    expect(skus).toContain("ROC030");
  });

  it("counts products by supplement facts status correctly", async () => {
    const bundle = makeSourceBundle();
    const pkg = await buildRocktomicMasterPackage({ sourceBundle: bundle });
    expect(pkg.countsBySupplementFactsStatus).toBeDefined();
    expect(Object.keys(pkg.countsBySupplementFactsStatus).length).toBeGreaterThan(0);
  });

  it("counts products by inventory status correctly", async () => {
    const bundle = makeSourceBundle();
    const pkg = await buildRocktomicMasterPackage({ sourceBundle: bundle });
    expect(pkg.countsByInventoryStatus).toBeDefined();
  });
});

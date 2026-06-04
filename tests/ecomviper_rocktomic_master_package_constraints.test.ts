import { describe, it, expect } from "vitest";
import { buildRocktomicMasterPackage } from "@/lib/ecomviper/suppliers/rocktomic/master-package-builder";
import type { SourceBundle } from "@/lib/ecomviper/suppliers/rocktomic/master-package-builder";

function makeMinimalBundle(): SourceBundle {
  return {
    sourceBundleId: "constraint-test-bundle",
    sourceDir: "/test",
    manifest: {
      bundleId: "constraint-test-bundle",
      sources: [
        { id: "catalog_pdf", name: "Catalog PDF", url: "https://rocktomicplatform.blob.core.windows.net/client-resources/Supplement-%26-Apparel-Catalog.pdf?t=1780083599627", type: "pdf" },
        { id: "inventory_report", name: "Inventory", url: "https://docs.google.com/spreadsheets/d/1oOjqXsaCAjSOkA1lXrasNtUVtrsxvyxcFcolD8n6YXY/edit?usp=sharing", type: "google_sheet" },
      ],
    },
    existingSourceFacts: [{ sku: "ROC010", productName: "Test Product", supplementFacts: null }],
    existingPricing: null,
    existingInventory: null,
    existingAssets: null,
  };
}

describe("master package builder - constraint checks", () => {
  it("runs without live internet access (source bundle mode)", async () => {
    const bundle = makeMinimalBundle();
    const start = Date.now();
    const pkg = await buildRocktomicMasterPackage({ sourceBundle: bundle });
    const elapsed = Date.now() - start;
    expect(pkg).toBeDefined();
    // Should complete very quickly without network calls
    expect(elapsed).toBeLessThan(5000);
  });

  it("does not require live OpenAI or Firecrawl (no API calls in default path)", async () => {
    process.env.ECOMVIPER_SUPPLIER_FIRECRAWL_ENABLED = "0";
    process.env.ECOMVIPER_SUPPLIER_OPENAI_VISION_ENABLED = "0";
    const bundle = makeMinimalBundle();
    const pkg = await buildRocktomicMasterPackage({ sourceBundle: bundle });
    expect(pkg).toBeDefined();
    delete process.env.ECOMVIPER_SUPPLIER_FIRECRAWL_ENABLED;
    delete process.env.ECOMVIPER_SUPPLIER_OPENAI_VISION_ENABLED;
  });

  it("produces a package with productCount matching products array length", async () => {
    const bundle = makeMinimalBundle();
    const pkg = await buildRocktomicMasterPackage({ sourceBundle: bundle });
    expect(pkg.productCount).toBe(pkg.products.length);
  });

  it("never fabricates supplement facts for SKUs with no evidence", async () => {
    const bundle = makeMinimalBundle();
    const pkg = await buildRocktomicMasterPackage({ sourceBundle: bundle });
    for (const product of pkg.products) {
      if (product.supplementFacts.status === "structured") {
        expect(product.supplementFacts.servingSize).not.toBeNull();
        expect(product.supplementFacts.nutrientFacts.length + product.supplementFacts.activeIngredients.length).toBeGreaterThan(0);
      }
      if (product.supplementFacts.status === "missing") {
        expect(product.supplementFacts.servingSize).toBeNull();
        expect(product.supplementFacts.nutrientFacts).toHaveLength(0);
        expect(product.supplementFacts.activeIngredients).toHaveLength(0);
      }
    }
  });

  it("always includes provenance for fields with known sources", async () => {
    const bundle: SourceBundle = {
      ...makeMinimalBundle(),
      existingAssets: [{ sku: "ROC010", coaUrl: "https://dropbox.com/roc010-coa.pdf" }],
    };
    const pkg = await buildRocktomicMasterPackage({ sourceBundle: bundle });
    const product = pkg.products.find((p) => p.sku === "ROC010");
    expect(product?.coaUrl).toBeTruthy();
    expect(product?.provenance.coaUrl).toBeDefined();
    expect(product?.provenance.coaUrl?.source).toBeTruthy();
  });
});

describe("duplicate Shopify product route remains absent", () => {
  it("does not restore the duplicate /ecomviper/shopify/products route", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const duplicateRoutePath = path.join(process.cwd(), "app/ecomviper/shopify/products");
    let exists = false;
    try {
      await fs.access(duplicateRoutePath);
      exists = true;
    } catch {
      exists = false;
    }
    expect(exists).toBe(false);
  });
});

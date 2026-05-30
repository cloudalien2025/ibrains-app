import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearRocktomicSourceIngestionCache,
  getRocktomicSourceIngestionSnapshot,
} from "@/lib/ecomviper/dropshipping/rocktomic-source-ingestion";

const CATALOG_CSV = `"Category","Product Name","SKU","Label Size","Container Size","Product Weight","Cost Per Unit","MSRP","Estimated Profit"
"Premium Gummies","Premium Nitric Oxide Gummies","ROC948","2.25","60 gummies","8 oz","12.00","34.99","22.99"
"Nootropics","Anxiety Formula","ROC801","2.00","60 gummies","7 oz","9.00","29.99","20.99"
"Premium Gummies","Premium Magnesium Glycinate Gummies","ROC949","2.25","60 gummies","8 oz","12.47","39.99","27.52"`;

const INVENTORY_CSV = `"Product Name","SKU","Inventory Status"
"Premium Nitric Oxide Gummies","ROC948","IN STOCK - This means that you may sell this item"
"Anxiety Formula","ROC801","LOW STOCK - This means that you need to immediately mark this product as OUT OF STOCK in your online store"
"Premium Magnesium Glycinate Gummies","ROC949","IN STOCK - This means that you may sell this item"`;

const PDF_WITH_ROC949_COA = `%PDF-1.4
1 0 obj
<</Type/Annot/Subtype/Link/A<</S/URI/URI(https://www.dropbox.com/scl/fi/936qb0b59cx0l6w0aagtu/ROC949-Date-Reported-Mar-14-2024.pdf?dl=0)>>>>
endobj
2 0 obj
<</Type/Annot/Subtype/Link/A<</S/URI/URI(https://rocktomicplatform.blob.core.windows.net/client-resources/templates.html)>>>>
endobj
(ROC949 Premium Magnesium Glycinate Gummies)
(Supplement Facts: Serving Size: 1 gummy; Servings Per Container: 60; Active Ingredients: Magnesium \\(as Magnesium Glycinate\\); Amount Per Serving: 30mg; Other Ingredients: Glucose syrup)
(Serving Size: 1 gummy)
(Servings Per Container: 60)
(Active Ingredients: Magnesium \\(as Magnesium Glycinate\\))
(Amount Per Serving: 30mg)
(Other Ingredients: Glucose syrup, sugar)
(Ingredient Highlights: Magnesium glycinate)
(Key Product Features: Premium magnesium glycinate gummies)
(Dietary Attributes: Vegan, Non-GMO)
(Manufacturing Claims: Made in USA)
%%EOF`;

const PDF_WITHOUT_ROC949_LINK = `%PDF-1.4
1 0 obj
<</Type/Annot/Subtype/Link/A<</S/URI/URI(https://rocktomicplatform.blob.core.windows.net/client-resources/templates.html)>>>>
endobj
(ROC949 Premium Magnesium Glycinate Gummies)
(Supplement Facts: Serving Size: 1 gummy; Servings Per Container: 60; Active Ingredients: Magnesium \\(as Magnesium Glycinate\\); Amount Per Serving: 30mg; Other Ingredients: Glucose syrup)
(Serving Size: 1 gummy)
(Servings Per Container: 60)
(Active Ingredients: Magnesium \\(as Magnesium Glycinate\\))
(Amount Per Serving: 30mg)
(Other Ingredients: Glucose syrup, sugar)
%%EOF`;

afterEach(() => {
  clearRocktomicSourceIngestionCache();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("rocktomic source ingestion", () => {
  it("reports configured/fetchable/parsed source diagnostics and parsed SKU records", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);

        if (init?.method === "HEAD") {
          return new Response(null, { status: 200 });
        }

        if (url.includes("1oOjqXsaCAjSOkA1lXrasNtUVtrsxvyxcFcolD8n6YXY")) {
          return new Response(INVENTORY_CSV, { status: 200 });
        }

        if (url.includes("15lZ6M5SqNby_uOIzZEhBYEn6rtLZYQmVUVF4yWzKIbU")) {
          return new Response(CATALOG_CSV, { status: 200 });
        }

        if (url.includes("Supplement-&-Apparel-Catalog.pdf")) {
          return new Response(PDF_WITH_ROC949_COA, { status: 200 });
        }

        return new Response("", { status: 404 });
      })
    );

    const snapshot = await getRocktomicSourceIngestionSnapshot({ forceRefresh: true });

    expect(snapshot.productCount).toBeGreaterThanOrEqual(2);
    expect(snapshot.catalogSkuCount).toBeGreaterThanOrEqual(2);
    expect(snapshot.inventorySkuCount).toBeGreaterThanOrEqual(2);
    expect(snapshot.inventoryAvailable).toBe(true);

    const inventorySource = snapshot.sourceDiagnostics.find((source) => source.id === "inventory_report");
    expect(inventorySource?.configured).toBe(true);
    expect(inventorySource?.fetchable).toBe(true);
    expect(inventorySource?.parsed).toBe(true);
    expect(inventorySource?.recordCount).toBeGreaterThanOrEqual(2);

    const roc948 = snapshot.products.find((product) => product.sku === "ROC948");
    expect(roc948?.inventoryStatus).toBe("in_stock");

    const roc949 = snapshot.products.find((product) => product.sku === "ROC949");
    expect(roc949).toBeTruthy();
    expect(roc949?.containerSize).toBe("60 gummies");
    expect(roc949?.productWeight).toBe("8 oz");
    expect(roc949?.supplementFacts.value).toContain("Serving Size: 1 gummy");
    expect(roc949?.servingSize).toBe("1 gummy");
    expect(roc949?.servingsPerContainer).toBe("60");
    expect(roc949?.activeIngredients).toContain("Magnesium (as Magnesium Glycinate)");
    expect(roc949?.amountPerServing).toContain("30mg");
    expect(roc949?.otherIngredients).toContain("Glucose syrup");
    expect(roc949?.productFeatures?.length).toBeGreaterThan(0);
    expect(roc949?.coa.url).toContain("ROC949-Date-Reported-Mar-14-2024.pdf");
    expect(roc949?.mockup.url).toContain("templates.html");
    expect(roc949?.coaLinkStatus).toBe("extracted");
  });

  it("surfaces inaccessible-source diagnostic without silent fallback labeling", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);

        if (init?.method === "HEAD") {
          return new Response(null, { status: 200 });
        }

        if (url.includes("1oOjqXsaCAjSOkA1lXrasNtUVtrsxvyxcFcolD8n6YXY")) {
          return new Response("", { status: 403 });
        }

        if (url.includes("15lZ6M5SqNby_uOIzZEhBYEn6rtLZYQmVUVF4yWzKIbU")) {
          return new Response(CATALOG_CSV, { status: 200 });
        }

        if (url.includes("Supplement-&-Apparel-Catalog.pdf")) {
          return new Response(PDF_WITH_ROC949_COA, { status: 200 });
        }

        return new Response("", { status: 200 });
      })
    );

    const snapshot = await getRocktomicSourceIngestionSnapshot({ forceRefresh: true });

    const inventorySource = snapshot.sourceDiagnostics.find((source) => source.id === "inventory_report");
    expect(inventorySource?.fetchable).toBe(false);
    expect(inventorySource?.parsed).toBe(false);
    expect(inventorySource?.lastError).toContain("HTTP 403");
    expect(snapshot.inventoryAvailable).toBe(false);
  });

  it("reports deterministic COA extraction diagnostics when SKU hyperlink is missing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);

        if (init?.method === "HEAD") {
          return new Response(null, { status: 200 });
        }

        if (url.includes("1oOjqXsaCAjSOkA1lXrasNtUVtrsxvyxcFcolD8n6YXY")) {
          return new Response(INVENTORY_CSV, { status: 200 });
        }

        if (url.includes("15lZ6M5SqNby_uOIzZEhBYEn6rtLZYQmVUVF4yWzKIbU")) {
          return new Response(CATALOG_CSV, { status: 200 });
        }

        if (url.includes("Supplement-&-Apparel-Catalog.pdf")) {
          return new Response(PDF_WITHOUT_ROC949_LINK, { status: 200 });
        }

        return new Response("", { status: 200 });
      })
    );

    const snapshot = await getRocktomicSourceIngestionSnapshot({ forceRefresh: true });
    const roc949 = snapshot.products.find((product) => product.sku === "ROC949");

    expect(roc949?.coaLinkStatus).toBe("extraction_failed");
    expect(roc949?.coaLinkError).toContain("PDF hyperlink not found for matched SKU row");
    expect(roc949?.sourceDiagnostics).toContain("coa_link_status: extraction_failed");
  });

  it("deduplicates concurrent refreshes for the same cache key", async () => {
    let catalogCsvFetchCount = 0;

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);

        if (init?.method === "HEAD") {
          return new Response(null, { status: 200 });
        }

        if (url.includes("1oOjqXsaCAjSOkA1lXrasNtUVtrsxvyxcFcolD8n6YXY")) {
          return new Response(INVENTORY_CSV, { status: 200 });
        }

        if (url.includes("15lZ6M5SqNby_uOIzZEhBYEn6rtLZYQmVUVF4yWzKIbU")) {
          catalogCsvFetchCount += 1;
          await new Promise((resolve) => setTimeout(resolve, 20));
          return new Response(CATALOG_CSV, { status: 200 });
        }

        if (url.includes("Supplement-&-Apparel-Catalog.pdf")) {
          return new Response(PDF_WITH_ROC949_COA, { status: 200 });
        }

        return new Response("", { status: 200 });
      })
    );

    const [first, second] = await Promise.all([
      getRocktomicSourceIngestionSnapshot({ forceRefresh: true }),
      getRocktomicSourceIngestionSnapshot({ forceRefresh: true }),
    ]);

    expect(first.productCount).toBeGreaterThan(0);
    expect(second.productCount).toBeGreaterThan(0);
    expect(catalogCsvFetchCount).toBe(2);
  });
});

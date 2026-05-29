import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearRocktomicSourceIngestionCache,
  getRocktomicSourceIngestionSnapshot,
} from "@/lib/ecomviper/dropshipping/rocktomic-source-ingestion";

const CATALOG_CSV = `"Category","Product Name","SKU"
"Premium Gummies","Premium Nitric Oxide Gummies","ROC948"
"Nootropics","Anxiety Formula","ROC801"`;

const INVENTORY_CSV = `"Product Name","SKU","Inventory Status"
"Premium Nitric Oxide Gummies","ROC948","IN STOCK - This means that you may sell this item"
"Anxiety Formula","ROC801","LOW STOCK - This means that you need to immediately mark this product as OUT OF STOCK in your online store"`;

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
});

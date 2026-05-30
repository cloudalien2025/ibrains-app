import { afterEach, describe, expect, it, vi } from "vitest";

const CATALOG_CSV = `"Category","Product Name","SKU","Label Size","Container Size","Product Weight","Cost Per Unit","MSRP","Estimated Profit"
"Premium Gummies","Premium Nitric Oxide Gummies","ROC948","2.25","60 gummies","8 oz","12.00","34.99","22.99"
"Premium Gummies","Premium Magnesium Glycinate Gummies","ROC949","2.25","60 gummies","8 oz","12.47","39.99","27.52"`;

const INVENTORY_CSV = `"Product Name","SKU","Inventory Status"
"Premium Nitric Oxide Gummies","ROC948","IN STOCK - This means that you may sell this item"
"Premium Magnesium Glycinate Gummies","ROC949","IN STOCK - This means that you may sell this item"`;

const PDF_WITH_ROC949_COA = `%PDF-1.4
1 0 obj
<</Type/Annot/Subtype/Link/A<</S/URI/URI(https://www.dropbox.com/scl/fi/936qb0b59cx0l6w0aagtu/ROC949-Date-Reported-Mar-14-2024.pdf?dl=0)>>>>
endobj
2 0 obj
<</Type/Annot/Subtype/Link/A<</S/URI/URI(https://rocktomicplatform.blob.core.windows.net/client-resources/templates.html)>>>>
endobj
(ROC949 Premium Magnesium Glycinate Gummies)
(Supplement Facts: Serving Size: 1 gummy; Servings Per Container: 60)
%%EOF`;

const LARGE_BINARY_SIZE = 9 * 1024 * 1024;

function buildLargePdfBuffer(sizeBytes: number): Buffer {
  const base = Buffer.from(PDF_WITH_ROC949_COA, "utf8");
  if (base.byteLength >= sizeBytes) return base;
  return Buffer.concat([base, Buffer.alloc(sizeBytes - base.byteLength, 0x20)]);
}

afterEach(() => {
  delete process.env.ECOMVIPER_ROCKTOMIC_SUPPLEMENT_CATALOG_URL;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("rocktomic source ingestion payload caps", () => {
  it("accepts trusted catalog PDF payloads above default 8MB during sync", async () => {
    process.env.ECOMVIPER_ROCKTOMIC_SUPPLEMENT_CATALOG_URL =
      "https://rocktomicplatform.blob.core.windows.net/client-resources/Supplement-&-Apparel-Catalog.pdf?t=1780083599627";
    const { clearRocktomicSourceIngestionCache, getRocktomicSourceIngestionSnapshot } = await import(
      "@/lib/ecomviper/dropshipping/rocktomic-source-ingestion"
    );

    const largePdf = buildLargePdfBuffer(LARGE_BINARY_SIZE);
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (init?.method === "HEAD") return new Response(null, { status: 200 });
        if (url.includes("1oOjqXsaCAjSOkA1lXrasNtUVtrsxvyxcFcolD8n6YXY")) {
          return new Response(INVENTORY_CSV, { status: 200 });
        }
        if (url.includes("15lZ6M5SqNby_uOIzZEhBYEn6rtLZYQmVUVF4yWzKIbU")) {
          return new Response(CATALOG_CSV, { status: 200 });
        }
        if (url.includes("Supplement-&-Apparel-Catalog.pdf")) {
          return new Response(largePdf, {
            status: 200,
            headers: { "content-length": String(largePdf.byteLength) },
          });
        }
        return new Response("", { status: 200 });
      })
    );

    const snapshot = await getRocktomicSourceIngestionSnapshot({ forceRefresh: true });
    const catalogPdf = snapshot.sourceDiagnostics.find((source) => source.id === "catalog_pdf");

    expect(catalogPdf?.fetchable).toBe(true);
    expect(catalogPdf?.lastError ?? "").not.toContain("Payload too large");
    clearRocktomicSourceIngestionCache();
  });

  it("keeps default 8MB cap for non-trusted catalog PDF source URLs", async () => {
    process.env.ECOMVIPER_ROCKTOMIC_SUPPLEMENT_CATALOG_URL = "https://example.com/large-catalog.pdf";
    const { clearRocktomicSourceIngestionCache, getRocktomicSourceIngestionSnapshot } = await import(
      "@/lib/ecomviper/dropshipping/rocktomic-source-ingestion"
    );

    const largePdf = buildLargePdfBuffer(LARGE_BINARY_SIZE);
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (init?.method === "HEAD") return new Response(null, { status: 200 });
        if (url.includes("1oOjqXsaCAjSOkA1lXrasNtUVtrsxvyxcFcolD8n6YXY")) {
          return new Response(INVENTORY_CSV, { status: 200 });
        }
        if (url.includes("15lZ6M5SqNby_uOIzZEhBYEn6rtLZYQmVUVF4yWzKIbU")) {
          return new Response(CATALOG_CSV, { status: 200 });
        }
        if (url.includes("example.com/large-catalog.pdf")) {
          return new Response(largePdf, {
            status: 200,
            headers: { "content-length": String(largePdf.byteLength) },
          });
        }
        return new Response("", { status: 200 });
      })
    );

    const snapshot = await getRocktomicSourceIngestionSnapshot({ forceRefresh: true });
    const catalogPdf = snapshot.sourceDiagnostics.find((source) => source.id === "catalog_pdf");

    expect(catalogPdf?.parsed).toBe(false);
    expect(catalogPdf?.lastError).toContain("Payload too large");
    expect(catalogPdf?.lastError).toContain("8388608");
    clearRocktomicSourceIngestionCache();
  });
});

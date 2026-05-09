import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  enrichProductsFromItemReport,
  enrichProductsFromParsedItemReport,
  parseItemReportCsv,
  runItemReportWorkflow,
  walmartItemReportInternals,
} from "@/lib/ecomviper/walmart/walmart-item-report";
import type { WalmartProductRecord } from "@/lib/ecomviper/walmart/walmart-types";

function createProduct(overrides?: Partial<WalmartProductRecord>): WalmartProductRecord {
  return {
    id: "walmart_30066-841",
    marketplace: "walmart",
    sku: "30066-841",
    externalItemId: "wm_30066-841",
    upc: "111222333444",
    gtin: "000111222333",
    wpid: "WP-30066",
    itemId: "ITEM-30066",
    title: "Daily Wellness Formula with Vitamin C and Zinc",
    brand: "BrandX",
    category: "Supplements",
    price: 19.99,
    inventoryQuantity: 9,
    inventoryStatus: "known",
    status: "attention",
    imageUrl: "",
    imageStatus: "catalog_missing",
    imageStatusMessage: "Image not provided by Walmart catalog",
    imageSource: "walmart_catalog",
    imageSyncStatus: "not_synced",
    issues: ["Image not provided by Walmart catalog"],
    attributes: {},
    shortDescription: "",
    longDescription: "",
    bulletPoints: [],
    rawPayload: {},
    normalizedPayload: {},
    lastSyncedAt: "2026-05-09T00:00:00.000Z",
    createdAt: "2026-05-09T00:00:00.000Z",
    updatedAt: "2026-05-09T00:00:00.000Z",
    ...overrides,
  };
}

function buildZipWithCsv(csvContent: string, filename = "item_report.csv"): Buffer {
  const fileNameBuffer = Buffer.from(filename, "utf8");
  const contentBuffer = Buffer.from(csvContent, "utf8");

  const localHeader = Buffer.alloc(30);
  localHeader.writeUInt32LE(0x04034b50, 0);
  localHeader.writeUInt16LE(20, 4);
  localHeader.writeUInt16LE(0, 6);
  localHeader.writeUInt16LE(0, 8);
  localHeader.writeUInt16LE(0, 10);
  localHeader.writeUInt16LE(0, 12);
  localHeader.writeUInt32LE(0, 14);
  localHeader.writeUInt32LE(contentBuffer.length, 18);
  localHeader.writeUInt32LE(contentBuffer.length, 22);
  localHeader.writeUInt16LE(fileNameBuffer.length, 26);
  localHeader.writeUInt16LE(0, 28);

  const centralDirectory = Buffer.alloc(46);
  centralDirectory.writeUInt32LE(0x02014b50, 0);
  centralDirectory.writeUInt16LE(20, 4);
  centralDirectory.writeUInt16LE(20, 6);
  centralDirectory.writeUInt16LE(0, 8);
  centralDirectory.writeUInt16LE(0, 10);
  centralDirectory.writeUInt16LE(0, 12);
  centralDirectory.writeUInt16LE(0, 14);
  centralDirectory.writeUInt32LE(0, 16);
  centralDirectory.writeUInt32LE(contentBuffer.length, 20);
  centralDirectory.writeUInt32LE(contentBuffer.length, 24);
  centralDirectory.writeUInt16LE(fileNameBuffer.length, 28);
  centralDirectory.writeUInt16LE(0, 30);
  centralDirectory.writeUInt16LE(0, 32);
  centralDirectory.writeUInt16LE(0, 34);
  centralDirectory.writeUInt16LE(0, 36);
  centralDirectory.writeUInt32LE(0, 38);
  centralDirectory.writeUInt32LE(0, 42);

  const centralDirectoryOffset = localHeader.length + fileNameBuffer.length + contentBuffer.length;
  const centralDirectorySize = centralDirectory.length + fileNameBuffer.length;

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(1, 8);
  eocd.writeUInt16LE(1, 10);
  eocd.writeUInt32LE(centralDirectorySize, 12);
  eocd.writeUInt32LE(centralDirectoryOffset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([
    localHeader,
    fileNameBuffer,
    contentBuffer,
    centralDirectory,
    fileNameBuffer,
    eocd,
  ]);
}

describe("Walmart Item Report image enrichment", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("parses primary/additional image columns with case and delimiter variants", () => {
    const csv = [
      "SKU,Primary Image URL,Additional Image URLs,Variant Image URLs,ProductId,ProductIdType,Brand,Title",
      'SKU-1,https://images.example.com/primary.jpg,"https://images.example.com/a.jpg|https://images.example.com/b.jpg;https://images.example.com/c.jpg",https://images.example.com/variant.jpg,000111222333,GTIN,BrandX,Title One',
      'SKU-2,,"[""https://images.example.com/json-1.jpg"",""https://images.example.com/json-1.jpg""]",invalid,111222333444,UPC,BrandY,Title Two',
    ].join("\n");

    const parsed = parseItemReportCsv(csv);

    expect(parsed).toHaveLength(2);
    expect(parsed[0]?.primaryImageUrl).toBe("https://images.example.com/primary.jpg");
    expect(parsed[0]?.galleryImageUrls).toEqual([
      "https://images.example.com/primary.jpg",
      "https://images.example.com/a.jpg",
      "https://images.example.com/b.jpg",
      "https://images.example.com/c.jpg",
    ]);
    expect(parsed[0]?.variantImageUrls).toEqual(["https://images.example.com/variant.jpg"]);
    expect(parsed[1]?.galleryImageUrls).toEqual(["https://images.example.com/json-1.jpg"]);
    expect(parsed[1]?.variantImageUrls).toEqual([]);
  });

  it("matches by exact SKU and prefers duplicate row with usable primary image", () => {
    const decisions = enrichProductsFromParsedItemReport({
      products: [createProduct({ sku: "SKU-1" })],
      rows: [
        {
          sku: "SKU-1",
          productId: "",
          productIdType: "",
          itemId: "ITEM-1",
          wpid: "",
          title: "Title 1",
          brand: "BrandX",
          primaryImageUrl: "",
          galleryImageUrls: ["https://images.example.com/gallery-only.jpg"],
          variantImageUrls: [],
          rowIndex: 0,
        },
        {
          sku: "SKU-1",
          productId: "",
          productIdType: "",
          itemId: "ITEM-2",
          wpid: "",
          title: "Title 1",
          brand: "BrandX",
          primaryImageUrl: "https://images.example.com/primary-preferred.jpg",
          galleryImageUrls: ["https://images.example.com/primary-preferred.jpg"],
          variantImageUrls: [],
          rowIndex: 1,
        },
      ],
    });

    const decision = decisions.get("SKU-1");
    expect(decision?.imageSyncStatus).toBe("found");
    expect(decision?.matchMethod).toBe("item_report_sku");
    expect(decision?.primaryImageUrl).toBe("https://images.example.com/primary-preferred.jpg");
    expect(decision?.statusReason).toBe("Image found in Walmart Item Report.");
  });

  it("marks not_found with safe reason when matched row has no usable image", () => {
    const decisions = enrichProductsFromParsedItemReport({
      products: [createProduct({ sku: "SKU-NO-IMG" })],
      rows: [
        {
          sku: "SKU-NO-IMG",
          productId: "",
          productIdType: "",
          itemId: "ITEM-NO-IMG",
          wpid: "",
          title: "Title",
          brand: "Brand",
          primaryImageUrl: "",
          galleryImageUrls: [],
          variantImageUrls: [],
          rowIndex: 0,
        },
      ],
    });

    const decision = decisions.get("SKU-NO-IMG");
    expect(decision?.imageSyncStatus).toBe("not_found");
    expect(decision?.allowItemSearchFallback).toBe(false);
    expect(decision?.statusReason).toBe("Item Report row found, but no usable image URL was provided.");
  });

  it("marks unmatched rows as not_found and allows fallback", () => {
    const decisions = enrichProductsFromParsedItemReport({
      products: [createProduct({ sku: "SKU-MISSING" })],
      rows: [],
    });

    const decision = decisions.get("SKU-MISSING");
    expect(decision?.imageSyncStatus).toBe("not_found");
    expect(decision?.allowItemSearchFallback).toBe(true);
    expect(decision?.statusReason).toBe("No matching row found in Walmart Item Report.");
  });

  it("runs report request -> poll -> download workflow and parses zip CSV", async () => {
    const csv = [
      "SKU,PrimaryImageUrl,AdditionalImageUrls",
      "SKU-1,https://images.example.com/primary.jpg,https://images.example.com/a.jpg",
    ].join("\n");
    const zip = buildZipWithCsv(csv);

    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

      if (url.includes("/v3/reports/generate")) {
        const headers = new Headers(init?.headers as HeadersInit);
        expect(headers.get("WM_SEC.ACCESS_TOKEN")).toBe("wm-token");
        expect(headers.get("WM_SVC.NAME")).toBe("Walmart Marketplace");
        expect(headers.get("content-type")).toContain("application/json");
        expect(String(init?.body ?? "")).toContain("ITEM");
        return new Response(JSON.stringify({ reportRequestId: "REQ-1" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }

      if (url.includes("/v3/reports/status/REQ-1")) {
        return new Response(
          JSON.stringify({ reportStatus: "PROCESSED", downloadUrl: "https://signed.example.com/report.zip" }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          }
        );
      }

      if (url.includes("signed.example.com/report.zip")) {
        return new Response(zip, {
          status: 200,
          headers: { "content-type": "application/zip" },
        });
      }

      return new Response(JSON.stringify({ message: "not found" }), {
        status: 404,
        headers: { "content-type": "application/json" },
      });
    });

    const run = await runItemReportWorkflow("wm-token");

    expect(run.status).toBe("ready");
    expect(run.itemReportRequested).toBe(true);
    expect(run.itemReportDownloaded).toBe(true);
    expect(run.itemReportRowsParsed).toBe(1);
    expect(run.reportRequestId).toBe("REQ-1");
    expect(fetchMock).toHaveBeenCalled();
  });

  it("handles timeout safely when report never reaches processed", async () => {
    vi.useFakeTimers();
    try {
      vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
        const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
        if (url.includes("/v3/reports/generate")) {
          return new Response(JSON.stringify({ reportRequestId: "REQ-TIMEOUT" }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        if (url.includes("/v3/reports/status/REQ-TIMEOUT") || url.includes("reportRequestId=REQ-TIMEOUT")) {
          return new Response(JSON.stringify({ reportStatus: "IN_PROGRESS" }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ message: "not found" }), {
          status: 404,
          headers: { "content-type": "application/json" },
        });
      });

      const pending = runItemReportWorkflow("wm-token");
      await vi.runAllTimersAsync();
      const run = await pending;

      expect(run.status).toBe("timed_out");
      expect(run.failureReason).toBe("Walmart Item Report was unavailable or timed out.");
    } finally {
      vi.useRealTimers();
    }
  });

  it("handles auth/permission failure without retry storm", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ message: "forbidden" }), {
        status: 403,
        headers: { "content-type": "application/json" },
      })
    );

    const run = await runItemReportWorkflow("wm-token");

    expect(run.status).toBe("failed");
    expect(run.failureCategory).toBe("auth_or_permission");
    expect(run.failureReason).toBe("Walmart Item Report request failed.");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("enriches multiple products from one ITEM report run", async () => {
    const csv = [
      "SKU,PrimaryImageUrl,AdditionalImageUrls,ProductId,ProductIdType",
      "SKU-1,https://images.example.com/sku1.jpg,https://images.example.com/sku1-a.jpg,000111222333,GTIN",
      "SKU-2,https://images.example.com/sku2.jpg,,111222333444,UPC",
    ].join("\n");

    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (url.includes("/v3/reports/generate")) {
        return new Response(JSON.stringify({ reportRequestId: "REQ-2" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      if (url.includes("/v3/reports/status/REQ-2")) {
        return new Response(
          JSON.stringify({ reportStatus: "PROCESSED", downloadUrl: "https://signed.example.com/report.csv" }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          }
        );
      }
      if (url.includes("signed.example.com/report.csv")) {
        return new Response(csv, {
          status: 200,
          headers: { "content-type": "text/csv" },
        });
      }
      return new Response(JSON.stringify({ message: "not found" }), {
        status: 404,
        headers: { "content-type": "application/json" },
      });
    });

    const result = await enrichProductsFromItemReport({
      accessToken: "wm-token",
      products: [createProduct({ sku: "SKU-1" }), createProduct({ sku: "SKU-2", upc: "111222333444", gtin: "" })],
    });

    expect(result.run.itemReportRowsParsed).toBe(2);
    expect(result.decisionsBySku.get("SKU-1")?.imageSyncStatus).toBe("found");
    expect(result.decisionsBySku.get("SKU-2")?.imageSyncStatus).toBe("found");
    expect(result.decisionsBySku.get("SKU-1")?.imageSource).toBe("walmart_item_report");
  });

  it("exposes parser internals for zip/csv regression coverage", () => {
    expect(walmartItemReportInternals.normalizeImageUrl("http://images.example.com/a.jpg")).toBe(
      "https://images.example.com/a.jpg"
    );
    expect(walmartItemReportInternals.parseAdditionalImageUrls("https://images.example.com/a.jpg;invalid")).toEqual([
      "https://images.example.com/a.jpg",
    ]);
  });
});

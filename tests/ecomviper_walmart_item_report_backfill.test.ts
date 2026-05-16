import { beforeEach, describe, expect, it, vi } from "vitest";
import { createEmptyWalmartDocket } from "@/lib/ecomviper/walmart/walmart-docket";
import {
  applyWalmartItemReportBackfillForUser,
  pollWalmartItemReportBackfillForUser,
  requestWalmartItemReportBackfillForUser,
} from "@/lib/ecomviper/walmart/walmart-item-report-backfill";
import { createFixtureWalmartItemReportProvider, type WalmartItemReportProvider } from "@/lib/ecomviper/walmart/walmart-item-report-provider";
import { replacePersistedWalmartProducts } from "@/lib/ecomviper/walmart/walmart-product-repository";
import type { WalmartProductRecord } from "@/lib/ecomviper/walmart/walmart-types";

function createProduct(overrides?: Partial<WalmartProductRecord>): WalmartProductRecord {
  const docket = createEmptyWalmartDocket({
    sku: "ROC948",
    statuses: ["imported_docket_ready", "report_backfill_pending"],
  });
  docket.content.shortDescription.value = "";
  docket.content.longDescription.value = "";
  docket.content.bullets.value = [];

  return {
    id: "walmart_roc948",
    marketplace: "walmart",
    sku: "ROC948",
    externalItemId: "wm_roc948",
    title: "OPA Joint",
    brand: "OPA",
    category: "Supplements",
    price: 29.99,
    inventoryQuantity: 8,
    inventoryStatus: "known",
    status: "attention",
    imageUrl: "",
    issues: [],
    attributes: {},
    shortDescription: "",
    longDescription: "",
    bulletPoints: [],
    docket,
    rawPayload: {},
    normalizedPayload: {
      itemReportBackfill: {
        status: "not_requested",
        requestId: null,
        reportType: "ITEM",
      },
      docket,
      docketHydrationStatus: docket.statuses,
    },
    lastSyncedAt: "2026-05-16T00:00:00.000Z",
    createdAt: "2026-05-16T00:00:00.000Z",
    updatedAt: "2026-05-16T00:00:00.000Z",
    ...overrides,
  };
}

function createProviderStub(partial?: Partial<WalmartItemReportProvider>): WalmartItemReportProvider {
  return {
    providerName: "stub",
    source: "fixture",
    credentialMode: "mock",
    createItemReportRequest: async () => ({
      ok: true,
      status: "requested",
      requestId: "REQ-STUB",
      reportType: "ITEM",
      reportVersion: null,
      requestedAt: "2026-05-16T00:00:00.000Z",
      cooldownUntil: "2026-05-16T01:00:00.000Z",
      source: "fixture",
      credentialMode: "mock",
      diagnostics: [],
    }),
    getReportRequestStatus: async (requestId: string) => ({
      ok: true,
      status: "submitted",
      requestId,
      reportType: "ITEM",
      reportVersion: null,
      walmartStatus: "SUBMITTED",
      ready: false,
      downloadUrl: null,
      lastCheckedAt: "2026-05-16T00:05:00.000Z",
      readyAt: null,
      expiresAt: null,
      source: "fixture",
      credentialMode: "mock",
      diagnostics: [],
    }),
    getReportDownloadUrl: async () => ({
      ok: true,
      status: "ready",
      downloadUrl: "fixture://download",
      diagnostics: [],
    }),
    downloadReport: async (input) => ({
      ok: true,
      status: "downloaded",
      requestId: input.requestId,
      content: "SKU,ProductName\nROC948,Fixture",
      contentType: "text/csv",
      downloadedAt: "2026-05-16T00:06:00.000Z",
      source: "fixture",
      credentialMode: "mock",
      diagnostics: [],
    }),
    parseItemReport: async () => [],
    applyItemReportRows: async () => ({
      status: "applied",
      rowCount: 0,
      appliedSkuCount: 0,
      warningCount: 0,
      errorCount: 0,
      source: "fixture",
      credentialMode: "mock",
      diagnostics: [],
    }),
    ...partial,
  };
}

describe("Walmart ITEM report backfill domain", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    (globalThis as Record<string, unknown>).__ecomviper_walmart_product_fallback__ = undefined;
    (globalThis as Record<string, unknown>).__ecomviper_walmart_product_tables_checked__ = undefined;

    await replacePersistedWalmartProducts({
      userId: "user_report_backfill",
      products: [createProduct()],
      importedAt: "2026-05-16T00:00:00.000Z",
      pruneMissingActiveSkus: true,
    });
  });

  it("returns request_blocked_no_credentials when provider reports missing credentials", async () => {
    const provider = createFixtureWalmartItemReportProvider({
      requestResult: {
        ok: false,
        status: "request_blocked_no_credentials",
        requestId: null,
      },
    });

    const result = await requestWalmartItemReportBackfillForUser({
      userId: "user_report_backfill",
      sku: "ROC948",
      provider,
    });

    expect(result.ok).toBe(false);
    expect(result.job.status).toBe("request_blocked_no_credentials");
    expect(result.freshness.itemReportFreshness).toBe("report_failed");
  });

  it("returns request_blocked_cooldown when cooldown is active", async () => {
    const providerCreate = vi.fn();
    const provider = createProviderStub({
      createItemReportRequest: providerCreate,
    });

    await replacePersistedWalmartProducts({
      userId: "user_report_backfill",
      products: [
        createProduct({
          normalizedPayload: {
            itemReportBackfill: {
              status: "requested",
              requestId: "REQ-COOLDOWN",
              reportType: "ITEM",
              cooldownUntil: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
            },
          },
        }),
      ],
      importedAt: "2026-05-16T00:00:00.000Z",
      pruneMissingActiveSkus: true,
    });

    const result = await requestWalmartItemReportBackfillForUser({
      userId: "user_report_backfill",
      sku: "ROC948",
      provider,
    });

    expect(result.ok).toBe(false);
    expect(result.job.status).toBe("request_blocked_cooldown");
    expect(providerCreate).not.toHaveBeenCalled();
  });

  it("maps submitted/in_progress/ready status transitions via poll", async () => {
    const provider = createFixtureWalmartItemReportProvider({
      requestResult: {
        ok: true,
        status: "requested",
        requestId: "REQ-STATUS",
      },
      statusSequence: [
        { status: "submitted", walmartStatus: "SUBMITTED", ready: false },
        { status: "in_progress", walmartStatus: "INPROGRESS", ready: false },
        {
          status: "ready",
          walmartStatus: "READY",
          ready: true,
          downloadUrl: "fixture://download",
          readyAt: "2026-05-16T00:20:00.000Z",
        },
      ],
    });

    await requestWalmartItemReportBackfillForUser({
      userId: "user_report_backfill",
      sku: "ROC948",
      provider,
    });

    const first = await pollWalmartItemReportBackfillForUser({
      userId: "user_report_backfill",
      sku: "ROC948",
      provider,
    });
    const second = await pollWalmartItemReportBackfillForUser({
      userId: "user_report_backfill",
      sku: "ROC948",
      provider,
    });
    const third = await pollWalmartItemReportBackfillForUser({
      userId: "user_report_backfill",
      sku: "ROC948",
      provider,
    });

    expect(first.job.status).toBe("submitted");
    expect(second.job.status).toBe("in_progress");
    expect(third.job.status).toBe("ready");
  });

  it("applies report rows to fill missing fields while preserving user_edit values", async () => {
    const docket = createEmptyWalmartDocket({
      sku: "ROC948",
      statuses: ["imported_docket_ready", "report_backfill_pending"],
    });
    docket.content.shortDescription.value = "User custom short";
    docket.content.shortDescription.source = "user_edit";
    docket.content.longDescription.value = "";
    docket.content.bullets.value = [];

    await replacePersistedWalmartProducts({
      userId: "user_report_backfill",
      products: [
        createProduct({
          docket,
          shortDescription: "User custom short",
          normalizedPayload: {
            docket,
            itemReportBackfill: {
              status: "downloaded",
              requestId: "REQ-APPLY",
              reportType: "ITEM",
              reportContent: "fixture",
              downloadedAt: "2026-05-16T00:25:00.000Z",
            },
          },
        }),
      ],
      importedAt: "2026-05-16T00:00:00.000Z",
      pruneMissingActiveSkus: true,
    });

    const provider = createFixtureWalmartItemReportProvider({
      rows: [
        {
          sku: "ROC948",
          productId: "000111222333",
          productIdType: "GTIN",
          itemId: "2791205430",
          wpid: "WP-1",
          title: "OPA Joint",
          brand: "OPA",
          siteDescription: "Incoming site description",
          longDescription: "Incoming long description",
          keyFeatures: ["Feature A", "Feature B"],
          primaryImageUrl: "https://images.example.com/primary.jpg",
          galleryImageUrls: ["https://images.example.com/primary.jpg"],
          variantImageUrls: [],
          rowIndex: 0,
        },
      ],
    });

    const result = await applyWalmartItemReportBackfillForUser({
      userId: "user_report_backfill",
      sku: "ROC948",
      provider,
    });

    expect(result.status === "applied" || result.status === "applied_with_warnings").toBe(true);
    expect(result.updatedProduct?.shortDescription).toBe("User custom short");
    expect(result.updatedProduct?.longDescription).toContain("Incoming long description");
    expect(result.updatedProduct?.bulletPoints).toEqual(["Feature A", "Feature B"]);
    expect(result.updatedProduct?.docket?.content.longDescription.source).toBe("item_report");

    const shortField = result.appliedFields.find((entry) => entry.field === "content.shortDescription");
    expect(shortField?.action).toBe("kept_user_edit");
  });

  it("returns no_matching_rows when report rows do not match sku", async () => {
    await replacePersistedWalmartProducts({
      userId: "user_report_backfill",
      products: [
        createProduct({
          normalizedPayload: {
            itemReportBackfill: {
              status: "downloaded",
              requestId: "REQ-NO-MATCH",
              reportType: "ITEM",
              reportContent: "fixture",
            },
          },
        }),
      ],
      importedAt: "2026-05-16T00:00:00.000Z",
      pruneMissingActiveSkus: true,
    });

    const provider = createFixtureWalmartItemReportProvider({
      rows: [
        {
          sku: "OTHER-SKU",
          productId: "",
          productIdType: "",
          itemId: "",
          wpid: "",
          title: "Other",
          brand: "Brand",
          primaryImageUrl: "",
          galleryImageUrls: [],
          variantImageUrls: [],
          rowIndex: 0,
        },
      ],
    });

    const result = await applyWalmartItemReportBackfillForUser({
      userId: "user_report_backfill",
      sku: "ROC948",
      provider,
    });

    expect(result.status).toBe("no_matching_rows");
    expect(result.appliedSkuCount).toBe(0);
  });
});

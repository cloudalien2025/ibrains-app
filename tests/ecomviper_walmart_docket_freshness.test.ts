import { describe, expect, it } from "vitest";
import { createEmptyWalmartDocket } from "@/lib/ecomviper/walmart/walmart-docket";
import { buildWalmartDocketFreshnessSummary } from "@/lib/ecomviper/walmart/walmart-docket-freshness";
import type { WalmartProductRecord } from "@/lib/ecomviper/walmart/walmart-types";

function createProduct(overrides?: Partial<WalmartProductRecord>): WalmartProductRecord {
  const docket = createEmptyWalmartDocket({
    sku: "ROC948",
    statuses: ["imported_docket_ready", "report_backfill_pending"],
  });
  docket.content.shortDescription.value = "Short";
  docket.content.shortDescription.source = "items_list";
  docket.content.shortDescription.retrievedAt = "2026-05-16T00:00:00.000Z";
  docket.content.longDescription.value = "Long";
  docket.content.longDescription.source = "item_detail";
  docket.content.longDescription.retrievedAt = "2026-05-16T00:00:00.000Z";

  return {
    id: "walmart_roc948",
    marketplace: "walmart",
    sku: "ROC948",
    externalItemId: "wm_roc948",
    title: "Product",
    brand: "OPA",
    category: "Supplements",
    price: 29.99,
    inventoryQuantity: 7,
    inventoryStatus: "known",
    status: "attention",
    imageUrl: "",
    issues: [],
    attributes: {},
    shortDescription: "Short",
    longDescription: "Long",
    bulletPoints: [],
    docket,
    rawPayload: {},
    normalizedPayload: {
      docket,
      itemReportBackfill: {
        status: "not_requested",
      },
    },
    lastSyncedAt: "2026-05-16T00:00:00.000Z",
    createdAt: "2026-05-16T00:00:00.000Z",
    updatedAt: "2026-05-16T00:00:00.000Z",
    ...overrides,
  };
}

describe("Walmart docket freshness summary", () => {
  it("reports pending_report when ITEM report request is in progress", () => {
    const product = createProduct({
      normalizedPayload: {
        itemReportBackfill: {
          status: "in_progress",
          requestId: "REQ-1",
          requestedAt: "2026-05-16T00:10:00.000Z",
        },
      },
    });

    const summary = buildWalmartDocketFreshnessSummary({
      product,
      now: "2026-05-16T00:20:00.000Z",
    });

    expect(summary.itemReportFreshness).toBe("pending_report");
    expect(summary.reportBackfillStatus).toBe("in_progress");
  });

  it("reports fresh after ITEM report applied with recent timestamps", () => {
    const product = createProduct({
      normalizedPayload: {
        itemReportBackfill: {
          status: "applied",
          requestId: "REQ-2",
          appliedAt: "2026-05-16T00:45:00.000Z",
          downloadedAt: "2026-05-16T00:40:00.000Z",
        },
      },
    });

    const summary = buildWalmartDocketFreshnessSummary({
      product,
      now: "2026-05-16T01:00:00.000Z",
    });

    expect(summary.itemReportFreshness).toBe("fresh");
    expect(summary.overallStatus).toBe("fresh");
  });

  it("reports stale when docket fields are older than freshness threshold", () => {
    const product = createProduct();
    product.docket!.content.shortDescription.retrievedAt = "2026-03-01T00:00:00.000Z";
    product.docket!.content.longDescription.retrievedAt = "2026-03-01T00:00:00.000Z";

    const summary = buildWalmartDocketFreshnessSummary({
      product,
      now: "2026-05-16T00:00:00.000Z",
    });

    expect(summary.sections.some((section) => section.status === "stale")).toBe(true);
  });
});

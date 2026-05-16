import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requireSignedInUser: vi.fn(),
  requestWalmartItemReportBackfillForUser: vi.fn(),
  pollWalmartItemReportBackfillForUser: vi.fn(),
  downloadWalmartItemReportBackfillForUser: vi.fn(),
  applyWalmartItemReportBackfillForUser: vi.fn(),
}));

vi.mock("@/lib/auth/requireSignedInUser", () => ({
  requireSignedInUser: mocks.requireSignedInUser,
}));

vi.mock("@/lib/ecomviper/walmart/walmart-item-report-backfill", () => ({
  requestWalmartItemReportBackfillForUser: mocks.requestWalmartItemReportBackfillForUser,
  pollWalmartItemReportBackfillForUser: mocks.pollWalmartItemReportBackfillForUser,
  downloadWalmartItemReportBackfillForUser: mocks.downloadWalmartItemReportBackfillForUser,
  applyWalmartItemReportBackfillForUser: mocks.applyWalmartItemReportBackfillForUser,
}));

function baseJob(status: string) {
  return {
    status,
    requestId: "REQ-1",
    reportType: "ITEM",
    reportVersion: null,
    requestedAt: "2026-05-16T00:00:00.000Z",
    lastCheckedAt: "2026-05-16T00:10:00.000Z",
    readyAt: null,
    downloadedAt: null,
    appliedAt: null,
    expiresAt: null,
    source: "fixture",
    credentialMode: "mock",
    cooldownUntil: null,
    rowCount: 0,
    appliedSkuCount: 0,
    warningCount: 0,
    errorCount: 0,
    diagnostics: [],
  };
}

describe("Walmart ITEM report routes", () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.requireSignedInUser.mockReset();
    mocks.requestWalmartItemReportBackfillForUser.mockReset();
    mocks.pollWalmartItemReportBackfillForUser.mockReset();
    mocks.downloadWalmartItemReportBackfillForUser.mockReset();
    mocks.applyWalmartItemReportBackfillForUser.mockReset();
  });

  it("request route returns 401 for unauthenticated requests", async () => {
    mocks.requireSignedInUser.mockResolvedValue({
      userId: null,
      unauthorizedResponse: new Response(null, { status: 401 }),
    });

    const { POST } = await import("@/app/api/ecomviper/walmart/reports/item/request/route");
    const response = await POST(
      new NextRequest("http://localhost/api/ecomviper/walmart/reports/item/request", {
        method: "POST",
        body: JSON.stringify({ sku: "ROC948" }),
      })
    );

    expect(response.status).toBe(401);
  });

  it("request route forwards sku and returns backfill payload", async () => {
    mocks.requireSignedInUser.mockResolvedValue({ userId: "user_1", unauthorizedResponse: null });
    mocks.requestWalmartItemReportBackfillForUser.mockResolvedValue({
      ok: true,
      job: baseJob("requested"),
      freshness: { overallStatus: "pending_report" },
    });

    const { POST } = await import("@/app/api/ecomviper/walmart/reports/item/request/route");
    const response = await POST(
      new NextRequest("http://localhost/api/ecomviper/walmart/reports/item/request", {
        method: "POST",
        body: JSON.stringify({ sku: "roc948" }),
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.reportBackfill.status).toBe("requested");
    expect(mocks.requestWalmartItemReportBackfillForUser).toHaveBeenCalledWith({
      userId: "user_1",
      sku: "ROC948",
    });
  });

  it("status route maps ready payload", async () => {
    mocks.requireSignedInUser.mockResolvedValue({ userId: "user_1", unauthorizedResponse: null });
    mocks.pollWalmartItemReportBackfillForUser.mockResolvedValue({
      ok: true,
      job: {
        ...baseJob("ready"),
        readyAt: "2026-05-16T00:20:00.000Z",
      },
      freshness: { overallStatus: "report_ready" },
    });

    const { POST } = await import("@/app/api/ecomviper/walmart/reports/item/status/route");
    const response = await POST(
      new NextRequest("http://localhost/api/ecomviper/walmart/reports/item/status", {
        method: "POST",
        body: JSON.stringify({ sku: "ROC948", requestId: "REQ-1" }),
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.reportBackfill.status).toBe("ready");
    expect(payload.message).toContain("ready");
  });

  it("download route returns downloaded job", async () => {
    mocks.requireSignedInUser.mockResolvedValue({ userId: "user_1", unauthorizedResponse: null });
    mocks.downloadWalmartItemReportBackfillForUser.mockResolvedValue({
      ok: true,
      job: {
        ...baseJob("downloaded"),
        downloadedAt: "2026-05-16T00:25:00.000Z",
        rowCount: 12,
      },
      freshness: { overallStatus: "pending_report" },
    });

    const { POST } = await import("@/app/api/ecomviper/walmart/reports/item/download/route");
    const response = await POST(
      new NextRequest("http://localhost/api/ecomviper/walmart/reports/item/download", {
        method: "POST",
        body: JSON.stringify({ sku: "ROC948", requestId: "REQ-1" }),
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.reportBackfill.status).toBe("downloaded");
    expect(payload.reportBackfill.rowCount).toBe(12);
  });

  it("apply route returns merged product payload", async () => {
    mocks.requireSignedInUser.mockResolvedValue({ userId: "user_1", unauthorizedResponse: null });
    mocks.applyWalmartItemReportBackfillForUser.mockResolvedValue({
      status: "applied_with_warnings",
      rowCount: 20,
      appliedSkuCount: 1,
      warningCount: 1,
      errorCount: 0,
      source: "fixture",
      credentialMode: "mock",
      diagnostics: [],
      job: {
        ...baseJob("applied_with_warnings"),
        appliedAt: "2026-05-16T00:30:00.000Z",
        rowCount: 20,
        appliedSkuCount: 1,
      },
      matchedRowCount: 1,
      unmatchedRowCount: 0,
      duplicateSkuCount: 1,
      appliedFields: [],
      freshnessBySku: { ROC948: { overallStatus: "fresh" } },
      updatedProduct: { sku: "ROC948", title: "Updated" },
    });

    const { POST } = await import("@/app/api/ecomviper/walmart/reports/item/apply/route");
    const response = await POST(
      new NextRequest("http://localhost/api/ecomviper/walmart/reports/item/apply", {
        method: "POST",
        body: JSON.stringify({ sku: "ROC948", applyToCatalog: false }),
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.reportBackfill.status).toBe("applied_with_warnings");
    expect(payload.applyResult.duplicateSkuCount).toBe(1);
    expect(payload.product.sku).toBe("ROC948");
  });
});

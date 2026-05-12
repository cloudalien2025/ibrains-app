import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requireSignedInUser: vi.fn(),
  importWalmartProducts: vi.fn(),
  isWalmartImportFailureError: vi.fn(),
  retryWalmartPublicImageEnrichmentForUser: vi.fn(),
  listWalmartProductsForUser: vi.fn(),
  getSerpApiCredentialsForUser: vi.fn(),
}));

vi.mock("@/lib/auth/requireSignedInUser", () => ({
  requireSignedInUser: mocks.requireSignedInUser,
}));

vi.mock("@/lib/ecomviper/walmart/walmart-products", () => ({
  importWalmartProducts: mocks.importWalmartProducts,
  isWalmartImportFailureError: mocks.isWalmartImportFailureError,
  retryWalmartPublicImageEnrichmentForUser: mocks.retryWalmartPublicImageEnrichmentForUser,
  listWalmartProductsForUser: mocks.listWalmartProductsForUser,
}));

vi.mock("@/lib/ecomviper/walmart/serpapi-walmart-images", () => ({
  getSerpApiCredentialsForUser: mocks.getSerpApiCredentialsForUser,
}));

describe("walmart products import route", () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.requireSignedInUser.mockReset();
    mocks.importWalmartProducts.mockReset();
    mocks.isWalmartImportFailureError.mockReset();
    mocks.retryWalmartPublicImageEnrichmentForUser.mockReset();
    mocks.listWalmartProductsForUser.mockReset();
    mocks.getSerpApiCredentialsForUser.mockReset();
    mocks.listWalmartProductsForUser.mockResolvedValue([]);
    mocks.isWalmartImportFailureError.mockReturnValue(false);
    mocks.getSerpApiCredentialsForUser.mockResolvedValue({
      connected: false,
      apiKey: null,
      status: "not_connected",
      statusReason: "SerpApi key is missing.",
    });
  });

  it("returns 401 when the caller is unauthenticated", async () => {
    mocks.requireSignedInUser.mockResolvedValue({
      userId: null,
      unauthorizedResponse: new Response(null, { status: 401 }),
    });

    const { POST } = await import("@/app/api/ecomviper/walmart/products/import/route");
    const response = await POST(new NextRequest("https://app.ibrains.ai/api/ecomviper/walmart/products/import", { method: "POST" }));
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload?.error?.code).toBe("UNAUTHORIZED");
    expect(payload?.error?.message).toContain("sign in");
  });

  it("returns import counts and message when import succeeds", async () => {
    mocks.requireSignedInUser.mockResolvedValue({
      userId: "user_clerk_1",
      unauthorizedResponse: null,
    });
    mocks.importWalmartProducts.mockResolvedValue({
      importedCount: 3,
      fetchedCount: 3,
      skippedCount: 0,
      lastImportAt: "2026-05-08T05:00:00.000Z",
      mode: "live-ready",
    });

    const { POST } = await import("@/app/api/ecomviper/walmart/products/import/route");
    const response = await POST(new NextRequest("https://app.ibrains.ai/api/ecomviper/walmart/products/import", { method: "POST" }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.importedCount).toBe(3);
    expect(payload.fetchedCount).toBe(3);
    expect(payload.message).toContain("Imported 3 products.");
    expect(payload.importProgress?.stage).toBe("complete");
    expect(mocks.importWalmartProducts).toHaveBeenCalledWith(
      "user_clerk_1",
      expect.objectContaining({ boundedRuntime: true })
    );
  });

  it("serializes per-product image enrichment diagnostics into import progress", async () => {
    mocks.requireSignedInUser.mockResolvedValue({
      userId: "user_clerk_1",
      unauthorizedResponse: null,
    });
    mocks.importWalmartProducts.mockResolvedValue({
      importedCount: 1,
      fetchedCount: 1,
      skippedCount: 0,
      lastImportAt: "2026-05-12T00:00:00.000Z",
      mode: "live-ready",
      importDiagnostics: {
        fetchedCount: 1,
        payloadShape: "root.ItemResponse.array",
        pageCount: 1,
        imageFoundCount: 0,
        imageFromImportPayloadCount: 0,
        imageEnrichedCount: 0,
        imageStillMissingCount: 1,
        enrichmentQueuedCount: 1,
        enrichmentCompletedCount: 1,
        enrichmentProviderConnected: true,
        serpApiStatus: "connected",
        serpApiCanAttempt: true,
        perProductAttemptDiagnostics: [
          {
            sku: "OPA-SLEEP-001",
            title: "OPA Sleep Magnesium Glycinate",
            attemptedMethods: ["walmart_item_search", "serpapi_brand_search", "serpapi_per_product_search"],
            queryUsed: "OPA Sleep Magnesium Glycinate",
            walmartItemSearchQueryOrIdentifier: "OPA Sleep Magnesium Glycinate",
            walmartItemSearchMethod: "query",
            resultCount: 4,
            topCandidateTitle: "OPA Sleep Magnesium Glycinate 120 Capsules",
            topCandidateItemOrProductId: "18273645",
            topCandidateProductId: "18273645",
            topCandidateUsItemId: "18273645",
            topCandidateThumbnailPresent: true,
            matchScore: 64,
            confidence: "medium",
            rejectionReason: "No confident brand-search match.",
            finalStatus: "not_synced",
          },
        ],
      },
    });

    const { POST } = await import("@/app/api/ecomviper/walmart/products/import/route");
    const response = await POST(
      new NextRequest("https://app.ibrains.ai/api/ecomviper/walmart/products/import", { method: "POST" })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.importProgress?.perProductAttemptDiagnostics).toEqual([
      {
        sku: "OPA-SLEEP-001",
        title: "OPA Sleep Magnesium Glycinate",
        attemptedMethods: ["walmart_item_search", "serpapi_brand_search", "serpapi_per_product_search"],
        queryUsed: "OPA Sleep Magnesium Glycinate",
        walmartItemSearchQueryOrIdentifier: "OPA Sleep Magnesium Glycinate",
        walmartItemSearchMethod: "query",
        resultCount: 4,
        topCandidateTitle: "OPA Sleep Magnesium Glycinate 120 Capsules",
        topCandidateItemOrProductId: "18273645",
        topCandidateProductId: "18273645",
        topCandidateUsItemId: "18273645",
        topCandidateThumbnailPresent: true,
        matchScore: 64,
        confidence: "medium",
        rejectionReason: "No confident brand-search match.",
        finalStatus: "not_synced",
      },
    ]);
  });

  it("includes inventory pending diagnostics in success message when inventory is unknown", async () => {
    mocks.requireSignedInUser.mockResolvedValue({
      userId: "user_clerk_1",
      unauthorizedResponse: null,
    });
    mocks.importWalmartProducts.mockResolvedValue({
      importedCount: 2,
      fetchedCount: 2,
      skippedCount: 0,
      lastImportAt: "2026-05-09T00:00:00.000Z",
      mode: "live-ready",
      importDiagnostics: {
        fetchedCount: 2,
        payloadShape: "root.ItemResponse.array",
        pageCount: 1,
        inventoryKnownCount: 1,
        inventoryUnknownCount: 1,
        inventoryOutOfStockCount: 0,
        imageFoundCount: 1,
        imageNotFoundCount: 1,
        imageAmbiguousCount: 0,
        imageFailedCount: 0,
        imageSkippedNoProviderCount: 0,
        enrichmentQueuedCount: 2,
        enrichmentCompletedCount: 2,
        enrichmentProviderConnected: true,
        serpApiStatus: "connected",
        serpApiStatusReason: null,
        serpApiCanAttempt: true,
        enrichmentErrorCategories: {
          invalidKeyCount: 0,
          forbiddenCount: 0,
          rateLimitedCount: 0,
          badRequestCount: 0,
          providerErrorCount: 0,
          networkErrorCount: 0,
          malformedResponseCount: 0,
          unknownErrorCount: 0,
        },
        imageSource: "Walmart Item Report + Walmart Item Search",
        itemReportRequested: true,
        itemReportDownloaded: true,
        itemReportRowsParsed: 8,
        imageSourceBreakdown: {
          walmartItemReport: 1,
          walmartSellerCatalogSearch: 0,
          walmartItemSearch: 0,
        },
      },
    });

    const { POST } = await import("@/app/api/ecomviper/walmart/products/import/route");
    const response = await POST(new NextRequest("https://app.ibrains.ai/api/ecomviper/walmart/products/import", { method: "POST" }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.importedCount).toBe(2);
    expect(payload.message).toContain("Imported 2 products.");
    expect(payload.importProgress?.stage).toBe("completed_with_warnings");
    expect(payload.importProgress?.totals?.imageFoundCount).toBe(1);
    expect(payload.importProgress?.totals?.imageNotFoundCount).toBe(1);
  });

  it("returns zero-import diagnostics when no products are imported", async () => {
    mocks.requireSignedInUser.mockResolvedValue({
      userId: "user_clerk_1",
      unauthorizedResponse: null,
    });
    mocks.importWalmartProducts.mockResolvedValue({
      importedCount: 0,
      fetchedCount: 0,
      skippedCount: 0,
      lastImportAt: "2026-05-09T00:00:00.000Z",
      mode: "live-ready",
      importDiagnostics: {
        fetchedCount: 0,
        payloadShape: "root.ItemResponse.object_empty",
        pageCount: 1,
      },
    });

    const { POST } = await import("@/app/api/ecomviper/walmart/products/import/route");
    const response = await POST(new NextRequest("https://app.ibrains.ai/api/ecomviper/walmart/products/import", { method: "POST" }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.importedCount).toBe(0);
    expect(payload.message).toContain("zero products");
    expect(payload.message).toContain("fetchedCount=0");
    expect(payload.message).toContain("payloadShape=root.ItemResponse.object_empty");
  });

  it("returns structured failed progress with import error category and provider status", async () => {
    mocks.requireSignedInUser.mockResolvedValue({
      userId: "user_clerk_1",
      unauthorizedResponse: null,
    });
    mocks.listWalmartProductsForUser.mockResolvedValue([
      { sku: "OLD-1" },
      { sku: "OLD-2" },
    ]);
    mocks.importWalmartProducts.mockRejectedValue(
      new Error("Production token request failed: HTTP 401 unauthorized.")
    );
    mocks.getSerpApiCredentialsForUser.mockResolvedValue({
      connected: true,
      apiKey: "serpapi_test_key",
      status: "connected",
      statusReason: null,
    });

    const { POST } = await import("@/app/api/ecomviper/walmart/products/import/route");
    const response = await POST(
      new NextRequest("https://app.ibrains.ai/api/ecomviper/walmart/products/import", {
        method: "POST",
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload.ok).toBe(false);
    expect(payload.error?.code).toBe("IMPORT_FAILED");
    expect(payload.importProgress?.stage).toBe("failed");
    expect(payload.importProgress?.importErrorCategory).toBe("walmart_auth_failed");
    expect(payload.importProgress?.importErrorPhase).toBe("walmart_auth");
    expect(payload.importProgress?.importErrorStatusCode).toBe(401);
    expect(payload.importProgress?.providerStatus).toBe("connected");
    expect(payload.importProgress?.totals?.importedCount).toBe(0);
    expect(payload.importProgress?.existingProductsShownCount).toBe(2);
  });

  it("returns structured request validation failure for malformed mode body", async () => {
    mocks.requireSignedInUser.mockResolvedValue({
      userId: "user_clerk_1",
      unauthorizedResponse: null,
    });

    const { POST } = await import("@/app/api/ecomviper/walmart/products/import/route");
    const response = await POST(
      new NextRequest("https://app.ibrains.ai/api/ecomviper/walmart/products/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode: 123 }),
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.ok).toBe(false);
    expect(payload.error?.code).toBe("IMPORT_REQUEST_INVALID");
    expect(payload.importProgress?.stage).toBe("failed");
    expect(payload.importProgress?.importErrorCategory).toBe("import_request_invalid");
    expect(payload.importProgress?.importErrorPhase).toBe("request_validation");
  });

  it("preserves typed importer diagnostics and partial progress on failure", async () => {
    mocks.requireSignedInUser.mockResolvedValue({
      userId: "user_clerk_1",
      unauthorizedResponse: null,
    });
    mocks.isWalmartImportFailureError.mockImplementation(
      (error: unknown) => Boolean(error && typeof error === "object" && (error as { name?: string }).name === "WalmartImportFailureError")
    );
    const typedError = Object.assign(new Error("Walmart catalog read failed with HTTP 503."), {
      name: "WalmartImportFailureError",
      category: "walmart_products_fetch_failed",
      phase: "walmart_products_fetch",
      statusCode: 503,
      endpointFamily: "walmart_catalog_items",
      correlationId: "corr-123",
      responseShapeSummary: "object:errors",
      partialProgress: {
        importedCount: 0,
        fetchedCount: 27,
        processedCount: 0,
        queuedCount: 0,
        imageFoundCount: 0,
        imageMissingCount: 0,
        imageNotFoundCount: 0,
        imageAmbiguousCount: 0,
        imageFailedCount: 0,
        imageSkippedNoProviderCount: 0,
      },
    });
    mocks.importWalmartProducts.mockRejectedValue(typedError);

    const { POST } = await import("@/app/api/ecomviper/walmart/products/import/route");
    const response = await POST(
      new NextRequest("https://app.ibrains.ai/api/ecomviper/walmart/products/import", { method: "POST" })
    );
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload.importProgress?.importErrorCategory).toBe("walmart_products_fetch_failed");
    expect(payload.importProgress?.importErrorPhase).toBe("walmart_products_fetch");
    expect(payload.importProgress?.importErrorStatusCode).toBe(503);
    expect(payload.importProgress?.importErrorEndpointFamily).toBe("walmart_catalog_items");
    expect(payload.importProgress?.totals?.fetchedCount).toBe(27);
  });

  it("returns walmart_credentials_missing when importer surfaces missing credential category", async () => {
    mocks.requireSignedInUser.mockResolvedValue({
      userId: "user_clerk_1",
      unauthorizedResponse: null,
    });
    mocks.isWalmartImportFailureError.mockImplementation(
      (error: unknown) => Boolean(error && typeof error === "object" && (error as { name?: string }).name === "WalmartImportFailureError")
    );
    mocks.importWalmartProducts.mockRejectedValue(
      Object.assign(new Error("Missing Walmart Client ID or Client Secret."), {
        name: "WalmartImportFailureError",
        category: "walmart_credentials_missing",
        phase: "walmart_credentials",
      })
    );

    const { POST } = await import("@/app/api/ecomviper/walmart/products/import/route");
    const response = await POST(
      new NextRequest("https://app.ibrains.ai/api/ecomviper/walmart/products/import", { method: "POST" })
    );
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload.importProgress?.importErrorCategory).toBe("walmart_credentials_missing");
    expect(payload.importProgress?.importErrorPhase).toBe("walmart_credentials");
  });

  it("maps non-error importer rejection to import_unknown_error with safe fallback", async () => {
    mocks.requireSignedInUser.mockResolvedValue({
      userId: "user_clerk_1",
      unauthorizedResponse: null,
    });
    mocks.importWalmartProducts.mockRejectedValue({
      code: "RUNTIME_BLOWUP",
    });

    const { POST } = await import("@/app/api/ecomviper/walmart/products/import/route");
    const response = await POST(
      new NextRequest("https://app.ibrains.ai/api/ecomviper/walmart/products/import", { method: "POST" })
    );
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload.importProgress?.importErrorCategory).toBe("import_unknown_error");
    expect(payload.importProgress?.importErrorReason).toBe("Import failed due to an unknown runtime error.");
  });

  it("maps gateway timeout errors to import_gateway_timeout with gateway phase", async () => {
    mocks.requireSignedInUser.mockResolvedValue({
      userId: "user_clerk_1",
      unauthorizedResponse: null,
    });
    mocks.importWalmartProducts.mockRejectedValue(
      new Error(
        "Import request timed out at the gateway before completion. Try Import Products again."
      )
    );

    const { POST } = await import("@/app/api/ecomviper/walmart/products/import/route");
    const response = await POST(
      new NextRequest("https://app.ibrains.ai/api/ecomviper/walmart/products/import", { method: "POST" })
    );
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload.importProgress?.importErrorCategory).toBe("import_gateway_timeout");
    expect(payload.importProgress?.importErrorPhase).toBe("gateway_timeout");
    expect(payload.importProgress?.importErrorStatusCode).toBe(504);
    expect(payload.importProgress?.importErrorEndpointFamily).toBe("gateway");
  });

  it("keeps import as completed_with_warnings when catalog import succeeds but SerpApi key is invalid", async () => {
    mocks.requireSignedInUser.mockResolvedValue({
      userId: "user_clerk_1",
      unauthorizedResponse: null,
    });
    mocks.importWalmartProducts.mockResolvedValue({
      importedCount: 4,
      fetchedCount: 4,
      skippedCount: 0,
      lastImportAt: "2026-05-11T00:00:00.000Z",
      mode: "live-ready",
      importDiagnostics: {
        fetchedCount: 4,
        payloadShape: "root.ItemResponse.array",
        pageCount: 1,
        imageFoundCount: 0,
        imageFromImportPayloadCount: 0,
        imageEnrichedCount: 0,
        imageStillMissingCount: 4,
        imageNotFoundCount: 0,
        imageAmbiguousCount: 0,
        imageFailedCount: 4,
        imageSkippedNoProviderCount: 0,
        enrichmentQueuedCount: 4,
        enrichmentCompletedCount: 4,
        enrichmentProviderConnected: true,
        serpApiStatus: "invalid_key",
        serpApiStatusReason: "SerpApi key was rejected.",
        serpApiCanAttempt: true,
        enrichmentErrorCategories: {
          invalidKeyCount: 4,
          forbiddenCount: 0,
          rateLimitedCount: 0,
          badRequestCount: 0,
          providerErrorCount: 0,
          networkErrorCount: 0,
          malformedResponseCount: 0,
          unknownErrorCount: 0,
        },
        imageEnrichmentNoImageReason: "SerpApi key was rejected.",
      },
    });

    const { POST } = await import("@/app/api/ecomviper/walmart/products/import/route");
    const response = await POST(
      new NextRequest("https://app.ibrains.ai/api/ecomviper/walmart/products/import", {
        method: "POST",
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.importProgress?.stage).toBe("completed_with_warnings");
    expect(payload.importProgress?.providerStatus).toBe("invalid_key");
    expect(payload.importProgress?.providerStatusReason).toBe("SerpApi key was rejected.");
    expect(payload.importProgress?.totals?.importedCount).toBe(4);
    expect(payload.importProgress?.totals?.imageStillMissingCount).toBe(4);
    expect(payload.importProgress?.totals?.imageMissingCount).toBe(4);
    expect(payload.importProgress?.totals?.imageFailedCount).toBe(4);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requireSignedInUser: vi.fn(),
  importWalmartProducts: vi.fn(),
}));

vi.mock("@/lib/auth/requireSignedInUser", () => ({
  requireSignedInUser: mocks.requireSignedInUser,
}));

vi.mock("@/lib/ecomviper/walmart/walmart-products", () => ({
  importWalmartProducts: mocks.importWalmartProducts,
}));

describe("walmart products import route", () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.requireSignedInUser.mockReset();
    mocks.importWalmartProducts.mockReset();
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
    expect(payload.message).toContain("Imported 3 Walmart product");
    expect(mocks.importWalmartProducts).toHaveBeenCalledWith("user_clerk_1");
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
        imageSource: "Walmart Item Search",
      },
    });

    const { POST } = await import("@/app/api/ecomviper/walmart/products/import/route");
    const response = await POST(new NextRequest("https://app.ibrains.ai/api/ecomviper/walmart/products/import", { method: "POST" }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.importedCount).toBe(2);
    expect(payload.message).toContain("Imported 2 Walmart product");
    expect(payload.message).toContain("Inventory pending for 1 SKU");
    expect(payload.message).toContain("Image enrichment (Walmart Item Search): found=1, notFound=1, ambiguous=0, failed=0");
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
});

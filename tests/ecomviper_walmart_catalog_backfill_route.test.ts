import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requireSignedInUser: vi.fn(),
  getWalmartProductBySkuForUser: vi.fn(),
  previewWalmartCatalogBackfillForUser: vi.fn(),
}));

vi.mock("@/lib/auth/requireSignedInUser", () => ({
  requireSignedInUser: mocks.requireSignedInUser,
}));

vi.mock("@/lib/ecomviper/walmart/walmart-products", () => ({
  getWalmartProductBySkuForUser: mocks.getWalmartProductBySkuForUser,
}));

vi.mock("@/lib/ecomviper/walmart/walmart-live-catalog-backfill", () => ({
  previewWalmartCatalogBackfillForUser: mocks.previewWalmartCatalogBackfillForUser,
}));

function productFixture() {
  return {
    id: "walmart_roc303",
    marketplace: "walmart",
    sku: "ROC303",
    externalItemId: "wm_roc303",
    title: "OPA Enzymes Prebiotic Probiotics For Men And Women - 60 Ct",
    brand: "",
    category: "Supplements",
    price: 0,
    inventoryQuantity: 0,
    inventoryStatus: "unknown",
    status: "attention",
    imageUrl: "",
    issues: [],
    attributes: {},
    shortDescription: "",
    longDescription: "",
    bulletPoints: [],
    rawPayload: {},
    normalizedPayload: {},
    lastSyncedAt: "2026-05-15T00:00:00.000Z",
    createdAt: "2026-05-15T00:00:00.000Z",
    updatedAt: "2026-05-15T00:00:00.000Z",
  };
}

describe("walmart catalog backfill route", () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.requireSignedInUser.mockReset();
    mocks.getWalmartProductBySkuForUser.mockReset();
    mocks.previewWalmartCatalogBackfillForUser.mockReset();
  });

  it("returns 401 when unauthenticated", async () => {
    mocks.requireSignedInUser.mockResolvedValue({
      userId: null,
      unauthorizedResponse: new Response(null, { status: 401 }),
    });

    const { POST } = await import(
      "@/app/api/ecomviper/walmart/products/[sku]/catalog-backfill/route"
    );
    const response = await POST(
      new NextRequest("http://localhost/api/ecomviper/walmart/products/ROC303/catalog-backfill", {
        method: "POST",
      }),
      { params: Promise.resolve({ sku: "ROC303" }) }
    );
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload?.error?.code).toBe("UNAUTHORIZED");
  });

  it("returns 404 when product does not exist", async () => {
    mocks.requireSignedInUser.mockResolvedValue({
      userId: "user_1",
      unauthorizedResponse: null,
    });
    mocks.getWalmartProductBySkuForUser.mockResolvedValue(null);

    const { POST } = await import(
      "@/app/api/ecomviper/walmart/products/[sku]/catalog-backfill/route"
    );
    const response = await POST(
      new NextRequest("http://localhost/api/ecomviper/walmart/products/ROC303/catalog-backfill", {
        method: "POST",
      }),
      { params: Promise.resolve({ sku: "ROC303" }) }
    );
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload?.error?.code).toBe("PRODUCT_NOT_FOUND");
  });

  it("returns deterministic skipped_no_credentials preview payload", async () => {
    mocks.requireSignedInUser.mockResolvedValue({
      userId: "user_1",
      unauthorizedResponse: null,
    });
    mocks.getWalmartProductBySkuForUser.mockResolvedValue(productFixture());
    mocks.previewWalmartCatalogBackfillForUser.mockResolvedValue({
      status: "skipped_no_credentials",
      canonicalItemId: "2791205430",
      canonicalPublicUrl: "https://www.walmart.com/ip/2791205430",
      matchConfidence: "none",
      selectedCandidate: null,
      candidates: [],
      fieldPatches: [],
      sourceConfidence: {
        overallConfidence: "none",
        totalFields: 0,
        actionableFields: 0,
        byAction: {
          kept_seller_native: 0,
          filled_missing: 0,
          replaced_placeholder: 0,
          skipped_lower_confidence: 0,
          skipped_conflict: 0,
          skipped_user_edited: 0,
        },
        byConfidence: {
          exact: 0,
          strong: 0,
          moderate: 0,
          weak: 0,
          none: 0,
        },
      },
      diagnostics: [],
      warnings: [],
      sourceSummary: {
        winningSource: "unavailable",
        sourceLabel: "Unavailable",
        retrievedAt: "2026-05-15T00:00:00.000Z",
        credentialMode: "unavailable",
      },
    });

    const { POST } = await import(
      "@/app/api/ecomviper/walmart/products/[sku]/catalog-backfill/route"
    );
    const response = await POST(
      new NextRequest("http://localhost/api/ecomviper/walmart/products/ROC303/catalog-backfill", {
        method: "POST",
        body: JSON.stringify({ userDraftPayload: { shortDescription: "draft value" } }),
      }),
      { params: Promise.resolve({ sku: "ROC303" }) }
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload?.catalogBackfill?.status).toBe("skipped_no_credentials");
    expect(payload?.note).toContain("does not publish changes");
  });
});


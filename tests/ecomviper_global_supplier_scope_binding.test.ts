import { beforeEach, describe, expect, it } from "vitest";
import {
  GLOBAL_SUPPLIER_SCOPE_USER_ID,
  clearRocktomicNormalizedStoreForTests,
  persistSupplierNormalizedSnapshot,
  type PersistedSupplierAssetsNormalized,
  type PersistedSupplierInventoryNormalized,
  type PersistedSupplierPricingNormalized,
  type PersistedSupplierProductNormalized,
  type PersistedSupplierSourceStatus,
  type PersistedSupplierSyncRun,
} from "@/lib/ecomviper/dropshipping/rocktomic-normalized-store";
import { clearRocktomicSourceIngestionCache } from "@/lib/ecomviper/dropshipping/rocktomic-source-ingestion";
import {
  getGlobalSupplierAssetsBySku,
  getGlobalSupplierInventoryBySku,
  getGlobalSupplierMembershipTiers,
  getGlobalSupplierPricingBySku,
  getGlobalSupplierProductBySku,
  getGlobalSupplierSyncSummary,
  matchPrimarySupplierBySkus,
} from "@/lib/ecomviper/suppliers/supplier-intelligence";
import {
  getMerchantSupplierMembershipTier,
  setMerchantSupplierMembershipTier,
} from "@/lib/ecomviper/settings/supplier-membership";

const SYNCED_AT = "2026-05-30T21:13:30.223Z";
const TIERS = ["Non Member Pricing", "Basic Plan $97/mo", "Scale Plan $497/mo"];

function product(sku: string, name: string, supplementFactsText: string | null): PersistedSupplierProductNormalized {
  return {
    sku,
    productName: name,
    category: "Supplements",
    labelSize: null,
    containerSize: "60 count",
    productWeight: null,
    productForm: null,
    supplementFactsRaw: supplementFactsText,
    supplementFactsText,
    servingSize: supplementFactsText ? "1 capsule" : null,
    servingsPerContainer: supplementFactsText ? "60" : null,
    activeIngredients: supplementFactsText ? ["Magnesium"] : [],
    amountPerServing: supplementFactsText ? "Magnesium 30mg" : null,
    otherIngredients: supplementFactsText ? "Rice flour" : null,
    ingredientHighlightsSource: supplementFactsText ? ["Magnesium"] : [],
    keyProductFeatures: ["Source-backed feature"],
    dietaryAttributes: ["Vegan"],
    manufacturingClaims: [],
    certifications: ["GMP Facility"],
    warnings: null,
    suggestedUse: null,
    coaUrl: `https://example.com/${sku}-COA.pdf`,
    coaStatus: "available",
    coaExtractionStatus: "extracted",
    coaExtractionError: null,
    labelTemplateUrl: "https://example.com/templates.html",
    mockupUrl: "https://example.com/mockup.html",
    sourceCatalogPage: null,
    sourceVersion: "global-test-source",
    extractionStatus: supplementFactsText ? "extracted" : "ocr_required",
    extractionErrors: supplementFactsText ? [] : ["Supplement Facts panel not extracted from PDF text layer"],
    lastSyncedAt: SYNCED_AT,
    rawPayload: {},
  };
}

function inventory(sku: string, status: string): PersistedSupplierInventoryNormalized {
  return {
    sku,
    inventoryStatusRaw: status,
    inventoryStatusNormalized: status,
    availabilityDisplay: status === "out_of_stock" ? "Currently Unavailable" : "Available",
    sourceReport: "Inventory Report",
    sourceUpdatedAt: SYNCED_AT,
    lastSyncedAt: SYNCED_AT,
    extractionStatus: "synced",
    extractionErrors: [],
  };
}

function pricing(sku: string, costs: Record<string, number>): PersistedSupplierPricingNormalized {
  return {
    sku,
    productName: sku,
    category: "Supplements",
    detectedMembershipTiers: TIERS,
    costsByMembershipTier: costs,
    msrp: 39.99,
    sourceSheet: "PLDS/MSRP",
    sourceTab: null,
    sourceRow: null,
    sourceVersion: "global-test-source",
    lastSyncedAt: SYNCED_AT,
    extractionStatus: "synced",
    extractionErrors: [],
  };
}

function assets(sku: string): PersistedSupplierAssetsNormalized {
  return {
    sku,
    labelTemplateUrl: "https://example.com/templates.html",
    mockupUrl: "https://example.com/mockup.html",
    supplementFactsAssetUrl: null,
    coaUrl: `https://example.com/${sku}-COA.pdf`,
    assetStatus: "available",
    lastSyncedAt: SYNCED_AT,
    extractionStatus: "synced",
    extractionErrors: [],
  };
}

function sourceStatuses(): PersistedSupplierSourceStatus[] {
  return [
    "catalog_pdf",
    "msrp_profit_margins_report",
    "plds_catalog",
    "inventory_report",
  ].map((sourceId) => ({
    sourceId,
    sourceLabel: sourceId,
    configured: true,
    fetchable: true,
    parsed: true,
    recordCount: 3,
    syncStatus: "synced",
    sourceUrl: null,
    fetchUrl: null,
    lastCheckedAt: SYNCED_AT,
    lastSuccessfulSyncAt: SYNCED_AT,
    lastError: null,
    metadata: {},
  })).concat({
    sourceId: "coa_repository",
    sourceLabel: "COA Repository",
    configured: false,
    fetchable: false,
    parsed: false,
    recordCount: 0,
    syncStatus: "never_synced",
    sourceUrl: null,
    fetchUrl: null,
    lastCheckedAt: SYNCED_AT,
    lastSuccessfulSyncAt: SYNCED_AT,
    lastError: "Source pending.",
    metadata: {},
  });
}

function syncRun(): PersistedSupplierSyncRun {
  return {
    syncStatus: "synced",
    productsParsedCount: 3,
    inventoryRecordsParsedCount: 3,
    pricingRecordsParsedCount: 3,
    assetRecordsParsedCount: 3,
    sourceDiagnostics: sourceStatuses(),
    attemptedAt: SYNCED_AT,
    completedAt: SYNCED_AT,
    lastError: "Source pending.",
  };
}

async function seedGlobalSupplierRecords() {
  await persistSupplierNormalizedSnapshot({
    userId: GLOBAL_SUPPLIER_SCOPE_USER_ID,
    supplierId: "rocktomic",
    products: [
      product("ROC720", "Premium Mineral Complex", null),
      product("ROC721", "Glutathione Complex", null),
      product("ROC817", "Sleep Formula", "Serving Size: 1 capsule"),
    ],
    inventoryRows: [
      inventory("ROC720", "in_stock"),
      inventory("ROC721", "out_of_stock"),
      inventory("ROC817", "unknown"),
    ],
    pricingRows: [
      pricing("ROC720", { "Non Member Pricing": 27.26, "Basic Plan $97/mo": 18.87, "Scale Plan $497/mo": 12.33 }),
      pricing("ROC721", { "Non Member Pricing": 24.66, "Basic Plan $97/mo": 17.07, "Scale Plan $497/mo": 16.9 }),
      pricing("ROC817", { "Non Member Pricing": 10.89, "Basic Plan $97/mo": 8.05, "Scale Plan $497/mo": 5.25 }),
    ],
    assetRows: [assets("ROC720"), assets("ROC721"), assets("ROC817")],
    sourceStatuses: sourceStatuses(),
    run: syncRun(),
  });
}

describe("EcomViper global supplier data scope", () => {
  beforeEach(async () => {
    clearRocktomicSourceIngestionCache();
    await clearRocktomicNormalizedStoreForTests();
    (globalThis as Record<string, unknown>).__ecomviper_supplier_membership_fallback__ = undefined;
  });

  it("reads global normalized records by SKU independently of merchant user/workspace", async () => {
    await seedGlobalSupplierRecords();

    expect(await getGlobalSupplierProductBySku("rocktomic", " roc-817 ")).toMatchObject({
      sku: "ROC817",
      productName: "Sleep Formula",
      supplementFactsText: "Serving Size: 1 capsule",
    });
    expect(await getGlobalSupplierPricingBySku("rocktomic", "ROC720")).toMatchObject({
      costsByMembershipTier: expect.objectContaining({ "Scale Plan $497/mo": 12.33 }),
    });
    expect(await getGlobalSupplierInventoryBySku("rocktomic", "ROC721")).toMatchObject({
      inventoryStatusNormalized: "out_of_stock",
    });
    expect(await getGlobalSupplierAssetsBySku("rocktomic", "ROC720")).toMatchObject({
      assetStatus: "available",
    });
  });

  it("keeps merchant membership tier user-scoped while applying it to global pricing", async () => {
    await seedGlobalSupplierRecords();
    await setMerchantSupplierMembershipTier({ userId: "merchant-a", supplierKey: "rocktomic", tier: "Scale Plan $497/mo" });
    await setMerchantSupplierMembershipTier({ userId: "merchant-b", supplierKey: "rocktomic", tier: "Basic Plan $97/mo" });

    expect(await getMerchantSupplierMembershipTier({ userId: "merchant-a", supplierKey: "rocktomic" })).toBe("Scale Plan $497/mo");
    expect(await getMerchantSupplierMembershipTier({ userId: "merchant-b", supplierKey: "rocktomic" })).toBe("Basic Plan $97/mo");

    const match = await matchPrimarySupplierBySkus(["ROC817"], {
      userId: "merchant-a",
      allowRefresh: false,
      triggerBackgroundRefresh: false,
    });
    expect(match.match.product?.pricing?.membershipTier).toBe("Scale Plan $497/mo");
    expect(match.match.product?.pricing?.wholesaleCost).toBe(5.25);
  });

  it("exposes global membership tiers and nonzero counts when optional COA repository is pending", async () => {
    await seedGlobalSupplierRecords();

    expect(await getGlobalSupplierMembershipTiers("rocktomic")).toEqual(TIERS);
    const summary = await getGlobalSupplierSyncSummary("rocktomic");
    expect(summary.productCount).toBe(3);
    expect(summary.pricingRecordCount).toBe(3);
    expect(summary.inventoryRecordCount).toBe(3);
    expect(summary.assetRecordCount).toBe(3);
    expect(summary.syncStatus).toBe("partially_synced");
    expect(summary.syncStatus).not.toBe("never_synced");
    expect(summary.syncStatus).not.toBe("sync_failed");
  });

  it("does not match seed fallback SKUs when normalized global records are absent", async () => {
    const match = await matchPrimarySupplierBySkus(["ROC948"], {
      userId: "merchant-a",
      allowRefresh: false,
      triggerBackgroundRefresh: false,
    });

    expect(match.match.status).toBe("unmatched");
    expect(match.match.product).toBeNull();
  });

  it("keeps inventory qualitative and does not mark source_unavailable when an inventory row exists", async () => {
    await seedGlobalSupplierRecords();
    const match = await matchPrimarySupplierBySkus(["ROC817"], {
      userId: "merchant-a",
      allowRefresh: false,
      triggerBackgroundRefresh: false,
    });

    expect(match.match.product?.inventoryStatus).toBe("unknown");
    expect(match.match.product?.sourceDiagnostics).toContain("normalized_inventory_record_status: found");
  });

  it("prefers current normalized records over a stale in-memory snapshot for product-facing reads", async () => {
    await seedGlobalSupplierRecords();
    await setMerchantSupplierMembershipTier({ userId: "merchant-a", supplierKey: "rocktomic", tier: "Scale Plan $497/mo" });

    const firstMatch = await matchPrimarySupplierBySkus(["ROC817"], {
      userId: "merchant-a",
      allowRefresh: false,
      triggerBackgroundRefresh: false,
    });
    expect(firstMatch.match.product?.productName).toBe("Sleep Formula");
    expect(firstMatch.match.product?.pricing?.wholesaleCost).toBe(5.25);

    await persistSupplierNormalizedSnapshot({
      userId: GLOBAL_SUPPLIER_SCOPE_USER_ID,
      supplierId: "rocktomic",
      products: [product("ROC817", "Sleep Formula Updated", "Serving Size: 1 capsule")],
      inventoryRows: [inventory("ROC817", "low_stock")],
      pricingRows: [pricing("ROC817", { "Scale Plan $497/mo": 4.95 })],
      assetRows: [assets("ROC817")],
      sourceStatuses: sourceStatuses(),
      run: syncRun(),
    });

    const secondMatch = await matchPrimarySupplierBySkus(["ROC817"], {
      userId: "merchant-a",
      allowRefresh: false,
      triggerBackgroundRefresh: false,
    });
    expect(secondMatch.match.product?.productName).toBe("Sleep Formula Updated");
    expect(secondMatch.match.product?.pricing?.wholesaleCost).toBe(4.95);
    expect(secondMatch.match.product?.inventoryStatus).toBe("low_stock");
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { normalizeWalmartProduct } from "@/lib/ecomviper/core/product-normalizer";
import {
  removeWalmartProductFromCatalogForUser,
  replaceWalmartProductsForUser,
} from "@/lib/ecomviper/walmart/walmart-products";

const authMocks = vi.hoisted(() => ({
  requireSignedInUser: vi.fn(),
}));

vi.mock("@/lib/auth/requireSignedInUser", () => ({
  requireSignedInUser: authMocks.requireSignedInUser,
}));

function buildProduct(sku: string) {
  return normalizeWalmartProduct({
    sku,
    title: `Product ${sku}`,
    brand: "Walmart Brand",
    price: 19.99,
    inventoryQuantity: 8,
    inventoryStatus: "known",
    imageUrl: "",
    imageStatus: "catalog_missing",
    imageStatusMessage: "Image not provided by Walmart catalog",
    imageSource: "none",
    shortDescription: "Short description",
    description: "Long description",
    bulletPoints: ["Bullet 1"],
    attributes: { size: "M" },
  });
}

describe("Walmart inventory/pricing pages use durable per-user product source", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as Record<string, unknown>).__ecomviper_walmart_store__ = undefined;
    (globalThis as Record<string, unknown>).__ecomviper_walmart_product_fallback__ = undefined;
    (globalThis as Record<string, unknown>).__ecomviper_walmart_product_tables_checked__ = undefined;
  });

  it("renders selector options from persisted products even when runtime store is empty", async () => {
    const userId = "selector_user";
    await replaceWalmartProductsForUser({
      userId,
      products: [buildProduct("ROC808")],
      importedAt: new Date().toISOString(),
    });

    (globalThis as Record<string, unknown>).__ecomviper_walmart_store__ = undefined;
    authMocks.requireSignedInUser.mockResolvedValue({ userId, unauthorizedResponse: null });

    const InventoryPage = (await import("@/app/apps/ecomviper/walmart/inventory/page")).default;
    const PricingPage = (await import("@/app/apps/ecomviper/walmart/pricing/page")).default;
    const inventoryHtml = renderToStaticMarkup(await InventoryPage());
    const pricingHtml = renderToStaticMarkup(await PricingPage());

    expect(inventoryHtml).toContain("Select product / SKU");
    expect(inventoryHtml).toContain('value="ROC808"');
    expect(pricingHtml).toContain("Select product / SKU");
    expect(pricingHtml).toContain('value="ROC808"');
  });

  it("excludes locally removed products from inventory and pricing selectors", async () => {
    const userId = "selector_remove_user";
    await replaceWalmartProductsForUser({
      userId,
      products: [buildProduct("ROC808"), buildProduct("OLD-SKU-1")],
      importedAt: new Date().toISOString(),
    });

    await removeWalmartProductFromCatalogForUser({
      userId,
      sku: "OLD-SKU-1",
    });

    (globalThis as Record<string, unknown>).__ecomviper_walmart_store__ = undefined;
    authMocks.requireSignedInUser.mockResolvedValue({ userId, unauthorizedResponse: null });

    const InventoryPage = (await import("@/app/apps/ecomviper/walmart/inventory/page")).default;
    const PricingPage = (await import("@/app/apps/ecomviper/walmart/pricing/page")).default;
    const inventoryHtml = renderToStaticMarkup(await InventoryPage());
    const pricingHtml = renderToStaticMarkup(await PricingPage());

    expect(inventoryHtml).toContain('value="ROC808"');
    expect(inventoryHtml).not.toContain('value="OLD-SKU-1"');
    expect(pricingHtml).toContain('value="ROC808"');
    expect(pricingHtml).not.toContain('value="OLD-SKU-1"');
  });
});

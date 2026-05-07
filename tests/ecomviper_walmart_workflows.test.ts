import { beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { listWalmartProducts } from "@/lib/ecomviper/walmart/walmart-products";
import { filterWalmartProducts } from "@/lib/ecomviper/walmart/walmart-product-filters";
import { POST as createDraftRoute, GET as listDraftsRoute } from "@/app/api/ecomviper/walmart/drafts/route";
import { GET as productListRoute } from "@/app/api/ecomviper/walmart/products/route";

describe("EcomViper Walmart workflows", () => {
  beforeEach(() => {
    (globalThis as Record<string, unknown>).__ecomviper_walmart_store__ = undefined;
    (globalThis as Record<string, unknown>).__ecomviper_activity_store__ = undefined;
  });

  it("product table source renders mock products and supports search/filter helpers", async () => {
    const products = listWalmartProducts();
    expect(products.length).toBeGreaterThan(0);

    const bySearch = filterWalmartProducts(products, { query: "omega", filter: "all" });
    expect(bySearch.some((product) => product.sku === "OPA-OMEGA3-120")).toBe(true);

    const attention = filterWalmartProducts(products, { filter: "needs_attention" });
    expect(attention.some((product) => product.sku === "OPA-SLEEP-60")).toBe(true);

    const apiReq = new NextRequest("http://localhost/api/ecomviper/walmart/products?search=omega&filter=all");
    const apiResp = await productListRoute(apiReq);
    const apiPayload = await apiResp.json();
    expect(apiPayload.count).toBeGreaterThan(0);
  });

  it("product editor draft path saves staged draft state", async () => {
    const createReq = new NextRequest("http://localhost/api/ecomviper/walmart/drafts", {
      method: "POST",
      body: JSON.stringify({
        sku: "OPA-OMEGA3-120",
        draftPayload: {
          title: "OPA Nutrition Omega-3 Daily Wellness Softgels 120ct | Updated",
          price: 42.99,
          inventoryQuantity: 40,
        },
      }),
    });

    const createResp = await createDraftRoute(createReq);
    expect(createResp.status).toBe(201);
    const createPayload = await createResp.json();
    expect(createPayload.draft?.sku).toBe("OPA-OMEGA3-120");
    expect(createPayload.draft?.status).toMatch(/draft|validated/);

    const listResp = await listDraftsRoute(new NextRequest("http://localhost/api/ecomviper/walmart/drafts"));
    const listPayload = await listResp.json();
    expect(Array.isArray(listPayload.drafts)).toBe(true);
    expect(listPayload.drafts.some((draft: { sku: string }) => draft.sku === "OPA-OMEGA3-120")).toBe(true);
  });
});

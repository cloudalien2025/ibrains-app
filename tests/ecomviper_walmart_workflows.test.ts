import { beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { normalizeWalmartProduct } from "@/lib/ecomviper/core/product-normalizer";
import { listWalmartProducts } from "@/lib/ecomviper/walmart/walmart-products";
import { filterWalmartProducts } from "@/lib/ecomviper/walmart/walmart-product-filters";
import { POST as createDraftRoute, GET as listDraftsRoute } from "@/app/api/ecomviper/walmart/drafts/route";
import { GET as productListRoute } from "@/app/api/ecomviper/walmart/products/route";
import { replaceProducts } from "@/lib/ecomviper/walmart/walmart-store";

describe("EcomViper Walmart workflows", () => {
  beforeEach(() => {
    (globalThis as Record<string, unknown>).__ecomviper_walmart_store__ = undefined;
    (globalThis as Record<string, unknown>).__ecomviper_activity_store__ = undefined;
    (globalThis as Record<string, unknown>).__ecomviper_walmart_token_cache__ = undefined;
    (globalThis as Record<string, unknown>).__ecomviper_walmart_connection_fallback__ = undefined;
  });

  it("product table source starts empty and product API returns zero records", async () => {
    const products = listWalmartProducts();
    expect(products.length).toBe(0);

    const bySearch = filterWalmartProducts(products, { query: "omega", filter: "all" });
    expect(bySearch.length).toBe(0);

    const apiReq = new NextRequest("http://localhost/api/ecomviper/walmart/products?search=omega&filter=all");
    const apiResp = await productListRoute(apiReq);
    const apiPayload = await apiResp.json();
    expect(apiPayload.count).toBe(0);
  });

  it("product editor draft path saves staged draft state for imported product", async () => {
    const product = normalizeWalmartProduct({
      sku: "OPA-OMEGA3-120",
      title: "OPA Nutrition Omega-3 Daily Wellness Softgels 120ct",
      brand: "OPA Nutrition",
      price: 39.99,
      inventoryQuantity: 42,
      imageUrl: "https://images.example.com/opa-omega3-120.jpg",
      attributes: { serving_size: "2 softgels" },
      description: "Daily wellness supplement.",
      shortDescription: "Daily wellness support",
      bulletPoints: ["Premium quality"],
    });

    replaceProducts([product], new Date().toISOString());

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

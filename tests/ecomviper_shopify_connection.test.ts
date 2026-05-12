import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { normalizeShopifyStoreDomain } from "@/lib/ecomviper/shopify/shopify-domain";
import { POST as shopifySaveRoute, GET as shopifyConnectStatusRoute } from "@/app/api/ecomviper/shopify/connect/route";
import { POST as shopifyTestRoute } from "@/app/api/ecomviper/shopify/connect/test/route";

const authMocks = vi.hoisted(() => ({
  requireSignedInUser: vi.fn(),
}));

vi.mock("@/lib/auth/requireSignedInUser", () => ({
  requireSignedInUser: authMocks.requireSignedInUser,
}));

const TEST_ENCRYPTION_KEY = Buffer.alloc(32, 11).toString("base64");

describe("Shopify connection config", () => {
  beforeEach(() => {
    (globalThis as Record<string, unknown>).__ecomviper_shopify_connection_fallback__ = undefined;
    (globalThis as Record<string, unknown>).__ecomviper_shopify_product_fallback__ = undefined;
    (globalThis as Record<string, unknown>).__ecomviper_shopify_product_tables_checked__ = undefined;

    authMocks.requireSignedInUser.mockReset();
    authMocks.requireSignedInUser.mockResolvedValue({ userId: "user_ibrains", unauthorizedResponse: null });

    process.env.ECOMVIPER_CREDENTIAL_ENCRYPTION_KEY = TEST_ENCRYPTION_KEY;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.ECOMVIPER_CREDENTIAL_ENCRYPTION_KEY;
    delete process.env.ECOMVIPER_SHOPIFY_ALLOW_CUSTOM_DOMAIN;
  });

  it("normalizes Shopify store domains and rejects non-Shopify hosts by default", () => {
    expect(normalizeShopifyStoreDomain("opanutrition.myshopify.com")).toBe("opanutrition.myshopify.com");
    expect(normalizeShopifyStoreDomain("https://opanutrition.myshopify.com")).toBe("opanutrition.myshopify.com");
    expect(normalizeShopifyStoreDomain("https://example.com")).toBeNull();
  });

  it("returns validation error when saving without domain/token", async () => {
    const req = new NextRequest("http://localhost/api/ecomviper/shopify/connect", {
      method: "POST",
      body: JSON.stringify({ storeDomain: "", adminApiToken: "" }),
    });

    const response = await shopifySaveRoute(req);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error?.code).toBe("VALIDATION_ERROR");
  });

  it("tests Shopify connection successfully and records success diagnostic event", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            shop: { id: "gid://shopify/Shop/1", name: "OPA Nutrition" },
            products: { nodes: [{ id: "gid://shopify/Product/1", title: "Omega" }] },
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json", "X-Request-Id": "req_shopify_1" } }
      )
    );

    const req = new NextRequest("http://localhost/api/ecomviper/shopify/connect/test", {
      method: "POST",
      body: JSON.stringify({
        storeDomain: "opanutrition.myshopify.com",
        adminApiToken: "shpat_live_token",
        apiVersion: "2025-10",
      }),
    });

    const response = await shopifyTestRoute(req);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.diagnosticEvent).toBe("shopify_connection_test_success");
    expect(payload.requiredScope).toBe("read_products");
    expect(payload.storeDomain).toBe("opanutrition.myshopify.com");
  });

  it("flags missing read_products scope during connection test", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            shop: { id: "gid://shopify/Shop/1", name: "OPA Nutrition" },
            products: null,
          },
          errors: [
            {
              message: "Access denied for products field. Required access: read_products.",
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const req = new NextRequest("http://localhost/api/ecomviper/shopify/connect/test", {
      method: "POST",
      body: JSON.stringify({
        storeDomain: "opanutrition.myshopify.com",
        adminApiToken: "shpat_scope_missing",
      }),
    });

    const response = await shopifyTestRoute(req);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(false);
    expect(payload.missingScope).toBe(true);
    expect(payload.diagnosticEvent).toBe("shopify_connection_missing_scope");
  });

  it("redacts Admin API token in save/status responses", async () => {
    const token = "shpat_super_secret_token";

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            shop: { id: "gid://shopify/Shop/1", name: "OPA Nutrition" },
            products: { nodes: [{ id: "gid://shopify/Product/1", title: "Omega" }] },
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const saveReq = new NextRequest("http://localhost/api/ecomviper/shopify/connect", {
      method: "POST",
      body: JSON.stringify({
        storeDomain: "opanutrition.myshopify.com",
        adminApiToken: token,
        apiVersion: "2025-10",
      }),
    });

    const saveResponse = await shopifySaveRoute(saveReq);
    const savePayload = await saveResponse.json();

    expect(saveResponse.status).toBe(200);
    expect(savePayload.maskedAccessToken).not.toContain("shpat_super");
    expect(JSON.stringify(savePayload)).not.toContain(token);

    const statusResponse = await shopifyConnectStatusRoute();
    const statusPayload = await statusResponse.json();

    expect(statusPayload.maskedAccessToken).not.toContain("shpat_super");
    expect(JSON.stringify(statusPayload)).not.toContain(token);
  });

  it("rejects unauthenticated Shopify test requests", async () => {
    authMocks.requireSignedInUser.mockResolvedValueOnce({
      userId: null,
      unauthorizedResponse: NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Sign-in required" } }, { status: 401 }),
    });

    const req = new NextRequest("http://localhost/api/ecomviper/shopify/connect/test", {
      method: "POST",
      body: JSON.stringify({
        storeDomain: "opanutrition.myshopify.com",
      }),
    });

    const response = await shopifyTestRoute(req);
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.error?.code).toBe("UNAUTHORIZED");
  });
});

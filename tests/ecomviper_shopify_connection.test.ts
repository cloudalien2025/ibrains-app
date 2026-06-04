import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { normalizeShopifyStoreDomain } from "@/lib/ecomviper/shopify/shopify-domain";
import {
  resolveShopifyAccessTokenForUser,
  saveShopifyConnectionForUser,
} from "@/lib/ecomviper/shopify/shopify-connection";
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
    (globalThis as Record<string, unknown>).__ecomviper_shopify_access_token_cache__ = undefined;
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

  it("normalizes Shopify store domains, including bare store handles", () => {
    expect(normalizeShopifyStoreDomain("opanutrition.myshopify.com")).toBe("opanutrition.myshopify.com");
    expect(normalizeShopifyStoreDomain("https://opanutrition.myshopify.com")).toBe("opanutrition.myshopify.com");
    expect(normalizeShopifyStoreDomain("opanutrition")).toBe("opanutrition.myshopify.com");
    expect(normalizeShopifyStoreDomain("https://example.com")).toBeNull();
  });

  it("returns validation error when saving without domain/client credentials", async () => {
    const req = new NextRequest("http://localhost/api/ecomviper/shopify/connect", {
      method: "POST",
      body: JSON.stringify({ storeDomain: "", clientId: "", clientSecret: "" }),
    });

    const response = await shopifySaveRoute(req);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error?.code).toBe("VALIDATION_ERROR");
  });

  it("tests Shopify connection successfully using client credentials and returns safe metadata", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: "shopify_access_token_live",
            scope: "read_products,write_orders",
            expires_in: 3600,
          }),
          { status: 200, headers: { "Content-Type": "application/json", "X-Request-Id": "req_token_1" } }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              shop: { id: "gid://shopify/Shop/1", name: "OPA Nutrition", myshopifyDomain: "opanutrition.myshopify.com" },
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
        clientId: "shopify_client_123456",
        clientSecret: "shopify_secret_super_long",
      }),
    });

    const response = await shopifyTestRoute(req);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.diagnosticEvent).toBe("shopify_connection_test_success");
    expect(payload.requiredScope).toBe("read_products");
    expect(payload.tokenStatus).toBe("valid");
    expect(payload.storeDomain).toBe("opanutrition.myshopify.com");
    expect(JSON.stringify(payload)).not.toContain("shopify_access_token_live");
    expect(JSON.stringify(payload)).not.toContain("shopify_secret_super_long");
  });

  it("saves Shopify credentials when apiVersion is omitted and defaults version internally", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: "shopify_access_token_live",
            scope: "read_products,read_product_listings",
            expires_in: 3600,
          }),
          { status: 200, headers: { "Content-Type": "application/json", "X-Request-Id": "req_token_2" } }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              shop: { id: "gid://shopify/Shop/1", name: "OPA Nutrition", myshopifyDomain: "opanutrition.myshopify.com" },
              products: { nodes: [{ id: "gid://shopify/Product/1", title: "Omega" }] },
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json", "X-Request-Id": "req_shopify_2" } }
        )
      );

    const saveReq = new NextRequest("http://localhost/api/ecomviper/shopify/connect", {
      method: "POST",
      body: JSON.stringify({
        storeDomain: "opanutrition.myshopify.com",
        clientId: "shopify_client_123456",
        clientSecret: "shopify_secret_super_long",
      }),
    });

    const saveResponse = await shopifySaveRoute(saveReq);
    const savePayload = await saveResponse.json();

    expect(saveResponse.status).toBe(200);
    expect(savePayload.ok).toBe(true);
    expect(savePayload.apiVersion).toBe("2025-10");
    expect(savePayload.tokenStatus).toBe("valid");
  });

  it("flags missing read_products scope during connection test", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: "shopify_access_scope_missing",
            scope: "read_orders",
            expires_in: 3600,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
      .mockResolvedValueOnce(
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
        clientId: "shopify_client_123456",
        clientSecret: "shopify_secret_scope_missing",
      }),
    });

    const response = await shopifyTestRoute(req);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(false);
    expect(payload.missingScope).toBe(true);
    expect(payload.diagnosticEvent).toBe("shopify_connection_missing_scope");
    expect(payload.lastApiError?.code).toBe("insufficient_scope");
  });

  it("returns safe token-exchange errors for invalid client credentials", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({ error: "invalid_client", error_description: "Invalid client credentials" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      )
    );

    const req = new NextRequest("http://localhost/api/ecomviper/shopify/connect/test", {
      method: "POST",
      body: JSON.stringify({
        storeDomain: "opanutrition.myshopify.com",
        clientId: "wrong_client_id",
        clientSecret: "wrong_client_secret",
      }),
    });

    const response = await shopifyTestRoute(req);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(false);
    expect(payload.diagnosticEvent).toBe("shopify_connection_token_exchange_failed");
    expect(payload.lastApiError?.code).toBe("invalid_client_credentials");
    expect(JSON.stringify(payload)).not.toContain("wrong_client_secret");
  });

  it("returns explicit created-vs-installed guidance for app_not_installed failures", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({ errors: "Application cannot be found for this store." }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      )
    );

    const req = new NextRequest("http://localhost/api/ecomviper/shopify/connect/test", {
      method: "POST",
      body: JSON.stringify({
        storeDomain: "opanutrition.myshopify.com",
        clientId: "shopify_client_123456",
        clientSecret: "wrong_or_not_installed",
      }),
    });

    const response = await shopifyTestRoute(req);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(false);
    expect(payload.lastApiError?.code).toBe("app_not_installed");
    expect(payload.lastApiError?.message).toContain("created but not installed");
    expect(payload.lastApiError?.message).toContain("Release the app version");
    expect(payload.lastApiError?.message).toContain("myshopify.com domain");
  });

  it("redacts Shopify client secret and access token in save/status responses", async () => {
    const clientSecret = "shopify_secret_super_secret_token";

    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: "shopify_exchange_token_super_secret",
            scope: "read_products",
            expires_in: 1800,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              shop: { id: "gid://shopify/Shop/1", name: "OPA Nutrition", myshopifyDomain: "opanutrition.myshopify.com" },
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
        clientId: "shopify_client_123456",
        clientSecret,
        apiVersion: "2025-10",
      }),
    });

    const saveResponse = await shopifySaveRoute(saveReq);
    const savePayload = await saveResponse.json();

    expect(saveResponse.status).toBe(200);
    expect(savePayload.maskedClientId).toMatch(/^sh\*\*\*/);
    expect(savePayload.clientSecretStored).toBe(true);
    expect(JSON.stringify(savePayload)).not.toContain(clientSecret);
    expect(JSON.stringify(savePayload)).not.toContain("shopify_exchange_token_super_secret");

    const statusResponse = await shopifyConnectStatusRoute();
    const statusPayload = await statusResponse.json();

    expect(statusPayload.clientSecretStored).toBe(true);
    expect(statusPayload.maskedClientId).toMatch(/^sh\*\*\*/);
    expect(JSON.stringify(statusPayload)).not.toContain(clientSecret);
  });

  it("refreshes exchanged token when it is near expiry", async () => {
    await saveShopifyConnectionForUser({
      userId: "user_ibrains",
      storeDomain: "opanutrition.myshopify.com",
      clientId: "shopify_client_123456",
      clientSecret: "shopify_secret_123456",
      apiVersion: "2025-10",
    });

    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: "token_short_lived_1",
            scope: "read_products",
            expires_in: 1,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: "token_short_lived_2",
            scope: "read_products",
            expires_in: 3600,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );

    const first = await resolveShopifyAccessTokenForUser("user_ibrains");
    const second = await resolveShopifyAccessTokenForUser("user_ibrains");

    expect(first.accessToken).toBe("token_short_lived_1");
    expect(second.accessToken).toBe("token_short_lived_2");
  });

  it("loads existing saved configs that already include apiVersion", async () => {
    await saveShopifyConnectionForUser({
      userId: "user_ibrains",
      storeDomain: "opanutrition.myshopify.com",
      clientId: "shopify_client_123456",
      clientSecret: "shopify_secret_legacy_config",
      apiVersion: "2024-10",
    });

    const statusResponse = await shopifyConnectStatusRoute();
    const statusPayload = await statusResponse.json();

    expect(statusResponse.status).toBe(200);
    expect(statusPayload.storeDomain).toBe("opanutrition.myshopify.com");
    expect(statusPayload.apiVersion).toBe("2024-10");
    expect(statusPayload.maskedClientId).toMatch(/^sh\*\*\*/);
    expect(statusPayload.clientSecretStored).toBe(true);
  });

  it("supports legacy admin token mode via adminApiToken", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: {
            shop: { id: "gid://shopify/Shop/1", name: "OPA Nutrition", myshopifyDomain: "opanutrition.myshopify.com" },
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
        adminApiToken: "shpat_live_token_1234",
      }),
    });

    const saveResponse = await shopifySaveRoute(saveReq);
    const payload = await saveResponse.json();

    expect(saveResponse.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.authMode).toBe("legacy_admin_token");
    expect(payload.connected).toBe(true);
    expect(JSON.stringify(payload)).not.toContain("shpat_live_token_1234");
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

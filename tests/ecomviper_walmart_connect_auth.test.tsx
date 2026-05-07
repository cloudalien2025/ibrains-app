import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { renderToStaticMarkup } from "react-dom/server";
import WalmartConnectClient from "@/app/apps/ecomviper/walmart/connect/connect-client";
import { POST as testConnectionRoute } from "@/app/api/ecomviper/walmart/connect/test/route";
import { requestServerSideWalmartToken } from "@/lib/ecomviper/walmart/walmart-auth";
import type { WalmartConnectionHealth } from "@/lib/ecomviper/walmart/walmart-types";

function buildInitialHealth(environment: "sandbox" | "production"): WalmartConnectionHealth {
  return {
    connectionStatus: "not_connected",
    summary: {
      accountNickname: "OPA Nutrition Walmart",
      environment,
      region: "US",
      maskedClientId: "ab***7890",
      clientSecretStored: false,
      lastSuccessfulAuth: null,
      lastApiError: null,
      tokenStatus: "unknown",
      permissionChecks: [
        { id: "catalog_read", label: "Items / Catalog read", state: "unknown" },
        { id: "item_maintenance", label: "Item maintenance / content update", state: "unknown" },
        { id: "inventory_update", label: "Inventory update", state: "unknown" },
        { id: "pricing_update", label: "Pricing update", state: "unknown" },
        { id: "feeds_submit_read", label: "Feeds submit/read", state: "unknown" },
        { id: "feed_error_reports", label: "Feed error reports", state: "unknown" },
      ],
      credentialStorageMode: "memory",
      mode: "live-ready",
    },
    lastSuccessfulApiCall: null,
    lastApiError: null,
  };
}

describe("EcomViper Walmart connect auth", () => {
  beforeEach(() => {
    (globalThis as Record<string, unknown>).__ecomviper_walmart_store__ = undefined;
    (globalThis as Record<string, unknown>).__ecomviper_activity_store__ = undefined;
    vi.restoreAllMocks();
    delete process.env.WALMART_CLIENT_ID;
    delete process.env.WALMART_CLIENT_SECRET;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("connect/test uses submitted credentials and production environment for OAuth", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ access_token: "wm_live_access_token", expires_in: 900 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    process.env.WALMART_CLIENT_ID = "env_client_id_should_not_be_used";
    process.env.WALMART_CLIENT_SECRET = "env_client_secret_should_not_be_used";

    const req = new NextRequest("http://localhost/api/ecomviper/walmart/connect/test", {
      method: "POST",
      body: JSON.stringify({
        accountNickname: "OPA Nutrition Walmart",
        clientId: "submitted_client_id",
        clientSecret: "submitted_client_secret",
        environment: "production",
        marketplaceRegion: "US",
      }),
    });

    const resp = await testConnectionRoute(req);
    const payload = await resp.json();

    expect(payload.ok).toBe(true);
    expect(payload.status).toBe("connected");
    expect(payload.environment).toBe("production");
    expect(payload.marketplaceRegion).toBe("US");

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];

    expect(url).toBe("https://marketplace.walmartapis.com/v3/token");
    expect(init.method).toBe("POST");

    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe(
      `Basic ${Buffer.from("submitted_client_id:submitted_client_secret").toString("base64")}`
    );
    expect(headers.Accept).toBe("application/json");
    expect(headers["Content-Type"]).toBe("application/x-www-form-urlencoded");
    expect(headers["WM_SVC.NAME"]).toBe("Walmart Marketplace");
    expect(typeof headers["WM_QOS.CORRELATION_ID"]).toBe("string");
    expect((init.body as string) ?? "").toBe("grant_type=client_credentials");
  });

  it("token request returns sanitized failure details and never leaks secret/token/auth", async () => {
    const secret = "submitted_secret_do_not_leak";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          error: "invalid_client",
          error_description: "the submitted secret is invalid",
        }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }
      )
    );

    const req = new NextRequest("http://localhost/api/ecomviper/walmart/connect/test", {
      method: "POST",
      body: JSON.stringify({
        accountNickname: "OPA Nutrition Walmart",
        clientId: "submitted_client",
        clientSecret: secret,
        environment: "sandbox",
        marketplaceRegion: "US",
      }),
    });

    const resp = await testConnectionRoute(req);
    const payload = await resp.json();
    const serialized = JSON.stringify(payload);

    expect(payload.ok).toBe(false);
    expect(payload.status).toBe("not_connected");
    expect(payload.tokenStatus).toBe("invalid");
    expect(payload.lastApiError?.code).toBe("WALMART_TOKEN_HTTP_401");
    expect(payload.lastApiError?.message).toContain("HTTP 401 unauthorized");
    expect(serialized).not.toContain(secret);
    expect(serialized).not.toContain("wm_live_access_token");
    expect(serialized).not.toContain("Authorization");
  });

  it("missing credentials returns explicit safe error and skips network call", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const result = await requestServerSideWalmartToken({
      clientId: "",
      clientSecret: "",
      environment: "sandbox",
      marketplaceRegion: "US",
    });

    expect(result.ok).toBe(false);
    expect(result.lastError?.code).toBe("MISSING_CREDENTIALS");
    expect(result.lastError?.message).toBe("Missing Walmart Client ID or Client Secret.");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("connect status panel can render Production environment from response model", () => {
    const html = renderToStaticMarkup(
      <WalmartConnectClient initialHealth={buildInitialHealth("production")} />
    );

    expect(html).toContain("Environment");
    expect(html).toContain("production");
  });
});

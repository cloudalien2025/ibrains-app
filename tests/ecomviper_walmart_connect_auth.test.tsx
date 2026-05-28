import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { renderToStaticMarkup } from "react-dom/server";
import WalmartConnectClient from "@/app/optiwal/connect/connect-client";
import { POST as testConnectionRoute } from "@/app/api/ecomviper/walmart/connect/test/route";
import { POST as saveConnectionRoute } from "@/app/api/ecomviper/walmart/connect/save/route";
import { GET as healthRoute } from "@/app/api/ecomviper/walmart/health/route";
import { requestServerSideWalmartToken } from "@/lib/ecomviper/walmart/walmart-auth";
import * as walmartProducts from "@/lib/ecomviper/walmart/walmart-products";
import type { WalmartConnectionHealth } from "@/lib/ecomviper/walmart/walmart-types";

const authMocks = vi.hoisted(() => ({
  requireSignedInUser: vi.fn(),
}));

vi.mock("@/lib/auth/requireSignedInUser", () => ({
  requireSignedInUser: authMocks.requireSignedInUser,
}));

const TEST_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");

function buildInitialHealth(): WalmartConnectionHealth {
  return {
    connectionStatus: "not_connected",
    summary: {
      accountNickname: "OPA Nutrition Walmart",
      environment: "production",
      region: "US",
      maskedClientId: "Not configured",
      clientSecretStored: false,
      lastSuccessfulAuth: null,
      lastSuccessfulRead: null,
      lastApiError: null,
      tokenStatus: "unknown",
      safeReadStatus: "unknown",
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
      diagnostic: {
        environment: "production",
        baseUrl: "https://marketplace.walmartapis.com",
        tokenStatus: "unknown",
        safeReadStatus: "unknown",
        httpStatus: null,
        correlationId: null,
        walmartErrorCode: null,
        walmartErrorMessage: null,
        timestamp: null,
      },
    },
    lastSuccessfulApiCall: null,
    lastApiError: null,
  };
}

describe("EcomViper Walmart connect auth", () => {
  beforeEach(() => {
    (globalThis as Record<string, unknown>).__ecomviper_walmart_store__ = undefined;
    (globalThis as Record<string, unknown>).__ecomviper_activity_store__ = undefined;
    (globalThis as Record<string, unknown>).__ecomviper_walmart_token_cache__ = undefined;
    (globalThis as Record<string, unknown>).__ecomviper_walmart_connection_fallback__ = undefined;

    vi.restoreAllMocks();
    delete process.env.WALMART_CLIENT_ID;
    delete process.env.WALMART_CLIENT_SECRET;
    process.env.ECOMVIPER_CREDENTIAL_ENCRYPTION_KEY = TEST_ENCRYPTION_KEY;
    authMocks.requireSignedInUser.mockReset();
    authMocks.requireSignedInUser.mockResolvedValue({ userId: "user_ibrains", unauthorizedResponse: null });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.ECOMVIPER_CREDENTIAL_ENCRYPTION_KEY;
  });

  it("connect/test uses submitted credentials with production token URL and production safe read URL", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: "wm_live_access_token", expires_in: 900 }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ elements: [] }), {
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
        marketplaceRegion: "US",
      }),
    });

    const resp = await testConnectionRoute(req);
    const payload = await resp.json();

    expect(payload.status).toBe("connected");
    expect(payload.environment).toBe("production");
    expect(payload.marketplaceRegion).toBe("US");

    expect(fetchSpy).toHaveBeenCalledTimes(2);

    const [tokenUrl, tokenInit] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(tokenUrl).toBe("https://marketplace.walmartapis.com/v3/token");
    expect(tokenInit.method).toBe("POST");

    const tokenHeaders = tokenInit.headers as Record<string, string>;
    expect(tokenHeaders.Authorization).toBe(
      `Basic ${Buffer.from("submitted_client_id:submitted_client_secret").toString("base64")}`
    );
    expect(tokenHeaders.Accept).toBe("application/json");
    expect(tokenHeaders["Content-Type"]).toBe("application/x-www-form-urlencoded");
    expect(tokenHeaders["WM_SVC.NAME"]).toBe("Walmart Marketplace");
    expect(typeof tokenHeaders["WM_QOS.CORRELATION_ID"]).toBe("string");
    expect((tokenInit.body as string) ?? "").toBe("grant_type=client_credentials");

    const [safeReadUrl, safeReadInit] = fetchSpy.mock.calls[1] as [string, RequestInit];
    expect(safeReadUrl).toContain("https://marketplace.walmartapis.com/");
    expect(safeReadUrl).not.toContain("sandbox.walmartapis.com");
    expect(safeReadInit.method).toBe("GET");
    const safeReadHeaders = safeReadInit.headers as Record<string, string>;
    expect(safeReadHeaders["WM_SEC.ACCESS_TOKEN"]).toBe("wm_live_access_token");
    expect(safeReadHeaders["WM_SVC.NAME"]).toBe("Walmart Marketplace");
  });

  it("save rejects unauthenticated requests with a clear 401 and skips Walmart calls", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    authMocks.requireSignedInUser.mockResolvedValueOnce({
      userId: null,
      unauthorizedResponse: NextResponse.json(
        {
          error: {
            code: "UNAUTHORIZED",
            message: "Sign-in required",
          },
        },
        { status: 401 }
      ),
    });

    const req = new NextRequest("http://localhost/api/ecomviper/walmart/connect/save", {
      method: "POST",
      body: JSON.stringify({
        action: "save",
        accountNickname: "OPA Nutrition Walmart",
        clientId: "submitted_client_id",
        clientSecret: "submitted_client_secret",
        marketplaceRegion: "US",
      }),
    });

    const resp = await saveConnectionRoute(req);
    const payload = await resp.json();

    expect(resp.status).toBe(401);
    expect(payload.error?.code).toBe("UNAUTHORIZED");
    expect(payload.error?.message).toBe("Please sign in before saving Walmart credentials.");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("connect/test rejects unauthenticated requests with a clear 401", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    authMocks.requireSignedInUser.mockResolvedValueOnce({
      userId: null,
      unauthorizedResponse: NextResponse.json(
        {
          error: {
            code: "UNAUTHORIZED",
            message: "Sign-in required",
          },
        },
        { status: 401 }
      ),
    });

    const req = new NextRequest("http://localhost/api/ecomviper/walmart/connect/test", {
      method: "POST",
      body: JSON.stringify({
        accountNickname: "OPA Nutrition Walmart",
        clientId: "submitted_client_id",
        clientSecret: "submitted_client_secret",
        marketplaceRegion: "US",
      }),
    });

    const resp = await testConnectionRoute(req);
    const payload = await resp.json();

    expect(resp.status).toBe(401);
    expect(payload.error?.code).toBe("UNAUTHORIZED");
    expect(payload.error?.message).toBe("Please sign in before testing Walmart credentials.");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("save persists credentials and test can use stored credentials when form fields are blank", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = typeof input === "string" ? input : input.url;
      if (url.includes("/v3/token")) {
        return new Response(JSON.stringify({ access_token: "wm_live_access_token", expires_in: 900 }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ elements: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    const secret = "stored_secret_123";

    const saveReq = new NextRequest("http://localhost/api/ecomviper/walmart/connect/save", {
      method: "POST",
      body: JSON.stringify({
        action: "save",
        accountNickname: "OPA Nutrition Walmart",
        clientId: "stored_client_id",
        clientSecret: secret,
        marketplaceRegion: "US",
      }),
    });

    const saveResp = await saveConnectionRoute(saveReq);
    const savePayload = await saveResp.json();

    expect(savePayload.maskedClientId).toBe("st***t_id");
    expect(savePayload.clientSecretStored).toBe(true);
    expect(savePayload.message).toBe("Credentials saved securely.");
    expect(JSON.stringify(savePayload)).not.toContain(secret);
    expect(JSON.stringify(savePayload)).not.toContain("encryptedClientSecret");

    fetchSpy.mockClear();

    const testReq = new NextRequest("http://localhost/api/ecomviper/walmart/connect/test", {
      method: "POST",
      body: JSON.stringify({
        accountNickname: "OPA Nutrition Walmart",
        clientId: "",
        clientSecret: "",
        marketplaceRegion: "US",
      }),
    });

    const testResp = await testConnectionRoute(testReq);
    const testPayload = await testResp.json();

    expect(testPayload.status).toBe("connected");
    expect(testPayload.clientSecretStored).toBe(true);
    expect(testPayload.maskedClientId).toBe("st***t_id");
    expect(testPayload.tokenStatus).toBe("valid");
    expect(testPayload.safeReadStatus).toBe("valid");
    expect(typeof testPayload.lastSuccessfulAuth).toBe("string");
    expect(typeof testPayload.lastSuccessfulRead).toBe("string");

    const [tokenUrl, tokenInit] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(tokenUrl).toBe("https://marketplace.walmartapis.com/v3/token");

    const tokenHeaders = tokenInit.headers as Record<string, string>;
    expect(tokenHeaders.Authorization).toBe(
      `Basic ${Buffer.from("stored_client_id:stored_secret_123").toString("base64")}`
    );
  });

  it("health route returns persisted safe summary and disconnect clears stored credentials", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: "wm_live_access_token", expires_in: 900 }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ elements: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );

    const saveReq = new NextRequest("http://localhost/api/ecomviper/walmart/connect/save", {
      method: "POST",
      body: JSON.stringify({
        action: "save",
        accountNickname: "OPA Nutrition Walmart",
        clientId: "persisted_client_id",
        clientSecret: "persisted_secret",
        marketplaceRegion: "US",
      }),
    });
    await saveConnectionRoute(saveReq);

    const healthResp = await healthRoute(new NextRequest("http://localhost/api/ecomviper/walmart/health"));
    const healthPayload = await healthResp.json();

    expect(healthPayload.connectionHealth.summary.clientSecretStored).toBe(true);
    expect(healthPayload.connectionHealth.summary.maskedClientId).toBe("pe***t_id");
    expect(healthPayload.ai_visibility_score?.provenance?.source).toBe("derived");
    expect(healthPayload.ai_visibility_score).toEqual(
      expect.objectContaining({
        overall: expect.any(Number),
        status: expect.stringMatching(/excellent|good|warning|critical|unknown/),
        dimensions: expect.any(Object),
      })
    );
    expect(JSON.stringify(healthPayload)).not.toContain("persisted_secret");

    const disconnectReq = new NextRequest("http://localhost/api/ecomviper/walmart/connect/save", {
      method: "POST",
      body: JSON.stringify({ action: "disconnect" }),
    });
    await saveConnectionRoute(disconnectReq);

    const healthAfterDisconnectResp = await healthRoute(new NextRequest("http://localhost/api/ecomviper/walmart/health"));
    const healthAfterDisconnectPayload = await healthAfterDisconnectResp.json();

    expect(healthAfterDisconnectPayload.connectionHealth.connectionStatus).toBe("not_connected");
    expect(healthAfterDisconnectPayload.connectionHealth.summary.clientSecretStored).toBe(false);
    expect(healthAfterDisconnectPayload.connectionHealth.summary.maskedClientId).toBe("Not configured");
  });

  it("health route still returns connection status when dashboard metrics fail to load", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: "wm_live_access_token", expires_in: 900 }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ elements: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );

    await saveConnectionRoute(
      new NextRequest("http://localhost/api/ecomviper/walmart/connect/save", {
        method: "POST",
        body: JSON.stringify({
          action: "save",
          accountNickname: "OPA Nutrition Walmart",
          clientId: "health_guard_client",
          clientSecret: "health_guard_secret",
          marketplaceRegion: "US",
        }),
      })
    );

    vi.spyOn(walmartProducts, "getWalmartDashboardSnapshotForUser").mockRejectedValueOnce(
      new Error("dashboard unavailable")
    );

    const healthResp = await healthRoute(new NextRequest("http://localhost/api/ecomviper/walmart/health"));
    const healthPayload = await healthResp.json();

    expect(healthResp.status).toBe(200);
    expect(healthPayload.ok).toBe(true);
    expect(healthPayload.connectionHealth.summary.maskedClientId).toBe("he***ient");
    expect(healthPayload.cards.productsImported).toBe(0);
    expect(healthPayload.cards.listingsNeedingAttention.count).toBe(0);
    expect(healthPayload.ai_visibility_score?.provenance?.source).toBe("derived");
    expect(healthPayload.ai_visibility_score?.dimensions?.prompt_match_coverage).toEqual(expect.any(Number));
  });

  it("scopes persisted Walmart connection records by user and prevents cross-user status bleed", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: "wm_live_access_token", expires_in: 900 }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ elements: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );

    await saveConnectionRoute(
      new NextRequest("http://localhost/api/ecomviper/walmart/connect/save", {
        method: "POST",
        body: JSON.stringify({
          action: "save",
          accountNickname: "User One Walmart",
          clientId: "user_one_client_id",
          clientSecret: "user_one_secret",
          marketplaceRegion: "US",
        }),
      })
    );

    authMocks.requireSignedInUser.mockResolvedValueOnce({
      userId: "user_two",
      unauthorizedResponse: null,
    });

    const healthResp = await healthRoute(new NextRequest("http://localhost/api/ecomviper/walmart/health"));
    const healthPayload = await healthResp.json();

    expect(healthResp.status).toBe(200);
    expect(healthPayload.connectionHealth.summary.maskedClientId).toBe("Not configured");
    expect(healthPayload.connectionHealth.summary.clientSecretStored).toBe(false);
    expect(healthPayload.connectionHealth.summary.tokenStatus).toBe("unknown");
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
        marketplaceRegion: "US",
      }),
    });

    const resp = await testConnectionRoute(req);
    const payload = await resp.json();
    const serialized = JSON.stringify(payload);

    expect(payload.ok).toBe(false);
    expect(payload.status).toBe("failed");
    expect(payload.tokenStatus).toBe("invalid");
    expect(payload.lastApiError?.code).toBe("WALMART_TOKEN_HTTP_401");
    expect(payload.lastApiError?.message).toContain("HTTP 401 unauthorized");
    expect(serialized).not.toContain(secret);
    expect(serialized).not.toContain("wm_live_access_token");
    expect(serialized).not.toContain("Authorization");
    expect(serialized).not.toContain("Basic ");
    expect(serialized).not.toContain("access_token");
    expect(serialized).not.toContain("encryptedClientSecret");
  });

  it("missing credentials returns explicit safe error and skips network call", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const result = await requestServerSideWalmartToken({
      clientId: "",
      clientSecret: "",
      marketplaceRegion: "US",
    });

    expect(result.ok).toBe(false);
    expect(result.lastError?.code).toBe("MISSING_CREDENTIALS");
    expect(result.lastError?.message).toBe("Missing Walmart Client ID or Client Secret.");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("save fails safely when credential encryption key is missing", async () => {
    delete process.env.ECOMVIPER_CREDENTIAL_ENCRYPTION_KEY;
    delete process.env.INTEGRATIONS_ENCRYPTION_KEY;
    delete process.env.SERVER_ENCRYPTION_KEY;

    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: "wm_live_access_token", expires_in: 900 }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ elements: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );

    const req = new NextRequest("http://localhost/api/ecomviper/walmart/connect/save", {
      method: "POST",
      body: JSON.stringify({
        action: "save",
        accountNickname: "OPA Nutrition Walmart",
        clientId: "submitted_client_id",
        clientSecret: "submitted_client_secret",
        marketplaceRegion: "US",
      }),
    });

    const resp = await saveConnectionRoute(req);
    const payload = await resp.json();

    expect(resp.status).toBe(500);
    expect(payload.error.message).toContain("ECOMVIPER_CREDENTIAL_ENCRYPTION_KEY");
  });

  it("connect status panel renders Production and no Sandbox option", () => {
    const html = renderToStaticMarkup(<WalmartConnectClient initialHealth={buildInitialHealth()} />);

    expect(html).toContain("Environment");
    expect(html).toContain("Production");
    expect(html).not.toContain("Sandbox");
  });
});

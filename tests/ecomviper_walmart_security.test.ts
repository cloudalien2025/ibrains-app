import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST as testConnectionRoute } from "@/app/api/ecomviper/walmart/connect/test/route";
import { POST as saveConnectionRoute } from "@/app/api/ecomviper/walmart/connect/save/route";
import { appendActivityLog, listActivityLogs } from "@/lib/ecomviper/core/activity-log";
import { maskClientId, saveWalmartConnection, testWalmartConnection } from "@/lib/ecomviper/walmart/walmart-auth";

describe("EcomViper Walmart security rules", () => {
  beforeEach(() => {
    (globalThis as Record<string, unknown>).__ecomviper_walmart_store__ = undefined;
    (globalThis as Record<string, unknown>).__ecomviper_activity_store__ = undefined;
    (globalThis as Record<string, unknown>).__ecomviper_walmart_token_cache__ = undefined;
    vi.restoreAllMocks();
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = typeof input === "string" ? input : input.url;
      if (url.includes("/v3/token")) {
        return new Response(JSON.stringify({ access_token: "wm_access_token_value", expires_in: 900 }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ items: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("connect test/save routes never return raw client secret, token, or auth header", async () => {
    const secret = "super-secret-walmart-client-secret";

    const testReq = new NextRequest("http://localhost/api/ecomviper/walmart/connect/test", {
      method: "POST",
      body: JSON.stringify({
        accountNickname: "OPA Nutrition Walmart",
        clientId: "wm-client-id-123456",
        clientSecret: secret,
        region: "US",
      }),
    });
    const testResp = await testConnectionRoute(testReq);
    const testPayload = await testResp.json();

    const saveReq = new NextRequest("http://localhost/api/ecomviper/walmart/connect/save", {
      method: "POST",
      body: JSON.stringify({
        action: "save",
        accountNickname: "OPA Nutrition Walmart",
        clientId: "wm-client-id-123456",
        clientSecret: secret,
        region: "US",
      }),
    });
    const saveResp = await saveConnectionRoute(saveReq);
    const savePayload = await saveResp.json();

    expect(JSON.stringify(testPayload)).not.toContain(secret);
    expect(JSON.stringify(savePayload)).not.toContain(secret);
    expect(testPayload.summary?.maskedClientId).toBeDefined();
    expect(savePayload.summary?.maskedClientId).toBeDefined();
    expect(JSON.stringify(testPayload)).not.toContain("wm_access_token_value");
    expect(JSON.stringify(savePayload)).not.toContain("wm_access_token_value");
    expect(JSON.stringify(testPayload)).not.toContain("Authorization");
    expect(JSON.stringify(savePayload)).not.toContain("Authorization");
  });

  it("walmart auth masks client id and does not expose client secret", async () => {
    const masked = maskClientId("ab1234567890");
    expect(masked).toBe("ab***7890");

    const secret = "secret-value-should-never-echo";
    const tested = await testWalmartConnection({
      accountNickname: "OPA Nutrition Walmart",
      clientId: "ab1234567890",
      clientSecret: secret,
      region: "US",
    });
    const saved = await saveWalmartConnection({
      accountNickname: "OPA Nutrition Walmart",
      clientId: "ab1234567890",
      clientSecret: secret,
      region: "US",
    });

    expect(JSON.stringify(tested)).not.toContain(secret);
    expect(JSON.stringify(saved)).not.toContain(secret);
    expect(JSON.stringify(tested)).not.toContain("wm_access_token_value");
    expect(JSON.stringify(saved)).not.toContain("wm_access_token_value");
    expect(tested.summary.maskedClientId).toBe("ab***7890");
    expect(saved.summary.maskedClientId).toBe("ab***7890");
    expect(tested.summary.environment).toBe("production");
    expect(saved.summary.environment).toBe("production");
  });

  it("activity log redacts secrets", () => {
    appendActivityLog({
      marketplace: "walmart",
      actionType: "credential_save",
      result: "success",
      message: "Saved",
      afterPayload: {
        clientSecret: "very-secret",
        nested: {
          accessToken: "token-value",
          ok: true,
        },
      },
    });

    const entries = listActivityLogs({ marketplace: "walmart", limit: 1 });
    const body = JSON.stringify(entries[0]);

    expect(body).toContain("[REDACTED]");
    expect(body).not.toContain("very-secret");
    expect(body).not.toContain("token-value");
  });
});

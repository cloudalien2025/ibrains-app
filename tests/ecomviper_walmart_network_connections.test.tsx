// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import WalmartConnectClient from "@/app/optiwal/connect/connect-client";
import { walmartNavItems } from "@/lib/ecomviper/walmart/walmart-nav";
import type { WalmartNetworkConnection } from "@/lib/ecomviper/walmart/walmart-network-connections";
import type { WalmartConnectionHealth } from "@/lib/ecomviper/walmart/walmart-types";

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
      permissionChecks: [],
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

function buildConnections(): WalmartNetworkConnection[] {
  return [
    {
      id: "conn_consumersun",
      name: "consumersun.com",
      platform: "wordpress",
      url: "https://consumersun.com",
      status: "connected",
      credentialLabel: "editor",
      credentialStored: true,
      defaultPublishingStatus: "draft",
      publishingMode: "draft_only",
      guardrails: {
        primaryNiche: "Product reviews",
        secondaryNiches: ["consumer buying guides", "supplement reviews"],
        allowedTopics: ["product reviews", "comparison articles"],
        blockedTopics: ["children health"],
        preferredContentTypes: ["product reviews", "roundup articles"],
        audience: "General consumers researching products",
      },
      notes: "",
      createdAt: "2026-05-17T00:00:00.000Z",
      updatedAt: "2026-05-17T00:00:00.000Z",
    },
    {
      id: "conn_pingdiet",
      name: "pingdiet.com",
      platform: "wordpress",
      url: "https://pingdiet.com",
      status: "connected",
      credentialLabel: "editor",
      credentialStored: true,
      defaultPublishingStatus: "draft",
      publishingMode: "draft_only",
      guardrails: {
        primaryNiche: "Intermittent fasting",
        secondaryNiches: ["weight management"],
        allowedTopics: ["fasting", "meal timing"],
        blockedTopics: [],
        preferredContentTypes: ["fasting guides"],
        audience: "People interested in intermittent fasting",
      },
      notes: "",
      createdAt: "2026-05-17T00:00:00.000Z",
      updatedAt: "2026-05-17T00:00:00.000Z",
    },
  ];
}

describe("Walmart network connections", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    delete (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
  });

  it("renames sidebar entry to Network Connections", () => {
    expect(walmartNavItems.some((item) => item.label === "Network Connections")).toBe(true);
    expect(walmartNavItems.some((item) => item.label === "Marketplace Health")).toBe(false);
  });

  it("renders WordPress connections and guardrail fields in Network Connections", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/api/ecomviper/walmart/health")) {
        return new Response(JSON.stringify({ ok: true, connectionHealth: buildInitialHealth() }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.includes("/api/ecomviper/walmart/connect/openai")) {
        return new Response(
          JSON.stringify({
            ok: true,
            provider: "openai",
            connected: false,
            status: "disconnected",
            maskedApiKey: "Not configured",
            updatedAt: null,
            saveSupported: true,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      if (url.includes("/api/ecomviper/walmart/connect/serpapi")) {
        return new Response(
          JSON.stringify({
            ok: true,
            provider: "serpapi",
            connected: false,
            status: "disconnected",
            maskedApiKey: "Not configured",
            updatedAt: null,
            saveSupported: true,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      if (url.includes("/api/ecomviper/shopify/connect")) {
        return new Response(
          JSON.stringify({
            ok: true,
            provider: "shopify",
            connected: false,
            status: "disconnected",
            storeDomain: "",
            apiVersion: "2025-10",
            authMode: "dev_dashboard_client_credentials",
            maskedClientId: "Not configured",
            clientSecretStored: false,
            tokenStatus: "unknown",
            lastTokenRefreshAt: null,
            tokenExpiresAt: null,
            grantedScopes: [],
            lastApiError: null,
            updatedAt: null,
            saveSupported: true,
            importState: {
              lastImportAt: null,
              lastImportStatus: "unknown",
              lastImportMessage: null,
              productCount: 0,
              imageCount: 0,
              updatedAt: null,
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      if (url.includes("/api/ecomviper/walmart/network-connections")) {
        return new Response(JSON.stringify({ ok: true, connections: buildConnections() }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    vi.stubGlobal("fetch", fetchMock);

    await act(async () => {
      root.render(
        <WalmartConnectClient
          initialHealth={buildInitialHealth()}
          initialNetworkConnections={buildConnections()}
        />
      );
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(container.textContent).toContain("Network Connections");
    expect(container.querySelector('[data-testid="ecomviper-walmart-network-connections-panel"]')).not.toBeNull();
    expect(container.textContent).toContain("Owned Publishing Properties (WordPress)");
    expect(container.textContent).toContain("consumersun.com");
    expect(container.textContent).toContain("pingdiet.com");
    expect(container.textContent).toContain("Primary niche");
    expect(container.textContent).toContain("Allowed topics");
    expect(container.textContent).toContain("Blocked topics");
    expect(container.textContent).toContain("Preferred content types");
    expect(container.textContent).toContain("Audience");
  });
});

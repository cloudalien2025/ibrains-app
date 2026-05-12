// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import WalmartConnectClient from "@/app/apps/ecomviper/walmart/connect/connect-client";
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

describe("Walmart connect Shopify UI", () => {
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

  it("shows Shopify connected state and import counters", async () => {
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
            connected: true,
            status: "connected",
            storeDomain: "opanutrition.myshopify.com",
            apiVersion: "2025-10",
            authMode: "dev_dashboard_client_credentials",
            maskedClientId: "sh***3456",
            clientSecretStored: true,
            tokenStatus: "valid",
            lastTokenRefreshAt: "2026-05-12T00:30:00.000Z",
            tokenExpiresAt: "2026-05-12T01:30:00.000Z",
            grantedScopes: ["read_products"],
            lastApiError: null,
            updatedAt: "2026-05-12T00:00:00.000Z",
            saveSupported: true,
            importState: {
              lastImportAt: "2026-05-12T01:00:00.000Z",
              lastImportStatus: "success",
              lastImportMessage: "Imported 12 Shopify products.",
              productCount: 12,
              imageCount: 34,
              updatedAt: "2026-05-12T01:00:00.000Z",
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    vi.stubGlobal("fetch", fetchMock);

    await act(async () => {
      root.render(<WalmartConnectClient initialHealth={buildInitialHealth()} />);
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(container.textContent).toContain("Shopify Source Catalog");
    expect(container.textContent).toContain("Shopify Status");
    expect(container.textContent).toContain("opanutrition.myshopify.com");
    expect(container.querySelector('input[placeholder="2025-10"]')).toBeNull();
    expect(container.querySelector('input[placeholder="opanutrition.myshopify.com"]')).not.toBeNull();
    expect(container.querySelector('input[placeholder="Shopify client id"]')).not.toBeNull();
    expect(container.querySelector('input[placeholder="Shopify client secret"]')).not.toBeNull();
    expect(container.textContent).toContain("Client ID");
    expect(container.textContent).toContain("sh***3456");
    expect(container.textContent).toContain("Token status");
    expect(container.textContent).toContain("valid");
    expect(container.textContent).toContain("Product count imported");
    expect(container.textContent).toContain("12");
    expect(container.textContent).toContain("Image count imported");
    expect(container.textContent).toContain("34");
  });
});

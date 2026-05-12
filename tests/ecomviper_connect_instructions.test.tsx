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

function getButtonsByLabel(container: HTMLDivElement, label: string): HTMLButtonElement[] {
  return Array.from(container.querySelectorAll("button")).filter(
    (entry) => entry.textContent?.trim() === label
  ) as HTMLButtonElement[];
}

function createConnectionFetchMock(options?: {
  failOpenAiStatus?: boolean;
  failSerpApiStatus?: boolean;
  failShopifyStatus?: boolean;
}) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();

    if (url.includes("/api/ecomviper/walmart/health")) {
      return new Response(
        JSON.stringify({
          ok: true,
          connectionHealth: buildInitialHealth(),
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    if (url.includes("/api/ecomviper/walmart/connect/openai")) {
      if (options?.failOpenAiStatus) return new Response("{}", { status: 500 });
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
      if (options?.failSerpApiStatus) return new Response("{}", { status: 500 });
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
      if (options?.failShopifyStatus) return new Response("{}", { status: 500 });
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

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  });
}

describe("EcomViper connect instructions", () => {
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

  it("renders Instructions button for Walmart, Shopify, OpenAI, and SerpApi cards", async () => {
    vi.stubGlobal("fetch", createConnectionFetchMock());

    await act(async () => {
      root.render(<WalmartConnectClient initialHealth={buildInitialHealth()} />);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(getButtonsByLabel(container, "Instructions")).toHaveLength(4);
  });

  it("opens provider-specific instructions and closes without losing form values", async () => {
    const fetchMock = createConnectionFetchMock();
    vi.stubGlobal("fetch", fetchMock);

    await act(async () => {
      root.render(<WalmartConnectClient initialHealth={buildInitialHealth()} />);
    });
    await act(async () => {
      await Promise.resolve();
    });

    const clientIdInput = container.querySelector(
      'input[placeholder="Walmart client id"]'
    ) as HTMLInputElement | null;
    expect(clientIdInput).not.toBeNull();
    if (!clientIdInput) return;

    await act(async () => {
      clientIdInput.value = "wm_visible_client_id";
      clientIdInput.dispatchEvent(new Event("input", { bubbles: true }));
      clientIdInput.dispatchEvent(new Event("change", { bubbles: true }));
    });

    const fetchCallsBeforeInstructions = fetchMock.mock.calls.length;
    const instructionButtons = getButtonsByLabel(container, "Instructions");

    await act(async () => {
      instructionButtons[0].click();
    });
    expect(container.textContent).toContain("Walmart Marketplace Instructions");

    await act(async () => {
      getButtonsByLabel(container, "Close")[0].click();
    });
    expect(clientIdInput.value).toBe("wm_visible_client_id");

    await act(async () => {
      instructionButtons[1].click();
    });
    expect(container.textContent).toContain("OpenAI API Instructions");
    await act(async () => {
      getButtonsByLabel(container, "Close")[0].click();
    });

    await act(async () => {
      instructionButtons[2].click();
    });
    expect(container.textContent).toContain("SerpAPI Instructions");
    await act(async () => {
      getButtonsByLabel(container, "Close")[0].click();
    });

    await act(async () => {
      instructionButtons[3].click();
    });
    expect(container.textContent).toContain("Shopify Source Catalog Instructions");
    expect(container.textContent).toContain("Client ID");
    expect(container.textContent).toContain("read_products");
    expect(container.textContent).toContain("read_product_listings");
    expect(container.textContent).toContain("Create and release an app version");
    expect(container.textContent).toContain("Install the released app on the exact Shopify store");
    expect(container.textContent).toContain("exact store `myshopify.com` domain");
    expect(container.textContent).toContain("Do not use the App automation token");
    await act(async () => {
      getButtonsByLabel(container, "Close")[0].click();
    });

    expect(fetchMock.mock.calls.length).toBe(fetchCallsBeforeInstructions);
  });

  it("shows unsaved Walmart warning and keeps status card on persisted values until save", async () => {
    vi.stubGlobal("fetch", createConnectionFetchMock());

    await act(async () => {
      root.render(<WalmartConnectClient initialHealth={buildInitialHealth()} />);
    });
    await act(async () => {
      await Promise.resolve();
    });

    const clientSecretInput = container.querySelector(
      'input[placeholder="Leave blank to keep stored secret"]'
    ) as HTMLInputElement | null;
    expect(clientSecretInput).not.toBeNull();
    if (!clientSecretInput) return;

    await act(async () => {
      clientSecretInput.value = "super_secret_do_not_show";
      clientSecretInput.dispatchEvent(new Event("input", { bubbles: true }));
      clientSecretInput.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(container.textContent).toContain("You have unsaved Walmart credential changes.");
    expect(container.textContent).toContain("Client Secret");
    expect(container.textContent).toContain("Not stored");

    const instructionButtons = getButtonsByLabel(container, "Instructions");
    await act(async () => {
      instructionButtons[0].click();
    });

    expect(container.textContent).toContain("Walmart Marketplace Instructions");
    expect(container.textContent).not.toContain("super_secret_do_not_show");
  });

  it("renders instructions safely even when provider status requests fail", async () => {
    vi.stubGlobal(
      "fetch",
      createConnectionFetchMock({
        failOpenAiStatus: true,
        failSerpApiStatus: true,
        failShopifyStatus: true,
      })
    );

    await act(async () => {
      root.render(<WalmartConnectClient initialHealth={buildInitialHealth()} />);
    });
    await act(async () => {
      await Promise.resolve();
    });

    const instructionButtons = getButtonsByLabel(container, "Instructions");
    expect(instructionButtons).toHaveLength(4);

    await act(async () => {
      instructionButtons[0].click();
    });
    expect(container.textContent).toContain("Walmart Marketplace Instructions");
  });

  it("does not crash when Shopify status payload is partial or legacy-shaped", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url.includes("/api/ecomviper/walmart/health")) {
        return new Response(
          JSON.stringify({
            ok: true,
            connectionHealth: buildInitialHealth(),
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
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
            authMode: "dev_dashboard_client_credentials",
            maskedClientId: "sh***3456",
            clientSecretStored: true,
            tokenStatus: null,
            grantedScopes: null,
            saveSupported: true,
            importState: null,
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

    expect(container.textContent).toContain("Shopify Status");
    expect(container.textContent).toContain("Granted scopes");
    expect(container.textContent).toContain("Unknown");
    expect(container.textContent).toContain("Last sync status");
    expect(container.textContent).toContain("unknown");
  });
});

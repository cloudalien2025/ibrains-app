import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import AppsIndexPage from "@/app/apps/page";
import EcomViperDashboardPage from "@/app/apps/ecomviper/page";
import WalmartLayout from "@/app/apps/ecomviper/walmart/layout";
import WalmartDashboardPage from "@/app/apps/ecomviper/walmart/page";
import WalmartConnectPage from "@/app/apps/ecomviper/walmart/connect/page";
import WalmartFeedsPage from "@/app/apps/ecomviper/walmart/feeds/page";
import WalmartProductsPage from "@/app/apps/ecomviper/walmart/products/page";
import WalmartActivityPage from "@/app/apps/ecomviper/walmart/activity/page";
import WalmartAiOptimizerPage from "@/app/apps/ecomviper/walmart/ai-optimizer/page";
import { replaceWalmartProductsForUser } from "@/lib/ecomviper/walmart/walmart-products";
import type { WalmartConnectionHealth } from "@/lib/ecomviper/walmart/walmart-types";

const walmartRouteMocks = vi.hoisted(() => ({
  requireSignedInUser: vi.fn(),
  getWalmartConnectionHealthForUser: vi.fn(),
}));

vi.mock("next/link", async () => {
  const React = await import("react");
  return {
    default: ({ href, children, ...props }: { href: string; children?: ReactNode }) =>
      React.createElement("a", { href, ...props }, children),
  };
});

vi.mock("next/navigation", () => ({
  usePathname: () => "/apps/ecomviper/walmart",
  useRouter: () => ({
    refresh: vi.fn(),
  }),
  redirect: (path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  },
}));

vi.mock("@/components/frontdoor/frontdoor-header-actions", () => ({
  default: () => null,
}));

vi.mock("@/lib/auth/requireSignedInUser", () => ({
  requireSignedInUser: walmartRouteMocks.requireSignedInUser,
}));

vi.mock("@/lib/ecomviper/walmart/walmart-auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ecomviper/walmart/walmart-auth")>(
    "@/lib/ecomviper/walmart/walmart-auth"
  );

  return {
    ...actual,
    getWalmartConnectionHealthForUser: walmartRouteMocks.getWalmartConnectionHealthForUser,
  };
});

function buildConnectionHealth(
  overrides?: Partial<WalmartConnectionHealth> & { summary?: Partial<WalmartConnectionHealth["summary"]> }
): WalmartConnectionHealth {
  return {
    connectionStatus: "not_connected",
    summary: {
      accountNickname: "Walmart Account",
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
    ...overrides,
    summary: {
      accountNickname: "Walmart Account",
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
      ...overrides?.summary,
    },
  };
}

describe("EcomViper Walmart route contracts", () => {
  beforeEach(() => {
    (globalThis as Record<string, unknown>).__ecomviper_walmart_store__ = undefined;
    (globalThis as Record<string, unknown>).__ecomviper_activity_store__ = undefined;
    (globalThis as Record<string, unknown>).__ecomviper_walmart_draft_fallback__ = undefined;
    (globalThis as Record<string, unknown>).__ecomviper_walmart_draft_tables_checked__ = undefined;
    (globalThis as Record<string, unknown>).__ecomviper_walmart_token_cache__ = undefined;
    (globalThis as Record<string, unknown>).__ecomviper_walmart_connection_fallback__ = undefined;
    (globalThis as Record<string, unknown>).__ecomviper_walmart_product_fallback__ = undefined;
    (globalThis as Record<string, unknown>).__ecomviper_walmart_product_tables_checked__ = undefined;
    walmartRouteMocks.requireSignedInUser.mockResolvedValue({ userId: "user_ibrains", unauthorizedResponse: null });
    walmartRouteMocks.getWalmartConnectionHealthForUser.mockResolvedValue(buildConnectionHealth());
  });

  it("shows EcomViper in /apps launcher", () => {
    const html = renderToStaticMarkup(<AppsIndexPage />);
    expect(html).toContain(">EcomViper<");
    expect(html).toContain('href="/apps/ecomviper"');
    expect(html).toContain(">Open EcomViper<");
    expect(html).toContain("apps-launcher-shell");
    expect(html).toContain("ibrains-shell");
    expect(html).toContain("rounded-3xl");
  });

  it("renders /apps/ecomviper marketplace cards", async () => {
    const html = renderToStaticMarkup(await EcomViperDashboardPage());
    expect(html).toContain("ecomviper-overview-page");
    expect(html).toContain(">Walmart<");
    expect(html).toContain(">Amazon<");
    expect(html).toContain(">eBay<");
    expect(html).toContain(">Shopify Source Catalog<");
  });

  it("renders walmart dashboard shell with sidebar and metric cards", async () => {
    const dashboard = await WalmartDashboardPage();
    const html = renderToStaticMarkup(
      <WalmartLayout>
        {dashboard}
      </WalmartLayout>
    );

    expect(html).toContain("ecomviper-walmart-sidebar");
    expect(html).toContain(">Products<");
    expect(html).toContain(">Drafts<");
    expect(html).not.toContain(">AI Visibility<");
    expect(html).not.toContain(">Listing Intelligence<");
    expect(html).toContain("ecomviper-walmart-metric-cards");
    expect(html).toContain("Walmart Agentic Commerce Command Center");
    expect(html).not.toContain(">AI Optimizer<");
    expect(html).toContain("No Walmart products imported yet");
    expect(html).toContain("ecomviper-walmart-capability-map");
    expect(html).toContain("ecomviper-walmart-agentic-coverage-panel");
    expect(html).toContain("Walmart Agentic Optimization Coverage");
    expect(html).toContain("ecomviper-walmart-missing-from-code");
    expect(html).toContain("ecomviper-walmart-next-best-actions");
    expect(html).toContain("Supported by current API path");
    expect(html).toContain("Catalog Optimizer");
    expect(html).toContain("Walmart Connect Ads Optimizer");
    expect(html).toContain("Separate integration required");
  });

  it("renders connected dashboard state and manage CTA when credential sync succeeded", async () => {
    walmartRouteMocks.getWalmartConnectionHealthForUser.mockResolvedValue(
      buildConnectionHealth({
        connectionStatus: "connected",
        summary: {
          maskedClientId: "ab***1234",
          clientSecretStored: true,
          lastSuccessfulAuth: "2026-05-09T10:00:00.000Z",
          lastSuccessfulRead: "2026-05-09T10:05:00.000Z",
          tokenStatus: "valid",
          safeReadStatus: "valid",
        },
        lastSuccessfulApiCall: "2026-05-09T10:05:00.000Z",
      })
    );

    const html = renderToStaticMarkup(await WalmartDashboardPage());

    expect(html).toContain(">Connected<");
    expect(html).toContain(">Manage Walmart Connection<");
    expect(html).not.toContain(">Connect Walmart<");
  });

  it("renders dashboard timestamps safely when connection data includes Date objects", async () => {
    const authAt = new Date("2026-05-09T20:30:00.000Z");
    const readAt = new Date("2026-05-09T20:31:00.000Z");
    const importAt = new Date("2026-05-09T20:32:00.000Z");

    await replaceWalmartProductsForUser({
      userId: "user_ibrains",
      products: [],
      importedAt: importAt.toISOString(),
    });

    walmartRouteMocks.getWalmartConnectionHealthForUser.mockResolvedValue(
      buildConnectionHealth({
        connectionStatus: "connected",
        summary: {
          maskedClientId: "ab***1234",
          clientSecretStored: true,
          lastSuccessfulAuth: authAt as unknown as string,
          lastSuccessfulRead: readAt as unknown as string,
          tokenStatus: "valid",
          safeReadStatus: "valid",
        },
        lastSuccessfulApiCall: readAt as unknown as string,
      })
    );

    const html = renderToStaticMarkup(await WalmartDashboardPage());

    expect(html).toContain(authAt.toISOString());
    expect(html).toContain(readAt.toISOString());
    expect(html).toContain(importAt.toISOString());
    expect(html).not.toContain("[object Date]");
  });

  it("keeps dashboard connected when imports succeeded even if stored status is stale", async () => {
    await replaceWalmartProductsForUser({
      userId: "user_ibrains",
      products: [
        {
          id: "walmart_30066-841",
          marketplace: "walmart",
          sku: "30066-841",
          externalItemId: "wm_30066-841",
          title: "Sample Walmart Product",
          brand: "Walmart Brand",
          category: "Supplements",
          price: 19.99,
          inventoryQuantity: 12,
          inventoryStatus: "known",
          status: "active",
          imageUrl: "",
          issues: ["Image not provided by Walmart catalog"],
          attributes: {},
          shortDescription: "",
          longDescription: "",
          bulletPoints: [],
          rawPayload: {},
          normalizedPayload: {},
          lastSyncedAt: "2026-05-09T10:05:00.000Z",
          createdAt: "2026-05-09T10:05:00.000Z",
          updatedAt: "2026-05-09T10:05:00.000Z",
        },
      ],
      importedAt: "2026-05-09T10:05:00.000Z",
    });
    walmartRouteMocks.getWalmartConnectionHealthForUser.mockResolvedValue(
      buildConnectionHealth({
        connectionStatus: "not_connected",
        summary: {
          maskedClientId: "Not configured",
          clientSecretStored: false,
        },
      })
    );

    const html = renderToStaticMarkup(await WalmartDashboardPage());

    expect(html).toContain(">Connected<");
    expect(html).toContain(">Manage Walmart Connection<");
  });

  it("renders not connected dashboard state and connect CTA when credentials are missing", async () => {
    walmartRouteMocks.getWalmartConnectionHealthForUser.mockResolvedValue(
      buildConnectionHealth({
        connectionStatus: "not_connected",
        summary: {
          maskedClientId: "Not configured",
          clientSecretStored: false,
          lastSuccessfulAuth: null,
          lastSuccessfulRead: null,
          tokenStatus: "unknown",
          safeReadStatus: "unknown",
        },
        lastSuccessfulApiCall: null,
      })
    );

    const html = renderToStaticMarkup(await WalmartDashboardPage());

    expect(html).toContain(">Not Connected<");
    expect(html).toContain(">Connect Walmart<");
    expect(html).not.toContain(">Manage Walmart Connection<");
  });

  it("renders walmart connect credential form in production-only mode", async () => {
    const html = renderToStaticMarkup(await WalmartConnectPage());
    expect(html).toContain("ecomviper-walmart-connect-page");
    expect(html).toContain("Account nickname");
    expect(html).toContain("Client ID");
    expect(html).toContain("Client Secret");
    expect(html).toContain("OpenAI API");
    expect(html).toContain("Save OpenAI Key");
    expect(html).toContain("SerpApi");
    expect(html).toContain("Save SerpApi Key");
    expect(html).toContain("Test Connection");
    expect(html).toContain("Save Credentials");
    expect(html).toContain("Production");
    expect(html).not.toContain("Sandbox");
  });

  it("renders feeds page empty state when no submissions exist", () => {
    const html = renderToStaticMarkup(<WalmartFeedsPage />);
    expect(html).toContain("ecomviper-walmart-feeds-page");
    expect(html).toContain("No feed submissions yet.");
  });

  it("renders products page empty state without mock SKUs", async () => {
    const html = renderToStaticMarkup(await WalmartProductsPage());
    expect(html).toContain("No Walmart products imported yet");
    expect(html).not.toContain("OPA-OMEGA3-120");
  });

  it("renders products page with legacy records that omit new enrichment metadata fields", async () => {
    await replaceWalmartProductsForUser({
      userId: "user_ibrains",
      products: [
        {
          id: "legacy_walmart_product",
          marketplace: "walmart",
          sku: "LEGACY-SKU-01",
          externalItemId: "legacy_external_item",
          title: "Legacy Product",
          brand: "Legacy Brand",
          category: "Supplements",
          price: 0,
          inventoryQuantity: 0,
          inventoryStatus: null,
          status: null,
          imageUrl: "",
          imageStatusMessage: null,
          imageSource: null,
          imageSyncStatus: null,
          issues: null,
          attributes: null,
          shortDescription: "",
          longDescription: "",
          bulletPoints: [],
          rawPayload: {},
          normalizedPayload: {},
          lastSyncedAt: "2026-05-11T00:00:00.000Z",
          createdAt: "2026-05-11T00:00:00.000Z",
          updatedAt: "2026-05-11T00:00:00.000Z",
        } as unknown as Parameters<typeof replaceWalmartProductsForUser>[0]["products"][number],
      ],
      importedAt: "2026-05-11T00:00:00.000Z",
    });

    const html = renderToStaticMarkup(await WalmartProductsPage());
    expect(html).toContain("LEGACY-SKU-01");
    expect(html).toContain("Image enrichment not synced.");
  });

  it("renders activity page with empty state when no activity exists", () => {
    const html = renderToStaticMarkup(<WalmartActivityPage />);
    expect(html).toContain("No activity yet.");
  });

  it("redirects deprecated ai-optimizer route into product workspace routes", async () => {
    await expect(
      WalmartAiOptimizerPage({ searchParams: Promise.resolve({ sku: "ROC808" }) })
    ).rejects.toThrow("NEXT_REDIRECT:/apps/ecomviper/walmart/products/ROC808");

    await expect(
      WalmartAiOptimizerPage({ searchParams: Promise.resolve({}) })
    ).rejects.toThrow("NEXT_REDIRECT:/apps/ecomviper/walmart/products");
  });
});

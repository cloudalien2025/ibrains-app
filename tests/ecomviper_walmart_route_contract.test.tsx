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

vi.mock("next/link", async () => {
  const React = await import("react");
  return {
    default: ({ href, children, ...props }: { href: string; children?: ReactNode }) =>
      React.createElement("a", { href, ...props }, children),
  };
});

vi.mock("next/navigation", () => ({
  usePathname: () => "/apps/ecomviper/walmart",
}));

vi.mock("@/components/frontdoor/frontdoor-header-actions", () => ({
  default: () => null,
}));

describe("EcomViper Walmart route contracts", () => {
  beforeEach(() => {
    (globalThis as Record<string, unknown>).__ecomviper_walmart_store__ = undefined;
    (globalThis as Record<string, unknown>).__ecomviper_activity_store__ = undefined;
    (globalThis as Record<string, unknown>).__ecomviper_walmart_token_cache__ = undefined;
    (globalThis as Record<string, unknown>).__ecomviper_walmart_connection_fallback__ = undefined;
  });

  it("shows EcomViper in /apps launcher", () => {
    const html = renderToStaticMarkup(<AppsIndexPage />);
    expect(html).toContain(">EcomViper<");
    expect(html).toContain('href="/apps/ecomviper"');
    expect(html).toContain(">Open EcomViper<");
  });

  it("renders /apps/ecomviper marketplace cards", () => {
    const html = renderToStaticMarkup(<EcomViperDashboardPage />);
    expect(html).toContain("ecomviper-overview-page");
    expect(html).toContain(">Walmart<");
    expect(html).toContain(">Amazon<");
    expect(html).toContain(">eBay<");
    expect(html).toContain(">Shopify Source Catalog<");
  });

  it("renders walmart dashboard shell with sidebar and metric cards", () => {
    const html = renderToStaticMarkup(
      <WalmartLayout>
        <WalmartDashboardPage />
      </WalmartLayout>
    );

    expect(html).toContain("ecomviper-walmart-sidebar");
    expect(html).toContain("ecomviper-walmart-metric-cards");
    expect(html).toContain("Walmart Marketplace Manager");
    expect(html).toContain("No Walmart products imported yet");
  });

  it("renders walmart connect credential form in production-only mode", () => {
    const html = renderToStaticMarkup(<WalmartConnectPage />);
    expect(html).toContain("ecomviper-walmart-connect-page");
    expect(html).toContain("Account nickname");
    expect(html).toContain("Client ID");
    expect(html).toContain("Client Secret");
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

  it("renders products page empty state without mock SKUs", () => {
    const html = renderToStaticMarkup(<WalmartProductsPage />);
    expect(html).toContain("No Walmart products imported yet");
    expect(html).not.toContain("OPA-OMEGA3-120");
  });

  it("renders activity page with empty state when no activity exists", () => {
    const html = renderToStaticMarkup(<WalmartActivityPage />);
    expect(html).toContain("No activity yet.");
  });
});

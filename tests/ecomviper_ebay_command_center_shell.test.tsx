import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import EbayLayout from "@/app/apps/ecomviper/ebay/layout";
import EcomViperEbayDashboardPage from "@/app/apps/ecomviper/ebay/page";

vi.mock("next/link", async () => {
  const React = await import("react");
  return {
    default: ({ href, children, ...props }: { href: string; children?: ReactNode }) =>
      React.createElement("a", { href, ...props }, children),
  };
});

vi.mock("next/navigation", () => ({
  usePathname: () => "/apps/ecomviper/ebay",
}));

describe("EcomViper eBay command-center shell", () => {
  it("renders the eBay workspace layout with sidebar and command-center navigation", () => {
    const page = EcomViperEbayDashboardPage();
    const html = renderToStaticMarkup(<EbayLayout>{page}</EbayLayout>);

    expect(html).toContain("ecomviper-ebay-layout");
    expect(html).toContain("ecomviper-ebay-sidebar");
    expect(html).toContain("eBay Agentic Workspace");
    expect(html).toContain(">Command Center<");
    expect(html).toContain(">Listing Intelligence<");
    expect(html).toContain(">AI Visibility<");
    expect(html).toContain(">Trust &amp; Reputation<");
    expect(html).toContain(">Sync &amp; Reconciliation<");
    expect(html).toContain(">Operator Actions<");
  });

  it("renders command-center metric and placeholder surfaces without exposing execute behavior", () => {
    const html = renderToStaticMarkup(<EcomViperEbayDashboardPage />);

    expect(html).toContain("ecomviper-ebay-metric-cards");
    expect(html).toContain("ecomviper-ebay-ai-visibility-panel");
    expect(html).toContain("ecomviper-ebay-trust-panel");
    expect(html).toContain("ecomviper-ebay-sync-panel");
    expect(html).toContain("ecomviper-ebay-operator-actions-panel");
    expect(html).toContain("No publish/execute action is available in this shell sprint.");

    expect(html).not.toContain("createOffer");
    expect(html).not.toContain("publishOffer");
  });
});

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import EcomViperEbayDashboardPage from "@/app/apps/ecomviper/ebay/page";
import { importEbayListingsForPhase1 } from "@/lib/ecomviper/ebay/dashboard";
import type { EbayDashboardConnectionSummary } from "@/lib/ecomviper/ebay/types";

function buildMockConnection(): EbayDashboardConnectionSummary {
  return {
    mode: "mock",
    connectionState: "mock_mode",
    environment: "sandbox",
    marketplace: "EBAY_US",
    readOnlyScope: "sell.inventory.readonly",
    checklist: [
      { key: "client_id", label: "eBay Client ID / App ID", configured: false },
      { key: "client_secret", label: "eBay Client Secret / Cert ID", configured: false },
      { key: "oauth_redirect", label: "OAuth redirect URL", configured: false },
      { key: "oauth_token", label: "Seller OAuth authorization token flow", configured: false },
      { key: "marketplace", label: "Marketplace (default EBAY_US)", configured: true },
    ],
    readOnlyBoundaryNote:
      "Phase 1 is read-only and mock-first. Listing changes are not pushed to eBay and no seller write actions are enabled.",
  };
}

describe("EcomViper eBay dashboard phase 1", () => {
  it("renders the /apps/ecomviper/ebay route", () => {
    const html = renderToStaticMarkup(<EcomViperEbayDashboardPage />);

    expect(html).toContain("ecomviper-ebay-dashboard");
    expect(html).toContain("Phase 1 Listing Optimization Dashboard");
    expect(html).toContain("ecomviper-ebay-connection-panel");
    expect(html).toContain("ecomviper-ebay-import-panel");
    expect(html).toContain("ecomviper-ebay-audit-table");
    expect(html).toContain("ecomviper-ebay-optimization-panel");
  });

  it("loads deterministic mock listings in mock mode", async () => {
    const connection = buildMockConnection();

    const firstImport = await importEbayListingsForPhase1(connection);
    const secondImport = await importEbayListingsForPhase1(connection);

    expect(firstImport.mode).toBe("mock");
    expect(firstImport.listings).toHaveLength(3);
    expect(firstImport.listings.map((entry) => entry.sku)).toEqual([
      "EV-EB-STRONG-001",
      "EV-EB-MEDIUM-001",
      "EV-EB-WEAK-001",
    ]);
    expect(secondImport.listings).toEqual(firstImport.listings);
  });

  it("shows explicit read-only and mock-first status", () => {
    const html = renderToStaticMarkup(<EcomViperEbayDashboardPage />);

    expect(html).toContain("Mock-first and read-only eBay listing optimization workspace");
    expect(html).toContain("Phase 1 is read-only and mock-first");
    expect(html).toContain("OAuth is intentionally not enabled in Phase 1.");
  });

  it("does not expose live eBay write operations in the phase 1 UI", () => {
    const html = renderToStaticMarkup(<EcomViperEbayDashboardPage />);

    expect(html).not.toContain("createOffer");
    expect(html).not.toContain("publishOffer");
    expect(html).not.toContain("updateInventoryItem");
    expect(html).not.toContain("bulkUpdatePriceQuantity");
    expect(html).not.toContain("deleteInventoryItem");
    expect(html).not.toContain("Revise Listing");
    expect(html).not.toContain("Submit update");
  });
});

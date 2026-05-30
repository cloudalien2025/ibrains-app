// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import EcomViperDashboardClient from "@/app/ecomviper/ecomviper-dashboard-client";
import type { EcomViperProductInventoryRow } from "@/lib/ecomviper/shopify/shopify-inventory-foundation";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

vi.mock("@/components/brains/back-to-brains-link", async () => {
  const React = await import("react");
  return {
    default: ({ className }: { className?: string }) =>
      React.createElement("a", { href: "/brains", className }, "← iBrains Dashboard"),
  };
});

function baseRows(): EcomViperProductInventoryRow[] {
  return [
    {
      id: "1",
      productEditorHref: "/ecomviper/products/roc948",
      imageUrl: null,
      productName: "Premium Nitric Oxide Gummies",
      sku: "ROC948",
      vendor: "OPA",
      productType: "Supplements",
      shopifyStatus: "active",
      supplierMatch: "rocktomic",
      supplierMatchedSku: "ROC948",
      supplierMatchConfidence: 1,
      supplierMatchReason: "exact_supplier_sku_match",
      supplierProductName: "Premium Nitric Oxide Gummies",
      aiPdpScore: 82,
      publishedToEcomViper: false,
      lastUpdated: "2026-05-20T00:00:00.000Z",
      inventoryStatus: "in_stock",
      inventorySource: "rocktomic",
    },
    {
      id: "2",
      productEditorHref: "/ecomviper/products/unmatched",
      imageUrl: null,
      productName: "Generic Product",
      sku: "GEN001",
      vendor: "OPA",
      productType: "General",
      shopifyStatus: "draft",
      supplierMatch: "unmatched",
      supplierMatchedSku: null,
      supplierMatchConfidence: 0,
      supplierMatchReason: "no_supplier_sku_match",
      supplierProductName: null,
      aiPdpScore: 40,
      publishedToEcomViper: false,
      lastUpdated: "2026-05-20T00:00:00.000Z",
      inventoryStatus: "unknown",
      inventorySource: "unknown",
    },
  ];
}

describe("ecomviper inventory foundation dashboard", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    pushMock.mockReset();
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
    delete (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
  });

  it("renders iBrains Dashboard header + sidebar IA without duplicate horizontal module navigation", async () => {
    await act(async () => {
      root.render(
        <EcomViperDashboardClient
          shopifyConnected={true}
          storeDomain="example.myshopify.com"
          shopifyStatusLabel="Connected"
          openAiStatusLabel="Connected"
          lastImportAt={null}
          productCount={2}
          sourceWarnings={[]}
          rows={baseRows()}
          rocktomicProductCount={140}
          rocktomicStatusLabel="Connected"
          rocktomicLastCheckedAt="2026-05-29T21:00:00.000Z"
        />
      );
    });

    const text = container.textContent || "";
    expect(text).toContain("EcomViper");
    expect(text).toContain("Products");
    expect(text).toContain("Image Studio");
    expect(text).toContain("Dropshipping");
    expect(text).toContain("Agentic Visibility");
    expect(text).toContain("Settings");
    expect(text).not.toContain("Overview");
    expect(text).toContain("iBrains Dashboard");
    expect(text).not.toContain("BrainOS");
    const backLink = container.querySelector('a[href="/brains"]');
    expect(backLink).not.toBeNull();
    expect(backLink?.textContent).toContain("iBrains Dashboard");
  });

  it("filters products by supplier match and supports row navigation", async () => {
    await act(async () => {
      root.render(
        <EcomViperDashboardClient
          shopifyConnected={true}
          storeDomain="example.myshopify.com"
          shopifyStatusLabel="Connected"
          openAiStatusLabel="Connected"
          lastImportAt={null}
          productCount={2}
          sourceWarnings={[]}
          rows={baseRows()}
          rocktomicProductCount={140}
          rocktomicStatusLabel="Connected"
          rocktomicLastCheckedAt="2026-05-29T21:00:00.000Z"
        />
      );
    });

    let rows = container.querySelectorAll('[data-testid="ecomviper-product-row"]');
    expect(rows.length).toBe(2);

    const selects = Array.from(container.querySelectorAll("select"));
    const supplierSelect = selects[0] as HTMLSelectElement;
    await act(async () => {
      supplierSelect.value = "rocktomic";
      supplierSelect.dispatchEvent(new Event("change", { bubbles: true }));
    });

    rows = container.querySelectorAll('[data-testid="ecomviper-product-row"]');
    expect(rows.length).toBe(1);
    expect(container.textContent).toContain("Premium Nitric Oxide Gummies");
    expect(container.textContent).not.toContain("Generic Product");
    expect(container.textContent).toContain("Supplier Feed:");
    expect(container.textContent).toContain("Supplier Records:");
    expect(container.textContent).toContain("Open supplier diagnostics");
    expect(container.textContent).toContain("Matched (ROC948)");
    expect(container.textContent).not.toContain("Rocktomic records");
    expect(container.textContent).not.toContain("Open Rocktomic diagnostics");

    await act(async () => {
      (rows[0] as HTMLTableRowElement).click();
    });

    expect(pushMock).toHaveBeenCalledWith("/ecomviper/products/roc948");
  });
});

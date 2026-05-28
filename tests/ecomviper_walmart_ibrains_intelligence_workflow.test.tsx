// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import WalmartIBrainsIntelligenceClient from "@/app/optiwal/ibrains-intelligence/walmart-ibrains-intelligence-client";
import type { WalmartEffectiveProductRecord } from "@/lib/ecomviper/walmart/walmart-product-display";

function createProduct(overrides?: Partial<WalmartEffectiveProductRecord>): WalmartEffectiveProductRecord {
  return {
    id: "walmart_ibrains_001",
    marketplace: "walmart",
    sku: "IBR-001",
    externalItemId: "wm_ibrains_001",
    title: "Daily Wellness Capsules",
    brand: "OPA Nutrition",
    category: "Supplements",
    price: 24.99,
    inventoryQuantity: 14,
    inventoryStatus: "known",
    status: "attention",
    imageUrl: "https://images.example.com/ibrains-001.jpg",
    issues: ["Add FAQ coverage"],
    attributes: {
      target_audience: "Adults",
      product_form: "Capsule",
    },
    searchBrowseAttributes: {
      lifestyle: "Wellness",
    },
    shortDescription: "Supports daily wellness routines.",
    longDescription: "Designed to support daily wellness and digestive balance.",
    bulletPoints: [
      "Supports daily wellness goals",
      "Designed for routine nutritional support",
      "Includes ingredient transparency",
    ],
    rawPayload: {},
    normalizedPayload: {},
    lastSyncedAt: "2026-05-10T00:00:00.000Z",
    createdAt: "2026-05-10T00:00:00.000Z",
    updatedAt: "2026-05-10T00:00:00.000Z",
    ...overrides,
  };
}

function flush() {
  return act(async () => {
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe("Walmart iBrains Intelligence workflow UI", () => {
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
    delete (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
  });

  it("renders header, product selector, and run button", async () => {
    await act(async () => {
      root.render(
        <WalmartIBrainsIntelligenceClient
          products={[
            createProduct(),
            createProduct({
              id: "walmart_ibrains_002",
              sku: "IBR-002",
              title: "Metabolic Wellness Support",
            }),
          ]}
        />
      );
    });

    expect(container.querySelector('[data-testid="ibrains-intelligence-page"]')).not.toBeNull();
    expect(container.textContent).toContain("iBrains Intelligence");

    const productSelect = container.querySelector(
      '[data-testid="ibrains-intelligence-product-select"]'
    ) as HTMLSelectElement | null;
    expect(productSelect).not.toBeNull();
    expect(container.textContent).toContain("Run iBrains Intelligence");
    expect(container.innerHTML).toContain("Daily Wellness Capsules | SKU: IBR-001");
  });

  it("runs intelligence for selected product and renders summary, opportunities, and drafts", async () => {
    await act(async () => {
      root.render(
        <WalmartIBrainsIntelligenceClient
          products={[
            createProduct(),
            createProduct({
              id: "walmart_ibrains_002",
              sku: "IBR-002",
              title: "Metabolic Wellness Support",
              longDescription: "Designed to support metabolic wellness and daily energy support.",
            }),
          ]}
        />
      );
    });

    const productSelect = container.querySelector(
      '[data-testid="ibrains-intelligence-product-select"]'
    ) as HTMLSelectElement;

    await act(async () => {
      productSelect.value = "IBR-002";
      productSelect.dispatchEvent(new Event("change", { bubbles: true }));
    });

    const runButton = container.querySelector(
      '[data-testid="ibrains-intelligence-run-button"]'
    ) as HTMLButtonElement;

    await act(async () => {
      runButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    expect(container.querySelector('[data-testid="ibrains-intelligence-summary"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="ibrains-intelligence-score-card"]')).not.toBeNull();
    expect(container.textContent).toContain("Agentic Visibility Score");
    expect(container.textContent).toContain("High-Impact Actions");
    expect(container.querySelector('[data-testid="ibrains-intelligence-opportunities-table"]')).not.toBeNull();
    expect(container.querySelectorAll('[data-testid="ibrains-intelligence-opportunity-row"]').length).toBeGreaterThan(0);
    expect(container.textContent).toContain("Recommended action");
    expect(container.querySelector('[data-testid="ibrains-intelligence-drafts-panel"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="ibrains-intelligence-copy-draft-button"]')).not.toBeNull();
    expect(container.textContent).toContain("You approve before anything is published externally");
  });
});

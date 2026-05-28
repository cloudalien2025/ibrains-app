// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import WalmartIBrainsIntelligenceClient from "@/app/optiwal/ibrains-intelligence/walmart-ibrains-intelligence-client";
import type { WalmartNetworkConnection } from "@/lib/ecomviper/walmart/walmart-network-connections";
import type { WalmartEffectiveProductRecord } from "@/lib/ecomviper/walmart/walmart-product-display";

function createProduct(overrides?: Partial<WalmartEffectiveProductRecord>): WalmartEffectiveProductRecord {
  return {
    id: "walmart_destination_001",
    marketplace: "walmart",
    sku: "DEST-001",
    externalItemId: "wm_destination_001",
    title: "Magnesium Glycinate Capsules",
    brand: "OPA Nutrition",
    category: "Supplements",
    price: 24.99,
    inventoryQuantity: 9,
    inventoryStatus: "known",
    status: "attention",
    imageUrl: "https://images.example.com/destination-001.jpg",
    issues: [],
    attributes: {
      target_audience: "Adults",
      product_form: "Capsule",
    },
    searchBrowseAttributes: {
      wellness_goal: "Sleep support",
    },
    shortDescription: "Supports nightly wellness routines.",
    longDescription: "Magnesium glycinate formula for nightly wellness and routine support.",
    bulletPoints: ["Nightly routine support", "Ingredient transparency"],
    rawPayload: {},
    normalizedPayload: {},
    lastSyncedAt: "2026-05-17T00:00:00.000Z",
    createdAt: "2026-05-17T00:00:00.000Z",
    updatedAt: "2026-05-17T00:00:00.000Z",
    ...overrides,
  };
}

function createConnections(): WalmartNetworkConnection[] {
  return [
    {
      id: "conn_consumersun",
      name: "consumersun.com",
      platform: "wordpress",
      url: "https://consumersun.com",
      status: "connected",
      publishingMode: "draft_only",
      defaultPublishingStatus: "draft",
      guardrails: {
        primaryNiche: "Product reviews",
        secondaryNiches: ["consumer buying guides", "supplement reviews"],
        allowedTopics: ["product reviews", "comparison articles", "buyer guides", "wellness"],
        blockedTopics: [],
        preferredContentTypes: ["product review", "roundup article", "comparison post"],
        audience: "General consumers researching products",
      },
      createdAt: "2026-05-17T00:00:00.000Z",
      updatedAt: "2026-05-17T00:00:00.000Z",
    },
    {
      id: "conn_pingdiet",
      name: "pingdiet.com",
      platform: "wordpress",
      url: "https://pingdiet.com",
      status: "connected",
      publishingMode: "draft_only",
      defaultPublishingStatus: "draft",
      guardrails: {
        primaryNiche: "Intermittent fasting",
        secondaryNiches: ["diet routines"],
        allowedTopics: ["fasting", "diet", "meal timing"],
        blockedTopics: [],
        preferredContentTypes: ["fasting guides"],
        audience: "People interested in intermittent fasting",
      },
      createdAt: "2026-05-17T00:00:00.000Z",
      updatedAt: "2026-05-17T00:00:00.000Z",
    },
    {
      id: "conn_prostatefoods",
      name: "prostatefoods.com",
      platform: "wordpress",
      url: "https://prostatefoods.com",
      status: "connected",
      publishingMode: "draft_only",
      defaultPublishingStatus: "draft",
      guardrails: {
        primaryNiche: "Men's health",
        secondaryNiches: ["prostate wellness"],
        allowedTopics: ["prostate-friendly foods", "urinary wellness"],
        blockedTopics: ["women health", "pregnancy", "children health"],
        preferredContentTypes: ["food guides"],
        audience: "Adult men interested in prostate wellness",
      },
      createdAt: "2026-05-17T00:00:00.000Z",
      updatedAt: "2026-05-17T00:00:00.000Z",
    },
  ];
}

function flush() {
  return act(async () => {
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe("Walmart iBrains destination-aware recommendations", () => {
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

  it("shows destination-specific recommendations and filters poor-fit properties from primary output", async () => {
    await act(async () => {
      root.render(
        <WalmartIBrainsIntelligenceClient
          products={[createProduct()]}
          networkConnections={createConnections()}
        />
      );
    });

    const runButton = container.querySelector('[data-testid="ibrains-intelligence-run-button"]') as HTMLButtonElement;
    await act(async () => {
      runButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    expect(container.querySelector('[data-testid="ibrains-intelligence-connected-properties"]')).not.toBeNull();
    expect(container.textContent).toContain("consumersun.com");
    expect(container.textContent).toContain("pingdiet.com");

    const table = container.querySelector('[data-testid="ibrains-intelligence-opportunities-table"]') as HTMLElement;
    expect(table.textContent).toContain("Recommended destination");
    expect(table.textContent).toContain("Create WordPress");
    expect(table.textContent).toContain("consumersun.com");
    expect(table.textContent).not.toContain("Use on your website");
    expect(table.textContent).not.toContain("Skipped prostatefoods.com");

    expect(container.textContent).toContain("You approve before anything is published externally");
  });

  it("shows no-match fallback when no strong connected destination is available", async () => {
    await act(async () => {
      root.render(
        <WalmartIBrainsIntelligenceClient
          products={[
            createProduct({
              sku: "DEST-FAST-001",
              title: "Intermittent Fasting Electrolyte Powder",
              category: "Diet",
              shortDescription: "Supports meal timing routines.",
              longDescription: "Designed for intermittent fasting and meal timing support.",
            }),
          ]}
          networkConnections={[]}
        />
      );
    });

    const runButton = container.querySelector('[data-testid="ibrains-intelligence-run-button"]') as HTMLButtonElement;
    await act(async () => {
      runButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    const table = container.querySelector('[data-testid="ibrains-intelligence-opportunities-table"]') as HTMLElement;
    expect(table.textContent).toContain("No strong matching connected property found for this topic yet");
    expect(table.textContent).toContain("Use on Walmart listing");
    expect(table.textContent).toContain("add a new WordPress property for this niche");
    expect(table.textContent).not.toContain("Skipped");
  });
});

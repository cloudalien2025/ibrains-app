import { describe, expect, it } from "vitest";
import {
  scoreWordpressDestinationFit,
  runWalmartIBrainsIntelligence,
} from "@/lib/ecomviper/walmart/walmart-ibrains-intelligence";
import type { WalmartNetworkConnection } from "@/lib/ecomviper/walmart/walmart-network-connections";
import type { WalmartEffectiveProductRecord } from "@/lib/ecomviper/walmart/walmart-product-display";

function createProduct(overrides?: Partial<WalmartEffectiveProductRecord>): WalmartEffectiveProductRecord {
  return {
    id: "walmart_guardrail_001",
    marketplace: "walmart",
    sku: "GR-001",
    externalItemId: "wm_guardrail_001",
    title: "Magnesium Glycinate Sleep Support Capsules",
    brand: "OPA Nutrition",
    category: "Supplements",
    price: 24.99,
    inventoryQuantity: 12,
    inventoryStatus: "known",
    status: "attention",
    imageUrl: "https://images.example.com/guardrail-001.jpg",
    issues: [],
    attributes: {
      target_audience: "Adults",
      product_form: "Capsule",
    },
    searchBrowseAttributes: {
      wellness_goal: "Sleep support",
    },
    shortDescription: "Supports nightly wellness routines.",
    longDescription: "Formulated for nightly wellness and routine sleep support.",
    bulletPoints: ["Magnesium glycinate formula", "Nightly routine support"],
    rawPayload: {},
    normalizedPayload: {},
    lastSyncedAt: "2026-05-17T00:00:00.000Z",
    createdAt: "2026-05-17T00:00:00.000Z",
    updatedAt: "2026-05-17T00:00:00.000Z",
    ...overrides,
  };
}

const consumersun: WalmartNetworkConnection = {
  id: "conn_consumersun",
  name: "consumersun.com",
  platform: "wordpress",
  url: "https://consumersun.com",
  status: "connected",
  publishingMode: "draft_only",
  defaultPublishingStatus: "draft",
  guardrails: {
    primaryNiche: "Product reviews",
    secondaryNiches: ["consumer buying guides", "wellness products"],
    allowedTopics: ["product reviews", "comparison articles", "buyer guides"],
    blockedTopics: ["children health"],
    preferredContentTypes: ["product review", "roundup article", "comparison post"],
    audience: "General consumers researching products",
    notesForIBrains: "Prioritize buyer-guide angles.",
  },
  createdAt: "2026-05-17T00:00:00.000Z",
  updatedAt: "2026-05-17T00:00:00.000Z",
};

const prostatefoods: WalmartNetworkConnection = {
  id: "conn_prostatefoods",
  name: "prostatefoods.com",
  platform: "wordpress",
  url: "https://prostatefoods.com",
  status: "connected",
  publishingMode: "draft_only",
  defaultPublishingStatus: "draft",
  guardrails: {
    primaryNiche: "Men's health",
    secondaryNiches: ["prostate wellness", "healthy aging"],
    allowedTopics: ["men wellness", "prostate-friendly foods"],
    blockedTopics: ["women health", "pregnancy", "children health", "generic product reviews"],
    preferredContentTypes: ["educational articles", "food guides"],
    audience: "Adult men interested in prostate wellness",
  },
  createdAt: "2026-05-17T00:00:00.000Z",
  updatedAt: "2026-05-17T00:00:00.000Z",
};

describe("Walmart network connection guardrails", () => {
  it("scores a strong topical fit for aligned WordPress destination", () => {
    const fit = scoreWordpressDestinationFit({
      product: createProduct(),
      template: {
        topicalKeywords: ["product", "review", "buyer", "guide"],
        desiredContentType: "product review",
        contentAngle: "Best magnesium glycinate capsules for nightly wellness routines",
      },
      connection: consumersun,
    });

    expect(fit.destinationName).toBe("consumersun.com");
    expect(fit.fitScore).toBeGreaterThanOrEqual(55);
    expect(fit.rationale).toContain("primary niche");
  });

  it("filters poor-fit destinations from primary recommendations", () => {
    const fastingProduct = createProduct({
      sku: "GR-FAST-001",
      title: "Intermittent Fasting Electrolyte Support",
      category: "Diet",
      shortDescription: "Supports fasting routine hydration.",
      longDescription: "Designed for intermittent fasting and meal timing support.",
      bulletPoints: ["Intermittent fasting support", "Meal timing hydration"],
    });

    const run = runWalmartIBrainsIntelligence(fastingProduct, {
      networkConnections: [prostatefoods],
    });

    const wordpressRecommendations = run.opportunities.filter(
      (opportunity) => opportunity.destination.destinationType === "wordpress_site"
    );

    expect(wordpressRecommendations.length).toBe(0);
    expect(run.summary.strongDestinationMatches).toBe(0);
    expect(run.opportunities.some((opportunity) => opportunity.recommendedAction.includes("Skipped"))).toBe(false);
  });
});

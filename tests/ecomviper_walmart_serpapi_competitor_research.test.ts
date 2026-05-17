import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WalmartProductRecord } from "@/lib/ecomviper/walmart/walmart-types";
import {
  buildWalmartCompetitorResearchQueries,
  getWalmartSerpApiCompetitorIntelligence,
} from "@/lib/ecomviper/walmart/walmart-serpapi-competitor-research";
import { saveWalmartSerpApiConnectionForUser } from "@/lib/ecomviper/walmart/walmart-serpapi-connection";

const TEST_ENCRYPTION_KEY = Buffer.alloc(32, 21).toString("base64");

function createProduct(overrides?: Partial<WalmartProductRecord>): WalmartProductRecord {
  return {
    id: "walmart_comp_1",
    marketplace: "walmart",
    sku: "COMP-1",
    externalItemId: "wm_comp_1",
    title: "OPA Magnesium Sleep Support Gummies 60ct",
    brand: "OPA",
    category: "Supplements",
    price: 19.99,
    inventoryQuantity: 8,
    inventoryStatus: "known",
    status: "attention",
    imageUrl: "",
    imageStatus: "catalog_missing",
    imageSyncStatus: "not_found",
    imageSource: "walmart_item_search",
    issues: [],
    attributes: {
      main_ingredients: "Magnesium, Chamomile",
      support_areas: "sleep quality, relaxation",
      product_form: "Gummy",
      count: "60 count",
    },
    searchBrowseAttributes: {
      product_type: "Sleep Supplement",
      supplement_type: "Magnesium Supplement",
      main_ingredients: "Magnesium, Chamomile",
      support_areas: "sleep quality, relaxation",
      product_form: "Gummy",
      count: "60 count",
      target_audience: "Adults",
    },
    shortDescription: "",
    longDescription: "",
    bulletPoints: [],
    rawPayload: {},
    normalizedPayload: {},
    lastSyncedAt: "2026-05-12T00:00:00.000Z",
    createdAt: "2026-05-12T00:00:00.000Z",
    updatedAt: "2026-05-12T00:00:00.000Z",
    ...overrides,
  };
}

describe("Walmart SerpApi competitor research", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.ECOMVIPER_CREDENTIAL_ENCRYPTION_KEY = TEST_ENCRYPTION_KEY;
    (globalThis as Record<string, unknown>).__ecomviper_walmart_serpapi_connection_fallback__ = undefined;
    (globalThis as Record<string, unknown>).__ecomviper_walmart_competitor_cache__ = undefined;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.ECOMVIPER_CREDENTIAL_ENCRYPTION_KEY;
  });

  it("builds relevant Walmart competitor research queries from docket facts", () => {
    const queries = buildWalmartCompetitorResearchQueries({
      product: createProduct(),
    });

    expect(queries.length).toBeGreaterThan(0);
    expect(queries.join(" ").toLowerCase()).toContain("magnesium");
    expect(queries.join(" ").toLowerCase()).toContain("sleep");
    expect(queries.join(" ").toLowerCase()).toContain("supplement");
  });

  it("is credential-gated and returns skipped_no_credentials without network calls", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");

    const result = await getWalmartSerpApiCompetitorIntelligence({
      userId: "user_no_key",
      product: createProduct(),
    });

    expect(result.status).toBe("skipped_no_credentials");
    expect(result.competitors).toHaveLength(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns provider fallback on timeout and does not block optimization", async () => {
    await saveWalmartSerpApiConnectionForUser({
      userId: "user_timeout",
      apiKey: "serpapi_test_timeout_12345",
    });

    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("request timeout"));

    const result = await getWalmartSerpApiCompetitorIntelligence({
      userId: "user_timeout",
      product: createProduct(),
      timeoutMs: 2000,
    });

    expect(result.status === "timeout" || result.status === "provider_error").toBe(true);
    expect(result.warnings.join(" ").toLowerCase()).toContain("local docket facts");
  });

  it("summarizes competitor patterns without copying raw competitor title text", async () => {
    await saveWalmartSerpApiConnectionForUser({
      userId: "user_available",
      apiKey: "serpapi_test_available_12345",
    });

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          organic_results: [
            {
              title: "Brand X Magnesium Sleep Gummies 60 Count with Melatonin",
              us_item_id: "10000001",
              price: "$14.99",
            },
            {
              title: "Brand Y Relaxation Magnesium Capsules 120 Count",
              us_item_id: "10000002",
              price: "$17.49",
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const result = await getWalmartSerpApiCompetitorIntelligence({
      userId: "user_available",
      product: createProduct(),
    });

    expect(result.status).toBe("available");
    expect(result.competitors.length).toBeGreaterThan(0);
    expect(result.patterns.titlePatterns.join(" ")).not.toContain(
      "Brand X Magnesium Sleep Gummies 60 Count with Melatonin"
    );
    expect(result.patterns.titlePatterns.length).toBeGreaterThan(0);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { CasaHudCampaign } from "@/lib/studio/domara/campaigns";
import { createEmptyCasaHudExecutionData } from "@/lib/studio/domara/campaign-execution";
import { createEmptyCasaHudLocationData } from "@/lib/studio/domara/campaign-location-intelligence";
import { createEmptyCasaHudMediaPlanData } from "@/lib/studio/domara/campaign-media-planning";
import { createEmptyCasaHudScriptData } from "@/lib/studio/domara/campaign-script-narrative";
import { createEmptyCasaHudYouTubePackageData } from "@/lib/studio/domara/campaign-youtube-package";

const userId = "11111111-1111-4111-8111-111111111111";

function buildCampaign(): CasaHudCampaign {
  return {
    id: "casahud-browser-import-route",
    name: "Could You Retire in Southern Italy for Under $300K?",
    selectedViralTitle: "Could You Retire in Southern Italy for Under $300K?",
    selectedTitle: {
      title: "Could You Retire in Southern Italy for Under $300K?",
      score: 92,
      campaignType: "lifestyle_relocation",
      confidence: 0.88,
      reasoning: "Believable hook.",
      regionHint: "Southern Italy",
      listingSearchHints: ["Southern Italy homes under 300k"],
    },
    titleCandidates: [],
    researchBrief: {
      summary: "Strong relocation opportunity.",
      opportunityCategories: ["relocation"],
      competitorPatterns: [],
      audienceIntent: ["retire in Italy"],
      suggestedTitleDirections: [],
      riskNotes: [],
    },
    campaignType: "lifestyle_relocation",
    marketRegionHint: "Southern Italy",
    preferredMarket: "Italian real-estate YouTube",
    generationSource: {
      mode: "casahud_patterns",
      label: "CasaHUD opportunity patterns",
      detail: "Using CasaHUD opportunity patterns.",
      canImproveWithYouTube: true,
    },
    confidenceReasoning: {
      summary: "Strong support.",
      titleOpportunitySummary: "The hook is supportable.",
      selectedTitleReasoning: "Budget plus geography.",
      selectedTitleConfidence: 0.88,
    },
    status: "campaign_created",
    listingCandidates: [],
    listingSearchCriteria: null,
    listingProviderStatuses: [],
    discoverySummary: null,
    listingDiscoveryStatus: "not_started",
    approvedListings: [],
    rejectedListings: [],
    listingRankOrder: [],
    listingValidationStatus: "not_started",
    listingValidationSummary: null,
    titleSupportConfidence: null,
    validationWarnings: [],
    ...createEmptyCasaHudLocationData(),
    ...createEmptyCasaHudScriptData(),
    ...createEmptyCasaHudMediaPlanData(),
    ...createEmptyCasaHudYouTubePackageData(),
    ...createEmptyCasaHudExecutionData(),
    nextPhase: {
      key: "property_discovery",
      label: "Find matching properties",
      detail: "Property Discovery comes next.",
      implemented: false,
    },
    createdAt: "2026-04-30T00:00:00.000Z",
    updatedAt: "2026-04-30T00:00:00.000Z",
    generatedAt: "2026-04-30T00:00:00.000Z",
    futureState: {
      listingCandidates: [],
      approvedListings: [],
      rejectedListings: [],
      listingRankOrder: [],
      locationIntelligence: null,
      mapPoiBundle: null,
      script: null,
      storyboard: null,
      mediaPlan: null,
      packaging: null,
      renderStatus: null,
      reviewStatus: null,
      approvalStatus: null,
      publishStatus: null,
      scheduleStatus: null,
    },
  };
}

const browserPayload = {
  version: "casahud-browser-import-v1",
  sourceUrl: "https://www.immobiliare.it/en/annunci/121869400/",
  canonicalUrl: "https://www.immobiliare.it/en/annunci/121869400/",
  providerHost: "www.immobiliare.it",
  capturedAt: "2026-04-30T10:00:00.000Z",
  title: "Single family villa via San Berardino, Albanella - immobiliare.it",
  metaDescription:
    "€299.000 single family villa in Albanella, Salerno, Campania with 3 bedrooms, 2 bathrooms, 150 m² interior, 1,106 m² garden, and private parking.",
  openGraph: {
    title: "Single family villa via San Berardino, Albanella",
    description:
      "Renovated independent villa with private garden, pool potential, nearby services, and about 25 minutes from the Paestum coast.",
    image: "https://images.example.com/albanella-og.jpg",
  },
  visibleText: `
    Price
    €299.000
    Address
    Via San Berardino, Albanella, Salerno, Campania, Italy
    Property type
    Single family villa
    Bedrooms
    3
    Bathrooms
    2
    Interior size
    150 m²
    Garden
    1.106 m²
    Garage / Parking
    2 garage/box spaces · 3 parking spaces
    Energy class
    D
  `,
  imageCandidates: [{ url: "https://images.example.com/albanella-og.jpg", source: "og" as const }],
};

const mocks = vi.hoisted(() => ({
  ensureUser: vi.fn(),
  resolveUserId: vi.fn(),
  isCasaHudCampaignStoreAvailable: vi.fn(),
  isCasaHudCampaignStoreUnavailable: vi.fn(),
  getCasaHudCampaign: vi.fn(),
  saveCasaHudCampaign: vi.fn(),
}));

vi.mock("@/app/api/ecomviper/_utils/user", () => ({
  ensureUser: mocks.ensureUser,
  resolveUserId: mocks.resolveUserId,
}));

vi.mock("@/lib/studio/domara/campaign-repository", () => ({
  isCasaHudCampaignStoreAvailable: mocks.isCasaHudCampaignStoreAvailable,
  isCasaHudCampaignStoreUnavailable: mocks.isCasaHudCampaignStoreUnavailable,
  getCasaHudCampaign: mocks.getCasaHudCampaign,
  saveCasaHudCampaign: mocks.saveCasaHudCampaign,
}));

describe("CasaHUD browser import route", () => {
  beforeEach(() => {
    mocks.ensureUser.mockReset();
    mocks.resolveUserId.mockReset();
    mocks.isCasaHudCampaignStoreAvailable.mockReset();
    mocks.isCasaHudCampaignStoreUnavailable.mockReset();
    mocks.getCasaHudCampaign.mockReset();
    mocks.saveCasaHudCampaign.mockReset();

    mocks.ensureUser.mockResolvedValue(undefined);
    mocks.resolveUserId.mockReturnValue(userId);
    mocks.isCasaHudCampaignStoreAvailable.mockResolvedValue(true);
    mocks.isCasaHudCampaignStoreUnavailable.mockReturnValue(false);
    mocks.getCasaHudCampaign.mockResolvedValue(buildCampaign());
    mocks.saveCasaHudCampaign.mockImplementation(async (_userId: string, campaign: CasaHudCampaign) => campaign);
  });

  it("accepts a browser capture payload and persists a browser_assisted_import candidate", async () => {
    const route = await import("@/app/api/studio/domara/campaigns/[id]/browser-import/route");
    const request = new NextRequest("http://localhost/api/studio/domara/campaigns/casahud-browser-import-route/browser-import", {
      method: "POST",
      body: JSON.stringify({
        payload: browserPayload,
        manualDetails: {
          manualLifestyleAngle: "Southern Italy villa living with a private garden and coastal access.",
        },
      }),
    });

    const response = await route.POST(request, { params: { id: "casahud-browser-import-route" } });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.listing.sourceType).toBe("browser_assisted_import");
    expect(payload.listing.sourceLabel).toBe("Immobiliare");
    expect(payload.listing.price).toBe(299000);
    expect(payload.listing.locationText).toContain("Albanella");
    expect(payload.listing.featuredImageUrl).toBe("https://images.example.com/albanella-og.jpg");
    expect(payload.listing.rawProviderMetadata.importMethod).toBe("browser_assisted");
    expect(payload.listing.casaHudNarrationSeed).toContain("€299,000");
    expect(mocks.saveCasaHudCampaign).toHaveBeenCalledOnce();
  });

  it("rejects unsafe source URLs", async () => {
    const route = await import("@/app/api/studio/domara/campaigns/[id]/browser-import/route");
    const request = new NextRequest("http://localhost/api/studio/domara/campaigns/casahud-browser-import-route/browser-import", {
      method: "POST",
      body: JSON.stringify({
        payload: {
          ...browserPayload,
          sourceUrl: "http://127.0.0.1/private",
        },
      }),
    });

    const response = await route.POST(request, { params: { id: "casahud-browser-import-route" } });
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.ok).toBe(false);
    expect(payload.error.message).toMatch(/Only http\/https|local|private/i);
  });

  it("rejects payloads that contain sensitive browser fields", async () => {
    const route = await import("@/app/api/studio/domara/campaigns/[id]/browser-import/route");
    const request = new NextRequest("http://localhost/api/studio/domara/campaigns/casahud-browser-import-route/browser-import", {
      method: "POST",
      body: JSON.stringify({
        payload: {
          ...browserPayload,
          localStorage: { token: "secret" },
        },
      }),
    });

    const response = await route.POST(request, { params: { id: "casahud-browser-import-route" } });
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.ok).toBe(false);
    expect(payload.error.message).toContain("visible page text, metadata, and image candidates");
  });
});

describe("CasaHUD bookmarklet loader route", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses forwarded production host and never emits localhost in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("APP_PUBLIC_URL", "");
    vi.stubEnv("APP_URL", "");

    const route = await import("@/app/api/studio/domara/browser-import/bookmarklet/route");
    const request = new NextRequest(
      "http://localhost:3001/api/studio/domara/browser-import/bookmarklet?campaignId=campaign id/with space",
      {
        method: "GET",
        headers: {
          host: "localhost:3001",
          "x-forwarded-host": "app.ibrains.ai",
          "x-forwarded-proto": "https",
        },
      },
    );

    const response = await route.GET(request);
    const script = await response.text();

    expect(response.status).toBe(200);
    expect(script).toContain('var APP_ORIGIN = "https://app.ibrains.ai"');
    expect(script).toContain("/apps/studio/casahud/import");
    expect(script).toContain("captureMethod");
    expect(script).toContain('var CAMPAIGN_ID_ENCODED = "campaign%20id%2Fwith%20space"');
    expect(script).not.toContain("localhost");
  });

  it("defaults public hosts to https when forwarded proto is missing in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("APP_PUBLIC_URL", "");
    vi.stubEnv("APP_URL", "");

    const route = await import("@/app/api/studio/domara/browser-import/bookmarklet/route");
    const request = new NextRequest("http://localhost:3001/api/studio/domara/browser-import/bookmarklet?campaignId=test-campaign", {
      method: "GET",
      headers: {
        host: "app.ibrains.ai",
      },
    });

    const response = await route.GET(request);
    const script = await response.text();

    expect(response.status).toBe(200);
    expect(script).toContain('var APP_ORIGIN = "https://app.ibrains.ai"');
    expect(script).not.toContain('var APP_ORIGIN = "http://app.ibrains.ai"');
  });

  it("keeps localhost fallback for local development/test when no public origin is configured", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("APP_PUBLIC_URL", "");
    vi.stubEnv("APP_URL", "");

    const route = await import("@/app/api/studio/domara/browser-import/bookmarklet/route");
    const request = new NextRequest("http://localhost:3001/api/studio/domara/browser-import/bookmarklet?campaignId=test-campaign", { method: "GET" });

    const response = await route.GET(request);
    const script = await response.text();

    expect(response.status).toBe(200);
    expect(script).toContain('var APP_ORIGIN = "http://localhost:3001"');
    expect(script).toContain('var CAMPAIGN_ID_ENCODED = "test-campaign"');
  });

  it("returns a campaign-aware loader script for Browser Import Review without secrets", async () => {
    const route = await import("@/app/api/studio/domara/browser-import/bookmarklet/route");
    const request = new NextRequest(
      "https://app.ibrains.ai/api/studio/domara/browser-import/bookmarklet?campaignId=test-campaign",
      { method: "GET" },
    );

    const response = await route.GET(request);
    const script = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/javascript");
    expect(script).toContain("/apps/studio/casahud/import");
    expect(script).toContain("captureMethod");
    expect(script).toContain("test-campaign");
    expect(script).toContain("window.open");
    expect(script).not.toContain("OPENAI_API_KEY");
    expect(script).not.toContain("Authorization");
  });
});

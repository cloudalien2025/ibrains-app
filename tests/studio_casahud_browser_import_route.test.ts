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
      label: "CasaFlix opportunity patterns",
      detail: "Using CasaFlix opportunity patterns.",
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
  sourceUrl: "https://www.immobiliare.it/en/annunci/114752041/",
  canonicalUrl: "https://www.immobiliare.it/en/annunci/114752041/",
  providerHost: "www.immobiliare.it",
  capturedAt: "2026-04-30T10:00:00.000Z",
  title: "via Capaccio-Paestum 13 Capaccio Paestum. Good condition Single family villa with Terrace - immobiliare.it",
  metaDescription:
    "Don&#39;t miss this opportunity! Capaccio Paestum detached villa, just 500 meters from th...",
  openGraph: {
    title: "Single family villa via Capaccio-Paestum 13, Capaccio Paestum",
    description:
      "Don&#39;t miss this opportunity! Capaccio Paestum detached villa with terrace and parking near the coast.",
    image: "https://images.example.com/capaccio-og.jpg",
  },
  visibleText: `
    Price
    €299.000
    Location
    via Capaccio-Paestum 13 Capaccio Paestum. Good condition, parking space, with terrace, independent heating,
    Address
    Via Capaccio-Paestum 13, Capaccio Paestum, Salerno, Campania, Italy
    Property type
    Single family villa
    Rooms
    4+
    Bedrooms
    4
    Bathrooms
    3
    Interior size
    200 m²
    Garage / Parking
    , car parking,
    Energy class
    D
    Description
    Don&#39;t miss this opportunity! Capaccio Paestum detached villa with panoramic exposure just 500 meters from the town center and close to the coast.
  `,
  imageCandidates: [{ url: "https://images.example.com/capaccio-og.jpg", source: "og" as const }],
};

const immobiliareFieldAccuracyPayload = {
  version: "casahud-browser-import-v1",
  sourceUrl: "https://www.immobiliare.it/en/annunci/127142643/",
  canonicalUrl: "https://www.immobiliare.it/en/annunci/127142643/",
  providerHost: "www.immobiliare.it",
  capturedAt: "2026-05-01T08:20:00.000Z",
  title: "Single family villa Contrada Lacagnina, Acqualadrone - Sparta, Messina",
  openGraph: {
    title: "Single family villa Contrada Lacagnina, Acqualadrone - Sparta, Messina",
    description:
      "Detached villa in Messina with visible facts for rooms, bathrooms, and interior surface.",
    image: "https://images.example.com/acqualadrone-og.jpg",
  },
  metaDescription:
    "EUR 300,000 single family villa in Acqualadrone - Sparta, Messina with 5+ rooms, 2 bathrooms and 187 m2 surface.",
  visibleText: `
    Single family villa Contrada Lacagnina, Acqualadrone - Sparta, Messina
    Price
    EUR 300,000
    Rooms
    5+
    Surface
    187 m2
    Bathrooms
    2
    +8 photos
    11 Photos
    1/11
    Listing ID 127142643
    Ref. 287
    Description
    Detached villa with panoramic exposure and outdoor space in the Acqualadrone area of Messina.
  `,
  imageCandidates: [{ url: "https://images.example.com/acqualadrone-og.jpg", source: "og" as const }],
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

describe("CasaFlix browser import route", () => {
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
    expect(payload.campaign.listingCandidates).toHaveLength(1);
    expect(payload.summary.listingCandidateCount).toBe(1);
    expect(payload.listing.sourceType).toBe("browser_assisted_import");
    expect(payload.listing.sourceLabel).toBe("Immobiliare");
    expect(payload.listing.price).toBe(299000);
    expect(payload.listing.priceText).toBe("€299,000");
    expect(payload.listing.locationText).toContain("Capaccio Paestum");
    expect(payload.listing.locationText).not.toContain("Good condition");
    expect(payload.listing.garageParking).toBe("Car parking");
    expect(payload.listing.descriptionSnippet).toContain("Don't miss this opportunity");
    expect(payload.listing.descriptionSnippet).not.toContain("Don&#39;t");
    expect(payload.listing.needsReviewFields || []).not.toContain("price");
    expect(payload.listing.featuredImageUrl).toBe("https://images.example.com/capaccio-og.jpg");
    expect(payload.listing.rawProviderMetadata.importMethod).toBe("browser_assisted");
    expect(payload.listing.casaHudNarrationSeed).toContain("€299,000");
    expect(mocks.saveCasaHudCampaign).toHaveBeenCalledOnce();
  });

  it("persists Immobiliare visible facts without photo-count or concatenated-size corruption", async () => {
    const route = await import("@/app/api/studio/domara/campaigns/[id]/browser-import/route");
    const request = new NextRequest("http://localhost/api/studio/domara/campaigns/casahud-browser-import-route/browser-import", {
      method: "POST",
      body: JSON.stringify({
        payload: immobiliareFieldAccuracyPayload,
      }),
    });

    const response = await route.POST(request, { params: { id: "casahud-browser-import-route" } });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.listing.price).toBe(300000);
    expect(payload.listing.currency).toBe("EUR");
    expect(payload.listing.rooms).toBe(5);
    expect(payload.listing.bathrooms).toBe(2);
    expect(payload.listing.sizeSqm).toBe(187);
    expect(payload.listing.sizeSqm).not.toBe(187287);
    expect(payload.listing.bedrooms).toBeUndefined();
    expect(payload.listing.needsReviewFields || []).not.toContain("price");
  });

  it("updates existing browser import by source URL instead of creating duplicate candidates", async () => {
    let storedCampaign = buildCampaign();
    mocks.getCasaHudCampaign.mockImplementation(async () => storedCampaign);
    mocks.saveCasaHudCampaign.mockImplementation(async (_userId: string, campaign: CasaHudCampaign) => {
      storedCampaign = campaign;
      return campaign;
    });

    const route = await import("@/app/api/studio/domara/campaigns/[id]/browser-import/route");
    const first = new NextRequest("http://localhost/api/studio/domara/campaigns/casahud-browser-import-route/browser-import", {
      method: "POST",
      body: JSON.stringify({
        payload: browserPayload,
      }),
    });
    const second = new NextRequest("http://localhost/api/studio/domara/campaigns/casahud-browser-import-route/browser-import", {
      method: "POST",
      body: JSON.stringify({
        payload: {
          ...browserPayload,
          title: "Updated browser import title",
        },
      }),
    });

    const firstResponse = await route.POST(first, { params: { id: "casahud-browser-import-route" } });
    const firstPayload = await firstResponse.json();
    const secondResponse = await route.POST(second, { params: { id: "casahud-browser-import-route" } });
    const secondPayload = await secondResponse.json();

    expect(firstResponse.status).toBe(200);
    expect(firstPayload.campaign.listingCandidates).toHaveLength(1);
    expect(secondResponse.status).toBe(200);
    expect(secondPayload.duplicate).toBe(true);
    expect(secondPayload.campaign.listingCandidates).toHaveLength(1);
  });

  it("normalizes manual browser-import price strings with thousands separators", async () => {
    const route = await import("@/app/api/studio/domara/campaigns/[id]/browser-import/route");
    const request = new NextRequest("http://localhost/api/studio/domara/campaigns/casahud-browser-import-route/browser-import", {
      method: "POST",
      body: JSON.stringify({
        payload: {
          ...browserPayload,
          visibleText: browserPayload.visibleText.replace("€299.000", "Price on request"),
        },
        manualDetails: {
          price: "260,000",
          currency: "EUR",
          sizeSqm: "165",
          landSizeSqm: "3.700",
        },
      }),
    });

    const response = await route.POST(request, { params: { id: "casahud-browser-import-route" } });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.listing.price).toBe(260000);
    expect(payload.listing.currency).toBe("EUR");
    expect(payload.listing.sizeSqm).toBe(165);
    expect(payload.listing.landSizeSqm).toBe(3700);
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

describe("CasaFlix bookmarklet loader route", () => {
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
    expect(script).toContain("/apps/studio/casaflix/import");
    expect(script).toContain("captureMethod");
    expect(script).toContain('var CAMPAIGN_ID_ENCODED = "campaign%20id%2Fwith%20space"');
    expect(script).not.toContain("localhost");
  });

  it("upgrades proxy http proto to https for public hosts in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("APP_PUBLIC_URL", "");
    vi.stubEnv("APP_URL", "");

    const route = await import("@/app/api/studio/domara/browser-import/bookmarklet/route");
    const request = new NextRequest("http://localhost:3001/api/studio/domara/browser-import/bookmarklet?campaignId=test-campaign", {
      method: "GET",
      headers: {
        host: "localhost:3001",
        "x-forwarded-host": "app.ibrains.ai",
        "x-forwarded-proto": "http",
      },
    });

    const response = await route.GET(request);
    const script = await response.text();

    expect(response.status).toBe(200);
    expect(script).toContain('var APP_ORIGIN = "https://app.ibrains.ai"');
    expect(script).not.toContain('var APP_ORIGIN = "http://app.ibrains.ai"');
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
    expect(script).toContain("/apps/studio/casaflix/import");
    expect(script).toContain("captureMethod");
    expect(script).toContain("test-campaign");
    expect(script).toContain("window.open");
    expect(script).not.toContain("OPENAI_API_KEY");
    expect(script).not.toContain("Authorization");
  });
});

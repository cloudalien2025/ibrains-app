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
    id: "casahud-project-edit-route",
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
    status: "listing_candidates_discovered",
    listingCandidates: [
      {
        id: "imported-listing-1",
        provider: "immobiliare",
        sourceType: "imported_url",
        sourceUrl: "https://www.immobiliare.it/en/annunci/121869400/",
        normalizedSourceUrl: "https://www.immobiliare.it/en/annunci/121869400/",
        canonicalSourceUrl: "https://www.immobiliare.it/en/annunci/121869400/",
        sourceHost: "immobiliare.it",
        sourceLabel: "Immobiliare",
        title: "Imported Immobiliare listing",
        locationText: "Location needs review",
        extractionStatus: "blocked_or_unavailable",
        manualCompletionStatus: "incomplete",
        needsReviewFields: ["price", "location", "images"],
        features: [],
        imageUrls: [],
        imageCount: 0,
        photoAvailability: "none",
        discoveredAt: "2026-04-29T10:00:00.000Z",
        preliminaryMatchNotes: "Imported URL saved from Immobiliare. Complete the missing details before validation.",
      },
    ],
    listingSearchCriteria: null,
    listingProviderStatuses: [],
    discoverySummary: null,
    listingDiscoveryStatus: "listing_candidates_discovered",
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
      key: "listing_validation",
      label: "Validate and rank listings",
      detail:
        "Validation and ranking arrive next. CasaFlix will confirm which discovered candidates truly support the title promise.",
      implemented: false,
    },
    createdAt: "2026-04-29T00:00:00.000Z",
    updatedAt: "2026-04-29T00:00:00.000Z",
    generatedAt: "2026-04-29T00:00:00.000Z",
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

describe("CasaFlix imported listing update route", () => {
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

  it("saves manual imported listing details and updates manual completion metadata", async () => {
    const route = await import("@/app/api/studio/domara/campaigns/[id]/listing-candidates/[listingId]/route");
    const request = new NextRequest(
      "http://localhost/api/studio/domara/campaigns/casahud-project-edit-route/listing-candidates/imported-listing-1",
      {
        method: "PATCH",
        body: JSON.stringify({
          title: "Albanella Independent Villa with Private Garden",
          price: 299000,
          currency: "EUR",
          locationText: "Via San Berardino, Albanella, Salerno, Campania, Italy",
          propertyType: "Single family villa",
          bedrooms: 3,
          bathrooms: 2,
          rooms: 5,
          sizeSqm: 150,
          commercialSurfaceSqm: 260.6,
          landSizeSqm: 1106,
          garageParking: "2 garage/box spaces · 3 parking spaces",
          balcony: true,
          terrace: true,
          condition: "Excellent / renovated",
          energyClass: "D",
          descriptionSnippet: "Renovated independent villa with private garden and pool potential about 25 minutes from the Paestum coast.",
          keyFeatures: ["Private garden", "Garage space", "Pool potential"],
          manualFeaturedImageUrl: "https://images.example.com/albanella-villa-manual.jpg",
          sourceUrl: "https://www.immobiliare.it/en/annunci/121869400/?utm_source=test",
          manualLifestyleAngle: "Southern Italy villa living with a private garden, room to entertain, and quick coastal access.",
        }),
      },
    );

    const response = await route.PATCH(request, {
      params: { id: "casahud-project-edit-route", listingId: "imported-listing-1" },
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.listing.title).toBe("Albanella Independent Villa with Private Garden");
    expect(payload.listing.price).toBe(299000);
    expect(payload.listing.locationText).toContain("Albanella");
    expect(payload.listing.manualFeaturedImageUrl).toBe("https://images.example.com/albanella-villa-manual.jpg");
    expect(payload.listing.featuredImageUrl).toBe("https://images.example.com/albanella-villa-manual.jpg");
    expect(payload.listing.sourceType).toBe("imported_url");
    expect(payload.listing.manualCompletionStatus).toBe("completed");
    expect(payload.listing.manuallyCompletedFields).toContain("manualFeaturedImageUrl");
    expect(payload.listing.casaHudNarrationSeed).toContain("Southern Italy villa living");
  });
});

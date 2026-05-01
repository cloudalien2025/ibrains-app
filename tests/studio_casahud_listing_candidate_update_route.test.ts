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

  it("normalizes manual price strings so thousands separators are preserved", async () => {
    const route = await import("@/app/api/studio/domara/campaigns/[id]/listing-candidates/[listingId]/route");

    const commaResponse = await route.PATCH(
      new NextRequest(
        "http://localhost/api/studio/domara/campaigns/casahud-project-edit-route/listing-candidates/imported-listing-1",
        {
          method: "PATCH",
          body: JSON.stringify({
            price: "260,000",
          }),
        },
      ),
      {
        params: { id: "casahud-project-edit-route", listingId: "imported-listing-1" },
      },
    );
    const commaPayload = await commaResponse.json();
    expect(commaResponse.status).toBe(200);
    expect(commaPayload.listing.price).toBe(260000);
    expect(commaPayload.listing.price).not.toBe(260);

    const currencyResponse = await route.PATCH(
      new NextRequest(
        "http://localhost/api/studio/domara/campaigns/casahud-project-edit-route/listing-candidates/imported-listing-1",
        {
          method: "PATCH",
          body: JSON.stringify({
            price: "€260,000",
            currency: "EUR",
          }),
        },
      ),
      {
        params: { id: "casahud-project-edit-route", listingId: "imported-listing-1" },
      },
    );
    const currencyPayload = await currencyResponse.json();
    expect(currencyResponse.status).toBe(200);
    expect(currencyPayload.listing.price).toBe(260000);
    expect(currencyPayload.listing.currency).toBe("EUR");

    const dotResponse = await route.PATCH(
      new NextRequest(
        "http://localhost/api/studio/domara/campaigns/casahud-project-edit-route/listing-candidates/imported-listing-1",
        {
          method: "PATCH",
          body: JSON.stringify({
            price: "260.000",
          }),
        },
      ),
      {
        params: { id: "casahud-project-edit-route", listingId: "imported-listing-1" },
      },
    );
    const dotPayload = await dotResponse.json();
    expect(dotResponse.status).toBe(200);
    expect(dotPayload.listing.price).toBe(260000);
    expect(dotPayload.listing.price).not.toBe(260);
  });

  it("revalidates corrected imported listings so they can move out of rejected", async () => {
    const route = await import("@/app/api/studio/domara/campaigns/[id]/listing-candidates/[listingId]/route");
    const campaign = buildCampaign();
    campaign.status = "listing_candidates_validated";
    campaign.listingValidationStatus = "listing_candidates_validated";
    campaign.approvedListings = [];
    campaign.rejectedListings = [
      {
        ...campaign.listingCandidates[0]!,
        validationStatus: "rejected",
        overallScore: 33,
        scoreBreakdown: {
          titleMatchScore: 34,
          geographyScore: 40,
          priceFitScore: 36,
          propertyTypeScore: 34,
          featureClaimScore: 30,
          mediaAvailabilityScore: 8,
          listingCompletenessScore: 16,
          providerQualityScore: 80,
          uniquenessScore: 100,
          overallScore: 33,
        },
        validationReasons: ["Overall story support is too weak."],
        warnings: ["Listing details are incomplete."],
        rejectionCategory: "weak_support",
      },
    ];
    campaign.listingValidationSummary = {
      headline: "The discovered listings only partly support the current story.",
      rankingExplanation: "Validation run complete.",
      discoveredCount: 1,
      approvedCount: 0,
      rejectedCount: 1,
      needsAttentionCount: 0,
      titleSupportConfidence: 30,
      warnings: [],
      completedAt: "2026-04-29T12:00:00.000Z",
    };
    mocks.getCasaHudCampaign.mockResolvedValue(campaign);

    const response = await route.PATCH(
      new NextRequest(
        "http://localhost/api/studio/domara/campaigns/casahud-project-edit-route/listing-candidates/imported-listing-1",
        {
          method: "PATCH",
          body: JSON.stringify({
            title: "Albanella Villa with Garden",
            price: "260,000",
            locationText: "Albanella, Salerno, Campania, Italy",
            propertyType: "Single family villa",
            bedrooms: 3,
            bathrooms: 2,
            sizeSqm: 165,
            landSizeSqm: "3,700",
            descriptionSnippet: "Spacious villa with outdoor space and strong relocation fit.",
            manualFeaturedImageUrl: "https://images.example.com/albanella-villa-manual.jpg",
          }),
        },
      ),
      {
        params: { id: "casahud-project-edit-route", listingId: "imported-listing-1" },
      },
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.campaign.listingValidationStatus).toBe("listing_candidates_validated");
    expect(payload.campaign.approvedListings.some((listing: { id: string }) => listing.id === "imported-listing-1")).toBe(true);
    expect(payload.campaign.rejectedListings.some((listing: { id: string }) => listing.id === "imported-listing-1")).toBe(false);
  });

  it("removes a listing candidate and updates campaign counts", async () => {
    const route = await import("@/app/api/studio/domara/campaigns/[id]/listing-candidates/[listingId]/route");
    const request = new NextRequest(
      "http://localhost/api/studio/domara/campaigns/casahud-project-edit-route/listing-candidates/imported-listing-1",
      {
        method: "DELETE",
      },
    );

    const response = await route.DELETE(request, {
      params: { id: "casahud-project-edit-route", listingId: "imported-listing-1" },
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.deletedListingId).toBe("imported-listing-1");
    expect(payload.campaign.listingCandidates).toHaveLength(0);
    expect(payload.campaign.approvedListings).toHaveLength(0);
    expect(payload.campaign.rejectedListings).toHaveLength(0);
    expect(payload.campaign.listingDiscoveryStatus).toBe("not_started");
    expect(payload.campaign.status).toBe("ready_for_property_discovery");
  });

  it("removes a listing from approved listings and returns listing not found for unknown ids", async () => {
    const route = await import("@/app/api/studio/domara/campaigns/[id]/listing-candidates/[listingId]/route");
    const campaign = buildCampaign();
    campaign.listingCandidates = [];
    campaign.approvedListings = [
      {
        id: "approved-imported-1",
        provider: "immobiliare",
        sourceType: "browser_assisted_import",
        sourceUrl: "https://www.immobiliare.it/en/annunci/114752041/",
        normalizedSourceUrl: "https://www.immobiliare.it/en/annunci/114752041/",
        canonicalSourceUrl: "https://www.immobiliare.it/en/annunci/114752041/",
        sourceHost: "immobiliare.it",
        sourceLabel: "Immobiliare",
        title: "Capaccio imported listing",
        locationText: "Capaccio Paestum, Salerno, Campania, Italy",
        features: ["Terrace"],
        imageUrls: ["https://images.example.com/capaccio-og.jpg"],
        imageCount: 1,
        photoAvailability: "limited",
        discoveredAt: "2026-04-29T10:00:00.000Z",
        preliminaryMatchNotes: "Imported via browser flow.",
        validationStatus: "approved",
        overallScore: 86,
        scoreBreakdown: {
          titleMatchScore: 90,
          geographyScore: 88,
          priceFitScore: 80,
          propertyTypeScore: 82,
          featureClaimScore: 78,
          mediaAvailabilityScore: 75,
          listingCompletenessScore: 80,
          providerQualityScore: 70,
          uniquenessScore: 95,
          overallScore: 86,
        },
        validationReasons: ["Strong shortlist fit."],
        warnings: [],
      },
    ];
    campaign.status = "listing_candidates_validated";
    campaign.listingValidationStatus = "listing_candidates_validated";
    campaign.listingValidationSummary = {
      headline: "Validated shortlist",
      rankingExplanation: "Ranking complete.",
      discoveredCount: 1,
      approvedCount: 1,
      rejectedCount: 0,
      needsAttentionCount: 0,
      titleSupportConfidence: 84,
      warnings: [],
      completedAt: "2026-04-29T12:00:00.000Z",
    };
    campaign.scriptGenerationStatus = "script_generated";
    campaign.scriptSummary = "A script that still references the old approved listing.";
    campaign.fullScriptText = "We are reviewing 6 validated listings...";
    campaign.scriptSegments = [
      {
        id: "segment-property",
        title: "Property 1",
        segmentType: "property_focus",
        narration: "Old listing narration",
        durationSeconds: 20,
        associatedListingId: "approved-imported-1",
      },
    ];
    campaign.propertySegments = [
      {
        listingId: "approved-imported-1",
        title: "Capaccio imported listing",
        locationText: "Capaccio Paestum, Salerno, Campania, Italy",
        narration: "Old listing narration",
        whyItMadeTheCut: "Old rationale",
        supportedFacts: ["EUR 299,000"],
      },
    ];
    mocks.getCasaHudCampaign.mockResolvedValue(campaign);

    const response = await route.DELETE(
      new NextRequest(
        "http://localhost/api/studio/domara/campaigns/casahud-project-edit-route/listing-candidates/approved-imported-1",
        {
          method: "DELETE",
        },
      ),
      {
        params: { id: "casahud-project-edit-route", listingId: "approved-imported-1" },
      },
    );
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.campaign.approvedListings).toHaveLength(0);
    expect(payload.campaign.scriptGenerationStatus).toBe("not_started");
    expect(payload.campaign.fullScriptText).toBeNull();
    expect(payload.campaign.scriptSegments).toHaveLength(0);
    expect(payload.campaign.propertySegments).toHaveLength(0);

    const missingResponse = await route.DELETE(
      new NextRequest("http://localhost/api/studio/domara/campaigns/casahud-project-edit-route/listing-candidates/missing", {
        method: "DELETE",
      }),
      {
        params: { id: "casahud-project-edit-route", listingId: "missing" },
      },
    );
    const missingPayload = await missingResponse.json();
    expect(missingResponse.status).toBe(404);
    expect(missingPayload.error.code).toBe("LISTING_NOT_FOUND");
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { CasaHudCampaign } from "@/lib/studio/domara/campaigns";
import type { CasaHudLocationData } from "@/lib/studio/domara/campaign-location-intelligence";
import type { CasaHudOpportunityResult } from "@/lib/studio/domara/opportunity-engine/types";

const userId = "11111111-1111-4111-8111-111111111111";

const opportunity: CasaHudOpportunityResult = {
  generatedAt: "2026-04-28T00:00:00.000Z",
  preferredMarket: "Italian real-estate YouTube",
  researchBrief: {
    summary: "CasaHUD identified the strongest opportunity in regional affordability plus relocation intent.",
    opportunityCategories: ["affordable coastal roundups", "retirement relocation", "regional niche inventory"],
    competitorPatterns: ["Top videos frequently anchor the title with a price ceiling."],
    audienceIntent: ["buyable Italy homes", "retire in Italy"],
    suggestedTitleDirections: ["Southern Italy affordability roundups", "Question-led relocation titles"],
    riskNotes: ["Very cheap Italy claims can become hard to prove with current listings."],
  },
  titleCandidates: [
    {
      id: "title-1",
      title: "Could You Retire in Southern Italy for Under $300K?",
      score: 92,
      ctrPotential: 93,
      searchAppeal: 90,
      novelty: 82,
      realism: 91,
      listingAvailability: 88,
      channelFit: 90,
      titleTruthfulness: 92,
      campaignType: "lifestyle_relocation",
      regionHint: "Southern Italy",
      listingSearchHints: ["Southern Italy homes under 300k", "relocation-friendly towns"],
      reasoning: "Strong relocation intent plus a concrete budget makes this highly clickable and supportable.",
    },
  ],
  selectedTitle: {
    title: "Could You Retire in Southern Italy for Under $300K?",
    score: 92,
    campaignType: "lifestyle_relocation",
    confidence: 0.89,
    reasoning: "CasaHUD chose this title because it balances click potential with a believable promise.",
    regionHint: "Southern Italy",
    listingSearchHints: ["Southern Italy homes under 300k", "relocation-friendly towns"],
  },
  campaignTypePrediction: "lifestyle_relocation",
  titleOpportunitySummary:
    "Could You Retire in Southern Italy for Under $300K? rose to the top because it gives CasaHUD a clear, searchable concept that can still hold up when listing discovery begins.",
  confidenceSummary:
    "89% confidence. CasaHUD prefers titles that can earn clicks without forcing unsupported claims.",
  providerStatus: {
    mode: "casahud_patterns",
    label: "CasaHUD opportunity patterns",
    detail: "Using CasaHUD opportunity patterns until YouTube connection is enabled for live competitive research.",
    canImproveWithYouTube: true,
  },
  nextStep: {
    action: "create_campaign",
    label: "Create campaign",
    detail: "Phase 3 will turn this winning concept into a saved CasaHUD campaign with durable workflow state.",
  },
};

const validatedCampaign: CasaHudCampaign = {
  id: "casahud-project-phase6-route",
  name: opportunity.selectedTitle.title,
  selectedViralTitle: opportunity.selectedTitle.title,
  selectedTitle: opportunity.selectedTitle,
  titleCandidates: opportunity.titleCandidates,
  researchBrief: opportunity.researchBrief,
  campaignType: opportunity.campaignTypePrediction,
  marketRegionHint: "Southern Italy",
  preferredMarket: opportunity.preferredMarket,
  generationSource: opportunity.providerStatus,
  confidenceReasoning: {
    summary: opportunity.confidenceSummary,
    titleOpportunitySummary: opportunity.titleOpportunitySummary,
    selectedTitleReasoning: opportunity.selectedTitle.reasoning,
    selectedTitleConfidence: opportunity.selectedTitle.confidence,
  },
  status: "listing_candidates_validated",
  listingCandidates: [],
  listingSearchCriteria: null,
  listingProviderStatuses: [],
  discoverySummary: null,
  listingDiscoveryStatus: "listing_candidates_discovered",
  approvedListings: [
    {
      id: "listing-1",
      provider: "casahud_sample",
      title: "Tropea apartment with sea views",
      locationText: "Tropea, Calabria, Italy",
      country: "Italy",
      region: "Calabria",
      city: "Tropea",
      price: 284000,
      currency: "USD",
      propertyType: "apartment",
      bedrooms: 2,
      bathrooms: 2,
      sizeSqm: 88,
      descriptionSnippet: "Move-in ready apartment with sea views and retirement appeal.",
      features: ["budget-conscious", "move-in ready", "coastal lifestyle"],
      imageUrls: ["https://images.example.com/1.jpg"],
      imageCount: 1,
      photoAvailability: "limited",
      discoveredAt: "2026-04-28T00:20:00.000Z",
      preliminaryMatchNotes: "Fits the title promise and budget.",
      validationStatus: "approved",
      overallScore: 84,
      scoreBreakdown: {
        titleMatchScore: 88,
        geographyScore: 100,
        priceFitScore: 100,
        propertyTypeScore: 100,
        featureClaimScore: 72,
        mediaAvailabilityScore: 44,
        listingCompletenessScore: 78,
        providerQualityScore: 64,
        uniquenessScore: 100,
        overallScore: 84,
      },
      validationReasons: ["Location aligns with the campaign region."],
      warnings: [],
      rank: 1,
      duplicateGroupKey: "listing-1",
    },
  ],
  rejectedListings: [],
  listingRankOrder: ["listing-1"],
  listingValidationStatus: "listing_candidates_validated",
  listingValidationSummary: {
    headline: "Approved 1 of 1 discovered listings for the title promise.",
    rankingExplanation:
      "CasaHUD ranked the shortlist by title truthfulness, geography fit, price support, feature alignment, media coverage, and duplicate reduction.",
    discoveredCount: 1,
    approvedCount: 1,
    rejectedCount: 0,
    needsAttentionCount: 0,
    titleSupportConfidence: 84,
    warnings: [],
    completedAt: "2026-04-28T00:25:00.000Z",
  },
  titleSupportConfidence: 84,
  validationWarnings: [],
  locationIntelligenceStatus: "not_started",
  locationIntelligenceSummary: null,
  locationStory: null,
  localHighlights: [],
  poiBundle: null,
  mapSceneIdeas: [],
  listingLocationInsights: [],
  locationProviderStatuses: [],
  locationWarnings: [],
  nextPhase: {
    key: "location_intelligence",
    label: "Location Intelligence",
    detail:
      "Location Intelligence comes next. CasaHUD will explain why the strongest validated properties work through area and map context.",
    implemented: false,
  },
  createdAt: "2026-04-28T00:10:00.000Z",
  updatedAt: "2026-04-28T00:25:00.000Z",
  generatedAt: opportunity.generatedAt,
  futureState: {
    listingCandidates: [],
    approvedListings: [],
    rejectedListings: [],
    listingRankOrder: ["listing-1"],
    locationIntelligence: null,
    mapPoiBundle: null,
    script: null,
    storyboard: null,
    mediaPlan: null,
    packaging: null,
    renderStatus: null,
    reviewStatus: null,
    publishStatus: null,
    scheduleStatus: null,
  },
};

const locationIntelligence: CasaHudLocationData = {
  locationIntelligenceStatus: "location_intelligence_completed",
  locationIntelligenceSummary: {
    headline: "Location story prepared across 1 shortlist anchor.",
    providerSummary: "Using CasaHUD location patterns until Google Places or Mapbox has full live coverage.",
    coverageSummary: "CasaHUD connected Tropea to local proof points, regional lifestyle context, and map scene ideas.",
    warningCount: 1,
    generatedAt: "2026-04-29T00:00:00.000Z",
    fallbackUsed: true,
  },
  locationStory: {
    headline: "Tropea turns the shortlist into a place-led story.",
    summary: "CasaHUD positioned the approved property around coastal context and everyday convenience so the campaign reads as property plus place.",
    narrativeAngles: [
      "Open with the region before dropping into the strongest listing.",
      "Use local proof points as support for the property promise instead of generic travel filler.",
      "Keep the location context tightly tied to buyer relevance, convenience, and visual texture.",
    ],
    lifestyleAnchors: ["Waterside lifestyle context", "Travel-friendly arrival story"],
    regionHighlights: ["Tropea", "Calabria"],
    fallbackNotice: "Using CasaHUD location patterns where live provider coverage was limited.",
  },
  localHighlights: [
    {
      id: "highlight-1",
      title: "Regional anchor",
      description: "Tropea gives the campaign a specific place identity instead of a generic property roundup.",
      locationText: "Tropea, Calabria, Italy",
      associatedListingId: "listing-1",
      provider: "casahud_location_patterns",
      sourceConfidence: "fallback",
    },
  ],
  poiBundle: {
    summary: "3 location proof points prepared for the approved shortlist.",
    cards: [
      {
        id: "poi-1",
        name: "Coastal access context",
        category: "Beach",
        locationText: "Tropea, Calabria, Italy",
        associatedListingId: "listing-1",
        relevanceReason: "Helps the shortlist read as a day-to-day coastal lifestyle story instead of a price-only claim.",
        provider: "casahud_location_patterns",
        sourceConfidence: "fallback",
      },
    ],
    categories: ["Beach"],
    generatedAt: "2026-04-29T00:00:00.000Z",
  },
  mapSceneIdeas: [
    {
      id: "scene-1",
      title: "Open on Tropea",
      sceneType: "regional_anchor",
      description: "Start with the region around Tropea to establish the place before the property details arrive.",
      locationText: "Tropea, Calabria, Italy",
      suggestedVisual: "Wide regional map pull-back with the strongest listing location highlighted first.",
      provider: "casahud_location_patterns",
      confidence: "fallback",
    },
  ],
  listingLocationInsights: [
    {
      listingId: "listing-1",
      summary: "Tropea apartment with sea views plays best as a waterside lifestyle story around Tropea, Calabria, Italy.",
      highlights: ["Coastal day-to-day context helps the property feel like a lifestyle move, not just a budget win."],
      nearbyPois: [],
      locationStrengths: ["Waterside lifestyle context"],
      warnings: ["Using CasaHUD location patterns until Google Places is connected."],
    },
  ],
  locationProviderStatuses: [
    {
      provider: "google_places",
      label: "Google Places",
      state: "missing_credentials",
      configured: false,
      used: false,
      detail: "Using CasaHUD location patterns until Google Places is connected for live POIs.",
      warning: "Connect Google Places for live points of interest and local highlights.",
      coverage: "No live POIs",
    },
    {
      provider: "mapbox",
      label: "Mapbox",
      state: "missing_credentials",
      configured: false,
      used: false,
      detail: "Using listing coordinates and CasaHUD location patterns until Mapbox is connected for live map anchoring.",
      warning: "Connect Mapbox for live geocoding and richer map scene anchoring.",
      coverage: "No live map anchoring",
    },
    {
      provider: "casahud_location_patterns",
      label: "CasaHUD location patterns",
      state: "fallback",
      configured: true,
      used: true,
      detail: "Using CasaHUD location patterns until Google Places or Mapbox has full live coverage.",
      warning: "Connect location providers for live POIs and richer map context.",
      coverage: "1 fallback context set",
    },
  ],
  locationWarnings: ["Using CasaHUD location patterns until Google Places is connected."],
};

const mocks = vi.hoisted(() => ({
  ensureUser: vi.fn(),
  resolveUserId: vi.fn(),
  isCasaHudCampaignStoreAvailable: vi.fn(),
  isCasaHudCampaignStoreUnavailable: vi.fn(),
  getCasaHudCampaign: vi.fn(),
  saveCasaHudCampaign: vi.fn(),
  isStudioIntegrationStoreAvailable: vi.fn(),
  isStudioIntegrationEncryptionConfigured: vi.fn(),
  getStudioIntegrationSecret: vi.fn(),
  runCasaHudLocationIntelligence: vi.fn(),
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

vi.mock("@/app/api/studio/domara/_utils/integration-settings", () => ({
  isStudioIntegrationStoreAvailable: mocks.isStudioIntegrationStoreAvailable,
  isStudioIntegrationEncryptionConfigured: mocks.isStudioIntegrationEncryptionConfigured,
  getStudioIntegrationSecret: mocks.getStudioIntegrationSecret,
}));

vi.mock("@/lib/studio/domara/location-intelligence-engine", () => ({
  runCasaHudLocationIntelligence: mocks.runCasaHudLocationIntelligence,
}));

describe("CasaHUD location intelligence route", () => {
  beforeEach(() => {
    mocks.ensureUser.mockReset();
    mocks.resolveUserId.mockReset();
    mocks.isCasaHudCampaignStoreAvailable.mockReset();
    mocks.isCasaHudCampaignStoreUnavailable.mockReset();
    mocks.getCasaHudCampaign.mockReset();
    mocks.saveCasaHudCampaign.mockReset();
    mocks.isStudioIntegrationStoreAvailable.mockReset();
    mocks.isStudioIntegrationEncryptionConfigured.mockReset();
    mocks.getStudioIntegrationSecret.mockReset();
    mocks.runCasaHudLocationIntelligence.mockReset();

    mocks.ensureUser.mockResolvedValue(undefined);
    mocks.resolveUserId.mockReturnValue(userId);
    mocks.isCasaHudCampaignStoreAvailable.mockResolvedValue(true);
    mocks.isCasaHudCampaignStoreUnavailable.mockReturnValue(false);
    mocks.getCasaHudCampaign.mockResolvedValue(validatedCampaign);
    mocks.saveCasaHudCampaign.mockImplementation(async (_userId: string, campaign: CasaHudCampaign) => campaign);
    mocks.isStudioIntegrationStoreAvailable.mockResolvedValue(false);
    mocks.isStudioIntegrationEncryptionConfigured.mockReturnValue(false);
    mocks.getStudioIntegrationSecret.mockResolvedValue(null);
    mocks.runCasaHudLocationIntelligence.mockResolvedValue(locationIntelligence);
  });

  it("requires approved listings before building location intelligence", async () => {
    const route = await import("@/app/api/studio/domara/campaigns/[id]/location-intelligence/route");
    mocks.getCasaHudCampaign.mockResolvedValue({
      ...validatedCampaign,
      approvedListings: [],
    });

    const response = await route.POST(
      new NextRequest(`http://localhost/api/studio/domara/campaigns/${validatedCampaign.id}/location-intelligence`, {
        method: "POST",
      }),
      { params: { id: validatedCampaign.id } },
    );
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload.error.code).toBe("APPROVED_LISTINGS_REQUIRED");
  });

  it("persists the location bundle and returns the updated campaign on success", async () => {
    const route = await import("@/app/api/studio/domara/campaigns/[id]/location-intelligence/route");

    const response = await route.POST(
      new NextRequest(`http://localhost/api/studio/domara/campaigns/${validatedCampaign.id}/location-intelligence`, {
        method: "POST",
      }),
      { params: { id: validatedCampaign.id } },
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(mocks.runCasaHudLocationIntelligence).toHaveBeenCalledOnce();
    expect(mocks.saveCasaHudCampaign).toHaveBeenCalledOnce();
    expect(payload.campaign.status).toBe("location_intelligence_completed");
    expect(payload.campaign.locationStory.headline).toContain("Tropea");
    expect(payload.campaign.poiBundle.summary).toContain("location proof points");
    expect(payload.summary.locationIntelligenceStatus).toBe("location_intelligence_completed");
    expect(payload.message).toContain("Location intelligence complete");
  });
});

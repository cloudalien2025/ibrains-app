import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createEmptyCasaHudMediaPlanData, type CasaHudMediaPlanData } from "@/lib/studio/domara/campaign-media-planning";
import type { CasaHudCampaign } from "@/lib/studio/domara/campaigns";
import { createEmptyCasaHudYouTubePackageData } from "@/lib/studio/domara/campaign-youtube-package";

const userId = "11111111-1111-4111-8111-111111111111";

const scriptReadyCampaign: CasaHudCampaign = {
  id: "casahud-project-phase8-route",
  name: "Could You Retire in Southern Italy for Under $300K?",
  selectedViralTitle: "Could You Retire in Southern Italy for Under $300K?",
  selectedTitle: {
    title: "Could You Retire in Southern Italy for Under $300K?",
    score: 92,
    campaignType: "lifestyle_relocation",
    confidence: 0.88,
    reasoning: "Believable support.",
    regionHint: "Southern Italy",
    listingSearchHints: ["Southern Italy homes under 300k"],
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
      listingSearchHints: ["Southern Italy homes under 300k"],
      reasoning: "Believable support.",
    },
  ],
  researchBrief: {
    summary: "CasaFlix identified the strongest relocation opportunity.",
    opportunityCategories: ["relocation"],
    competitorPatterns: ["Budget-led relocation titles perform well."],
    audienceIntent: ["retire in Italy"],
    suggestedTitleDirections: ["price-led relocation"],
    riskNotes: ["Avoid unsupported lifestyle claims."],
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
    titleOpportunitySummary: "The title stays supportable against the shortlist.",
    selectedTitleReasoning: "It balances click appeal with believable support.",
    selectedTitleConfidence: 0.88,
  },
  status: "script_narrative_completed",
  listingCandidates: [],
  listingSearchCriteria: null,
  listingProviderStatuses: [],
  discoverySummary: null,
  listingDiscoveryStatus: "listing_candidates_discovered",
  approvedListings: [
    {
      id: "listing-1",
      provider: "idealista",
      providerListingId: "idealista-1",
      sourceUrl: "https://example.com/listing-1",
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
      descriptionSnippet: "Move-in ready apartment with sea views.",
      features: ["move-in ready"],
      imageUrls: ["https://images.example.com/1.jpg"],
      imageCount: 1,
      photoAvailability: "limited",
      discoveredAt: "2026-04-29T00:00:00.000Z",
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
    headline: "Approved 1 of 1 discovered listings.",
    rankingExplanation: "Ranked by title support and coverage.",
    discoveredCount: 1,
    approvedCount: 1,
    rejectedCount: 0,
    needsAttentionCount: 0,
    titleSupportConfidence: 84,
    warnings: [],
    completedAt: "2026-04-29T00:05:00.000Z",
  },
  titleSupportConfidence: 84,
  validationWarnings: [],
  locationIntelligenceStatus: "location_intelligence_completed",
  locationIntelligenceSummary: {
    headline: "Location story prepared.",
    providerSummary: "Using CasaFlix location patterns.",
    coverageSummary: "CasaFlix connected the shortlist to regional proof points.",
    warningCount: 1,
    generatedAt: "2026-04-29T00:08:00.000Z",
    fallbackUsed: true,
  },
  locationStory: {
    headline: "Tropea turns the shortlist into a place-led story.",
    summary: "CasaFlix positioned the approved property around coastal context and everyday convenience.",
    narrativeAngles: ["Open with the region before the property details arrive."],
    lifestyleAnchors: ["Waterside lifestyle context"],
    regionHighlights: ["Tropea", "Calabria"],
    fallbackNotice: "Using CasaFlix location patterns where live providers were limited.",
  },
  localHighlights: [],
  poiBundle: null,
  mapSceneIdeas: [],
  listingLocationInsights: [],
  locationProviderStatuses: [],
  locationWarnings: [],
  scriptGenerationStatus: "script_generated",
  scriptSummary: "A relocation-oriented narrative built from the approved shortlist.",
  openingHook: "What does life in Southern Italy actually look like when the homes are real and the budget still matters?",
  estimatedDurationSeconds: 104,
  tone: "Premium, clear, and grounded.",
  scriptSegments: [
    {
      id: "segment-hook",
      title: "Opening Hook",
      segmentType: "hook",
      narration: "What does life in Southern Italy actually look like when the homes are real and the budget still matters?",
      durationSeconds: 14,
    },
  ],
  propertySegments: [
    {
      listingId: "listing-1",
      title: "Tropea apartment with sea views",
      locationText: "Tropea, Calabria, Italy",
      narration: "Tropea apartment with sea views keeps the segment grounded in verified listing facts.",
      whyItMadeTheCut: "It keeps the title promise grounded.",
      supportedFacts: ["USD 284,000", "apartment"],
    },
  ],
  locationLifestyleLines: ["Lead the place story through Tropea before drilling into property specifics."],
  transitions: [],
  closingCta: "Close by summarizing who this move feels best suited for.",
  toneAndPacingNotes: ["Keep the delivery premium and clear."],
  scriptWarnings: [],
  scriptProviderStatus: {
    provider: "casahud_script_patterns",
    label: "CasaFlix script patterns",
    state: "fallback",
    configured: true,
    used: true,
    detail: "Using deterministic CasaFlix script composition.",
  },
  fullScriptText: "Opening Hook\nWhat does life in Southern Italy actually look like when the homes are real and the budget still matters?",
  ...createEmptyCasaHudMediaPlanData(),
  ...createEmptyCasaHudYouTubePackageData(),
  nextPhase: {
    key: "media_planning_asset_assembly",
    label: "Media Planning and Asset Assembly",
    detail: "Media Planning and Asset Assembly comes next. CasaFlix will organize visuals, map scenes, and asset needs around the approved narrative package.",
    implemented: false,
  },
  createdAt: "2026-04-29T00:00:00.000Z",
  updatedAt: "2026-04-29T00:10:00.000Z",
  generatedAt: "2026-04-29T00:00:00.000Z",
  futureState: {
    listingCandidates: [],
    approvedListings: [],
    rejectedListings: [],
    listingRankOrder: ["listing-1"],
    locationIntelligence: {
      status: "location_intelligence_completed",
      storyHeadline: "Tropea turns the shortlist into a place-led story.",
      generatedAt: "2026-04-29T00:08:00.000Z",
    },
    mapPoiBundle: null,
    script: {
      status: "script_generated",
      summary: "A relocation-oriented narrative built from the approved shortlist.",
      generatedAt: "2026-04-29T00:10:00.000Z",
    },
    storyboard: null,
    mediaPlan: null,
    packaging: null,
    renderStatus: null,
    reviewStatus: null,
    publishStatus: null,
    scheduleStatus: null,
  },
};

const mediaPlanResult: CasaHudMediaPlanData = {
  mediaPlanningStatus: "media_plan_built",
  mediaPlanSummary: "A production-ready media plan built from scripted scenes and approved media coverage.",
  visualAssets: [
    {
      id: "asset-1",
      type: "listing_image",
      title: "Tropea apartment hero image",
      sourceProvider: "idealista",
      sourceUrl: "https://images.example.com/1.jpg",
      listingId: "listing-1",
      description: "Lead listing image.",
      usageRightsStatus: "unknown",
      confidence: 0.84,
      availabilityStatus: "available",
    },
  ],
  sceneAssetMapping: [
    {
      sceneId: "scene-map-1",
      segmentId: "segment-hook",
      sceneTitle: "Opening Hook",
      narrationExcerpt: "What does life in Southern Italy actually look like when the homes are real and the budget still matters?",
      assignedAssetIds: ["asset-1"],
      recommendedAssetType: "listing_image",
      visualPurpose: "Lead with the strongest approved property visual.",
      coverageStatus: "partial",
      warnings: [],
    },
  ],
  shotList: [
    {
      id: "shot-1",
      order: 1,
      title: "Opening Hook",
      description: "Lead with the strongest approved property visual.",
      associatedListingId: "listing-1",
      associatedSceneId: "scene-map-1",
      recommendedVisualType: "listing_image",
      assetIds: ["asset-1"],
      notes: ["Coverage is usable but should stay economical until stronger media is connected."],
    },
  ],
  listingImageCoverage: [
    {
      listingId: "listing-1",
      listingTitle: "Tropea apartment with sea views",
      availableImageCount: 1,
      assetIds: ["asset-1"],
      coverageStatus: "partial",
      coverageSummary: "Tropea apartment with sea views has limited image coverage.",
    },
  ],
  mapLocationVisualPlan: [],
  thumbnailCandidateInputs: [
    {
      id: "thumbnail-1",
      title: "Lead property hero frame",
      rationale: "Use the strongest approved property as the hero.",
      associatedAssetIds: ["asset-1"],
      listingId: "listing-1",
      textOverlayIdea: "Could You Retire in Southern Italy for Under $300K?",
      compositionNotes: "Keep the frame clean and editorial.",
      warnings: [],
    },
  ],
  missingMediaWarnings: ["Visual coverage is still limited on the approved listing."],
  mediaProviderStatuses: [
    {
      provider: "listing_source_media",
      label: "Listing source media",
      state: "connected",
      configured: true,
      used: true,
      detail: "One listing image is available.",
    },
  ],
};

const mocks = vi.hoisted(() => ({
  ensureUser: vi.fn(),
  resolveUserId: vi.fn(),
  isCasaHudCampaignStoreAvailable: vi.fn(),
  isCasaHudCampaignStoreUnavailable: vi.fn(),
  getCasaHudCampaign: vi.fn(),
  saveCasaHudCampaign: vi.fn(),
  runCasaHudMediaPlanning: vi.fn(),
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

vi.mock("@/lib/studio/domara/media-planning-engine", () => ({
  runCasaHudMediaPlanning: mocks.runCasaHudMediaPlanning,
}));

describe("CasaFlix media planning route", () => {
  beforeEach(() => {
    mocks.ensureUser.mockReset();
    mocks.resolveUserId.mockReset();
    mocks.isCasaHudCampaignStoreAvailable.mockReset();
    mocks.isCasaHudCampaignStoreUnavailable.mockReset();
    mocks.getCasaHudCampaign.mockReset();
    mocks.saveCasaHudCampaign.mockReset();
    mocks.runCasaHudMediaPlanning.mockReset();

    mocks.ensureUser.mockResolvedValue(undefined);
    mocks.resolveUserId.mockReturnValue(userId);
    mocks.isCasaHudCampaignStoreAvailable.mockResolvedValue(true);
    mocks.isCasaHudCampaignStoreUnavailable.mockReturnValue(false);
    mocks.getCasaHudCampaign.mockResolvedValue(scriptReadyCampaign);
    mocks.saveCasaHudCampaign.mockImplementation(async (_userId: string, campaign: CasaHudCampaign) => campaign);
    mocks.runCasaHudMediaPlanning.mockReturnValue(mediaPlanResult);
  });

  it("requires the script package, approved listings, and location intelligence before building the media plan", async () => {
    const route = await import("@/app/api/studio/domara/campaigns/[id]/media-plan/route");

    mocks.getCasaHudCampaign.mockResolvedValueOnce({
      ...scriptReadyCampaign,
      approvedListings: [],
    });
    const noListingsResponse = await route.POST(
      new NextRequest(`http://localhost/api/studio/domara/campaigns/${scriptReadyCampaign.id}/media-plan`, {
        method: "POST",
      }),
      { params: { id: scriptReadyCampaign.id } },
    );
    expect(noListingsResponse.status).toBe(409);

    mocks.getCasaHudCampaign.mockResolvedValueOnce({
      ...scriptReadyCampaign,
      locationIntelligenceStatus: "not_started",
      status: "listing_candidates_validated",
    });
    const noLocationResponse = await route.POST(
      new NextRequest(`http://localhost/api/studio/domara/campaigns/${scriptReadyCampaign.id}/media-plan`, {
        method: "POST",
      }),
      { params: { id: scriptReadyCampaign.id } },
    );
    expect(noLocationResponse.status).toBe(409);

    mocks.getCasaHudCampaign.mockResolvedValueOnce({
      ...scriptReadyCampaign,
      scriptGenerationStatus: "not_started",
      scriptSegments: [],
      status: "location_intelligence_completed",
    });
    const noScriptResponse = await route.POST(
      new NextRequest(`http://localhost/api/studio/domara/campaigns/${scriptReadyCampaign.id}/media-plan`, {
        method: "POST",
      }),
      { params: { id: scriptReadyCampaign.id } },
    );
    expect(noScriptResponse.status).toBe(409);
  });

  it("accepts a complete browser import as script-ready when approvedListings is empty", async () => {
    const route = await import("@/app/api/studio/domara/campaigns/[id]/media-plan/route");

    mocks.getCasaHudCampaign.mockResolvedValueOnce({
      ...scriptReadyCampaign,
      approvedListings: [],
      listingCandidates: [
        {
          id: "listing-browser-ready",
          provider: "immobiliare",
          sourceType: "browser_assisted_import",
          sourceUrl: "https://www.immobiliare.it/en/annunci/127142643/",
          title: "Messina villa",
          locationText: "Messina, Sicily, Italy",
          city: "Messina",
          region: "Sicily",
          country: "Italy",
          price: 300000,
          currency: "EUR",
          propertyType: "Single family villa",
          rooms: 5,
          bathrooms: 2,
          sizeSqm: 187,
          descriptionSnippet: "Complete browser import.",
          features: ["5+ rooms", "2 bathrooms", "187 sqm"],
          imageUrls: ["https://images.example.com/messina.jpg"],
          featuredImageUrl: "https://images.example.com/messina.jpg",
          imageCount: 1,
          photoAvailability: "limited",
          manualCompletionStatus: "completed",
          discoveredAt: "2026-05-02T00:00:00.000Z",
          preliminaryMatchNotes: "Complete browser import.",
        },
      ],
    });

    const response = await route.POST(
      new NextRequest(`http://localhost/api/studio/domara/campaigns/${scriptReadyCampaign.id}/media-plan`, {
        method: "POST",
      }),
      { params: { id: scriptReadyCampaign.id } },
    );
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
  });

  it("persists the media plan and returns the updated campaign", async () => {
    const route = await import("@/app/api/studio/domara/campaigns/[id]/media-plan/route");

    const response = await route.POST(
      new NextRequest(`http://localhost/api/studio/domara/campaigns/${scriptReadyCampaign.id}/media-plan`, {
        method: "POST",
      }),
      { params: { id: scriptReadyCampaign.id } },
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.campaign.status).toBe("media_planning_completed");
    expect(payload.campaign.mediaPlanningStatus).toBe("media_plan_built");
    expect(payload.campaign.mediaPlanSummary).toBe(mediaPlanResult.mediaPlanSummary);
    expect(payload.campaign.nextPhase.key).toBe("youtube_package_review_render_plan");
    expect(payload.summary.mediaPlanningStatus).toBe("media_plan_built");
    expect(mocks.runCasaHudMediaPlanning).toHaveBeenCalledTimes(1);
    expect(mocks.saveCasaHudCampaign).toHaveBeenCalledTimes(1);
  });
});

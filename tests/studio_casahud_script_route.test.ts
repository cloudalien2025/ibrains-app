import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { CasaHudCampaign } from "@/lib/studio/domara/campaigns";
import { createEmptyCasaHudMediaPlanData } from "@/lib/studio/domara/campaign-media-planning";
import { createEmptyCasaHudYouTubePackageData } from "@/lib/studio/domara/campaign-youtube-package";
import { computeApprovedListingsLocationFingerprint } from "@/lib/studio/domara/location-intelligence-fingerprint";
import { deriveCasaHudWorkingListings } from "@/lib/studio/domara/listing-working-set";
import type { CasaHudOpportunityResult } from "@/lib/studio/domara/opportunity-engine/types";

const userId = "11111111-1111-4111-8111-111111111111";

const opportunity: CasaHudOpportunityResult = {
  generatedAt: "2026-04-28T00:00:00.000Z",
  preferredMarket: "Italian real-estate YouTube",
  researchBrief: {
    summary: "CasaFlix identified the strongest opportunity in regional affordability plus relocation intent.",
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
    reasoning: "CasaFlix chose this title because it balances click potential with a believable promise.",
    regionHint: "Southern Italy",
    listingSearchHints: ["Southern Italy homes under 300k", "relocation-friendly towns"],
  },
  campaignTypePrediction: "lifestyle_relocation",
  titleOpportunitySummary:
    "Could You Retire in Southern Italy for Under $300K? rose to the top because it gives CasaFlix a clear, searchable concept that can still hold up when listing discovery begins.",
  confidenceSummary:
    "89% confidence. CasaFlix prefers titles that can earn clicks without forcing unsupported claims.",
  providerStatus: {
    mode: "casahud_patterns",
    label: "CasaFlix opportunity patterns",
    detail: "Using CasaFlix opportunity patterns until YouTube connection is enabled for live competitive research.",
    canImproveWithYouTube: true,
  },
  nextStep: {
    action: "create_campaign",
    label: "Create campaign",
    detail: "Phase 3 will turn this winning concept into a saved CasaFlix campaign with durable workflow state.",
  },
};

const locationReadyCampaign: CasaHudCampaign = {
  id: "casahud-project-phase7-route",
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
  status: "location_intelligence_completed",
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
      "CasaFlix ranked the shortlist by title truthfulness, geography fit, price support, feature alignment, media coverage, and duplicate reduction.",
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
  locationIntelligenceStatus: "location_intelligence_completed",
  locationIntelligenceSummary: {
    headline: "Location story prepared across 1 shortlist anchor.",
    providerSummary: "Using CasaFlix location patterns until Google Places or Mapbox has full live coverage.",
    coverageSummary: "CasaFlix connected Tropea to local proof points, regional lifestyle context, and map scene ideas.",
    warningCount: 1,
    generatedAt: "2026-04-29T00:00:00.000Z",
    fallbackUsed: true,
  },
  locationStory: {
    headline: "Tropea turns the shortlist into a place-led story.",
    summary: "CasaFlix positioned the approved property around coastal context and everyday convenience so the campaign reads as property plus place.",
    narrativeAngles: ["Open with the region before dropping into the strongest listing."],
    lifestyleAnchors: ["Waterside lifestyle context"],
    regionHighlights: ["Tropea", "Calabria"],
    fallbackNotice: "Using CasaFlix location patterns where live provider coverage was limited.",
  },
  localHighlights: [],
  poiBundle: null,
  mapSceneIdeas: [],
  listingLocationInsights: [],
  locationProviderStatuses: [],
  locationWarnings: [],
  scriptGenerationStatus: "not_started",
  scriptSummary: null,
  openingHook: null,
  estimatedDurationSeconds: null,
  tone: null,
  scriptSegments: [],
  propertySegments: [],
  locationLifestyleLines: [],
  transitions: [],
  closingCta: null,
  toneAndPacingNotes: [],
  scriptWarnings: [],
  scriptProviderStatus: null,
  fullScriptText: null,
  ...createEmptyCasaHudMediaPlanData(),
  ...createEmptyCasaHudYouTubePackageData(),
  nextPhase: {
    key: "script_narrative_generation",
    label: "Script and Narrative Generation",
    detail:
      "Script and Narrative Generation comes next. CasaFlix will turn the validated property story and location intelligence into the video narrative package.",
    implemented: false,
  },
  createdAt: "2026-04-28T00:10:00.000Z",
  updatedAt: "2026-04-29T00:00:00.000Z",
  generatedAt: opportunity.generatedAt,
  futureState: {
    listingCandidates: [],
    approvedListings: [],
    rejectedListings: [],
    listingRankOrder: ["listing-1"],
    locationIntelligence: {
      status: "location_intelligence_completed",
      storyHeadline: "Tropea turns the shortlist into a place-led story.",
      generatedAt: "2026-04-29T00:00:00.000Z",
    },
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

const scriptResult = {
  scriptGenerationStatus: "script_generated" as const,
  scriptSummary: "A relocation-focused script built from the current approved shortlist and location context.",
  openingHook:
    "Could you really build a comfortable life in Southern Italy without blowing your budget? That's what we're testing today.",
  estimatedDurationSeconds: 104,
  tone: "Premium, clear, cinematic where appropriate, and tightly grounded in validated property and location support.",
  scriptSegments: [
    {
      id: "segment-hook",
      title: "Opening Hook",
      segmentType: "hook" as const,
      narration:
        "Could you really build a comfortable life in Southern Italy without blowing your budget? That's what we're testing today.",
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
  locationLifestyleLines: ["Lead the place story through Tropea and Calabria before drilling into property specifics."],
  transitions: [],
  closingCta:
    "Close by summarizing who this move feels best suited for, then invite the viewer to follow for the next relocation-focused shortlist.",
  toneAndPacingNotes: ["Keep the delivery premium and clear."],
  scriptWarnings: [],
  scriptProviderStatus: {
    provider: "casahud_script_patterns" as const,
    label: "CasaFlix script patterns",
    state: "fallback" as const,
    configured: true,
    used: true,
    detail: "Using deterministic CasaFlix script composition.",
  },
  fullScriptText: "Could you really build a comfortable life in Southern Italy without blowing your budget? That's what we're testing today.",
  ...createEmptyCasaHudMediaPlanData(),
};

const mocks = vi.hoisted(() => ({
  ensureUser: vi.fn(),
  resolveUserId: vi.fn(),
  isCasaHudCampaignStoreAvailable: vi.fn(),
  isCasaHudCampaignStoreUnavailable: vi.fn(),
  getCasaHudCampaign: vi.fn(),
  saveCasaHudCampaign: vi.fn(),
  isStudioIntegrationStoreAvailable: vi.fn(),
  getStudioIntegrationSecret: vi.fn(),
  runCasaHudScriptNarrative: vi.fn(),
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
  isStudioIntegrationEncryptionConfigured: () => true,
  getStudioIntegrationSecret: mocks.getStudioIntegrationSecret,
}));

vi.mock("@/lib/studio/domara/script-narrative-engine", () => ({
  runCasaHudScriptNarrative: mocks.runCasaHudScriptNarrative,
}));

describe("CasaFlix script generation route", () => {
  beforeEach(() => {
    mocks.ensureUser.mockReset();
    mocks.resolveUserId.mockReset();
    mocks.isCasaHudCampaignStoreAvailable.mockReset();
    mocks.isCasaHudCampaignStoreUnavailable.mockReset();
    mocks.getCasaHudCampaign.mockReset();
    mocks.saveCasaHudCampaign.mockReset();
    mocks.isStudioIntegrationStoreAvailable.mockReset();
    mocks.getStudioIntegrationSecret.mockReset();
    mocks.runCasaHudScriptNarrative.mockReset();

    mocks.ensureUser.mockResolvedValue(undefined);
    mocks.resolveUserId.mockReturnValue(userId);
    mocks.isCasaHudCampaignStoreAvailable.mockResolvedValue(true);
    mocks.isCasaHudCampaignStoreUnavailable.mockReturnValue(false);
    mocks.getCasaHudCampaign.mockResolvedValue(locationReadyCampaign);
    mocks.saveCasaHudCampaign.mockImplementation(async (_userId: string, campaign: CasaHudCampaign) => campaign);
    mocks.isStudioIntegrationStoreAvailable.mockResolvedValue(false);
    mocks.getStudioIntegrationSecret.mockResolvedValue(null);
    mocks.runCasaHudScriptNarrative.mockResolvedValue(scriptResult);
  });

  it("requires at least one complete listing and location intelligence before generating the script", async () => {
    const route = await import("@/app/api/studio/domara/campaigns/[id]/script/route");

    mocks.getCasaHudCampaign.mockResolvedValueOnce({
      ...locationReadyCampaign,
      approvedListings: [],
    });
    const noListingsResponse = await route.POST(
      new NextRequest(`http://localhost/api/studio/domara/campaigns/${locationReadyCampaign.id}/script`, {
        method: "POST",
      }),
      { params: { id: locationReadyCampaign.id } },
    );
    const noListingsPayload = await noListingsResponse.json();
    expect(noListingsResponse.status).toBe(409);
    expect(noListingsPayload.error.code).toBe("APPROVED_LISTINGS_REQUIRED");
    expect(noListingsPayload.error.message).toContain("complete listing");

    mocks.getCasaHudCampaign.mockResolvedValueOnce({
      ...locationReadyCampaign,
      locationIntelligenceStatus: "not_started",
      status: "listing_candidates_validated",
      nextPhase: {
        key: "location_intelligence",
        label: "Location Intelligence",
        detail: "Location Intelligence comes next. CasaFlix will explain why the strongest validated properties work through area and map context.",
        implemented: false,
      },
    });
    const noLocationResponse = await route.POST(
      new NextRequest(`http://localhost/api/studio/domara/campaigns/${locationReadyCampaign.id}/script`, {
        method: "POST",
      }),
      { params: { id: locationReadyCampaign.id } },
    );
    const noLocationPayload = await noLocationResponse.json();
    expect(noLocationResponse.status).toBe(409);
    expect(noLocationPayload.error.code).toBe("LOCATION_INTELLIGENCE_REQUIRED");

    mocks.getCasaHudCampaign.mockResolvedValueOnce({
      ...locationReadyCampaign,
      approvedListings: [
        {
          ...locationReadyCampaign.approvedListings[0]!,
          id: "listing-messina",
          title: "Contrada Lacagnina Messina Single family villa with Terrace",
          locationText: "Acqualadrone - Sparta, Messina, Sicily, Italy",
          city: "Messina",
          region: "Sicily",
        },
      ],
      locationIntelligenceSummary: {
        ...locationReadyCampaign.locationIntelligenceSummary!,
        listingFingerprint: "approved:stale-tropea",
      },
      locationStory: {
        ...locationReadyCampaign.locationStory!,
        headline: "Tropea turns the shortlist into a place-led story.",
        summary: "Legacy Tropea story that no longer matches current properties.",
      },
    });
    const staleLocationResponse = await route.POST(
      new NextRequest(`http://localhost/api/studio/domara/campaigns/${locationReadyCampaign.id}/script`, {
        method: "POST",
      }),
      { params: { id: locationReadyCampaign.id } },
    );
    const staleLocationPayload = await staleLocationResponse.json();
    expect(staleLocationResponse.status).toBe(409);
    expect(staleLocationPayload.error.code).toBe("LOCATION_INTELLIGENCE_STALE");
    expect(staleLocationPayload.error.message).toContain("Regenerate Location Intelligence");
  });

  it("accepts a complete browser import as script-ready even when approvedListings is empty", async () => {
    const route = await import("@/app/api/studio/domara/campaigns/[id]/script/route");
    const scriptReadyCampaign: CasaHudCampaign = {
      ...locationReadyCampaign,
      approvedListings: [],
      listingCandidates: [
        {
          id: "listing-browser-ready",
          provider: "immobiliare",
          sourceType: "browser_assisted_import",
          sourceUrl: "https://www.immobiliare.it/en/annunci/127142643/",
          title: "Contrada Lacagnina Messina Single family villa with Terrace",
          locationText: "Acqualadrone - Sparta, Messina, Sicily, Italy",
          city: "Messina",
          region: "Sicily",
          country: "Italy",
          price: 300000,
          currency: "EUR",
          propertyType: "Single family villa",
          rooms: 5,
          bathrooms: 2,
          sizeSqm: 187,
          descriptionSnippet: "Seaside villa with direct access and complete viewer-facing details.",
          features: ["5+ rooms", "2 bathrooms", "187 sqm"],
          imageUrls: ["https://images.example.com/messina-villa.jpg"],
          imageCount: 1,
          photoAvailability: "limited",
          featuredImageUrl: "https://images.example.com/messina-villa.jpg",
          manualCompletionStatus: "completed",
          discoveredAt: "2026-05-02T00:00:00.000Z",
          preliminaryMatchNotes: "Complete browser import.",
        },
      ],
      locationStory: {
        ...locationReadyCampaign.locationStory!,
        headline: "Messina turns the shortlist into a place-led story.",
        summary: "Location intelligence now reflects Messina and Sicily.",
        regionHighlights: ["Messina", "Sicily"],
      },
      locationIntelligenceSummary: {
        ...locationReadyCampaign.locationIntelligenceSummary!,
        sourceLocations: ["Messina", "Sicily"],
      },
    };
    scriptReadyCampaign.locationIntelligenceSummary = {
      ...scriptReadyCampaign.locationIntelligenceSummary!,
      listingFingerprint: computeApprovedListingsLocationFingerprint(deriveCasaHudWorkingListings(scriptReadyCampaign)),
    };
    mocks.getCasaHudCampaign.mockResolvedValueOnce(scriptReadyCampaign);

    const response = await route.POST(
      new NextRequest(`http://localhost/api/studio/domara/campaigns/${locationReadyCampaign.id}/script`, {
        method: "POST",
      }),
      { params: { id: locationReadyCampaign.id } },
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(mocks.runCasaHudScriptNarrative).toHaveBeenCalled();
  });

  it("persists the script package and returns the updated campaign", async () => {
    const route = await import("@/app/api/studio/domara/campaigns/[id]/script/route");

    const response = await route.POST(
      new NextRequest(`http://localhost/api/studio/domara/campaigns/${locationReadyCampaign.id}/script`, {
        method: "POST",
      }),
      { params: { id: locationReadyCampaign.id } },
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.campaign.status).toBe("script_narrative_completed");
    expect(payload.campaign.scriptSummary).toBe(scriptResult.scriptSummary);
    expect(payload.campaign.nextPhase.key).toBe("media_planning_asset_assembly");
    expect(payload.summary.scriptGenerationStatus).toBe("script_generated");
    expect(payload.summary.scriptSummary).toBe(scriptResult.scriptSummary);
    expect(payload.campaign.propertySegments).toHaveLength(payload.campaign.approvedListings.length);
    expect(payload.campaign.fullScriptText).not.toContain("Video Premise");
    expect(payload.campaign.fullScriptText).not.toContain("If this title is going to resonate");
    expect(mocks.runCasaHudScriptNarrative).toHaveBeenCalledTimes(1);
    expect(mocks.saveCasaHudCampaign).toHaveBeenCalledTimes(1);
  });
});

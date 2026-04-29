import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { CasaHudCampaign } from "@/lib/studio/domara/campaigns";
import { createEmptyCasaHudMediaPlanData } from "@/lib/studio/domara/campaign-media-planning";
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

const discoveredCampaign: CasaHudCampaign = {
  id: "casahud-project-phase5",
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
  status: "listing_candidates_discovered",
  listingCandidates: [
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
    },
  ],
  listingSearchCriteria: {
    operation: "sale",
    campaignType: "lifestyle_relocation",
    titlePromise: opportunity.selectedTitle.title,
    regionHint: "Southern Italy",
    country: "Italy",
    cities: ["Tropea", "Lecce", "Bari"],
    propertyTypes: ["apartment", "villa", "house"],
    featureTags: ["budget-conscious", "move-in ready"],
    lifestyleTags: ["retirement", "relocation"],
    searchTerms: ["Southern Italy homes under 300k"],
    pricePositioning: "affordable",
    targetListingCount: 6,
    singlePropertyFocus: false,
    maxPrice: 300000,
    currency: "USD",
  },
  listingProviderStatuses: [
    {
      provider: "casahud_sample",
      label: "CasaHUD sample listing patterns",
      state: "fallback",
      configured: true,
      used: true,
      candidateCount: 1,
      detail: "Using CasaHUD sample listing patterns until listing sources are connected.",
      warning: "Connect Idealista or Immobiliare to search live listings.",
    },
  ],
  discoverySummary: {
    headline: `Prepared 1 candidate property for "${opportunity.selectedTitle.title}".`,
    criteriaSummary: "Searching sale listings around Southern Italy up to USD 300,000.",
    providerSummary: "Using CasaHUD sample listing patterns until listing sources are connected.",
    candidateCount: 1,
    liveCandidateCount: 0,
    fallbackCandidateCount: 1,
    fallbackUsed: true,
    warnings: ["Using CasaHUD sample listing patterns until listing sources are connected."],
    discoveredAt: "2026-04-28T00:20:00.000Z",
  },
  listingDiscoveryStatus: "listing_candidates_discovered",
  approvedListings: [],
  rejectedListings: [],
  listingRankOrder: [],
  listingValidationStatus: "not_started",
  listingValidationSummary: null,
  titleSupportConfidence: null,
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
  nextPhase: {
    key: "listing_validation",
    label: "Validate and rank listings",
    detail:
      "Validation and ranking arrive next. CasaHUD will confirm which discovered candidates truly support the title promise.",
    implemented: false,
  },
  createdAt: "2026-04-28T00:10:00.000Z",
  updatedAt: "2026-04-28T00:20:00.000Z",
  generatedAt: opportunity.generatedAt,
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
    publishStatus: null,
    scheduleStatus: null,
  },
};

const mocks = vi.hoisted(() => ({
  ensureUser: vi.fn(),
  resolveUserId: vi.fn(),
  isCasaHudCampaignStoreAvailable: vi.fn(),
  isCasaHudCampaignStoreUnavailable: vi.fn(),
  getCasaHudCampaign: vi.fn(),
  saveCasaHudCampaign: vi.fn(),
  runCasaHudListingValidation: vi.fn(),
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

vi.mock("@/lib/studio/domara/listing-validation-engine", () => ({
  runCasaHudListingValidation: mocks.runCasaHudListingValidation,
}));

describe("CasaHUD listing validation route", () => {
  beforeEach(() => {
    mocks.ensureUser.mockReset();
    mocks.resolveUserId.mockReset();
    mocks.isCasaHudCampaignStoreAvailable.mockReset();
    mocks.isCasaHudCampaignStoreUnavailable.mockReset();
    mocks.getCasaHudCampaign.mockReset();
    mocks.saveCasaHudCampaign.mockReset();
    mocks.runCasaHudListingValidation.mockReset();

    mocks.ensureUser.mockResolvedValue(undefined);
    mocks.resolveUserId.mockReturnValue(userId);
    mocks.isCasaHudCampaignStoreAvailable.mockResolvedValue(true);
    mocks.isCasaHudCampaignStoreUnavailable.mockReturnValue(false);
    mocks.getCasaHudCampaign.mockResolvedValue(discoveredCampaign);
    mocks.saveCasaHudCampaign.mockImplementation(async (_userId: string, campaign: CasaHudCampaign) => campaign);
    mocks.runCasaHudListingValidation.mockReturnValue({
      approvedListings: [
        {
          ...discoveredCampaign.listingCandidates[0]!,
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
    });
  });

  it("validates listings, persists ranked results, and returns a typed response", async () => {
    const route = await import("@/app/api/studio/domara/campaigns/[id]/validate-listings/route");
    const response = await route.POST(
      new NextRequest(`http://localhost/api/studio/domara/campaigns/${discoveredCampaign.id}/validate-listings`, {
        method: "POST",
      }),
      { params: { id: discoveredCampaign.id } },
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.campaign.status).toBe("listing_candidates_validated");
    expect(payload.campaign.approvedListings).toHaveLength(1);
    expect(payload.summary.approvedListingCount).toBe(1);
    expect(payload.campaign.nextPhase.key).toBe("location_intelligence");
    expect(mocks.saveCasaHudCampaign).toHaveBeenCalledTimes(1);
  });

  it("returns safe errors for missing ids, missing campaigns, missing candidates, and unavailable storage", async () => {
    const route = await import("@/app/api/studio/domara/campaigns/[id]/validate-listings/route");

    const invalidResponse = await route.POST(
      new NextRequest("http://localhost/api/studio/domara/campaigns//validate-listings", { method: "POST" }),
      { params: { id: "" } },
    );
    expect(invalidResponse.status).toBe(400);

    mocks.getCasaHudCampaign.mockResolvedValueOnce(null);
    const missingResponse = await route.POST(
      new NextRequest(`http://localhost/api/studio/domara/campaigns/${discoveredCampaign.id}/validate-listings`, {
        method: "POST",
      }),
      { params: { id: discoveredCampaign.id } },
    );
    expect(missingResponse.status).toBe(404);

    mocks.getCasaHudCampaign.mockResolvedValueOnce({ ...discoveredCampaign, listingCandidates: [] });
    const missingCandidates = await route.POST(
      new NextRequest(`http://localhost/api/studio/domara/campaigns/${discoveredCampaign.id}/validate-listings`, {
        method: "POST",
      }),
      { params: { id: discoveredCampaign.id } },
    );
    expect(missingCandidates.status).toBe(409);

    mocks.isCasaHudCampaignStoreAvailable.mockResolvedValueOnce(false);
    const unavailableResponse = await route.POST(
      new NextRequest(`http://localhost/api/studio/domara/campaigns/${discoveredCampaign.id}/validate-listings`, {
        method: "POST",
      }),
      { params: { id: discoveredCampaign.id } },
    );
    expect(unavailableResponse.status).toBe(503);
  });
});

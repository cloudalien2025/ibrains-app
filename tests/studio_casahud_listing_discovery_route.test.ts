import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { CasaHudCampaign } from "@/lib/studio/domara/campaigns";
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

const savedCampaign: CasaHudCampaign = {
  id: "casahud-project-phase4",
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
    key: "property_discovery",
    label: "Find matching properties",
    detail:
      "Property Discovery comes next. CasaHUD will translate the saved title promise into real candidate listings without regenerating the title package.",
    implemented: false,
  },
  createdAt: "2026-04-28T00:10:00.000Z",
  updatedAt: "2026-04-28T00:10:00.000Z",
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
  isStudioIntegrationStoreAvailable: vi.fn(),
  isStudioIntegrationEncryptionConfigured: vi.fn(),
  listStudioStoredIntegrationStatuses: vi.fn(),
  runCasaHudListingDiscovery: vi.fn(),
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
  listStudioStoredIntegrationStatuses: mocks.listStudioStoredIntegrationStatuses,
}));

vi.mock("@/lib/studio/domara/listing-discovery-engine", () => ({
  runCasaHudListingDiscovery: mocks.runCasaHudListingDiscovery,
}));

describe("CasaHUD listing discovery route", () => {
  beforeEach(() => {
    mocks.ensureUser.mockReset();
    mocks.resolveUserId.mockReset();
    mocks.isCasaHudCampaignStoreAvailable.mockReset();
    mocks.isCasaHudCampaignStoreUnavailable.mockReset();
    mocks.getCasaHudCampaign.mockReset();
    mocks.saveCasaHudCampaign.mockReset();
    mocks.isStudioIntegrationStoreAvailable.mockReset();
    mocks.isStudioIntegrationEncryptionConfigured.mockReset();
    mocks.listStudioStoredIntegrationStatuses.mockReset();
    mocks.runCasaHudListingDiscovery.mockReset();

    mocks.ensureUser.mockResolvedValue(undefined);
    mocks.resolveUserId.mockReturnValue(userId);
    mocks.isCasaHudCampaignStoreAvailable.mockResolvedValue(true);
    mocks.isCasaHudCampaignStoreUnavailable.mockReturnValue(false);
    mocks.getCasaHudCampaign.mockResolvedValue(savedCampaign);
    mocks.saveCasaHudCampaign.mockImplementation(async (_userId: string, campaign: CasaHudCampaign) => campaign);
    mocks.isStudioIntegrationStoreAvailable.mockResolvedValue(false);
    mocks.isStudioIntegrationEncryptionConfigured.mockReturnValue(false);
    mocks.listStudioStoredIntegrationStatuses.mockResolvedValue([]);
    mocks.runCasaHudListingDiscovery.mockResolvedValue({
      listingSearchCriteria: {
        operation: "sale",
        campaignType: "lifestyle_relocation",
        titlePromise: savedCampaign.selectedViralTitle,
        regionHint: "Southern Italy",
        country: "Italy",
        cities: ["Tropea", "Lecce", "Palermo"],
        propertyTypes: ["apartment", "villa"],
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
          provider: "idealista",
          label: "Idealista",
          state: "missing_credentials",
          configured: false,
          used: false,
          candidateCount: 0,
          detail: "Idealista is not connected yet. CasaHUD can still prepare candidate properties with sample listing patterns.",
          warning: "Connect Idealista to search live listings.",
        },
        {
          provider: "casahud_sample",
          label: "CasaHUD sample listing patterns",
          state: "fallback",
          configured: true,
          used: true,
          candidateCount: 2,
          detail: "Using CasaHUD sample listing patterns until listing sources are connected.",
          warning: "Connect Idealista or Immobiliare to search live listings.",
        },
      ],
      listingCandidates: [
        {
          id: "listing-a",
          provider: "casahud_sample",
          title: "Tropea apartment candidate",
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
          descriptionSnippet: "Candidate listing pattern with strong relocation fit.",
          features: ["budget-conscious", "move-in ready", "coastal lifestyle"],
          imageUrls: ["https://images.example.com/1.jpg"],
          imageCount: 1,
          photoAvailability: "limited",
          discoveredAt: "2026-04-28T00:20:00.000Z",
          preliminaryMatchNotes: "Fits the title promise and budget.",
        },
        {
          id: "listing-b",
          provider: "casahud_sample",
          title: "Lecce villa candidate",
          locationText: "Lecce, Puglia, Italy",
          country: "Italy",
          region: "Puglia",
          city: "Lecce",
          price: 296000,
          currency: "USD",
          propertyType: "villa",
          bedrooms: 3,
          bathrooms: 2,
          sizeSqm: 112,
          descriptionSnippet: "Candidate listing pattern with strong relocation fit.",
          features: ["budget-conscious", "move-in ready", "coastal lifestyle"],
          imageUrls: ["https://images.example.com/2.jpg"],
          imageCount: 1,
          photoAvailability: "limited",
          discoveredAt: "2026-04-28T00:20:00.000Z",
          preliminaryMatchNotes: "Matches the retirement angle with visual support.",
        },
      ],
      discoverySummary: {
        headline: `Prepared 2 candidate properties for "${savedCampaign.selectedViralTitle}".`,
        criteriaSummary: "Searching sale listings around Southern Italy up to USD 300,000, focused on budget-conscious and move-in ready properties.",
        providerSummary: "Using CasaHUD sample listing patterns until listing sources are connected.",
        candidateCount: 2,
        liveCandidateCount: 0,
        fallbackCandidateCount: 2,
        fallbackUsed: true,
        warnings: ["Using CasaHUD sample listing patterns until listing sources are connected."],
        discoveredAt: "2026-04-28T00:20:00.000Z",
      },
    });
  });

  it("discovers listings, persists them on the campaign, and returns a typed response", async () => {
    const route = await import("@/app/api/studio/domara/campaigns/[id]/discover-listings/route");
    const response = await route.POST(
      new NextRequest(`http://localhost/api/studio/domara/campaigns/${savedCampaign.id}/discover-listings`, {
        method: "POST",
      }),
      { params: { id: savedCampaign.id } },
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.campaign.status).toBe("listing_candidates_discovered");
    expect(payload.campaign.listingCandidates).toHaveLength(2);
    expect(payload.summary.listingCandidateCount).toBe(2);
    expect(payload.campaign.nextPhase.key).toBe("listing_validation");
    expect(mocks.saveCasaHudCampaign).toHaveBeenCalledTimes(1);
  });

  it("returns safe errors for missing ids, missing campaigns, and unavailable storage", async () => {
    const route = await import("@/app/api/studio/domara/campaigns/[id]/discover-listings/route");

    const invalidResponse = await route.POST(
      new NextRequest("http://localhost/api/studio/domara/campaigns//discover-listings", { method: "POST" }),
      { params: { id: "" } },
    );
    expect(invalidResponse.status).toBe(400);

    mocks.getCasaHudCampaign.mockResolvedValueOnce(null);
    const missingResponse = await route.POST(
      new NextRequest(`http://localhost/api/studio/domara/campaigns/${savedCampaign.id}/discover-listings`, {
        method: "POST",
      }),
      { params: { id: savedCampaign.id } },
    );
    expect(missingResponse.status).toBe(404);

    mocks.isCasaHudCampaignStoreAvailable.mockResolvedValueOnce(false);
    const unavailableResponse = await route.POST(
      new NextRequest(`http://localhost/api/studio/domara/campaigns/${savedCampaign.id}/discover-listings`, {
        method: "POST",
      }),
      { params: { id: savedCampaign.id } },
    );
    expect(unavailableResponse.status).toBe(503);
  });
});

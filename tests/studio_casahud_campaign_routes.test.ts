import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { CasaHudCampaign } from "@/lib/studio/domara/campaigns";
import { createEmptyCasaHudMediaPlanData } from "@/lib/studio/domara/campaign-media-planning";
import { createEmptyCasaHudYouTubePackageData } from "@/lib/studio/domara/campaign-youtube-package";
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

const campaign: CasaHudCampaign = {
  id: "casahud-project-phase3",
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
  createCasaHudCampaignFromOpportunity: vi.fn(),
  listCasaHudCampaignSummaries: vi.fn(),
  getCasaHudCampaign: vi.fn(),
}));

vi.mock("@/app/api/ecomviper/_utils/user", () => ({
  ensureUser: mocks.ensureUser,
  resolveUserId: mocks.resolveUserId,
}));

vi.mock("@/lib/studio/domara/campaign-repository", () => ({
  isCasaHudCampaignStoreAvailable: mocks.isCasaHudCampaignStoreAvailable,
  isCasaHudCampaignStoreUnavailable: mocks.isCasaHudCampaignStoreUnavailable,
  createCasaHudCampaignFromOpportunity: mocks.createCasaHudCampaignFromOpportunity,
  listCasaHudCampaignSummaries: mocks.listCasaHudCampaignSummaries,
  getCasaHudCampaign: mocks.getCasaHudCampaign,
}));

describe("CasaHUD campaign routes", () => {
  beforeEach(() => {
    mocks.ensureUser.mockReset();
    mocks.resolveUserId.mockReset();
    mocks.isCasaHudCampaignStoreAvailable.mockReset();
    mocks.isCasaHudCampaignStoreUnavailable.mockReset();
    mocks.createCasaHudCampaignFromOpportunity.mockReset();
    mocks.listCasaHudCampaignSummaries.mockReset();
    mocks.getCasaHudCampaign.mockReset();

    mocks.ensureUser.mockResolvedValue(undefined);
    mocks.resolveUserId.mockReturnValue(userId);
    mocks.isCasaHudCampaignStoreAvailable.mockResolvedValue(true);
    mocks.isCasaHudCampaignStoreUnavailable.mockReturnValue(false);
    mocks.createCasaHudCampaignFromOpportunity.mockResolvedValue(campaign);
    mocks.listCasaHudCampaignSummaries.mockResolvedValue([
      {
        id: campaign.id,
        name: campaign.name,
        campaignType: campaign.campaignType,
        marketRegionHint: campaign.marketRegionHint,
        status: campaign.status,
        createdAt: campaign.createdAt,
        updatedAt: campaign.updatedAt,
        researchSummary: campaign.researchBrief.summary,
        listingCandidateCount: 0,
        listingDiscoveryStatus: "not_started",
        approvedListingCount: 0,
        listingValidationStatus: "not_started",
        locationIntelligenceStatus: "not_started",
        scriptGenerationStatus: "not_started",
      },
    ]);
    mocks.getCasaHudCampaign.mockResolvedValue(campaign);
  });

  it("creates a typed campaign response and uses the selected viral title as the campaign name", async () => {
    const route = await import("@/app/api/studio/domara/campaigns/route");
    const request = new NextRequest("http://localhost/api/studio/domara/campaigns", {
      method: "POST",
      body: JSON.stringify({ opportunity }),
    });

    const response = await route.POST(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.campaign.name).toBe(opportunity.selectedTitle.title);
    expect(payload.campaign.selectedViralTitle).toBe(opportunity.selectedTitle.title);
    expect(payload.summary.researchSummary).toBe(opportunity.researchBrief.summary);
  });

  it("rejects invalid create payloads with a safe validation error", async () => {
    const route = await import("@/app/api/studio/domara/campaigns/route");
    const request = new NextRequest("http://localhost/api/studio/domara/campaigns", {
      method: "POST",
      body: JSON.stringify({ opportunity: { selectedTitle: {} } }),
    });

    const response = await route.POST(request);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe("INVALID_INPUT");
  });

  it("lists recent campaigns and reads a campaign by id", async () => {
    const listRoute = await import("@/app/api/studio/domara/campaigns/route");
    const readRoute = await import("@/app/api/studio/domara/campaigns/[id]/route");

    const listResponse = await listRoute.GET(new NextRequest("http://localhost/api/studio/domara/campaigns"));
    const listPayload = await listResponse.json();
    expect(listResponse.status).toBe(200);
    expect(listPayload.campaigns[0].name).toBe(campaign.name);

    const readResponse = await readRoute.GET(new NextRequest(`http://localhost/api/studio/domara/campaigns/${campaign.id}`), {
      params: { id: campaign.id },
    });
    const readPayload = await readResponse.json();
    expect(readResponse.status).toBe(200);
    expect(readPayload.campaign.id).toBe(campaign.id);
    expect(readPayload.campaign.researchBrief.summary).toBe(campaign.researchBrief.summary);
  });

  it("fails safely when storage is unavailable or the campaign is missing", async () => {
    const listRoute = await import("@/app/api/studio/domara/campaigns/route");
    const readRoute = await import("@/app/api/studio/domara/campaigns/[id]/route");

    mocks.isCasaHudCampaignStoreAvailable.mockResolvedValue(false);
    const unavailableResponse = await listRoute.POST(
      new NextRequest("http://localhost/api/studio/domara/campaigns", {
        method: "POST",
        body: JSON.stringify({ opportunity }),
      }),
    );
    const unavailablePayload = await unavailableResponse.json();
    expect(unavailableResponse.status).toBe(503);
    expect(unavailablePayload.error.code).toBe("CASAHUD_STORE_UNAVAILABLE");

    mocks.isCasaHudCampaignStoreAvailable.mockResolvedValue(true);
    mocks.getCasaHudCampaign.mockResolvedValue(null);
    const missingResponse = await readRoute.GET(new NextRequest(`http://localhost/api/studio/domara/campaigns/${campaign.id}`), {
      params: { id: campaign.id },
    });
    const missingPayload = await missingResponse.json();
    expect(missingResponse.status).toBe(404);
    expect(missingPayload.error.code).toBe("NOT_FOUND");
  });
});

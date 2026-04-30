import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { CasaHudCampaign } from "@/lib/studio/domara/campaigns";
import type { CasaHudOpportunityResult } from "@/lib/studio/domara/opportunity-engine/types";

const userId = "11111111-1111-4111-8111-111111111111";

const opportunity: CasaHudOpportunityResult = {
  generatedAt: "2026-04-28T00:00:00.000Z",
  preferredMarket: "Italian real-estate YouTube",
  researchBrief: {
    summary: "CasaFlix identified the strongest relocation opportunity in Southern Italy.",
    opportunityCategories: ["relocation"],
    competitorPatterns: ["Budget-led relocation titles perform well."],
    audienceIntent: ["retire in Italy"],
    suggestedTitleDirections: ["price-led relocation"],
    riskNotes: ["Avoid unsupported lifestyle claims."],
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
      reasoning: "Strong relocation intent plus believable listing support.",
    },
  ],
  selectedTitle: {
    title: "Could You Retire in Southern Italy for Under $300K?",
    score: 92,
    campaignType: "lifestyle_relocation",
    confidence: 0.89,
    reasoning: "Strong relocation intent plus believable listing support.",
    regionHint: "Southern Italy",
    listingSearchHints: ["Southern Italy homes under 300k", "relocation-friendly towns"],
  },
  campaignTypePrediction: "lifestyle_relocation",
  titleOpportunitySummary:
    "The title gives CasaFlix a clear, searchable relocation angle that can still stay grounded in approved listings and place story.",
  confidenceSummary: "89% confidence. CasaFlix prefers titles that can earn clicks without forcing unsupported claims.",
  providerStatus: {
    mode: "casahud_patterns",
    label: "CasaFlix opportunity patterns",
    detail: "Using CasaFlix opportunity patterns.",
    canImproveWithYouTube: true,
  },
  nextStep: {
    action: "create_campaign",
    label: "Create campaign",
    detail: "Turn this winning concept into a saved CasaFlix campaign.",
  },
};

async function buildMediaPlannedCampaign(): Promise<CasaHudCampaign> {
  const campaigns = await import("@/lib/studio/domara/campaigns");
  const discovery = await import("@/lib/studio/domara/listing-discovery-engine");
  const validation = await import("@/lib/studio/domara/listing-validation-engine");
  const location = await import("@/lib/studio/domara/location-intelligence-engine");
  const script = await import("@/lib/studio/domara/script-narrative-engine");
  const media = await import("@/lib/studio/domara/media-planning-engine");

  const created = campaigns.buildCasaHudCampaignFromOpportunity(userId, opportunity);
  const discoveryResult = await discovery.runCasaHudListingDiscovery(created);
  const discovered = campaigns.applyCasaHudListingDiscovery(created, discoveryResult);
  const validationResult = validation.runCasaHudListingValidation(discovered);
  const validated = campaigns.applyCasaHudListingValidation(discovered, validationResult);
  const locationResult = await location.runCasaHudLocationIntelligence(validated, {});
  const enriched = campaigns.applyCasaHudLocationIntelligence(validated, locationResult);
  const scriptResult = await script.runCasaHudScriptNarrative(enriched, {});
  const scripted = campaigns.applyCasaHudScriptNarrative(enriched, scriptResult);
  const mediaPlan = media.runCasaHudMediaPlanning(scripted);
  return campaigns.applyCasaHudMediaPlan(scripted, mediaPlan);
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

describe("CasaFlix youtube package route", () => {
  let mediaPlannedCampaign: CasaHudCampaign;

  beforeEach(async () => {
    mediaPlannedCampaign = await buildMediaPlannedCampaign();

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
    mocks.getCasaHudCampaign.mockResolvedValue(mediaPlannedCampaign);
    mocks.saveCasaHudCampaign.mockImplementation(async (_userId: string, campaign: CasaHudCampaign) => campaign);
  });

  it("requires approved listings, location intelligence, script, and media planning before building the package", async () => {
    const route = await import("@/app/api/studio/domara/campaigns/[id]/youtube-package/route");

    mocks.getCasaHudCampaign.mockResolvedValueOnce({
      ...mediaPlannedCampaign,
      approvedListings: [],
    });
    const noListingsResponse = await route.POST(
      new NextRequest(`http://localhost/api/studio/domara/campaigns/${mediaPlannedCampaign.id}/youtube-package`, {
        method: "POST",
      }),
      { params: { id: mediaPlannedCampaign.id } },
    );
    expect(noListingsResponse.status).toBe(409);

    mocks.getCasaHudCampaign.mockResolvedValueOnce({
      ...mediaPlannedCampaign,
      locationIntelligenceStatus: "not_started",
      status: "listing_candidates_validated",
    });
    const noLocationResponse = await route.POST(
      new NextRequest(`http://localhost/api/studio/domara/campaigns/${mediaPlannedCampaign.id}/youtube-package`, {
        method: "POST",
      }),
      { params: { id: mediaPlannedCampaign.id } },
    );
    expect(noLocationResponse.status).toBe(409);

    mocks.getCasaHudCampaign.mockResolvedValueOnce({
      ...mediaPlannedCampaign,
      scriptGenerationStatus: "not_started",
      scriptSegments: [],
      status: "location_intelligence_completed",
    });
    const noScriptResponse = await route.POST(
      new NextRequest(`http://localhost/api/studio/domara/campaigns/${mediaPlannedCampaign.id}/youtube-package`, {
        method: "POST",
      }),
      { params: { id: mediaPlannedCampaign.id } },
    );
    expect(noScriptResponse.status).toBe(409);

    mocks.getCasaHudCampaign.mockResolvedValueOnce({
      ...mediaPlannedCampaign,
      mediaPlanningStatus: "not_started",
      sceneAssetMapping: [],
      status: "script_narrative_completed",
    });
    const noMediaResponse = await route.POST(
      new NextRequest(`http://localhost/api/studio/domara/campaigns/${mediaPlannedCampaign.id}/youtube-package`, {
        method: "POST",
      }),
      { params: { id: mediaPlannedCampaign.id } },
    );
    expect(noMediaResponse.status).toBe(409);
  });

  it("persists the package, review summary, and render plan on success", async () => {
    const route = await import("@/app/api/studio/domara/campaigns/[id]/youtube-package/route");

    const response = await route.POST(
      new NextRequest(`http://localhost/api/studio/domara/campaigns/${mediaPlannedCampaign.id}/youtube-package`, {
        method: "POST",
      }),
      { params: { id: mediaPlannedCampaign.id } },
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.campaign.status).toBe("youtube_package_review_completed");
    expect(payload.campaign.youtubePackageStatus).toBe("package_prepared");
    expect(payload.campaign.reviewStatus).not.toBe("not_started");
    expect(payload.campaign.renderPlanStatus).toBe("render_plan_ready");
    expect(payload.campaign.finalTitle).toBeTruthy();
    expect(payload.campaign.youtubeDescription).toBeTruthy();
    expect(payload.campaign.nextPhase.key).toBe("render_publish_schedule");
    expect(payload.summary.youtubePackageStatus).toBe("package_prepared");
    expect(payload.summary.reviewStatus).toBe(payload.campaign.reviewStatus);
    expect(mocks.saveCasaHudCampaign).toHaveBeenCalledTimes(1);
  });
});

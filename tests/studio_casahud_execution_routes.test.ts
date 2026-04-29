import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import {
  applyCasaHudLocationIntelligence,
  applyCasaHudListingDiscovery,
  applyCasaHudListingValidation,
  applyCasaHudMediaPlan,
  applyCasaHudScriptNarrative,
  applyCasaHudYouTubePackage,
  buildCasaHudCampaignFromOpportunity,
  type CasaHudCampaign,
} from "@/lib/studio/domara/campaigns";
import { createEmptyCasaHudExecutionData } from "@/lib/studio/domara/campaign-execution";
import type { CasaHudOpportunityResult } from "@/lib/studio/domara/opportunity-engine/types";
import { runCasaHudListingDiscovery } from "@/lib/studio/domara/listing-discovery-engine";
import { runCasaHudListingValidation } from "@/lib/studio/domara/listing-validation-engine";
import { runCasaHudLocationIntelligence } from "@/lib/studio/domara/location-intelligence-engine";
import { runCasaHudMediaPlanning } from "@/lib/studio/domara/media-planning-engine";
import { runCasaHudScriptNarrative } from "@/lib/studio/domara/script-narrative-engine";
import { runCasaHudYouTubePackageReview } from "@/lib/studio/domara/youtube-package-engine";

const userId = "11111111-1111-4111-8111-111111111111";

const opportunity: CasaHudOpportunityResult = {
  generatedAt: "2026-04-28T00:00:00.000Z",
  preferredMarket: "Italian real-estate YouTube",
  researchBrief: {
    summary: "CasaHUD identified the strongest relocation opportunity in Southern Italy.",
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
    "The title gives CasaHUD a clear, searchable relocation angle that can still stay grounded in approved listings and place story.",
  confidenceSummary: "89% confidence. CasaHUD prefers titles that can earn clicks without forcing unsupported claims.",
  providerStatus: {
    mode: "casahud_patterns",
    label: "CasaHUD opportunity patterns",
    detail: "Using CasaHUD opportunity patterns.",
    canImproveWithYouTube: true,
  },
  nextStep: {
    action: "create_campaign",
    label: "Create campaign",
    detail: "Turn this winning concept into a saved CasaHUD campaign.",
  },
};

async function buildPackagedCampaign(): Promise<CasaHudCampaign> {
  const created = buildCasaHudCampaignFromOpportunity(userId, opportunity);
  const discovery = await runCasaHudListingDiscovery(created);
  const discovered = applyCasaHudListingDiscovery(created, discovery);
  const validation = runCasaHudListingValidation(discovered);
  const validated = applyCasaHudListingValidation(discovered, validation);
  const location = await runCasaHudLocationIntelligence(validated, {});
  const located = applyCasaHudLocationIntelligence(validated, location);
  const script = await runCasaHudScriptNarrative(located, {});
  const scripted = applyCasaHudScriptNarrative(located, script);
  const media = runCasaHudMediaPlanning(scripted);
  const mediaPlanned = applyCasaHudMediaPlan(scripted, media);
  return applyCasaHudYouTubePackage(mediaPlanned, runCasaHudYouTubePackageReview(mediaPlanned));
}

const mocks = vi.hoisted(() => ({
  ensureUser: vi.fn(),
  resolveUserId: vi.fn(),
  isCasaHudCampaignStoreAvailable: vi.fn(),
  isCasaHudCampaignStoreUnavailable: vi.fn(),
  getCasaHudCampaign: vi.fn(),
  saveCasaHudCampaign: vi.fn(),
  runCasaHudRenderAgent: vi.fn(),
  runCasaHudPublishAgent: vi.fn(),
  runCasaHudScheduleAgent: vi.fn(),
  resolveCasaHudYouTubeExecutionContext: vi.fn(),
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

vi.mock("@/lib/studio/domara/campaign-execution-engine", () => ({
  runCasaHudRenderAgent: mocks.runCasaHudRenderAgent,
  runCasaHudPublishAgent: mocks.runCasaHudPublishAgent,
  runCasaHudScheduleAgent: mocks.runCasaHudScheduleAgent,
}));

vi.mock("@/app/api/studio/domara/_utils/execution-context", () => ({
  resolveCasaHudYouTubeExecutionContext: mocks.resolveCasaHudYouTubeExecutionContext,
}));

describe("CasaHUD execution routes", () => {
  let packagedCampaign: CasaHudCampaign;

  beforeEach(async () => {
    packagedCampaign = await buildPackagedCampaign();

    mocks.ensureUser.mockReset();
    mocks.resolveUserId.mockReset();
    mocks.isCasaHudCampaignStoreAvailable.mockReset();
    mocks.isCasaHudCampaignStoreUnavailable.mockReset();
    mocks.getCasaHudCampaign.mockReset();
    mocks.saveCasaHudCampaign.mockReset();
    mocks.runCasaHudRenderAgent.mockReset();
    mocks.runCasaHudPublishAgent.mockReset();
    mocks.runCasaHudScheduleAgent.mockReset();
    mocks.resolveCasaHudYouTubeExecutionContext.mockReset();

    mocks.ensureUser.mockResolvedValue(undefined);
    mocks.resolveUserId.mockReturnValue(userId);
    mocks.isCasaHudCampaignStoreAvailable.mockResolvedValue(true);
    mocks.isCasaHudCampaignStoreUnavailable.mockReturnValue(false);
    mocks.getCasaHudCampaign.mockResolvedValue(packagedCampaign);
    mocks.saveCasaHudCampaign.mockImplementation(async (_userId: string, campaign: CasaHudCampaign) => campaign);
    mocks.resolveCasaHudYouTubeExecutionContext.mockResolvedValue({
      connected: false,
      uploadAvailable: false,
      providerStatus: {
        provider: "youtube_unavailable",
        state: "needs_connection",
        detail: "Connect the YouTube Channel before CasaHUD can publish or schedule this campaign.",
      },
    });
  });

  it("renders and persists execution state through the render route", async () => {
    const route = await import("@/app/api/studio/domara/campaigns/[id]/render/route");
    const execution = createEmptyCasaHudExecutionData();
    mocks.runCasaHudRenderAgent.mockResolvedValueOnce({
      ok: true,
      httpStatus: 200,
      message: "Render ready.",
      execution: {
        ...execution,
        approvalStatus: "approved",
        approvedAt: "2026-04-29T10:00:00.000Z",
        approvedBy: userId,
        renderStatus: "rendered",
        renderOutput: {
          id: "render-1",
          type: "preview_package",
          status: "rendered",
          url: null,
          path: null,
          durationSeconds: 90,
          format: "preview_package",
          createdAt: "2026-04-29T10:00:00.000Z",
          provider: "preview_package",
          metadata: { sceneCount: 1 },
          warnings: [],
        },
        renderJobId: "render-1",
        renderProviderStatus: {
          provider: "preview_package",
          state: "degraded",
          detail: "Preview package prepared.",
        },
        renderRunHistory: [
          {
            id: "run-1",
            type: "render",
            status: "rendered",
            startedAt: "2026-04-29T10:00:00.000Z",
            completedAt: "2026-04-29T10:00:00.000Z",
            provider: "preview_package",
            message: "Preview package prepared.",
          },
        ],
        executionRunHistory: [
          {
            id: "run-1",
            type: "render",
            status: "rendered",
            startedAt: "2026-04-29T10:00:00.000Z",
            completedAt: "2026-04-29T10:00:00.000Z",
            provider: "preview_package",
            message: "Preview package prepared.",
          },
        ],
        finalState: "rendered",
      },
    });

    const response = await route.POST(
      new NextRequest(`http://localhost/api/studio/domara/campaigns/${packagedCampaign.id}/render`, {
        method: "POST",
      }),
      { params: { id: packagedCampaign.id } },
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.campaign.renderStatus).toBe("rendered");
    expect(payload.campaign.renderOutput.type).toBe("preview_package");
    expect(mocks.saveCasaHudCampaign).toHaveBeenCalledTimes(1);
  });

  it("persists a blocked publish attempt when YouTube is not connected", async () => {
    const route = await import("@/app/api/studio/domara/campaigns/[id]/publish/route");
    const execution = createEmptyCasaHudExecutionData();
    mocks.runCasaHudPublishAgent.mockResolvedValueOnce({
      ok: false,
      httpStatus: 503,
      message: "Connect the YouTube Channel before CasaHUD can publish or schedule this campaign.",
      execution: {
        ...execution,
        publishStatus: "blocked",
        publishProviderStatus: {
          provider: "youtube_unavailable",
          state: "needs_connection",
          detail: "Connect the YouTube Channel before CasaHUD can publish or schedule this campaign.",
        },
        publishRunHistory: [
          {
            id: "run-2",
            type: "publish",
            status: "blocked",
            startedAt: "2026-04-29T10:10:00.000Z",
            completedAt: "2026-04-29T10:10:00.000Z",
            provider: "youtube_unavailable",
            message: "Connect the YouTube Channel before CasaHUD can publish or schedule this campaign.",
          },
        ],
        executionRunHistory: [
          {
            id: "run-2",
            type: "publish",
            status: "blocked",
            startedAt: "2026-04-29T10:10:00.000Z",
            completedAt: "2026-04-29T10:10:00.000Z",
            provider: "youtube_unavailable",
            message: "Connect the YouTube Channel before CasaHUD can publish or schedule this campaign.",
          },
        ],
        finalState: "blocked",
      },
    });

    const response = await route.POST(
      new NextRequest(`http://localhost/api/studio/domara/campaigns/${packagedCampaign.id}/publish`, {
        method: "POST",
      }),
      { params: { id: packagedCampaign.id } },
    );
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload.ok).toBe(false);
    expect(payload.campaign.publishStatus).toBe("blocked");
    expect(mocks.saveCasaHudCampaign).toHaveBeenCalledTimes(1);
  });

  it("validates the scheduled datetime before calling the schedule agent", async () => {
    const route = await import("@/app/api/studio/domara/campaigns/[id]/schedule/route");

    const response = await route.POST(
      new NextRequest(`http://localhost/api/studio/domara/campaigns/${packagedCampaign.id}/schedule`, {
        method: "POST",
        body: JSON.stringify({ scheduledAt: "2026-04-29T00:00:00.000Z" }),
      }),
      { params: { id: packagedCampaign.id } },
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error.code).toBe("INVALID_SCHEDULE_TIME");
    expect(mocks.runCasaHudScheduleAgent).not.toHaveBeenCalled();
  });

  it("rejects render execution when the Phase 9 package is missing", async () => {
    const route = await import("@/app/api/studio/domara/campaigns/[id]/render/route");
    mocks.getCasaHudCampaign.mockResolvedValueOnce({
      ...packagedCampaign,
      youtubePackageStatus: "not_started",
      renderPlan: null,
      previewPackage: null,
    });

    const response = await route.POST(
      new NextRequest(`http://localhost/api/studio/domara/campaigns/${packagedCampaign.id}/render`, {
        method: "POST",
      }),
      { params: { id: packagedCampaign.id } },
    );

    expect(response.status).toBe(409);
    expect(mocks.saveCasaHudCampaign).not.toHaveBeenCalled();
  });
});

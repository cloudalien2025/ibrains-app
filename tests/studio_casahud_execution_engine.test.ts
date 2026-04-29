import { describe, expect, it } from "vitest";
import {
  applyCasaHudExecutionUpdate,
  applyCasaHudLocationIntelligence,
  applyCasaHudListingDiscovery,
  applyCasaHudListingValidation,
  applyCasaHudMediaPlan,
  applyCasaHudScriptNarrative,
  applyCasaHudYouTubePackage,
  buildCasaHudCampaignFromOpportunity,
} from "@/lib/studio/domara/campaigns";
import { createEmptyCasaHudExecutionData } from "@/lib/studio/domara/campaign-execution";
import {
  runCasaHudPublishAgent,
  runCasaHudRenderAgent,
  runCasaHudScheduleAgent,
} from "@/lib/studio/domara/campaign-execution-engine";
import { runCasaHudListingDiscovery } from "@/lib/studio/domara/listing-discovery-engine";
import { runCasaHudListingValidation } from "@/lib/studio/domara/listing-validation-engine";
import { runCasaHudLocationIntelligence } from "@/lib/studio/domara/location-intelligence-engine";
import { runCasaHudMediaPlanning } from "@/lib/studio/domara/media-planning-engine";
import type { CasaHudOpportunityResult } from "@/lib/studio/domara/opportunity-engine/types";
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

async function buildPackagedCampaign() {
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

describe("CasaHUD execution engine", () => {
  it("creates an honest preview-package render result when full render is not yet safe", async () => {
    const packaged = await buildPackagedCampaign();
    const result = await runCasaHudRenderAgent({
      ...packaged,
      renderBlockers: ["Scene coverage is incomplete for the current package."],
    });

    expect(result.ok).toBe(true);
    expect(result.execution.renderStatus).toBe("rendered");
    expect(result.execution.renderOutput?.type).toBe("preview_package");
    expect(result.execution.renderProviderStatus?.provider).toBe("preview_package");
    expect(result.execution.renderRunHistory[0]?.type).toBe("render");
  });

  it("blocks publishing when the YouTube channel is not connected", async () => {
    const packaged = await buildPackagedCampaign();
    const execution = createEmptyCasaHudExecutionData();
    const renderReadyCampaign = applyCasaHudExecutionUpdate(packaged, {
      ...execution,
      approvalStatus: "approved",
      approvedAt: "2026-04-29T10:00:00.000Z",
      approvedBy: userId,
      renderStatus: "rendered",
      renderOutput: {
        id: "render-1",
        type: "mp4",
        status: "rendered",
        url: "/generated/domara/render-1.mp4",
        path: "/generated/domara/render-1.mp4",
        durationSeconds: 92,
        format: "mp4",
        createdAt: "2026-04-29T10:00:00.000Z",
        provider: "ffmpeg_local",
        metadata: { filename: "render-1.mp4" },
        warnings: [],
      },
      renderOutputUrl: "/generated/domara/render-1.mp4",
      renderOutputPath: "/generated/domara/render-1.mp4",
      renderProviderStatus: {
        provider: "ffmpeg_local",
        state: "connected",
        detail: "Rendered locally.",
      },
      publishStatus: "ready",
      finalState: "rendered",
    });

    const result = await runCasaHudPublishAgent(
      { ...renderReadyCampaign, reviewStatus: "ready_for_review", reviewWarnings: [], reviewBlockers: [] },
      {
        connected: false,
        uploadAvailable: false,
        providerStatus: {
          provider: "youtube_unavailable",
          state: "needs_connection",
          detail: "Connect the YouTube Channel before CasaHUD can publish or schedule this campaign.",
        },
      },
    );

    expect(result.ok).toBe(false);
    expect(result.httpStatus).toBe(503);
    expect(result.execution.publishStatus).toBe("blocked");
    expect(result.execution.publishProviderStatus?.state).toBe("needs_connection");
  });

  it("saves a schedule intent without faking a live YouTube schedule", async () => {
    const packaged = await buildPackagedCampaign();
    const execution = createEmptyCasaHudExecutionData();
    const renderReadyCampaign = applyCasaHudExecutionUpdate(packaged, {
      ...execution,
      approvalStatus: "approved",
      approvedAt: "2026-04-29T10:00:00.000Z",
      approvedBy: userId,
      renderStatus: "rendered",
      renderOutput: {
        id: "render-1",
        type: "mp4",
        status: "rendered",
        url: "/generated/domara/render-1.mp4",
        path: "/generated/domara/render-1.mp4",
        durationSeconds: 92,
        format: "mp4",
        createdAt: "2026-04-29T10:00:00.000Z",
        provider: "ffmpeg_local",
        metadata: { filename: "render-1.mp4" },
        warnings: [],
      },
      renderOutputUrl: "/generated/domara/render-1.mp4",
      renderOutputPath: "/generated/domara/render-1.mp4",
      renderProviderStatus: {
        provider: "ffmpeg_local",
        state: "connected",
        detail: "Rendered locally.",
      },
      publishStatus: "ready",
      finalState: "rendered",
    });

    const scheduledAt = "2026-05-02T12:00:00.000Z";
    const result = await runCasaHudScheduleAgent(
      { ...renderReadyCampaign, reviewStatus: "ready_for_review", reviewWarnings: [], reviewBlockers: [] },
      {
        connected: true,
        uploadAvailable: false,
        providerStatus: {
          provider: "youtube_channel",
          state: "degraded",
          detail:
            "YouTube Channel is connected for research and package preparation, but live upload and scheduling are not enabled in this workspace yet.",
        },
      },
      scheduledAt,
    );

    expect(result.ok).toBe(false);
    expect(result.httpStatus).toBe(503);
    expect(result.execution.scheduleStatus).toBe("blocked");
    expect(result.execution.scheduledPublishAt).toBe(scheduledAt);
    expect(result.execution.scheduleRunHistory[0]?.type).toBe("schedule");
  });
});

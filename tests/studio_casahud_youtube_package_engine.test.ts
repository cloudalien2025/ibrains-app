import { describe, expect, it } from "vitest";
import type { CasaHudCampaign } from "@/lib/studio/domara/campaigns";
import type { CasaHudOpportunityResult } from "@/lib/studio/domara/opportunity-engine/types";
import { runCasaHudYouTubePackageReview } from "@/lib/studio/domara/youtube-package-engine";

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

describe("CasaFlix youtube package engine", () => {
  it("builds the final package, review summary, and render plan from a media-planned campaign", async () => {
    const campaign = await buildMediaPlannedCampaign();
    const result = runCasaHudYouTubePackageReview(campaign);

    expect(result.youtubePackageStatus).toBe("package_prepared");
    expect(result.finalTitle).toBeTruthy();
    expect(result.titleRationale).toBeTruthy();
    expect(result.youtubeDescription).toContain("approved listings");
    expect(result.youtubeTags.length).toBeGreaterThan(0);
    expect(result.youtubeHashtags.length).toBeGreaterThan(0);
    expect(result.youtubeChapters.length).toBeGreaterThan(0);
    expect(result.thumbnailConcept?.headline).toBeTruthy();
    expect(result.publishMetadataDraft?.packageNote).toContain("review");
    expect(result.reviewStatus).not.toBe("not_started");
    expect(result.reviewSummary).toBeTruthy();
    expect(result.renderPlanStatus).toBe("render_plan_ready");
    expect(result.renderPlan?.sceneCount).toBeGreaterThan(0);
    expect(result.previewPackage?.finalTitle).toBe(result.finalTitle);
  });

  it("flags visual gaps and blocks render handoff when scene coverage is missing", async () => {
    const campaign = await buildMediaPlannedCampaign();
    const firstScene = campaign.sceneAssetMapping[0];
    expect(firstScene).toBeTruthy();

    const weakenedCampaign: CasaHudCampaign = {
      ...campaign,
      sceneAssetMapping: campaign.sceneAssetMapping.map((scene, index) =>
        index === 0
          ? {
              ...scene,
              assignedAssetIds: [],
              coverageStatus: "missing",
              warnings: [...scene.warnings, "No assigned asset for the lead scene."],
            }
          : scene,
      ),
    };

    const result = runCasaHudYouTubePackageReview(weakenedCampaign);

    expect(result.reviewStatus).toBe("blocked");
    expect(result.reviewFindings.some((finding) => finding.category === "visual_gaps" && finding.severity === "blocker")).toBe(true);
    expect(result.renderBlockers.length).toBeGreaterThan(0);
    expect(result.renderPlan?.missingAssets.length).toBeGreaterThan(0);
  });

  it("returns the empty package state when prerequisites are missing", async () => {
    const campaign = await buildMediaPlannedCampaign();
    const incomplete: CasaHudCampaign = {
      ...campaign,
      mediaPlanningStatus: "not_started",
      sceneAssetMapping: [],
    };

    const result = runCasaHudYouTubePackageReview(incomplete);

    expect(result.youtubePackageStatus).toBe("not_started");
    expect(result.reviewStatus).toBe("not_started");
    expect(result.renderPlanStatus).toBe("not_started");
  });
});

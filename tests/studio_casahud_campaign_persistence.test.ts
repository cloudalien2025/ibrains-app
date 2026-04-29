import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CasaHudOpportunityResult } from "@/lib/studio/domara/opportunity-engine/types";
import type { CasaHudCampaignMetadata } from "@/lib/studio/domara/campaigns";

type StoredProjectRow = {
  id: string;
  user_id: string;
  name: string;
  selected_title: string;
  video_type: string;
  status: string;
  provider_metadata: string;
  created_at: string;
  updated_at: string;
};

const state = {
  available: true,
  projects: new Map<string, StoredProjectRow>(),
};

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
}));

vi.mock("@/app/api/ecomviper/_utils/db", () => ({
  query: mocks.query,
}));

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
    {
      id: "title-2",
      title: "7 Affordable Beachfront Homes in Southern Italy",
      score: 90,
      ctrPotential: 91,
      searchAppeal: 88,
      novelty: 79,
      realism: 89,
      listingAvailability: 90,
      channelFit: 89,
      titleTruthfulness: 91,
      campaignType: "roundup",
      regionHint: "Southern Italy",
      listingSearchHints: ["Southern Italy beachfront homes"],
      reasoning: "This roundup stays highly repeatable and keeps the geography clear.",
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

describe("CasaHUD campaign persistence", () => {
  beforeEach(() => {
    state.available = true;
    state.projects.clear();
    mocks.query.mockReset();
    mocks.query.mockImplementation(async (sql: string, params: unknown[] = []) => {
      const normalized = sql.replace(/\s+/g, " ").trim().toLowerCase();

      if (normalized.includes("to_regclass('public.casahud_projects')")) {
        return [{ projects: state.available ? "casahud_projects" : null }];
      }

      if (normalized.startsWith("insert into casahud_projects")) {
        const [id, storedUserId, name, selectedTitle, videoType, status, providerMetadata, createdAt, updatedAt] = params as [
          string,
          string,
          string,
          string,
          string,
          string,
          string,
          string,
          string,
        ];
        state.projects.set(id, {
          id,
          user_id: storedUserId,
          name,
          selected_title: selectedTitle,
          video_type: videoType,
          status,
          provider_metadata: providerMetadata,
          created_at: createdAt,
          updated_at: updatedAt,
        });
        return [];
      }

      if (normalized.includes("from casahud_projects") && normalized.includes("and provider_metadata->>'phase' in ($2, $3, $4, $5, $6, $7)")) {
        const [storedUserId] = params as [string];
        return Array.from(state.projects.values())
          .filter((row) => row.user_id === storedUserId)
          .map((row) => ({
            ...row,
            provider_metadata: JSON.parse(row.provider_metadata),
          }))
          .sort((left, right) => right.updated_at.localeCompare(left.updated_at));
      }

      if (
        normalized.includes("from casahud_projects") &&
        normalized.includes("and id = $2") &&
        normalized.includes("and provider_metadata->>'phase' in ($3, $4, $5, $6, $7, $8)")
      ) {
        const [storedUserId, campaignId] = params as [string, string];
        const row = state.projects.get(campaignId);
        if (!row || row.user_id !== storedUserId) return [];
        return [{ ...row, provider_metadata: JSON.parse(row.provider_metadata) }];
      }

      throw new Error(`Unhandled SQL in test: ${sql}`);
    });
  });

  it("creates a campaign from the selected Phase 2 title and persists the research package", async () => {
    const repository = await import("@/lib/studio/domara/campaign-repository");

    const campaign = await repository.createCasaHudCampaignFromOpportunity(userId, opportunity);

    expect(campaign.name).toBe(opportunity.selectedTitle.title);
    expect(campaign.selectedViralTitle).toBe(opportunity.selectedTitle.title);
    expect(campaign.status).toBe("campaign_created");
    expect(campaign.titleCandidates).toHaveLength(2);
    expect(campaign.researchBrief.summary).toBe(opportunity.researchBrief.summary);

    const stored = state.projects.get(campaign.id);
    expect(stored?.selected_title).toBe(opportunity.selectedTitle.title);
    expect(stored?.name).toBe(opportunity.selectedTitle.title);

    const metadata = JSON.parse(stored!.provider_metadata) as CasaHudCampaignMetadata;
    expect(metadata.campaign.titleCandidates[0]?.title).toBe(opportunity.titleCandidates[0]?.title);
    expect(metadata.campaign.researchBrief.summary).toBe(opportunity.researchBrief.summary);
    expect(metadata.campaign.nextPhase.key).toBe("property_discovery");
    expect(metadata.campaign.listingCandidates).toEqual([]);
    expect(metadata.campaign.listingDiscoveryStatus).toBe("not_started");
    expect(metadata.campaign.approvedListings).toEqual([]);
    expect(metadata.campaign.listingValidationStatus).toBe("not_started");
    expect(metadata.campaign.locationIntelligenceStatus).toBe("not_started");
    expect(metadata.campaign.scriptGenerationStatus).toBe("not_started");
    expect(metadata.campaign.mediaPlanningStatus).toBe("not_started");
  });

  it("lists recent campaigns and reopens a saved campaign by id", async () => {
    const repository = await import("@/lib/studio/domara/campaign-repository");

    const first = await repository.createCasaHudCampaignFromOpportunity(userId, opportunity);
    const second = await repository.createCasaHudCampaignFromOpportunity(userId, opportunity);

    expect(first.id).not.toBe(second.id);
    expect(first.name).toBe(second.name);

    const campaigns = await repository.listCasaHudCampaignSummaries(userId);
    expect(campaigns.length).toBe(2);
    expect(campaigns[0]?.name).toBe(opportunity.selectedTitle.title);
    expect(campaigns[0]?.researchSummary).toBe(opportunity.researchBrief.summary);
    expect(campaigns[0]?.approvedListingCount).toBe(0);
    expect(campaigns[0]?.listingValidationStatus).toBe("not_started");
    expect(campaigns[0]?.locationIntelligenceStatus).toBe("not_started");
    expect(campaigns[0]?.scriptGenerationStatus).toBe("not_started");
    expect(campaigns[0]?.mediaPlanningStatus).toBe("not_started");

    const reopened = await repository.getCasaHudCampaign(userId, first.id);
    expect(reopened?.selectedTitle.title).toBe(opportunity.selectedTitle.title);
    expect(reopened?.confidenceReasoning.summary).toBe(opportunity.confidenceSummary);
    expect(reopened?.generationSource.label).toBe(opportunity.providerStatus.label);
    expect(campaigns[0]?.listingCandidateCount).toBe(0);
    expect(campaigns[0]?.listingDiscoveryStatus).toBe("not_started");
  });

  it("persists discovered listing candidates and reloads them on the campaign", async () => {
    const repository = await import("@/lib/studio/domara/campaign-repository");
    const campaigns = await import("@/lib/studio/domara/campaigns");
    const discovery = await import("@/lib/studio/domara/listing-discovery-engine");

    const created = await repository.createCasaHudCampaignFromOpportunity(userId, opportunity);
    const discoveryResult = await discovery.runCasaHudListingDiscovery(created);
    const updated = campaigns.applyCasaHudListingDiscovery(created, discoveryResult);

    await repository.saveCasaHudCampaign(userId, updated);

    const reopened = await repository.getCasaHudCampaign(userId, created.id);
    expect(reopened?.status).toBe("listing_candidates_discovered");
    expect(reopened?.listingCandidates.length).toBeGreaterThan(0);
    expect(reopened?.listingSearchCriteria?.regionHint).toBe("Southern Italy");
    expect(reopened?.listingProviderStatuses.some((status) => status.provider === "casahud_sample")).toBe(true);
    expect(reopened?.nextPhase.key).toBe("listing_validation");
    expect(reopened?.locationIntelligenceStatus).toBe("not_started");

    const summaries = await repository.listCasaHudCampaignSummaries(userId);
    expect(summaries[0]?.listingCandidateCount).toBe(reopened?.listingCandidates.length);
    expect(summaries[0]?.status).toBe("listing_candidates_discovered");
  });

  it("persists validation results and reloads approved rankings with title support confidence", async () => {
    const repository = await import("@/lib/studio/domara/campaign-repository");
    const campaigns = await import("@/lib/studio/domara/campaigns");
    const discovery = await import("@/lib/studio/domara/listing-discovery-engine");
    const validation = await import("@/lib/studio/domara/listing-validation-engine");

    const created = await repository.createCasaHudCampaignFromOpportunity(userId, opportunity);
    const discoveryResult = await discovery.runCasaHudListingDiscovery(created);
    const discovered = campaigns.applyCasaHudListingDiscovery(created, discoveryResult);
    const validationResult = validation.runCasaHudListingValidation(discovered);
    const validated = campaigns.applyCasaHudListingValidation(discovered, validationResult);

    await repository.saveCasaHudCampaign(userId, validated);

    const reopened = await repository.getCasaHudCampaign(userId, created.id);
    expect(reopened?.status).toBe("listing_candidates_validated");
    expect(reopened?.listingValidationStatus).toBe("listing_candidates_validated");
    expect(reopened?.listingRankOrder).toEqual(validated.listingRankOrder);
    expect(reopened?.approvedListings.length).toBeGreaterThan(0);
    expect(typeof reopened?.titleSupportConfidence).toBe("number");
    expect(reopened?.nextPhase.key).toBe("location_intelligence");
    expect(reopened?.locationIntelligenceStatus).toBe("not_started");
    expect(reopened?.scriptGenerationStatus).toBe("not_started");

    const summaries = await repository.listCasaHudCampaignSummaries(userId);
    expect(summaries[0]?.approvedListingCount).toBe(reopened?.approvedListings.length);
    expect(summaries[0]?.listingValidationStatus).toBe("listing_candidates_validated");
    expect(summaries[0]?.validationSummary).toBe(reopened?.listingValidationSummary?.headline);
  });

  it("persists location intelligence and reloads the place story on the campaign", async () => {
    const repository = await import("@/lib/studio/domara/campaign-repository");
    const campaigns = await import("@/lib/studio/domara/campaigns");
    const discovery = await import("@/lib/studio/domara/listing-discovery-engine");
    const validation = await import("@/lib/studio/domara/listing-validation-engine");
    const location = await import("@/lib/studio/domara/location-intelligence-engine");

    const created = await repository.createCasaHudCampaignFromOpportunity(userId, opportunity);
    const discoveryResult = await discovery.runCasaHudListingDiscovery(created);
    const discovered = campaigns.applyCasaHudListingDiscovery(created, discoveryResult);
    const validationResult = validation.runCasaHudListingValidation(discovered);
    const validated = campaigns.applyCasaHudListingValidation(discovered, validationResult);
    const locationResult = await location.runCasaHudLocationIntelligence(validated, {});
    const enriched = campaigns.applyCasaHudLocationIntelligence(validated, locationResult);

    await repository.saveCasaHudCampaign(userId, enriched);

    const reopened = await repository.getCasaHudCampaign(userId, created.id);
    expect(reopened?.status).toBe("location_intelligence_completed");
    expect(reopened?.locationIntelligenceStatus).toBe("location_intelligence_completed");
    expect(reopened?.locationStory?.headline).toContain("story");
    expect(reopened?.poiBundle?.cards.length).toBeGreaterThan(0);
    expect(reopened?.mapSceneIdeas.length).toBeGreaterThan(0);
    expect(reopened?.listingLocationInsights.length).toBeGreaterThan(0);
    expect(reopened?.nextPhase.key).toBe("script_narrative_generation");
    expect(reopened?.scriptGenerationStatus).toBe("not_started");

    const summaries = await repository.listCasaHudCampaignSummaries(userId);
    expect(summaries[0]?.status).toBe("location_intelligence_completed");
    expect(summaries[0]?.locationIntelligenceStatus).toBe("location_intelligence_completed");
    expect(summaries[0]?.locationSummary).toBe(reopened?.locationIntelligenceSummary?.headline);
  });

  it("persists script generation and reloads the narrative package on the campaign", async () => {
    const repository = await import("@/lib/studio/domara/campaign-repository");
    const campaigns = await import("@/lib/studio/domara/campaigns");
    const discovery = await import("@/lib/studio/domara/listing-discovery-engine");
    const validation = await import("@/lib/studio/domara/listing-validation-engine");
    const location = await import("@/lib/studio/domara/location-intelligence-engine");
    const script = await import("@/lib/studio/domara/script-narrative-engine");

    const created = await repository.createCasaHudCampaignFromOpportunity(userId, opportunity);
    const discoveryResult = await discovery.runCasaHudListingDiscovery(created);
    const discovered = campaigns.applyCasaHudListingDiscovery(created, discoveryResult);
    const validationResult = validation.runCasaHudListingValidation(discovered);
    const validated = campaigns.applyCasaHudListingValidation(discovered, validationResult);
    const locationResult = await location.runCasaHudLocationIntelligence(validated, {});
    const enriched = campaigns.applyCasaHudLocationIntelligence(validated, locationResult);
    const scriptResult = await script.runCasaHudScriptNarrative(enriched, {});
    const scripted = campaigns.applyCasaHudScriptNarrative(enriched, scriptResult);

    await repository.saveCasaHudCampaign(userId, scripted);

    const reopened = await repository.getCasaHudCampaign(userId, created.id);
    expect(reopened?.status).toBe("script_narrative_completed");
    expect(reopened?.scriptGenerationStatus).toBe("script_generated");
    expect(reopened?.scriptSummary).toBeTruthy();
    expect(reopened?.openingHook).toBeTruthy();
    expect(reopened?.scriptSegments.length).toBeGreaterThan(0);
    expect(reopened?.propertySegments.length).toBeGreaterThan(0);
    expect(reopened?.closingCta).toBeTruthy();
    expect(reopened?.nextPhase.key).toBe("media_planning_asset_assembly");

    const summaries = await repository.listCasaHudCampaignSummaries(userId);
    expect(summaries[0]?.status).toBe("script_narrative_completed");
    expect(summaries[0]?.scriptGenerationStatus).toBe("script_generated");
    expect(summaries[0]?.scriptSummary).toBe(reopened?.scriptSummary || undefined);
  });

  it("persists media planning and reloads the visual package on the campaign", async () => {
    const repository = await import("@/lib/studio/domara/campaign-repository");
    const campaigns = await import("@/lib/studio/domara/campaigns");
    const discovery = await import("@/lib/studio/domara/listing-discovery-engine");
    const validation = await import("@/lib/studio/domara/listing-validation-engine");
    const location = await import("@/lib/studio/domara/location-intelligence-engine");
    const script = await import("@/lib/studio/domara/script-narrative-engine");
    const media = await import("@/lib/studio/domara/media-planning-engine");

    const created = await repository.createCasaHudCampaignFromOpportunity(userId, opportunity);
    const discoveryResult = await discovery.runCasaHudListingDiscovery(created);
    const discovered = campaigns.applyCasaHudListingDiscovery(created, discoveryResult);
    const validationResult = validation.runCasaHudListingValidation(discovered);
    const validated = campaigns.applyCasaHudListingValidation(discovered, validationResult);
    const locationResult = await location.runCasaHudLocationIntelligence(validated, {});
    const enriched = campaigns.applyCasaHudLocationIntelligence(validated, locationResult);
    const scriptResult = await script.runCasaHudScriptNarrative(enriched, {});
    const scripted = campaigns.applyCasaHudScriptNarrative(enriched, scriptResult);
    const mediaPlan = media.runCasaHudMediaPlanning(scripted);
    const planned = campaigns.applyCasaHudMediaPlan(scripted, mediaPlan);

    await repository.saveCasaHudCampaign(userId, planned);

    const reopened = await repository.getCasaHudCampaign(userId, created.id);
    expect(reopened?.status).toBe("media_planning_completed");
    expect(reopened?.mediaPlanningStatus).toBe("media_plan_built");
    expect(reopened?.mediaPlanSummary).toBeTruthy();
    expect(reopened?.visualAssets.length).toBeGreaterThan(0);
    expect(reopened?.sceneAssetMapping.length).toBeGreaterThan(0);
    expect(reopened?.shotList.length).toBeGreaterThan(0);
    expect(reopened?.thumbnailCandidateInputs.length).toBeGreaterThan(0);
    expect(reopened?.nextPhase.key).toBe("youtube_package_review_render_plan");

    const summaries = await repository.listCasaHudCampaignSummaries(userId);
    expect(summaries[0]?.status).toBe("media_planning_completed");
    expect(summaries[0]?.mediaPlanningStatus).toBe("media_plan_built");
    expect(summaries[0]?.mediaPlanSummary).toBe(reopened?.mediaPlanSummary || undefined);
  });
});

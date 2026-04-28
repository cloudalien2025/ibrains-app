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

      if (normalized.includes("from casahud_projects") && normalized.includes("and provider_metadata->>'phase' = $2")) {
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
        normalized.includes("and provider_metadata->>'phase' = $3")
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

    const reopened = await repository.getCasaHudCampaign(userId, first.id);
    expect(reopened?.selectedTitle.title).toBe(opportunity.selectedTitle.title);
    expect(reopened?.confidenceReasoning.summary).toBe(opportunity.confidenceSummary);
    expect(reopened?.generationSource.label).toBe(opportunity.providerStatus.label);
  });
});

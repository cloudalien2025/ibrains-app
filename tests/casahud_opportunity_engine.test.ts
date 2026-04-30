import { describe, expect, it } from "vitest";
import { generateCasaHudOpportunityResult } from "@/lib/studio/domara/opportunity-engine/orchestrator";
import { getSupportedCasaHudOpportunityCampaignTypes } from "@/lib/studio/domara/opportunity-engine/title-strategy-agent";
import type { CasaHudOpportunityResearchProvider } from "@/lib/studio/domara/opportunity-engine/youtube-research-provider";
import type { CasaHudOpportunityResearchResult } from "@/lib/studio/domara/opportunity-engine/types";

const userId = "11111111-1111-4111-8111-111111111111";

const liveResearchProvider: CasaHudOpportunityResearchProvider = {
  async research(): Promise<CasaHudOpportunityResearchResult> {
    return {
      generatedAt: "2026-04-28T00:00:00.000Z",
      preferredMarket: "Italian real-estate YouTube",
      marketLabel: "Italy relocation and property YouTube",
      searchQuery: "Italy real estate affordable homes relocation YouTube",
      providerStatus: {
        mode: "live_youtube",
        label: "Live YouTube research",
        detail: "Using live YouTube search results and recent video statistics to shape title opportunities.",
        canImproveWithYouTube: false,
      },
      similarVideos: [
        {
          title: "7 Cheap Houses in Italy You Can Actually Buy",
          channelTitle: "Channel A",
          viewCount: 450000,
          velocityScore: 13000,
        },
      ],
      researchBrief: {
        summary: "Live research shows demand for concrete affordability and relocation hooks.",
        opportunityCategories: ["affordable coastal roundups", "retirement relocation", "regional niche inventory"],
        competitorPatterns: ["Top videos frequently anchor the title with a price ceiling."],
        audienceIntent: ["buyable Italy homes", "retire in Italy"],
        suggestedTitleDirections: ["Southern Italy affordability roundups", "Question-led relocation titles"],
        riskNotes: ["Very cheap Italy claims can become hard to prove with current listings."],
      },
    };
  },
};

describe("CasaFlix opportunity engine", () => {
  it("generates a stable ranked Phase 2 opportunity package when live YouTube data is unavailable", async () => {
    const output = await generateCasaHudOpportunityResult({
      userId,
      preferredMarket: "Italian real-estate YouTube",
    });

    expect(output.providerStatus.mode).toBe("casahud_patterns");
    expect(output.titleCandidates.length).toBeGreaterThanOrEqual(3);
    expect(output.titleCandidates.length).toBeLessThanOrEqual(10);
    expect(output.selectedTitle.title).toBeTruthy();
    expect(output.selectedTitle.confidence).toBeGreaterThanOrEqual(0.7);
    expect(output.researchBrief.opportunityCategories.length).toBeGreaterThan(0);
    expect(output.researchBrief.riskNotes.length).toBeGreaterThan(0);
    expect(getSupportedCasaHudOpportunityCampaignTypes()).toContain(output.campaignTypePrediction);
  });

  it("uses the research provider seam to upgrade scoring when live research is available", async () => {
    const output = await generateCasaHudOpportunityResult(
      {
        userId,
        preferredMarket: "Italian real-estate YouTube",
      },
      { researchProvider: liveResearchProvider },
    );

    expect(output.providerStatus.mode).toBe("live_youtube");
    expect(output.providerStatus.label).toBe("Live YouTube research");
    expect(output.titleCandidates[0]?.score).toBeGreaterThan(0);
    expect(output.confidenceSummary).toContain("confidence");
    expect(output.selectedTitle.reasoning).toContain("CasaFlix chose this");
  });
});

import { nowIso } from "@/lib/studio/domara/ai-channel-engine/ids";
import { getDefaultPreferredMarket } from "@/lib/studio/domara/opportunity-engine/market-profiles";
import {
  createCasaHudOpportunityResearchProvider,
  type CasaHudOpportunityResearchProvider,
} from "@/lib/studio/domara/opportunity-engine/youtube-research-provider";
import {
  buildCasaHudOpportunityTitleCandidates,
  selectWinningCasaHudOpportunityTitle,
} from "@/lib/studio/domara/opportunity-engine/title-strategy-agent";
import type { CasaHudOpportunityRequest, CasaHudOpportunityResult } from "@/lib/studio/domara/opportunity-engine/types";

export type CasaHudOpportunityOrchestratorDependencies = {
  researchProvider?: CasaHudOpportunityResearchProvider;
};

export async function generateCasaHudOpportunityResult(
  request: CasaHudOpportunityRequest,
  dependencies: CasaHudOpportunityOrchestratorDependencies = {},
): Promise<CasaHudOpportunityResult> {
  const researchProvider =
    dependencies.researchProvider || createCasaHudOpportunityResearchProvider({ apiKey: process.env.YOUTUBE_API_KEY });
  const preferredMarket = request.preferredMarket?.trim() || getDefaultPreferredMarket();
  const research = await researchProvider.research({ preferredMarket });
  const titleCandidates = buildCasaHudOpportunityTitleCandidates(research);
  const selectedTitle = selectWinningCasaHudOpportunityTitle(titleCandidates, research);

  return {
    generatedAt: nowIso(),
    preferredMarket,
    researchBrief: research.researchBrief,
    titleCandidates,
    selectedTitle,
    campaignTypePrediction: selectedTitle.campaignType,
    titleOpportunitySummary: `${selectedTitle.title} rose to the top because it gives CasaHUD a clear, searchable concept that is more likely to stay honest once later listing discovery begins.`,
    confidenceSummary: `${Math.round(selectedTitle.confidence * 100)}% confidence. CasaHUD prefers titles that can earn clicks without forcing unsupported claims, so the winning concept leans on strong geography, buyer intent, and a listing-backed promise.`,
    providerStatus: research.providerStatus,
    nextStep: {
      action: "create_campaign",
      label: "Create campaign",
      detail: "Phase 3 will turn this winning concept into a saved CasaHUD campaign with durable workflow state.",
    },
  };
}

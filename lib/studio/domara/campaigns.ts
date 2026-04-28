import { nowIso, stableCasaHudId } from "@/lib/studio/domara/ai-channel-engine/ids";
import type { CasaHudProject } from "@/lib/studio/domara/ai-channel-engine/types";
import type {
  CasaHudOpportunityCampaignType,
  CasaHudOpportunityProviderStatus,
  CasaHudOpportunityResearchBrief,
  CasaHudOpportunityResult,
  CasaHudOpportunitySelectedTitle,
  CasaHudOpportunityTitleCandidate,
} from "@/lib/studio/domara/opportunity-engine/types";

export const CASAHUD_CAMPAIGN_METADATA_PHASE = "phase_3_campaign_persistence" as const;
const CASAHUD_CAMPAIGN_METADATA_VERSION = 1 as const;

export type CasaHudCampaignStatus = "opportunity_generated" | "campaign_created" | "ready_for_property_discovery";

export type CasaHudCampaignNextPhase = {
  key: "property_discovery";
  label: "Find matching properties";
  detail: "Property Discovery arrives next. CasaHUD will enrich this campaign without regenerating the title package.";
  implemented: false;
};

export type CasaHudCampaignFutureState = {
  listingCandidates: unknown[];
  approvedListings: unknown[];
  rejectedListings: unknown[];
  listingRankOrder: string[];
  locationIntelligence: null;
  mapPoiBundle: null;
  script: null;
  storyboard: null;
  mediaPlan: null;
  packaging: null;
  renderStatus: null;
  reviewStatus: null;
  publishStatus: null;
  scheduleStatus: null;
};

export type CasaHudCampaign = {
  id: string;
  name: string;
  selectedViralTitle: string;
  selectedTitle: CasaHudOpportunitySelectedTitle;
  titleCandidates: CasaHudOpportunityTitleCandidate[];
  researchBrief: CasaHudOpportunityResearchBrief;
  campaignType: CasaHudOpportunityCampaignType;
  marketRegionHint?: string;
  preferredMarket?: string;
  generationSource: CasaHudOpportunityProviderStatus;
  confidenceReasoning: {
    summary: string;
    titleOpportunitySummary: string;
    selectedTitleReasoning: string;
    selectedTitleConfidence: number;
  };
  status: CasaHudCampaignStatus;
  nextPhase: CasaHudCampaignNextPhase;
  createdAt: string;
  updatedAt: string;
  generatedAt: string;
  futureState: CasaHudCampaignFutureState;
};

export type CasaHudCampaignSummary = {
  id: string;
  name: string;
  campaignType: CasaHudOpportunityCampaignType;
  marketRegionHint?: string;
  status: CasaHudCampaignStatus;
  createdAt: string;
  updatedAt: string;
  researchSummary: string;
};

export type CasaHudCampaignMetadata = {
  schemaVersion: typeof CASAHUD_CAMPAIGN_METADATA_VERSION;
  phase: typeof CASAHUD_CAMPAIGN_METADATA_PHASE;
  source: "opportunity_result";
  campaign: CasaHudCampaign;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isOpportunityCampaignType(value: unknown): value is CasaHudOpportunityCampaignType {
  return (
    value === "roundup" ||
    value === "single_property_showcase" ||
    value === "niche_category" ||
    value === "location_led" ||
    value === "lifestyle_relocation"
  );
}

function isSelectedTitle(value: unknown): value is CasaHudOpportunitySelectedTitle {
  return (
    isRecord(value) &&
    isNonEmptyString(value.title) &&
    typeof value.score === "number" &&
    typeof value.confidence === "number" &&
    isNonEmptyString(value.reasoning) &&
    isOpportunityCampaignType(value.campaignType)
  );
}

function isTitleCandidate(value: unknown): value is CasaHudOpportunityTitleCandidate {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.title) &&
    typeof value.score === "number" &&
    isNonEmptyString(value.reasoning) &&
    isOpportunityCampaignType(value.campaignType)
  );
}

function isResearchBrief(value: unknown): value is CasaHudOpportunityResearchBrief {
  return (
    isRecord(value) &&
    isNonEmptyString(value.summary) &&
    isStringArray(value.opportunityCategories) &&
    isStringArray(value.competitorPatterns) &&
    isStringArray(value.audienceIntent) &&
    isStringArray(value.suggestedTitleDirections) &&
    isStringArray(value.riskNotes)
  );
}

function isProviderStatus(value: unknown): value is CasaHudOpportunityProviderStatus {
  return (
    isRecord(value) &&
    (value.mode === "live_youtube" || value.mode === "casahud_patterns") &&
    isNonEmptyString(value.label) &&
    isNonEmptyString(value.detail) &&
    typeof value.canImproveWithYouTube === "boolean"
  );
}

export function parseCasaHudCampaignCreateBody(
  body: unknown,
): { ok: true; opportunity: CasaHudOpportunityResult } | { ok: false; message: string } {
  if (!isRecord(body) || !isRecord(body.opportunity)) {
    return {
      ok: false,
      message: "CasaHUD needs the Phase 2 opportunity result before it can create a campaign.",
    };
  }

  const opportunity = body.opportunity;
  if (!isSelectedTitle(opportunity.selectedTitle)) {
    return {
      ok: false,
      message: "CasaHUD could not save this campaign because the selected viral title is missing.",
    };
  }
  if (!Array.isArray(opportunity.titleCandidates) || opportunity.titleCandidates.length === 0) {
    return {
      ok: false,
      message: "CasaHUD could not save this campaign because title candidates are missing.",
    };
  }
  if (!opportunity.titleCandidates.every((candidate) => isTitleCandidate(candidate))) {
    return {
      ok: false,
      message: "CasaHUD could not save this campaign because one or more title candidates are invalid.",
    };
  }
  if (!isResearchBrief(opportunity.researchBrief)) {
    return {
      ok: false,
      message: "CasaHUD could not save this campaign because the research brief is incomplete.",
    };
  }
  if (!isOpportunityCampaignType(opportunity.campaignTypePrediction)) {
    return {
      ok: false,
      message: "CasaHUD could not save this campaign because the campaign type is invalid.",
    };
  }
  if (!isProviderStatus(opportunity.providerStatus)) {
    return {
      ok: false,
      message: "CasaHUD could not save this campaign because the generation source is invalid.",
    };
  }
  if (!isNonEmptyString(opportunity.confidenceSummary) || !isNonEmptyString(opportunity.titleOpportunitySummary)) {
    return {
      ok: false,
      message: "CasaHUD could not save this campaign because the confidence summary is missing.",
    };
  }

  return {
    ok: true,
    opportunity: opportunity as CasaHudOpportunityResult,
  };
}

export function toCasaHudProjectVideoType(type: CasaHudOpportunityCampaignType): CasaHudProject["videoType"] {
  switch (type) {
    case "roundup":
      return "roundup";
    case "single_property_showcase":
      return "single_property";
    case "niche_category":
      return "niche";
    case "location_led":
      return "location_category";
    case "lifestyle_relocation":
      return "lifestyle_relocation";
  }
}

function createFutureState(): CasaHudCampaignFutureState {
  return {
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
  };
}

export function buildCasaHudCampaignFromOpportunity(userId: string, opportunity: CasaHudOpportunityResult): CasaHudCampaign {
  const timestamp = nowIso();
  const nonce = Math.random().toString(36).slice(2, 10);
  const selectedViralTitle = opportunity.selectedTitle.title.trim();
  const marketRegionHint = opportunity.selectedTitle.regionHint?.trim() || opportunity.preferredMarket?.trim() || undefined;

  return {
    id: stableCasaHudId("casahud-project", `${userId}:${selectedViralTitle}:${timestamp}:${nonce}`),
    name: selectedViralTitle,
    selectedViralTitle,
    selectedTitle: opportunity.selectedTitle,
    titleCandidates: opportunity.titleCandidates,
    researchBrief: opportunity.researchBrief,
    campaignType: opportunity.campaignTypePrediction,
    marketRegionHint,
    preferredMarket: opportunity.preferredMarket?.trim() || undefined,
    generationSource: opportunity.providerStatus,
    confidenceReasoning: {
      summary: opportunity.confidenceSummary,
      titleOpportunitySummary: opportunity.titleOpportunitySummary,
      selectedTitleReasoning: opportunity.selectedTitle.reasoning,
      selectedTitleConfidence: opportunity.selectedTitle.confidence,
    },
    status: "campaign_created",
    nextPhase: {
      key: "property_discovery",
      label: "Find matching properties",
      detail: "Property Discovery arrives next. CasaHUD will enrich this campaign without regenerating the title package.",
      implemented: false,
    },
    createdAt: timestamp,
    updatedAt: timestamp,
    generatedAt: opportunity.generatedAt,
    futureState: createFutureState(),
  };
}

export function toCasaHudCampaignSummary(campaign: CasaHudCampaign): CasaHudCampaignSummary {
  return {
    id: campaign.id,
    name: campaign.name,
    campaignType: campaign.campaignType,
    marketRegionHint: campaign.marketRegionHint,
    status: campaign.status,
    createdAt: campaign.createdAt,
    updatedAt: campaign.updatedAt,
    researchSummary: campaign.researchBrief.summary,
  };
}

export function toCasaHudCampaignMetadata(campaign: CasaHudCampaign): CasaHudCampaignMetadata {
  return {
    schemaVersion: CASAHUD_CAMPAIGN_METADATA_VERSION,
    phase: CASAHUD_CAMPAIGN_METADATA_PHASE,
    source: "opportunity_result",
    campaign,
  };
}

export function isCasaHudCampaignMetadata(value: unknown): value is CasaHudCampaignMetadata {
  return (
    isRecord(value) &&
    value.phase === CASAHUD_CAMPAIGN_METADATA_PHASE &&
    value.schemaVersion === CASAHUD_CAMPAIGN_METADATA_VERSION &&
    isRecord(value.campaign) &&
    isNonEmptyString(value.campaign.id) &&
    isNonEmptyString(value.campaign.name) &&
    isNonEmptyString(value.campaign.selectedViralTitle) &&
    isSelectedTitle(value.campaign.selectedTitle) &&
    Array.isArray(value.campaign.titleCandidates) &&
    value.campaign.titleCandidates.every((candidate) => isTitleCandidate(candidate)) &&
    isResearchBrief(value.campaign.researchBrief) &&
    isOpportunityCampaignType(value.campaign.campaignType) &&
    isProviderStatus(value.campaign.generationSource) &&
    isRecord(value.campaign.confidenceReasoning) &&
    isNonEmptyString(value.campaign.confidenceReasoning.summary) &&
    isNonEmptyString(value.campaign.confidenceReasoning.titleOpportunitySummary) &&
    isNonEmptyString(value.campaign.confidenceReasoning.selectedTitleReasoning) &&
    typeof value.campaign.confidenceReasoning.selectedTitleConfidence === "number" &&
    (value.campaign.status === "opportunity_generated" ||
      value.campaign.status === "campaign_created" ||
      value.campaign.status === "ready_for_property_discovery") &&
    isRecord(value.campaign.nextPhase) &&
    value.campaign.nextPhase.key === "property_discovery" &&
    value.campaign.nextPhase.implemented === false &&
    isNonEmptyString(value.campaign.createdAt) &&
    isNonEmptyString(value.campaign.updatedAt) &&
    isNonEmptyString(value.campaign.generatedAt) &&
    isRecord(value.campaign.futureState)
  );
}

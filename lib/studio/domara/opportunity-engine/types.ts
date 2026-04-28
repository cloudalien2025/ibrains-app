export type CasaHudOpportunityCampaignType =
  | "roundup"
  | "single_property_showcase"
  | "niche_category"
  | "location_led"
  | "lifestyle_relocation";

export type CasaHudOpportunityResearchMode = "live_youtube" | "casahud_patterns";

export type CasaHudOpportunityProviderStatus = {
  mode: CasaHudOpportunityResearchMode;
  label: string;
  detail: string;
  canImproveWithYouTube: boolean;
};

export type CasaHudOpportunityResearchBrief = {
  summary: string;
  opportunityCategories: string[];
  competitorPatterns: string[];
  audienceIntent: string[];
  suggestedTitleDirections: string[];
  riskNotes: string[];
};

export type CasaHudOpportunityResearchVideo = {
  title: string;
  channelTitle?: string;
  publishedAt?: string;
  viewCount?: number;
  likeCount?: number;
  velocityScore?: number;
  sourceUrl?: string;
};

export type CasaHudOpportunityResearchResult = {
  generatedAt: string;
  preferredMarket: string;
  marketLabel: string;
  searchQuery: string;
  providerStatus: CasaHudOpportunityProviderStatus;
  researchBrief: CasaHudOpportunityResearchBrief;
  similarVideos: CasaHudOpportunityResearchVideo[];
};

export type CasaHudOpportunityTitleCandidate = {
  id: string;
  title: string;
  score: number;
  ctrPotential: number;
  searchAppeal: number;
  novelty: number;
  realism: number;
  listingAvailability: number;
  channelFit: number;
  titleTruthfulness: number;
  campaignType: CasaHudOpportunityCampaignType;
  regionHint?: string;
  listingSearchHints?: string[];
  reasoning: string;
};

export type CasaHudOpportunitySelectedTitle = {
  title: string;
  score: number;
  campaignType: CasaHudOpportunityCampaignType;
  confidence: number;
  reasoning: string;
  regionHint?: string;
  listingSearchHints?: string[];
};

export type CasaHudOpportunityNextStep = {
  action: "create_campaign";
  label: "Create campaign";
  detail: string;
};

export type CasaHudOpportunityResult = {
  generatedAt: string;
  preferredMarket: string;
  researchBrief: CasaHudOpportunityResearchBrief;
  titleCandidates: CasaHudOpportunityTitleCandidate[];
  selectedTitle: CasaHudOpportunitySelectedTitle;
  campaignTypePrediction: CasaHudOpportunityCampaignType;
  titleOpportunitySummary: string;
  confidenceSummary: string;
  providerStatus: CasaHudOpportunityProviderStatus;
  nextStep: CasaHudOpportunityNextStep;
};

export type CasaHudOpportunityRequest = {
  userId: string;
  preferredMarket?: string;
};

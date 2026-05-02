import type { CasaHudScriptData, CasaHudScriptProviderStatus } from "@/lib/studio/domara/campaign-script-narrative";
import type { CasaHudCampaign } from "@/lib/studio/domara/campaigns";

export type CasaHudAgentKey =
  | "youtube_research"
  | "title_strategy"
  | "listing_discovery"
  | "listing_validation"
  | "location_intelligence"
  | "script"
  | "media"
  | "packaging"
  | "render"
  | "review";

export type CasaHudScriptAgentOptions = {
  generatedAt?: string;
  extraWarnings?: string[];
};

export type CasaHudScriptAgentPromptContext = {
  campaignType: CasaHudCampaign["campaignType"];
  selectedViralTitle: string;
  researchSummary: string;
  titleSupportConfidence?: number;
  locationStory: CasaHudCampaign["locationStory"];
  localHighlights: CasaHudCampaign["localHighlights"];
  mapSceneIdeas: CasaHudCampaign["mapSceneIdeas"];
  listingLocationInsights: CasaHudCampaign["listingLocationInsights"];
  providerStatuses: CasaHudCampaign["locationProviderStatuses"];
  listings: Array<{
    id: string;
    title: string;
    locationText: string;
    price: string | null;
    propertyType: string | null;
    bedrooms: number | null;
    bathrooms: number | null;
    sizeSqm: number | null;
    descriptionSnippet: string | null;
    features: string[];
    validationReasons: string[];
    warnings: string[];
    rank: number | null;
  }>;
  deterministicBaseline: {
    scriptSummary: string | null;
    openingHook: string | null;
    transitions: string[];
    scriptWarnings: string[];
    toneAndPacingNotes: string[];
  };
};

export type CasaHudScriptQualityIssue = {
  code: string;
  snippet: string;
};

export type CasaHudScriptReviewResult = {
  passed: boolean;
  issues: CasaHudScriptQualityIssue[];
  warning?: string;
};

export type CasaHudScriptAgentResult = CasaHudScriptData & {
  scriptProviderStatus: CasaHudScriptProviderStatus | null;
};

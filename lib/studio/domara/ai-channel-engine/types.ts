import type { DomaraVideoRenderPlan } from "@/lib/studio/domara/render-plan";
import type {
  DomaraLocationEnrichment,
  PropertyListingInput,
  PropertyVideoScene,
} from "@/lib/studio/domara/types";
import type { DomaraYouTubePackage } from "@/lib/studio/domara/youtube-package";

export type CasaHudVideoType =
  | "single_property"
  | "roundup"
  | "niche"
  | "location_category"
  | "lifestyle_relocation"
  | "search_opportunity";

export type CasaHudRunStatus =
  | "queued"
  | "running"
  | "needs_credentials"
  | "awaiting_review"
  | "approved"
  | "scheduled"
  | "published"
  | "failed";

export type CasaHudStageStatus = "pending" | "running" | "complete" | "needs_credentials" | "failed" | "skipped";

export type CasaHudStageName =
  | "youtube_research"
  | "viral_title"
  | "project_creation"
  | "content_strategy"
  | "listing_discovery"
  | "listing_validation"
  | "location_intelligence"
  | "script"
  | "storyboard_render_plan"
  | "youtube_package"
  | "render"
  | "review"
  | "publishing";

export type CasaHudCapabilityFlags = {
  openaiGeneration: boolean;
  youtubeResearch: boolean;
  listingDiscovery: boolean;
  mapPoiEnrichment: boolean;
  renderJobs: boolean;
  youtubePublishing: boolean;
};

export type CasaHudStageRecord<TOutput = unknown> = {
  name: CasaHudStageName;
  status: CasaHudStageStatus;
  startedAt: string;
  completedAt?: string;
  output?: TOutput;
  error?: string;
  retryable: boolean;
};

export type CasaHudProject = {
  id: string;
  userId: string;
  name: string;
  selectedTitle: string;
  videoType: CasaHudVideoType;
  status: CasaHudRunStatus;
  createdAt: string;
  updatedAt: string;
};

export type CasaHudGenerationRun = {
  id: string;
  userId: string;
  projectId?: string;
  status: CasaHudRunStatus;
  objective: "generate_next_property_video";
  currentStage: CasaHudStageName;
  createdAt: string;
  updatedAt: string;
};

export type CasaHudYouTubeResearchVideo = {
  videoId?: string;
  title: string;
  channelTitle?: string;
  publishedAt?: string;
  viewCount?: number;
  likeCount?: number;
  velocityScore?: number;
  sourceUrl?: string;
};

export type CasaHudYouTubeResearchResult = {
  provider: "youtube_data_api" | "heuristic";
  status: "live" | "limited";
  credentialRequired: boolean;
  query: string;
  opportunitySummary: string;
  titlePatterns: string[];
  nicheGaps: string[];
  similarVideos: CasaHudYouTubeResearchVideo[];
  generatedAt: string;
};

export type CasaHudTitleCandidate = {
  id: string;
  title: string;
  score: number;
  ctrPotential: number;
  rankingPotential: number;
  clarityScore: number;
  listingAvailabilityScore: number;
  channelFitScore: number;
  rationale: string[];
  selected: boolean;
};

export type CasaHudContentStrategy = {
  videoType: CasaHudVideoType;
  listingCountTarget: number;
  primaryMarket: string;
  budgetCeiling?: number;
  currency: string;
  buyerPersona: string;
  titlePromise: string[];
  requiredListingEvidence: string[];
  poiPriorities: string[];
  strategySummary: string;
};

export type CasaHudListingDiscoveryResult = {
  status: "ready" | "needs_credentials";
  provider: "idealista" | "immobiliare" | "multi_provider" | "manual_import" | "unavailable";
  listings: PropertyListingInput[];
  queries: Array<{
    provider: string;
    query: string;
    status: "ready" | "needs_credentials" | "failed";
    sourceUrl?: string;
    error?: string;
  }>;
  credentialRequiredProviders: string[];
  notes: string[];
};

export type CasaHudListingValidationResult = {
  listingId: string;
  title: string;
  valid: boolean;
  score: number;
  matchedClaims: string[];
  riskFlags: string[];
  sourceUrl?: string;
};

export type CasaHudValidatedListings = {
  status: "ready" | "blocked";
  selectedListings: PropertyListingInput[];
  validations: CasaHudListingValidationResult[];
  blockingReasons: string[];
};

export type CasaHudLocationIntelligenceResult = {
  listingTitle: string;
  enrichment: DomaraLocationEnrichment;
  influenceNotes: string[];
};

export type CasaHudScriptPackage = {
  hook: string;
  narrationScript: string;
  scenes: PropertyVideoScene[];
  factNotes: string[];
  titleUsed: string;
};

export type CasaHudStoryboardPackage = {
  scenes: PropertyVideoScene[];
  renderPlan: DomaraVideoRenderPlan;
  mapSceneCount: number;
  poiDrivenSceneCount: number;
};

export type CasaHudReviewPackage = {
  status: "awaiting_review";
  approvalRequired: true;
  reviewFlags: string[];
  questionableClaims: string[];
  publishBlockedUntilApproved: true;
};

export type CasaHudPublishScheduleRequest =
  | { mode: "publish_now" }
  | { mode: "schedule"; scheduledAt: string };

export type CasaHudPublishScheduleResult = {
  status: "needs_credentials" | "needs_approval" | "scheduled" | "published";
  provider: "youtube_data_api";
  externalVideoId?: string;
  scheduledAt?: string;
  message: string;
};

export type CasaHudOrchestratorOutput = {
  run: CasaHudGenerationRun;
  project?: CasaHudProject;
  research: CasaHudYouTubeResearchResult;
  titleCandidates: CasaHudTitleCandidate[];
  selectedTitle: CasaHudTitleCandidate;
  strategy: CasaHudContentStrategy;
  listingDiscovery: CasaHudListingDiscoveryResult;
  listingValidation?: CasaHudValidatedListings;
  locationIntelligence: CasaHudLocationIntelligenceResult[];
  script?: CasaHudScriptPackage;
  storyboard?: CasaHudStoryboardPackage;
  youtubePackage?: DomaraYouTubePackage;
  review?: CasaHudReviewPackage;
  stages: CasaHudStageRecord[];
};

export type CasaHudGenerateRequest = {
  userId: string;
  objective?: "generate_next_property_video";
  channelName?: string;
  preferredMarket?: string;
  capabilities: CasaHudCapabilityFlags;
};

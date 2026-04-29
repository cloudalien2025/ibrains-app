"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type {
  CasaHudCampaign,
  CasaHudCampaignSummary,
  CasaHudListingCandidate,
  CasaHudValidatedListing,
} from "@/lib/studio/domara/campaigns";
import type {
  CasaHudOpportunityCampaignType,
  CasaHudOpportunityResult,
  CasaHudOpportunityTitleCandidate,
} from "@/lib/studio/domara/opportunity-engine/types";
import type { DomaraIntegrationProviderId, DomaraIntegrationProviderStatus } from "@/lib/studio/domara/integrations";
import {
  buildCasaHudConnectionCards,
  getCasaHudSetupMessage,
  getMissingCasaHudCoreConnections,
  type CasaHudConnectionCard,
  type CasaHudConnectionCardId,
} from "@/lib/studio/domara/integrations-ui";

type CasaHudGenerationStatus = "idle" | "loading" | "ready" | "error";
type CasaHudProgressState = "idle" | "running" | "complete" | "failed";
type CasaHudWorkspaceSection =
  | "campaigns"
  | "viral_titles"
  | "property_shortlist"
  | "location_intelligence"
  | "script_studio"
  | "media_library"
  | "storyboard"
  | "video_builder"
  | "review_package"
  | "publishing"
  | "connections"
  | "settings";
type CasaHudOperationalState = "complete" | "running" | "needs_attention" | "blocked" | "pending";
type CasaHudCommandStepState = "complete" | "current" | "pending" | "blocked";

type CasaHudConnectionStatusPayload = {
  ok?: boolean;
  providers?: DomaraIntegrationProviderStatus[];
  saveSupported?: boolean;
};

type CasaHudConnectionSavePayload = {
  ok?: boolean;
  provider?: DomaraIntegrationProviderStatus;
  providers?: DomaraIntegrationProviderStatus[];
  error?: { message?: string };
};

type CasaHudOpportunityPayload = {
  ok?: boolean;
  output?: CasaHudOpportunityResult;
  error?: { message?: string };
};

type CasaHudCampaignListPayload = {
  ok?: boolean;
  campaigns?: CasaHudCampaignSummary[];
  error?: { message?: string };
};

type CasaHudCampaignCreatePayload = {
  ok?: boolean;
  campaign?: CasaHudCampaign;
  summary?: CasaHudCampaignSummary;
  message?: string;
  error?: { message?: string };
};

type CasaHudCampaignDetailPayload = {
  ok?: boolean;
  campaign?: CasaHudCampaign;
  error?: { message?: string };
};

type CasaHudListingDiscoveryPayload = {
  ok?: boolean;
  campaign?: CasaHudCampaign;
  summary?: CasaHudCampaignSummary;
  message?: string;
  error?: { message?: string };
};

type CasaHudListingValidationPayload = {
  ok?: boolean;
  campaign?: CasaHudCampaign;
  summary?: CasaHudCampaignSummary;
  message?: string;
  error?: { message?: string };
};

type CasaHudLocationIntelligencePayload = {
  ok?: boolean;
  campaign?: CasaHudCampaign;
  summary?: CasaHudCampaignSummary;
  message?: string;
  error?: { message?: string };
};

type CasaHudScriptNarrativePayload = {
  ok?: boolean;
  campaign?: CasaHudCampaign;
  summary?: CasaHudCampaignSummary;
  message?: string;
  error?: { message?: string };
};

type CasaHudMediaPlanPayload = {
  ok?: boolean;
  campaign?: CasaHudCampaign;
  summary?: CasaHudCampaignSummary;
  message?: string;
  error?: { message?: string };
};

type CasaHudProgressStep = {
  id: string;
  label: string;
};

type CasaHudWorkspaceNavItem = {
  id: CasaHudWorkspaceSection;
  label: string;
  eyebrow: string;
  description: string;
};

type CasaHudPhaseProgressItem = {
  id: string;
  label: string;
  status: CasaHudCommandStepState;
};

type CasaHudAgentActivityRow = {
  name: string;
  state: CasaHudOperationalState;
  detail: string;
};

type CasaHudPrimaryAction = {
  label: string;
  helper: string;
  section: CasaHudWorkspaceSection;
  disabled?: boolean;
};

type CasaHudSceneOutlineRow = {
  id: string;
  title: string;
  narration: string;
  durationSeconds: number;
  associatedListingId?: string;
  visualSummary: string;
  status: CasaHudOperationalState;
};

type CasaHudYouTubePackagePreview = {
  finalTitle: string;
  description: string;
  tags: string[];
  hashtags: string[];
  chapters: { timestamp: string; title: string }[];
  thumbnailConcept: string;
};

const sidebarSections: CasaHudWorkspaceNavItem[] = [
  {
    id: "campaigns",
    label: "Campaigns",
    eyebrow: "Overview",
    description: "Current campaign, workflow stages, and recent work.",
  },
  {
    id: "viral_titles",
    label: "Viral Titles",
    eyebrow: "Strategy",
    description: "Winning title, candidates, and research brief.",
  },
  {
    id: "property_shortlist",
    label: "Property Shortlist",
    eyebrow: "Listings",
    description: "Approved properties, ranking, and title support.",
  },
  {
    id: "location_intelligence",
    label: "Location Intelligence",
    eyebrow: "Place Story",
    description: "POIs, local highlights, and map scene ideas.",
  },
  {
    id: "script_studio",
    label: "Script Studio",
    eyebrow: "Narrative",
    description: "Hook, segments, narration, transitions, and CTA.",
  },
  {
    id: "media_library",
    label: "Media Library",
    eyebrow: "Assets",
    description: "Listing images, map visuals, and coverage gaps.",
  },
  {
    id: "storyboard",
    label: "Storyboard",
    eyebrow: "Scenes",
    description: "Scene-by-scene creative plan for review.",
  },
  {
    id: "review_package",
    label: "Review Package",
    eyebrow: "Review",
    description: "Title, properties, script, storyboard, and metadata.",
  },
  {
    id: "publishing",
    label: "Publishing",
    eyebrow: "Ship",
    description: "Publish now, schedule, and channel status.",
  },
  {
    id: "connections",
    label: "Connections",
    eyebrow: "Providers",
    description: "Creation and publishing service readiness.",
  },
  {
    id: "settings",
    label: "Settings",
    eyebrow: "Advanced",
    description: "Preferences and advanced defaults.",
  },
];

const commandSteps = [
  "Opportunity",
  "Title",
  "Campaign",
  "Listings",
  "Validation",
  "Location",
  "Script",
  "Media",
  "Package",
  "Render",
  "Review",
  "Publish",
] as const;

const wizardSteps: CasaHudProgressStep[] = [
  { id: "youtube_research", label: "Researching YouTube opportunities" },
  { id: "viral_title", label: "Creating viral titles" },
  { id: "winning_concept", label: "Selecting winning concept" },
];

const discoverySteps: CasaHudProgressStep[] = [
  { id: "read_promise", label: "Reading campaign title promise" },
  { id: "build_criteria", label: "Building listing search criteria" },
  { id: "search_sources", label: "Searching listing sources" },
  { id: "prepare_candidates", label: "Preparing candidate properties" },
];

const validationSteps: CasaHudProgressStep[] = [
  { id: "check_truthfulness", label: "Checking title truthfulness" },
  { id: "remove_duplicates", label: "Removing duplicate listings" },
  { id: "score_fit", label: "Scoring listing fit" },
  { id: "rank_properties", label: "Ranking strongest properties" },
  { id: "prepare_shortlist", label: "Preparing approved shortlist" },
];

const locationSteps: CasaHudProgressStep[] = [
  { id: "read_locations", label: "Reading approved property locations" },
  { id: "find_highlights", label: "Finding local highlights" },
  { id: "build_poi_context", label: "Building POI context" },
  { id: "prepare_map_ideas", label: "Preparing map scene ideas" },
  { id: "create_story", label: "Creating location story" },
];

const scriptSteps: CasaHudProgressStep[] = [
  { id: "opening_hook", label: "Building the opening hook" },
  { id: "video_flow", label: "Structuring the video flow" },
  { id: "property_segments", label: "Writing property segments" },
  { id: "location_storytelling", label: "Adding location storytelling" },
  { id: "review_ready", label: "Preparing review-ready script" },
];

const mediaSteps: CasaHudProgressStep[] = [
  { id: "read_scenes", label: "Reading the script scenes" },
  { id: "organize_visuals", label: "Organizing listing visuals" },
  { id: "match_scenes", label: "Matching images to scenes" },
  { id: "map_location_assets", label: "Adding map and location visuals" },
  { id: "thumbnail_candidates", label: "Preparing thumbnail candidates" },
  { id: "coverage_check", label: "Checking visual coverage" },
];

const providerOptionLabels: Record<DomaraIntegrationProviderId, string> = {
  openai: "OpenAI",
  elevenlabs: "ElevenLabs",
  mapbox: "Mapbox",
  google_maps_places: "Google Maps / Places",
  idealista: "Idealista",
  immobiliare: "Immobiliare",
  cloudinary: "Cloudinary",
  digitalocean_spaces: "DigitalOcean Spaces",
  youtube: "YouTube Channel",
};

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function statusDotClass(status: CasaHudProgressState) {
  if (status === "complete") return "bg-[#1B8A5A] shadow-[0_0_0_5px_rgba(27,138,90,0.12)]";
  if (status === "failed") return "bg-[#B91C1C] shadow-[0_0_0_5px_rgba(185,28,28,0.14)]";
  if (status === "running") return "bg-[#2563EB] shadow-[0_0_0_5px_rgba(37,99,235,0.14)]";
  return "bg-[#CBD5E1]";
}

function stageTextClass(status: CasaHudProgressState) {
  if (status === "complete") return "text-[#0F5132]";
  if (status === "failed") return "text-[#991B1B]";
  return "text-[#344256]";
}

function progressStatusLabel(status: CasaHudProgressState) {
  if (status === "complete") return "Complete";
  if (status === "running") return "Working";
  if (status === "failed") return "Needs attention";
  return "Coming up";
}

function getProgressStepStatus(
  generationStatus: CasaHudGenerationStatus,
  progressIndex: number,
  stepIndex: number,
): CasaHudProgressState {
  if (generationStatus === "ready") return "complete";
  if (generationStatus === "error") {
    if (stepIndex < progressIndex) return "complete";
    if (stepIndex === progressIndex) return "failed";
    return "idle";
  }
  if (generationStatus !== "loading") return "idle";
  if (stepIndex < progressIndex) return "complete";
  if (stepIndex === progressIndex) return "running";
  return "idle";
}

function formatOpportunityCampaignType(type: CasaHudOpportunityCampaignType) {
  switch (type) {
    case "roundup":
      return "Roundup";
    case "single_property_showcase":
      return "Single Property Showcase";
    case "niche_category":
      return "Niche / Category";
    case "location_led":
      return "Location-Led";
    case "lifestyle_relocation":
      return "Lifestyle / Relocation";
  }
}

function formatCampaignTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatCampaignStatus(status?: string | null) {
  if (!status) return "Pending";
  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatListingPrice(price?: number, currency?: string) {
  if (typeof price !== "number" || !Number.isFinite(price)) return "Price on request";
  if (currency === "EUR") return `€${price.toLocaleString("en-US")}`;
  if (currency === "USD") return `$${price.toLocaleString("en-US")}`;
  return `${currency || "EUR"} ${price.toLocaleString("en-US")}`;
}

function formatListingProvider(provider: string) {
  if (provider === "idealista") return "Idealista";
  if (provider === "immobiliare") return "Immobiliare";
  if (provider === "casahud_sample") return "CasaHUD listing patterns";
  return provider;
}

function formatSupportConfidence(value?: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "Pending";
  return `${Math.round(value)}%`;
}

function formatDuration(seconds?: number | null) {
  if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds <= 0) return "TBD";
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  if (minutes === 0) return `${remainder}s`;
  if (remainder === 0) return `${minutes}m`;
  return `${minutes}m ${remainder}s`;
}

function formatCountLabel(value: number, singular: string, plural = `${singular}s`) {
  return `${value} ${value === 1 ? singular : plural}`;
}

function toTimestamp(totalSeconds: number) {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function summarizeCampaign(campaign: CasaHudCampaign): CasaHudCampaignSummary {
  return {
    id: campaign.id,
    name: campaign.name,
    campaignType: campaign.campaignType,
    marketRegionHint: campaign.marketRegionHint,
    status: campaign.status,
    createdAt: campaign.createdAt,
    updatedAt: campaign.updatedAt,
    researchSummary: campaign.researchBrief.summary,
    listingCandidateCount: campaign.listingCandidates.length,
    listingDiscoveryStatus: campaign.listingDiscoveryStatus,
    approvedListingCount: campaign.approvedListings.length,
    listingValidationStatus: campaign.listingValidationStatus,
    titleSupportConfidence: campaign.titleSupportConfidence ?? undefined,
    locationIntelligenceStatus: campaign.locationIntelligenceStatus,
    scriptGenerationStatus: campaign.scriptGenerationStatus,
    mediaPlanningStatus: campaign.mediaPlanningStatus,
    discoverySummary: campaign.discoverySummary?.headline,
    validationSummary: campaign.listingValidationSummary?.headline,
    locationSummary: campaign.locationIntelligenceSummary?.headline,
    scriptSummary: campaign.scriptSummary ?? undefined,
    mediaPlanSummary: campaign.mediaPlanSummary ?? undefined,
  };
}

function defaultProviderForCard(card: CasaHudConnectionCard, providers: DomaraIntegrationProviderStatus[]) {
  if (card.id !== "listing_sources") return card.providerIds[0];
  const connected = providers.find(
    (provider) =>
      card.providerIds.includes(provider.providerId) &&
      provider.configured &&
      provider.validationStatus !== "invalid",
  );
  return connected?.providerId || "idealista";
}

function toneClasses(tone: "ink" | "gold" | "sage" | "blue" | "red" | "neutral") {
  if (tone === "ink") return "border-[#172033] bg-[#172033] text-white";
  if (tone === "gold") return "border-[#E2CEB1] bg-[#FFF4E4] text-[#845128]";
  if (tone === "sage") return "border-[#D2E4D7] bg-[#F3FBF5] text-[#0F5132]";
  if (tone === "blue") return "border-[#CEDAF0] bg-[#F4F8FF] text-[#274C87]";
  if (tone === "red") return "border-[#F1C9C9] bg-[#FFF4F4] text-[#9A2727]";
  return "border-[#E5DACE] bg-white text-[#344256]";
}

function operationalTone(state: CasaHudOperationalState) {
  if (state === "complete") return "sage";
  if (state === "running") return "blue";
  if (state === "needs_attention") return "red";
  if (state === "blocked") return "gold";
  return "neutral";
}

function connectionTone(status: CasaHudConnectionCard["status"]) {
  if (status === "connected" || status === "partially_connected") return "sage";
  if (status === "needs_attention") return "red";
  if (status === "optional") return "neutral";
  return "gold";
}

function phaseTone(status: CasaHudCommandStepState) {
  if (status === "complete") return "sage";
  if (status === "current") return "ink";
  if (status === "blocked") return "red";
  return "neutral";
}

function featuredImage(listing: CasaHudListingCandidate | CasaHudValidatedListing) {
  return listing.imageUrls.find((value) => value.trim().length > 0) || null;
}

function isValidatedListing(
  listing: CasaHudListingCandidate | CasaHudValidatedListing,
): listing is CasaHudValidatedListing {
  return "validationStatus" in listing;
}

function getCampaignPrimaryAction(campaign: CasaHudCampaign | null): CasaHudPrimaryAction {
  if (!campaign) {
    return {
      label: "Generate Viral Video Title",
      helper: "Start the next opportunity from one click.",
      section: "campaigns",
    };
  }

  if (campaign.mediaPlanningStatus === "media_plan_built") {
    return {
      label: "Review Package",
      helper: "Review the completed visual plan before package, review, and render planning steps.",
      section: "review_package",
    };
  }

  if (campaign.scriptGenerationStatus === "script_generated") {
    return {
      label: "Build Media Plan",
      helper: "Assemble the visual plan from listing imagery, map cues, and the scripted scenes.",
      section: "media_library",
    };
  }

  return {
    label: "Continue Campaign",
    helper: `Advance CasaHUD to ${campaign.nextPhase.label}.`,
    section:
      campaign.nextPhase.key === "location_intelligence"
        ? "location_intelligence"
        : campaign.nextPhase.key === "script_narrative_generation"
          ? "script_studio"
          : "property_shortlist",
  };
}

function buildPhaseProgress(campaign: CasaHudCampaign | null, youtubeConnected: boolean): CasaHudPhaseProgressItem[] {
  if (!campaign) {
    return commandSteps.map((label, index) => ({
      id: label.toLowerCase(),
      label,
      status: index === 0 ? "current" : "pending",
    }));
  }

  let completedThrough = 2;
  if (campaign.listingDiscoveryStatus === "listing_candidates_discovered") completedThrough = 3;
  if (campaign.listingValidationStatus === "listing_candidates_validated") completedThrough = 4;
  if (campaign.locationIntelligenceStatus === "location_intelligence_completed") completedThrough = 5;
  if (campaign.scriptGenerationStatus === "script_generated") completedThrough = 6;
  if (campaign.mediaPlanningStatus === "media_plan_built" || campaign.futureState.mediaPlan || campaign.futureState.storyboard) completedThrough = 7;
  if (campaign.futureState.packaging) completedThrough = 8;
  if (campaign.futureState.renderStatus) completedThrough = 9;
  if (campaign.futureState.reviewStatus) completedThrough = 10;
  if (campaign.futureState.publishStatus || campaign.futureState.scheduleStatus) completedThrough = 11;

  return commandSteps.map((label, index) => {
    if (index <= completedThrough) {
      return {
        id: label.toLowerCase(),
        label,
        status: "complete",
      };
    }

    if (index === completedThrough + 1) {
      if (label === "Publish" && !youtubeConnected) {
        return { id: label.toLowerCase(), label, status: "blocked" };
      }

      return { id: label.toLowerCase(), label, status: "current" };
    }

    return { id: label.toLowerCase(), label, status: "pending" };
  });
}

function deriveReadinessScore(campaign: CasaHudCampaign | null) {
  if (!campaign) return 6;
  const progress = buildPhaseProgress(campaign, true);
  const completedCount = progress.filter((item) => item.status === "complete").length;
  let score = Math.round((completedCount / progress.length) * 78);
  if (typeof campaign.titleSupportConfidence === "number") {
    score += Math.round(campaign.titleSupportConfidence * 0.14);
  }
  if (campaign.scriptGenerationStatus === "script_generated") {
    score += 8;
  }
  return Math.max(0, Math.min(100, score));
}

function deriveTruthfulnessStatus(campaign: CasaHudCampaign | null) {
  if (!campaign || !campaign.listingValidationSummary) {
    return {
      headline: "Validation pending",
      detail: "CasaHUD will confirm title-to-listing support before publish review.",
      tone: "gold" as const,
    };
  }

  const confidence = campaign.titleSupportConfidence ?? 0;
  if (confidence >= 85 && campaign.scriptWarnings.length === 0) {
    return {
      headline: "Strong title support",
      detail: "The shortlist and script stay closely aligned with the selected title promise.",
      tone: "sage" as const,
    };
  }
  if (confidence >= 70) {
    return {
      headline: "Moderate support",
      detail: "Keep narration specific and avoid stretching beyond the validated evidence.",
      tone: "gold" as const,
    };
  }
  return {
    headline: "Needs review",
    detail: "Title support is thin enough that the review pass should tighten claims before publish.",
    tone: "red" as const,
  };
}

function deriveVisualReadiness(campaign: CasaHudCampaign | null) {
  if (!campaign) {
    return {
      headline: "No visual package yet",
      detail: "Generate a campaign before CasaHUD assembles scene coverage.",
      tone: "neutral" as const,
    };
  }

  const listings = campaign.approvedListings.length > 0 ? campaign.approvedListings : campaign.listingCandidates;
  const photoCount = listings.reduce((sum, listing) => sum + listing.imageCount, 0);
  if (campaign.mediaPlanningStatus === "media_plan_built") {
    return {
      headline: "Media plan is assembled",
      detail: campaign.mediaPlanSummary || "Scene-to-asset mapping, shot list, and thumbnail inputs are ready for review.",
      tone: "sage" as const,
    };
  }
  if (campaign.scriptGenerationStatus === "script_generated" && photoCount >= 8 && campaign.mapSceneIdeas.length > 0) {
    return {
      headline: "Visual coverage is promising",
      detail: "Property images, map scenes, and scene-level narration are available for media planning.",
      tone: "sage" as const,
    };
  }
  if (photoCount > 0) {
    return {
      headline: "Partial visual coverage",
      detail: "CasaHUD has some property imagery, but map and asset planning still need the Phase 8 handoff.",
      tone: "gold" as const,
    };
  }
  return {
    headline: "Visual gaps remain",
    detail: "Listing imagery is limited, so later media planning should tighten asset coverage before render.",
    tone: "red" as const,
  };
}

function buildAgentRows(params: {
  campaign: CasaHudCampaign | null;
  opportunityOutput: CasaHudOpportunityResult | null;
  generationStatus: CasaHudGenerationStatus;
  campaignDiscoveringId: string | null;
  campaignValidatingId: string | null;
  campaignLocatingId: string | null;
  campaignScriptingId: string | null;
  campaignMediaPlanningId: string | null;
  youtubeCard?: CasaHudConnectionCard;
}): CasaHudAgentActivityRow[] {
  const {
    campaign,
    opportunityOutput,
    generationStatus,
    campaignDiscoveringId,
    campaignValidatingId,
    campaignLocatingId,
    campaignScriptingId,
    campaignMediaPlanningId,
    youtubeCard,
  } = params;

  return [
    {
      name: "YouTube Research Agent",
      state:
        generationStatus === "loading"
          ? "running"
          : opportunityOutput || campaign
            ? "complete"
            : youtubeCard?.status === "needs_attention"
              ? "needs_attention"
              : "pending",
      detail:
        opportunityOutput || campaign
          ? "The opening research package is ready and linked to the selected title."
          : youtubeCard?.status === "needs_attention"
            ? "The YouTube connection needs attention before live competitive research can improve the package."
            : "Waiting to generate the next opportunity.",
    },
    {
      name: "Title Strategy Agent",
      state: generationStatus === "loading" ? "running" : opportunityOutput || campaign ? "complete" : "pending",
      detail:
        opportunityOutput || campaign
          ? "CasaHUD selected a dominant title and preserved the candidate set for review."
          : "Waiting on the initial opportunity run.",
    },
    {
      name: "Listing Discovery Agent",
      state:
        campaignDiscoveringId
          ? "running"
          : campaign?.listingDiscoveryStatus === "listing_candidates_discovered"
            ? "complete"
            : campaign
              ? "pending"
              : "blocked",
      detail:
        campaign?.listingDiscoveryStatus === "listing_candidates_discovered"
          ? "Candidate properties are saved on the campaign."
          : campaign
            ? "Ready to translate the title promise into property candidates."
            : "Create a campaign first.",
    },
    {
      name: "Listing Validation Agent",
      state:
        campaignValidatingId
          ? "running"
          : campaign?.listingValidationStatus === "listing_candidates_validated"
            ? "complete"
            : campaign?.listingCandidates.length
              ? "pending"
              : "blocked",
      detail:
        campaign?.listingValidationStatus === "listing_candidates_validated"
          ? "Approved and rejected listings are ranked and persisted."
          : campaign?.listingCandidates.length
            ? "Waiting to score the shortlist and title fit."
            : "Listing discovery must finish first.",
    },
    {
      name: "Location Intelligence Agent",
      state:
        campaignLocatingId
          ? "running"
          : campaign?.locationIntelligenceStatus === "location_intelligence_completed"
            ? "complete"
            : campaign?.listingValidationStatus === "listing_candidates_validated"
              ? "pending"
              : "blocked",
      detail:
        campaign?.locationIntelligenceStatus === "location_intelligence_completed"
          ? "Place story, POIs, and map scene ideas are available."
          : campaign?.listingValidationStatus === "listing_candidates_validated"
            ? "Ready to build location context from the approved listings."
            : "Validation must complete first.",
    },
    {
      name: "Script Agent",
      state:
        campaignScriptingId
          ? "running"
          : campaign?.scriptGenerationStatus === "script_generated"
            ? "complete"
            : campaign?.locationIntelligenceStatus === "location_intelligence_completed"
              ? "pending"
              : "blocked",
      detail:
        campaign?.scriptGenerationStatus === "script_generated"
          ? "Hook, narrative flow, and CTA are ready for review."
          : campaign?.locationIntelligenceStatus === "location_intelligence_completed"
            ? "Ready to write the review-ready narrative."
            : "Location intelligence must finish first.",
    },
    {
      name: "Media Agent",
      state:
        campaignMediaPlanningId
          ? "running"
          : campaign?.mediaPlanningStatus === "media_plan_built" || campaign?.futureState.mediaPlan || campaign?.futureState.storyboard
          ? "complete"
          : campaign?.scriptGenerationStatus === "script_generated"
            ? "pending"
            : "blocked",
      detail:
        campaignMediaPlanningId
          ? "Reading scenes, organizing visuals, and matching media coverage to the scripted package."
          : campaign?.mediaPlanningStatus === "media_plan_built" || campaign?.futureState.mediaPlan || campaign?.futureState.storyboard
          ? "Scene visuals, shot list, and media planning assets are available."
          : campaign?.scriptGenerationStatus === "script_generated"
            ? "Waiting on Phase 8 media planning and asset assembly."
            : "Script completion unlocks the media phase.",
    },
    {
      name: "Packaging Agent",
      state:
        campaign?.futureState.packaging
          ? "complete"
          : campaign?.mediaPlanningStatus === "media_plan_built"
            ? "pending"
            : "blocked",
      detail:
        campaign?.futureState.packaging
          ? "The YouTube package is assembled for review."
          : campaign?.mediaPlanningStatus === "media_plan_built"
            ? "The command center is ready to hand the project forward into package, review, and render planning."
            : "Packaging waits on the narrative package.",
    },
    {
      name: "Render Agent",
      state:
        campaign?.futureState.renderStatus
          ? "complete"
          : campaign?.scriptGenerationStatus === "script_generated"
            ? "pending"
            : "blocked",
      detail:
        campaign?.futureState.renderStatus
          ? `Render status: ${formatCampaignStatus(String(campaign.futureState.renderStatus))}.`
          : campaign?.scriptGenerationStatus === "script_generated"
            ? "Render remains gated behind later phase media and review approval."
            : "Render is blocked until the narrative package is ready.",
    },
    {
      name: "Review Agent",
      state:
        campaign?.futureState.reviewStatus
          ? "complete"
          : campaign?.scriptWarnings.length
            ? "needs_attention"
            : campaign?.scriptGenerationStatus === "script_generated"
              ? "pending"
              : "blocked",
      detail:
        campaign?.futureState.reviewStatus
          ? `Review status: ${formatCampaignStatus(String(campaign.futureState.reviewStatus))}.`
          : campaign?.scriptWarnings.length
            ? "Warnings are present, so the human review pass should tighten claims before publish."
            : campaign?.scriptGenerationStatus === "script_generated"
              ? "The package is ready for human review."
              : "Review opens after the narrative package is ready.",
    },
    {
      name: "Publish Agent",
      state:
        campaign?.futureState.publishStatus || campaign?.futureState.scheduleStatus
          ? "complete"
          : params.youtubeCard?.status === "connected" && campaign?.scriptGenerationStatus === "script_generated"
            ? "pending"
            : "blocked",
      detail:
        campaign?.futureState.publishStatus || campaign?.futureState.scheduleStatus
          ? `Publish status: ${formatCampaignStatus(String(campaign.futureState.publishStatus || campaign.futureState.scheduleStatus))}.`
          : params.youtubeCard?.status === "connected" && campaign?.scriptGenerationStatus === "script_generated"
            ? "The channel is connected, but publish still waits on review approval."
            : "YouTube connection or review approval is still missing.",
    },
  ];
}

function buildSceneOutline(campaign: CasaHudCampaign | null): CasaHudSceneOutlineRow[] {
  if (!campaign) return [];

  if (campaign.sceneAssetMapping.length > 0) {
    return campaign.sceneAssetMapping.map((scene, index) => ({
      id: scene.sceneId,
      title: scene.sceneTitle,
      narration: scene.narrationExcerpt,
      durationSeconds: campaign.scriptSegments.find((segment) => segment.id === scene.segmentId)?.durationSeconds || 16,
      associatedListingId:
        campaign.scriptSegments.find((segment) => segment.id === scene.segmentId)?.associatedListingId ||
        campaign.propertySegments[index]?.listingId,
      visualSummary: scene.visualPurpose,
      status: scene.coverageStatus === "strong" ? "complete" : scene.coverageStatus === "partial" ? "needs_attention" : "blocked",
    }));
  }

  if (campaign.scriptSegments.length > 0) {
    return campaign.scriptSegments.map((segment) => ({
      id: segment.id,
      title: segment.title,
      narration: segment.narration,
      durationSeconds: segment.durationSeconds,
      associatedListingId: segment.associatedListingId,
      visualSummary: segment.visualNote || "Scene visual planning follows in Media Planning and Asset Assembly.",
      status: campaign.scriptGenerationStatus === "script_generated" ? "complete" : "pending",
    }));
  }

  return campaign.approvedListings.map((listing, index) => ({
    id: `listing-scene-${listing.id}`,
    title: `${index === 0 ? "Opening proof" : "Property segment"}: ${listing.title}`,
    narration: listing.validationReasons[0] || listing.preliminaryMatchNotes,
    durationSeconds: 16,
    associatedListingId: listing.id,
    visualSummary:
      campaign.mapSceneIdeas.find((scene) => scene.associatedListingId === listing.id)?.suggestedVisual ||
      "Lead with the listing visuals and location anchors once media planning runs.",
    status: "pending",
  }));
}

function buildYouTubePackagePreview(campaign: CasaHudCampaign | null): CasaHudYouTubePackagePreview | null {
  if (!campaign) return null;

  const scenes = buildSceneOutline(campaign);
  let elapsed = 0;
  const chapters = scenes.slice(0, 6).map((scene) => {
    const chapter = {
      timestamp: toTimestamp(elapsed),
      title: scene.title,
    };
    elapsed += scene.durationSeconds;
    return chapter;
  });

  const topProperty = campaign.approvedListings[0];
  const descriptionParts = [
    campaign.scriptSummary || campaign.researchBrief.summary,
    topProperty
      ? `Featured property: ${topProperty.title} in ${topProperty.locationText}.`
      : "The package will attach the strongest approved properties once the shortlist is confirmed.",
    campaign.locationStory?.summary || campaign.locationIntelligenceSummary?.coverageSummary,
    "Review required before render or publish.",
  ].filter(Boolean);

  const tags = [
    "CasaHUD",
    campaign.marketRegionHint || "Property video",
    formatOpportunityCampaignType(campaign.campaignType),
    topProperty?.propertyType || "real estate",
    topProperty?.city || "location story",
  ].filter(Boolean);

  return {
    finalTitle: campaign.selectedViralTitle,
    description: descriptionParts.join("\n\n"),
    tags,
    hashtags: ["#CasaHUD", "#PropertyVideo", "#RealEstate", "#YouTubeStrategy", "#ReviewBeforePublish"],
    chapters,
    thumbnailConcept:
      campaign.locationStory?.headline ||
      `Lead with ${campaign.marketRegionHint || "the region"} and the strongest approved property against a premium editorial frame.`,
  };
}

function getPropertySceneRole(
  campaign: CasaHudCampaign,
  listing: CasaHudListingCandidate | CasaHudValidatedListing,
  index: number,
) {
  if (campaign.campaignType === "single_property_showcase") return "Primary walkthrough";
  if (index === 0) return "Lead proof point";
  if (campaign.campaignType === "location_led") return "Regional proof example";
  if (campaign.campaignType === "lifestyle_relocation") return "Lifestyle support segment";
  return "Supporting comparison beat";
}

function getPropertySupportCopy(
  campaign: CasaHudCampaign,
  listing: CasaHudListingCandidate | CasaHudValidatedListing,
) {
  const propertySegment = campaign.propertySegments.find((item) => item.listingId === listing.id);
  const locationInsight = campaign.listingLocationInsights.find((item) => item.listingId === listing.id);
  if (propertySegment?.whyItMadeTheCut) return propertySegment.whyItMadeTheCut;
  if ("validationReasons" in listing && listing.validationReasons.length > 0) return listing.validationReasons[0];
  if (locationInsight?.summary) return locationInsight.summary;
  return listing.preliminaryMatchNotes;
}

function getPropertyMatchScore(listing: CasaHudListingCandidate | CasaHudValidatedListing) {
  if ("overallScore" in listing && typeof listing.overallScore === "number") {
    return `${Math.round(listing.overallScore)}%`;
  }
  return "Pending";
}

function statusLabelFromListing(listing: CasaHudListingCandidate | CasaHudValidatedListing) {
  if ("validationStatus" in listing) return formatCampaignStatus(listing.validationStatus);
  return "Candidate";
}

function listingStatusTone(listing: CasaHudListingCandidate | CasaHudValidatedListing) {
  if (!("validationStatus" in listing)) return "neutral" as const;
  if (listing.validationStatus === "approved") return "sage" as const;
  if (listing.validationStatus === "needs_attention") return "gold" as const;
  return "red" as const;
}

function propertyDrawerFacts(listing: CasaHudListingCandidate | CasaHudValidatedListing) {
  return [
    listing.propertyType ? formatCampaignStatus(listing.propertyType) : null,
    listing.bedrooms ? `${listing.bedrooms} bd` : null,
    listing.bathrooms ? `${listing.bathrooms} ba` : null,
    listing.sizeSqm ? `${listing.sizeSqm} sqm` : null,
  ].filter(Boolean) as string[];
}

function canOpenExternalUrl(url?: string | null) {
  return Boolean(url && /^https?:\/\//i.test(url));
}

function ReviewStatusCard({
  campaign,
  youtubePreview,
}: {
  campaign: CasaHudCampaign;
  youtubePreview: CasaHudYouTubePackagePreview | null;
}) {
  const visualGaps = campaign.approvedListings.filter((listing) => listing.imageCount === 0).length;
  const reviewState =
    campaign.scriptWarnings.length > 0 || (campaign.titleSupportConfidence ?? 0) < 80
      ? "Needs revision"
      : campaign.scriptGenerationStatus === "script_generated"
        ? "Ready for review"
        : "Blocked";

  return (
    <section className="rounded-[1.7rem] border border-[#E6D8C7] bg-white/90 p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8A5A34]">Review Card</p>
      <h3 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[#172033]">{reviewState}</h3>
      <div className="mt-4 grid gap-3 text-sm leading-6 text-[#526070]">
        <p>
          <span className="font-semibold text-[#172033]">Unsupported claims:</span>{" "}
          {campaign.scriptWarnings.length > 0 ? campaign.scriptWarnings[0] : "No obvious unsupported claims surfaced in the current script package."}
        </p>
        <p>
          <span className="font-semibold text-[#172033]">Weak listings:</span>{" "}
          {campaign.rejectedListings.length > 0
            ? `${campaign.rejectedListings.length} rejected or weak-fit listing${campaign.rejectedListings.length === 1 ? "" : "s"} remain outside the default package.`
            : "No rejected listings are competing for inclusion."}
        </p>
        <p>
          <span className="font-semibold text-[#172033]">Visual gaps:</span>{" "}
          {visualGaps > 0
            ? `${visualGaps} approved listing${visualGaps === 1 ? "" : "s"} still need stronger visual coverage before render.`
            : "Property visuals are present for the approved shortlist."}
        </p>
        <p>
          <span className="font-semibold text-[#172033]">Metadata quality:</span>{" "}
          {youtubePreview ? "A reviewable title, description, chapters, tags, and thumbnail concept preview are available." : "Metadata preview waits on the current campaign package."}
        </p>
      </div>
    </section>
  );
}

function SidebarGlyph({ active }: { active: boolean }) {
  return (
    <span
      className={cx(
        "relative inline-flex h-5 w-5 shrink-0 items-center justify-center",
        active ? "text-[#7A5230]" : "text-white/65",
      )}
      aria-hidden="true"
    >
      <span className={cx("absolute h-3.5 w-3.5 rounded-[5px] border", active ? "border-[#D4B180] bg-[#F7ECD9]" : "border-white/16 bg-white/8")} />
      <span className={cx("absolute h-1.5 w-1.5 rounded-full", active ? "bg-[#7A5230]" : "bg-white/55")} />
    </span>
  );
}

function StatusPill({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: "ink" | "gold" | "sage" | "blue" | "red" | "neutral";
  className?: string;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold tracking-[0.02em]",
        toneClasses(tone),
        className,
      )}
    >
      {children}
    </span>
  );
}

function WorkspaceCard({
  eyebrow,
  title,
  description,
  actions,
  children,
  testId,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  testId?: string;
}) {
  return (
    <section
      className="rounded-[1.7rem] border border-[#E7DCCB] bg-[#FFFDF8]/[0.96] p-5 shadow-[0_18px_42px_rgba(70,55,35,0.1)] md:p-6"
      data-testid={testId}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8A5A34]">{eyebrow}</p>
          <h2 className="mt-1 text-[1.9rem] font-semibold tracking-[-0.04em] text-[#172033]">{title}</h2>
          {description ? <p className="mt-2 max-w-3xl text-sm leading-6 text-[#5A6677]">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function PlaceholderVisual({
  label,
  detail,
  className,
}: {
  label: string;
  detail: string;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "relative overflow-hidden rounded-[1.4rem] border border-[#E6D8C7] bg-[linear-gradient(140deg,rgba(25,35,55,0.96),rgba(128,94,58,0.9))] p-4 text-white shadow-sm",
        className,
      )}
      role="img"
      aria-label={label}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.18),transparent_38%),radial-gradient(circle_at_bottom_left,rgba(236,215,184,0.15),transparent_44%)]" />
      <div className="relative">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#F9E5C4]">{label}</p>
        <p className="mt-4 max-w-xs text-sm leading-6 text-white/88">{detail}</p>
      </div>
    </div>
  );
}

function PropertyImage({
  src,
  alt,
  label,
  className,
}: {
  src?: string | null;
  alt: string;
  label: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return <PlaceholderVisual label={label} detail="Stable CasaHUD placeholder while premium media coverage is prepared." className={className} />;
  }

  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={src}
      alt={alt}
      className={cx("h-full w-full object-cover", className)}
      onError={() => setFailed(true)}
    />
  );
}

function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-[1.75rem] border border-dashed border-[#D8C8B2] bg-[linear-gradient(160deg,rgba(255,249,239,0.9),rgba(255,255,255,0.74))] p-6">
      <p className="text-2xl font-semibold tracking-[-0.03em] text-[#172033]">{title}</p>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-[#526070]">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

function PropertyCard({
  campaign,
  listing,
  index,
  onSelect,
}: {
  campaign: CasaHudCampaign;
  listing: CasaHudListingCandidate | CasaHudValidatedListing;
  index: number;
  onSelect: (listingId: string) => void;
}) {
  const facts = propertyDrawerFacts(listing);
  const propertySegment = campaign.propertySegments.find((item) => item.listingId === listing.id);

  return (
    <article className="overflow-hidden rounded-[1.5rem] border border-[#E7DCCB] bg-white/95 shadow-[0_16px_34px_rgba(70,55,35,0.08)]">
      <div className="relative h-52 w-full bg-[#F2ECE3]">
        <PropertyImage
          src={featuredImage(listing)}
          alt={`${listing.title} featured listing image`}
          label={listing.locationText}
          className="h-52 w-full"
        />
        <div className="absolute left-4 top-4 flex flex-wrap gap-2">
          <StatusPill tone="ink">#{index + 1}</StatusPill>
          <StatusPill tone={listingStatusTone(listing)}>{statusLabelFromListing(listing)}</StatusPill>
        </div>
      </div>
      <div className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill tone="gold">{formatListingProvider(listing.provider)}</StatusPill>
              <StatusPill tone="neutral">{getPropertySceneRole(campaign, listing, index)}</StatusPill>
              <StatusPill tone="blue">Match {getPropertyMatchScore(listing)}</StatusPill>
            </div>
            <h3 className="mt-3 text-lg font-semibold tracking-[-0.03em] text-[#172033]">{listing.title}</h3>
            <p className="mt-1 text-sm leading-6 text-[#526070]">{listing.locationText}</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold text-[#172033]">{formatListingPrice(listing.price, listing.currency)}</p>
            <p className="mt-1 text-xs uppercase tracking-[0.14em] text-[#7A897E]">{formatCountLabel(listing.imageCount, "photo")}</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {facts.map((fact) => (
            <StatusPill key={fact} tone="neutral">
              {fact}
            </StatusPill>
          ))}
        </div>

        <div className="mt-4 grid gap-2 text-sm leading-6 text-[#526070]">
          <p>
            <span className="font-semibold text-[#172033]">Why this property supports the title:</span>{" "}
            {getPropertySupportCopy(campaign, listing)}
          </p>
          <p>
            <span className="font-semibold text-[#172033]">Potential scene role:</span>{" "}
            {propertySegment?.locationLine ||
              campaign.listingLocationInsights.find((item) => item.listingId === listing.id)?.summary ||
              "Use this property as an evidence-backed visual beat inside the video flow."}
          </p>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          {canOpenExternalUrl(listing.sourceUrl) ? (
            <a
              href={listing.sourceUrl!}
              target="_blank"
              rel="noreferrer noopener"
              className="rounded-2xl border border-[#D6C9B9] bg-[#F8F3EA] px-4 py-2 text-sm font-semibold text-[#172033] transition hover:bg-[#FFF9EF]"
            >
              Open source listing
            </a>
          ) : (
            <span className="rounded-2xl border border-[#E6D8C7] bg-[#F8F3EA] px-4 py-2 text-sm font-semibold text-[#7A897E]">
              Source unavailable
            </span>
          )}
          <button
            type="button"
            className="rounded-2xl border border-[#172033] bg-[#172033] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#26324B]"
            onClick={() => onSelect(listing.id)}
          >
            View details
          </button>
          <span className="rounded-2xl border border-[#D2E4D7] bg-[#F3FBF5] px-4 py-2 text-sm font-semibold text-[#0F5132]">
            {campaign.approvedListings.some((item) => item.id === listing.id) ? "Selected for campaign" : "Review candidate"}
          </span>
        </div>
      </div>
    </article>
  );
}

function renderProgressList(
  steps: CasaHudProgressStep[],
  progressIndex: number,
  generationStatus: CasaHudGenerationStatus,
  testId?: string,
) {
  return (
    <div className="grid gap-2" data-testid={testId}>
      {steps.map((step, index) => {
        const status = getProgressStepStatus(generationStatus, progressIndex, index);
        return (
          <div
            key={step.id}
            className="grid grid-cols-[12px_1fr_auto] items-center gap-3 rounded-2xl border border-[#E2E8E0] bg-white/[0.88] px-3 py-3"
          >
            <span className={cx("h-2.5 w-2.5 rounded-full", statusDotClass(status))} />
            <span className={cx("text-sm font-medium", stageTextClass(status))}>{step.label}</span>
            <span className="text-xs text-[#718096]">{progressStatusLabel(status)}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function StudioCasaHudCommandCenter() {
  const [generationStatus, setGenerationStatus] = useState<CasaHudGenerationStatus>("idle");
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [opportunityOutput, setOpportunityOutput] = useState<CasaHudOpportunityResult | null>(null);
  const [progressIndex, setProgressIndex] = useState(0);
  const [recentCampaigns, setRecentCampaigns] = useState<CasaHudCampaignSummary[]>([]);
  const [activeCampaign, setActiveCampaign] = useState<CasaHudCampaign | null>(null);
  const [campaignNotice, setCampaignNotice] = useState<string | null>(null);
  const [campaignError, setCampaignError] = useState<string | null>(null);
  const [campaignCreating, setCampaignCreating] = useState(false);
  const [campaignOpeningId, setCampaignOpeningId] = useState<string | null>(null);
  const [campaignDiscoveringId, setCampaignDiscoveringId] = useState<string | null>(null);
  const [discoveryProgressIndex, setDiscoveryProgressIndex] = useState(0);
  const [campaignValidatingId, setCampaignValidatingId] = useState<string | null>(null);
  const [validationProgressIndex, setValidationProgressIndex] = useState(0);
  const [campaignLocatingId, setCampaignLocatingId] = useState<string | null>(null);
  const [locationProgressIndex, setLocationProgressIndex] = useState(0);
  const [campaignScriptingId, setCampaignScriptingId] = useState<string | null>(null);
  const [scriptProgressIndex, setScriptProgressIndex] = useState(0);
  const [campaignMediaPlanningId, setCampaignMediaPlanningId] = useState<string | null>(null);
  const [mediaProgressIndex, setMediaProgressIndex] = useState(0);
  const [connectionProviders, setConnectionProviders] = useState<DomaraIntegrationProviderStatus[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<"loading" | "ready" | "error">("loading");
  const [connectionSaveSupported, setConnectionSaveSupported] = useState(true);
  const [setupOpen, setSetupOpen] = useState(false);
  const [setupReason, setSetupReason] = useState<string | null>(null);
  const [activeConnectionId, setActiveConnectionId] = useState<CasaHudConnectionCardId | null>(null);
  const [activeProviderId, setActiveProviderId] = useState<DomaraIntegrationProviderId>("youtube");
  const [connectionSecret, setConnectionSecret] = useState("");
  const [connectionNotice, setConnectionNotice] = useState<string | null>(null);
  const [connectionSaving, setConnectionSaving] = useState(false);
  const [connectionTesting, setConnectionTesting] = useState(false);
  const [activeSection, setActiveSection] = useState<CasaHudWorkspaceSection>("campaigns");
  const [selectedListingId, setSelectedListingId] = useState<string | null>(null);
  const [scriptCopyNotice, setScriptCopyNotice] = useState<string | null>(null);

  const connectionCards = useMemo(() => buildCasaHudConnectionCards(connectionProviders), [connectionProviders]);
  const setupMessage = useMemo(() => getCasaHudSetupMessage(connectionCards), [connectionCards]);
  const activeConnectionCard = useMemo(
    () => connectionCards.find((card) => card.id === activeConnectionId) || null,
    [activeConnectionId, connectionCards],
  );
  const campaignCards = recentCampaigns.slice(0, 4);
  const hasRecentCampaigns = campaignCards.length > 0;
  const requiredConnections = connectionCards.filter((card) => card.required);
  const connectedRequiredConnections = requiredConnections.filter(
    (card) => card.status === "connected" || card.status === "partially_connected",
  ).length;
  const attentionConnectionCount = connectionCards.filter((card) => card.status === "needs_attention").length;
  const youtubeConnectionCard = connectionCards.find((card) => card.id === "youtube");
  const activeListings = useMemo(() => {
    if (!activeCampaign) return [];
    if (activeCampaign.approvedListings.length > 0) return activeCampaign.approvedListings;
    return activeCampaign.listingCandidates;
  }, [activeCampaign]);
  const selectedListing = useMemo(() => {
    if (!activeCampaign || !selectedListingId) return null;
    return (
      activeCampaign.approvedListings.find((listing) => listing.id === selectedListingId) ||
      activeCampaign.rejectedListings.find((listing) => listing.id === selectedListingId) ||
      activeCampaign.listingCandidates.find((listing) => listing.id === selectedListingId) ||
      null
    );
  }, [activeCampaign, selectedListingId]);
  const primaryAction = useMemo(() => getCampaignPrimaryAction(activeCampaign), [activeCampaign]);
  const readinessScore = useMemo(() => deriveReadinessScore(activeCampaign), [activeCampaign]);
  const truthfulnessStatus = useMemo(() => deriveTruthfulnessStatus(activeCampaign), [activeCampaign]);
  const visualReadiness = useMemo(() => deriveVisualReadiness(activeCampaign), [activeCampaign]);
  const commandProgress = useMemo(
    () => buildPhaseProgress(activeCampaign, youtubeConnectionCard?.status === "connected"),
    [activeCampaign, youtubeConnectionCard],
  );
  const sceneOutline = useMemo(() => buildSceneOutline(activeCampaign), [activeCampaign]);
  const youtubePackagePreview = useMemo(() => buildYouTubePackagePreview(activeCampaign), [activeCampaign]);
  const agentRows = useMemo(
    () =>
      buildAgentRows({
        campaign: activeCampaign,
        opportunityOutput,
        generationStatus,
        campaignDiscoveringId,
        campaignValidatingId,
        campaignLocatingId,
        campaignScriptingId,
        campaignMediaPlanningId,
        youtubeCard: youtubeConnectionCard,
      }),
    [
      activeCampaign,
      opportunityOutput,
      generationStatus,
      campaignDiscoveringId,
      campaignValidatingId,
      campaignLocatingId,
      campaignScriptingId,
      campaignMediaPlanningId,
      youtubeConnectionCard,
    ],
  );

  const loadConnectionStatus = useCallback(async () => {
    setConnectionStatus("loading");
    try {
      const response = await fetch("/api/studio/domara/integrations/status", {
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => null)) as CasaHudConnectionStatusPayload | null;
      if (!response.ok || !payload?.ok) {
        throw new Error("CasaHUD could not load connection status.");
      }

      const providers = payload.providers || [];
      setConnectionProviders(providers);
      setConnectionSaveSupported(payload.saveSupported !== false);
      setConnectionStatus("ready");
      return providers;
    } catch {
      setConnectionStatus("error");
      setConnectionNotice("CasaHUD could not check your connections. Open setup to try again.");
      return [];
    }
  }, []);

  const loadCampaigns = useCallback(async () => {
    try {
      const response = await fetch("/api/studio/domara/campaigns", {
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => null)) as CasaHudCampaignListPayload | null;
      if (!response.ok || !payload?.ok) {
        setRecentCampaigns([]);
        return [];
      }

      const campaigns = payload.campaigns || [];
      setRecentCampaigns(campaigns);
      return campaigns;
    } catch {
      setRecentCampaigns([]);
      return [];
    }
  }, []);

  useEffect(() => {
    void loadCampaigns();
  }, [loadCampaigns]);

  useEffect(() => {
    void loadConnectionStatus();
  }, [loadConnectionStatus]);

  useEffect(() => {
    if (generationStatus !== "loading" || progressIndex >= wizardSteps.length - 1) return;
    const timeoutId = window.setTimeout(() => {
      setProgressIndex((current) => Math.min(current + 1, wizardSteps.length - 1));
    }, 850);
    return () => window.clearTimeout(timeoutId);
  }, [generationStatus, progressIndex]);

  useEffect(() => {
    if (!campaignDiscoveringId || discoveryProgressIndex >= discoverySteps.length - 1) return;
    const timeoutId = window.setTimeout(() => {
      setDiscoveryProgressIndex((current) => Math.min(current + 1, discoverySteps.length - 1));
    }, 700);
    return () => window.clearTimeout(timeoutId);
  }, [campaignDiscoveringId, discoveryProgressIndex]);

  useEffect(() => {
    if (!campaignValidatingId || validationProgressIndex >= validationSteps.length - 1) return;
    const timeoutId = window.setTimeout(() => {
      setValidationProgressIndex((current) => Math.min(current + 1, validationSteps.length - 1));
    }, 650);
    return () => window.clearTimeout(timeoutId);
  }, [campaignValidatingId, validationProgressIndex]);

  useEffect(() => {
    if (!campaignLocatingId || locationProgressIndex >= locationSteps.length - 1) return;
    const timeoutId = window.setTimeout(() => {
      setLocationProgressIndex((current) => Math.min(current + 1, locationSteps.length - 1));
    }, 620);
    return () => window.clearTimeout(timeoutId);
  }, [campaignLocatingId, locationProgressIndex]);

  useEffect(() => {
    if (!campaignScriptingId || scriptProgressIndex >= scriptSteps.length - 1) return;
    const timeoutId = window.setTimeout(() => {
      setScriptProgressIndex((current) => Math.min(current + 1, scriptSteps.length - 1));
    }, 620);
    return () => window.clearTimeout(timeoutId);
  }, [campaignScriptingId, scriptProgressIndex]);

  useEffect(() => {
    if (!campaignMediaPlanningId || mediaProgressIndex >= mediaSteps.length - 1) return;
    const timeoutId = window.setTimeout(() => {
      setMediaProgressIndex((current) => Math.min(current + 1, mediaSteps.length - 1));
    }, 620);
    return () => window.clearTimeout(timeoutId);
  }, [campaignMediaPlanningId, mediaProgressIndex]);

  useEffect(() => {
    if (!selectedListingId || !activeCampaign) return;
    const listingStillExists =
      activeCampaign.approvedListings.some((listing) => listing.id === selectedListingId) ||
      activeCampaign.rejectedListings.some((listing) => listing.id === selectedListingId) ||
      activeCampaign.listingCandidates.some((listing) => listing.id === selectedListingId);
    if (!listingStillExists) {
      setSelectedListingId(null);
    }
  }, [activeCampaign, selectedListingId]);

  useEffect(() => {
    if (!selectedListingId) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSelectedListingId(null);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedListingId]);

  function openSetup(reason?: string, focusCardId?: CasaHudConnectionCardId, cardsOverride?: CasaHudConnectionCard[]) {
    setSetupReason(reason || setupMessage);
    setSetupOpen(true);
    setConnectionNotice(null);
    const availableCards = cardsOverride || connectionCards;
    const missingCards = getMissingCasaHudCoreConnections(availableCards);
    const targetCard =
      (focusCardId ? availableCards.find((card) => card.id === focusCardId) : null) ||
      missingCards[0] ||
      availableCards[0];
    if (targetCard) {
      setActiveConnectionId(targetCard.id);
      setActiveProviderId(defaultProviderForCard(targetCard, connectionProviders));
    }
  }

  function openConnectionCard(card: CasaHudConnectionCard) {
    setActiveConnectionId(card.id);
    setActiveProviderId(defaultProviderForCard(card, connectionProviders));
    setConnectionSecret("");
    setConnectionNotice(null);
  }

  async function onSaveConnection() {
    const activeCard = activeConnectionCard;
    if (!activeCard) return;
    if (!connectionSaveSupported) {
      setConnectionNotice("This workspace cannot save new connections here yet. Existing connected services can still be used.");
      return;
    }
    if (!connectionSecret.trim()) {
      setConnectionNotice(`Add the connection key for ${providerOptionLabels[activeProviderId]} before saving.`);
      return;
    }

    try {
      setConnectionSaving(true);
      setConnectionNotice(null);
      const response = await fetch(`/api/studio/domara/integrations/${encodeURIComponent(activeProviderId)}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          connectionKey: connectionSecret,
        }),
      });
      const payload = (await response.json().catch(() => null)) as CasaHudConnectionSavePayload | null;
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error?.message || "CasaHUD could not save this connection.");
      }
      setConnectionSecret("");
      setConnectionNotice(`${providerOptionLabels[activeProviderId]} is connected.`);
      await loadConnectionStatus();
    } catch (error) {
      setConnectionNotice(error instanceof Error ? error.message : "CasaHUD could not save this connection.");
    } finally {
      setConnectionSaving(false);
    }
  }

  async function onTestConnection() {
    if (!activeConnectionCard) return;

    try {
      setConnectionTesting(true);
      setConnectionNotice(null);
      const response = await fetch(`/api/studio/domara/integrations/${encodeURIComponent(activeProviderId)}/test`, {
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; message?: string; error?: { message?: string } }
        | null;
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error?.message || "CasaHUD could not verify this connection.");
      }
      setConnectionNotice(payload.message || `${providerOptionLabels[activeProviderId]} looks ready.`);
      await loadConnectionStatus();
    } catch (error) {
      setConnectionNotice(error instanceof Error ? error.message : "CasaHUD could not verify this connection.");
    } finally {
      setConnectionTesting(false);
    }
  }

  async function onGenerateViralVideo() {
    try {
      setGenerationStatus("loading");
      setGenerationError(null);
      setCampaignError(null);
      setCampaignNotice(null);
      setOpportunityOutput(null);
      setProgressIndex(0);
      setActiveSection("viral_titles");

      const response = await fetch("/api/studio/domara/opportunity", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          preferredMarket: "Italian real-estate YouTube",
        }),
      });
      const payload = (await response.json().catch(() => null)) as CasaHudOpportunityPayload | null;

      if (!response.ok || !payload?.ok || !payload.output) {
        throw new Error(payload?.error?.message || "CasaHUD could not generate title opportunities right now.");
      }

      setOpportunityOutput(payload.output);
      setProgressIndex(wizardSteps.length - 1);
      setGenerationStatus("ready");
    } catch (error) {
      setGenerationStatus("error");
      setGenerationError(error instanceof Error ? error.message : "CasaHUD could not generate title opportunities right now.");
    }
  }

  async function onCreateCampaign() {
    if (!opportunityOutput) return;

    try {
      setCampaignCreating(true);
      setCampaignError(null);
      setCampaignNotice(null);

      const response = await fetch("/api/studio/domara/campaigns", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          opportunity: opportunityOutput,
        }),
      });
      const payload = (await response.json().catch(() => null)) as CasaHudCampaignCreatePayload | null;
      if (!response.ok || !payload?.ok || !payload.campaign) {
        throw new Error(payload?.error?.message || "CasaHUD could not save this campaign right now.");
      }

      setActiveCampaign(payload.campaign);
      setActiveSection("campaigns");
      setOpportunityOutput(null);
      setCampaignNotice(payload.message || `Campaign saved. "${payload.campaign.name}" is ready for Property Discovery.`);
      setRecentCampaigns((current) => {
        const summary = payload.summary || summarizeCampaign(payload.campaign!);
        return [summary, ...current.filter((campaign) => campaign.id !== summary.id)];
      });
    } catch (error) {
      setCampaignError(error instanceof Error ? error.message : "CasaHUD could not save this campaign right now.");
    } finally {
      setCampaignCreating(false);
    }
  }

  async function onResumeCampaign(campaignId: string) {
    try {
      setCampaignOpeningId(campaignId);
      setCampaignError(null);
      setCampaignNotice(null);

      const response = await fetch(`/api/studio/domara/campaigns/${encodeURIComponent(campaignId)}`, {
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => null)) as CasaHudCampaignDetailPayload | null;
      if (!response.ok || !payload?.ok || !payload.campaign) {
        throw new Error(payload?.error?.message || "CasaHUD could not reopen this campaign right now.");
      }

      setOpportunityOutput(null);
      setActiveCampaign(payload.campaign);
      setActiveSection("campaigns");
      setCampaignNotice(`Resumed "${payload.campaign.name}".`);
    } catch (error) {
      setCampaignError(error instanceof Error ? error.message : "CasaHUD could not reopen this campaign right now.");
    } finally {
      setCampaignOpeningId(null);
    }
  }

  async function onDiscoverListings() {
    if (!activeCampaign) return;

    try {
      setCampaignDiscoveringId(activeCampaign.id);
      setDiscoveryProgressIndex(0);
      setCampaignError(null);
      setCampaignNotice(null);
      setActiveSection("property_shortlist");

      const response = await fetch(`/api/studio/domara/campaigns/${encodeURIComponent(activeCampaign.id)}/discover-listings`, {
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as CasaHudListingDiscoveryPayload | null;
      if (!response.ok || !payload?.ok || !payload.campaign) {
        throw new Error(payload?.error?.message || "CasaHUD could not discover listings right now.");
      }

      setActiveCampaign(payload.campaign);
      setCampaignNotice(payload.message || `Property discovery complete. "${payload.campaign.name}" is ready for listing validation.`);
      setRecentCampaigns((current) => {
        const summary = payload.summary || summarizeCampaign(payload.campaign!);
        return [summary, ...current.filter((campaign) => campaign.id !== summary.id)];
      });
      setDiscoveryProgressIndex(discoverySteps.length - 1);
    } catch (error) {
      setCampaignError(error instanceof Error ? error.message : "CasaHUD could not discover listings right now.");
    } finally {
      setCampaignDiscoveringId(null);
    }
  }

  async function onValidateListings() {
    if (!activeCampaign) return;

    try {
      setCampaignValidatingId(activeCampaign.id);
      setValidationProgressIndex(0);
      setCampaignError(null);
      setCampaignNotice(null);
      setActiveSection("property_shortlist");

      const response = await fetch(`/api/studio/domara/campaigns/${encodeURIComponent(activeCampaign.id)}/validate-listings`, {
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as CasaHudListingValidationPayload | null;
      if (!response.ok || !payload?.ok || !payload.campaign) {
        throw new Error(payload?.error?.message || "CasaHUD could not validate listings right now.");
      }

      setActiveCampaign(payload.campaign);
      setCampaignNotice(payload.message || `Listing validation complete. "${payload.campaign.name}" is ready for Location Intelligence.`);
      setRecentCampaigns((current) => {
        const summary = payload.summary || summarizeCampaign(payload.campaign!);
        return [summary, ...current.filter((campaign) => campaign.id !== summary.id)];
      });
      setValidationProgressIndex(validationSteps.length - 1);
    } catch (error) {
      setCampaignError(error instanceof Error ? error.message : "CasaHUD could not validate listings right now.");
    } finally {
      setCampaignValidatingId(null);
    }
  }

  async function onAddLocationIntelligence() {
    if (!activeCampaign) return;

    try {
      setCampaignLocatingId(activeCampaign.id);
      setLocationProgressIndex(0);
      setCampaignError(null);
      setCampaignNotice(null);
      setActiveSection("location_intelligence");

      const response = await fetch(`/api/studio/domara/campaigns/${encodeURIComponent(activeCampaign.id)}/location-intelligence`, {
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as CasaHudLocationIntelligencePayload | null;
      if (!response.ok || !payload?.ok || !payload.campaign) {
        throw new Error(payload?.error?.message || "CasaHUD could not build location intelligence right now.");
      }

      setActiveCampaign(payload.campaign);
      setCampaignNotice(payload.message || `Location intelligence complete. "${payload.campaign.name}" now includes place story, POIs, and map scene ideas.`);
      setRecentCampaigns((current) => {
        const summary = payload.summary || summarizeCampaign(payload.campaign!);
        return [summary, ...current.filter((campaign) => campaign.id !== summary.id)];
      });
      setLocationProgressIndex(locationSteps.length - 1);
    } catch (error) {
      setCampaignError(error instanceof Error ? error.message : "CasaHUD could not build location intelligence right now.");
    } finally {
      setCampaignLocatingId(null);
    }
  }

  async function onGenerateScript() {
    if (!activeCampaign) return;

    try {
      setCampaignScriptingId(activeCampaign.id);
      setScriptProgressIndex(0);
      setCampaignError(null);
      setCampaignNotice(null);
      setActiveSection("script_studio");

      const response = await fetch(`/api/studio/domara/campaigns/${encodeURIComponent(activeCampaign.id)}/script`, {
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as CasaHudScriptNarrativePayload | null;
      if (!response.ok || !payload?.ok || !payload.campaign) {
        throw new Error(payload?.error?.message || "CasaHUD could not generate the script right now.");
      }

      setActiveCampaign(payload.campaign);
      setCampaignNotice(payload.message || `Script ready. "${payload.campaign.name}" now includes the review-ready narrative package.`);
      setRecentCampaigns((current) => {
        const summary = payload.summary || summarizeCampaign(payload.campaign!);
        return [summary, ...current.filter((campaign) => campaign.id !== summary.id)];
      });
      setScriptProgressIndex(scriptSteps.length - 1);
    } catch (error) {
      setCampaignError(error instanceof Error ? error.message : "CasaHUD could not generate the script right now.");
    } finally {
      setCampaignScriptingId(null);
    }
  }

  async function onBuildMediaPlan() {
    if (!activeCampaign) return;

    try {
      setCampaignMediaPlanningId(activeCampaign.id);
      setMediaProgressIndex(0);
      setCampaignError(null);
      setCampaignNotice(null);
      setActiveSection("media_library");

      const response = await fetch(`/api/studio/domara/campaigns/${encodeURIComponent(activeCampaign.id)}/media-plan`, {
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as CasaHudMediaPlanPayload | null;
      if (!response.ok || !payload?.ok || !payload.campaign) {
        throw new Error(payload?.error?.message || "CasaHUD could not assemble the visual plan right now.");
      }

      setActiveCampaign(payload.campaign);
      setCampaignNotice(payload.message || `Media plan ready. "${payload.campaign.name}" now includes the visual production package.`);
      setRecentCampaigns((current) => {
        const summary = payload.summary || summarizeCampaign(payload.campaign!);
        return [summary, ...current.filter((campaign) => campaign.id !== summary.id)];
      });
      setMediaProgressIndex(mediaSteps.length - 1);
    } catch (error) {
      setCampaignError(error instanceof Error ? error.message : "CasaHUD could not assemble the visual plan right now.");
    } finally {
      setCampaignMediaPlanningId(null);
    }
  }

  async function onCopyScript() {
    if (!activeCampaign?.fullScriptText || typeof navigator === "undefined" || !navigator.clipboard) {
      setScriptCopyNotice("Copy Script is unavailable in this browser session.");
      return;
    }

    try {
      await navigator.clipboard.writeText(activeCampaign.fullScriptText);
      setScriptCopyNotice("Script copied.");
    } catch {
      setScriptCopyNotice("CasaHUD could not copy the script right now.");
    }
  }

  const connectionSummary =
    connectionStatus === "loading"
      ? "Checking connection readiness for CasaHUD."
      : connectionStatus === "error"
        ? "Connection status needs attention. Open Connections to refresh and verify services."
        : attentionConnectionCount > 0
          ? `${attentionConnectionCount} connection${attentionConnectionCount === 1 ? "" : "s"} needs attention.`
          : `${connectedRequiredConnections} of ${requiredConnections.length} required services are ready.`;

  let sectionContent: ReactNode = null;

  if (activeSection === "campaigns") {
    sectionContent = (
      <WorkspaceCard
        eyebrow="Campaigns"
        title="Campaigns"
        description="Create, resume, and review CasaHUD video campaigns."
        actions={
          <>
            <button
              type="button"
              className="rounded-2xl border border-[#172033] bg-[#172033] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#26324B] disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => void onGenerateViralVideo()}
              disabled={generationStatus === "loading"}
              data-testid="casahud-generate-cta"
            >
              {generationStatus === "loading" ? "Generating Viral Video Title..." : "Generate Viral Video Title"}
            </button>
            {hasRecentCampaigns ? (
              <button
                type="button"
                className="rounded-2xl border border-[#D7CAB8] bg-white px-4 py-3 text-sm font-semibold text-[#172033]"
                onClick={() => {
                  const campaign = campaignCards[0];
                  if (campaign) {
                    void onResumeCampaign(campaign.id);
                  }
                }}
              >
                Recent Campaigns
              </button>
            ) : null}
          </>
        }
        testId="casahud-workspace"
      >
        {campaignNotice ? (
          <div
            className="mb-4 rounded-2xl border border-[#C6DFC9] bg-[#F2FBF3] px-4 py-3 text-sm text-[#0F5132]"
            data-testid="casahud-campaign-create-success"
          >
            {campaignNotice}
          </div>
        ) : null}

        {campaignError ? (
          <div className="mb-4 rounded-2xl border border-[#E9C4A5] bg-[#FFF5DA] px-4 py-3 text-sm text-[#7A4B13]">{campaignError}</div>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <section
            className="rounded-[1.45rem] border border-[#E7DCCB] bg-[linear-gradient(150deg,rgba(255,249,239,0.95),rgba(255,255,255,0.9))] p-5"
            data-testid="casahud-campaign-detail"
          >
            {activeCampaign ? (
              <div data-testid="casahud-command-header">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8A5A34]">Current campaign</p>
                    <h3 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-[#172033]">{activeCampaign.name}</h3>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <StatusPill tone="neutral">{formatOpportunityCampaignType(activeCampaign.campaignType)}</StatusPill>
                      {activeCampaign.marketRegionHint ? <StatusPill tone="neutral">{activeCampaign.marketRegionHint}</StatusPill> : null}
                      <StatusPill tone="gold">{formatCampaignStatus(activeCampaign.status)}</StatusPill>
                    </div>
                  </div>

                  <div className="min-w-[210px] rounded-[1.2rem] border border-[#E3D6C2] bg-white/80 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7A897E]">Next action</p>
                    <p className="mt-2 text-sm font-semibold text-[#172033]">{primaryAction.label}</p>
                    <p className="mt-2 text-sm leading-6 text-[#526070]">Next: {activeCampaign.nextPhase.label}</p>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-3">
                  <div className="rounded-[1.2rem] border border-[#E7DCCB] bg-white/85 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7A897E]">Opportunity</p>
                    <p className="mt-2 text-sm leading-6 text-[#526070]">{activeCampaign.researchBrief.summary}</p>
                  </div>
                  <div className="rounded-[1.2rem] border border-[#E7DCCB] bg-white/85 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7A897E]">Title</p>
                    <p className="mt-2 text-sm font-semibold text-[#172033]">{activeCampaign.selectedViralTitle}</p>
                  </div>
                  <div className="rounded-[1.2rem] border border-[#E7DCCB] bg-white/85 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7A897E]">Readiness</p>
                    <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[#172033]">{readinessScore}</p>
                    <p className="mt-1 text-sm text-[#526070]">{primaryAction.helper}</p>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-3">
                  {activeCampaign.nextPhase.key === "property_discovery" ? (
                    <button
                      type="button"
                      className="rounded-2xl border border-[#172033] bg-[#172033] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#26324B] disabled:cursor-not-allowed disabled:opacity-60"
                      onClick={() => void onDiscoverListings()}
                      disabled={campaignDiscoveringId === activeCampaign.id}
                      data-testid="casahud-discover-listings-cta"
                    >
                      {campaignDiscoveringId === activeCampaign.id ? "Finding Matching Properties..." : "Find Matching Properties"}
                    </button>
                  ) : activeCampaign.nextPhase.key === "listing_validation" ? (
                    <button
                      type="button"
                      className="rounded-2xl border border-[#172033] bg-[#172033] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#26324B] disabled:cursor-not-allowed disabled:opacity-60"
                      onClick={() => void onValidateListings()}
                      disabled={campaignValidatingId === activeCampaign.id}
                      data-testid="casahud-validate-listings-cta"
                    >
                      {campaignValidatingId === activeCampaign.id ? "Validating Listings..." : "Validate and Rank Listings"}
                    </button>
                  ) : activeCampaign.nextPhase.key === "location_intelligence" ? (
                    <button
                      type="button"
                      className="rounded-2xl border border-[#172033] bg-[#172033] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#26324B] disabled:cursor-not-allowed disabled:opacity-60"
                      onClick={() => void onAddLocationIntelligence()}
                      disabled={campaignLocatingId === activeCampaign.id}
                      data-testid="casahud-location-intelligence-cta"
                    >
                      {campaignLocatingId === activeCampaign.id ? "Building Location Story..." : "Add Location Intelligence"}
                    </button>
                  ) : activeCampaign.nextPhase.key === "script_narrative_generation" ? (
                    <button
                      type="button"
                      className="rounded-2xl border border-[#172033] bg-[#172033] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#26324B] disabled:cursor-not-allowed disabled:opacity-60"
                      onClick={() => void onGenerateScript()}
                      disabled={campaignScriptingId === activeCampaign.id}
                      data-testid="casahud-generate-script-cta"
                    >
                      {campaignScriptingId === activeCampaign.id ? "Generating Script..." : "Generate Script"}
                    </button>
                  ) : activeCampaign.nextPhase.key === "media_planning_asset_assembly" ? (
                    <button
                      type="button"
                      className="rounded-2xl border border-[#172033] bg-[#172033] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#26324B] disabled:cursor-not-allowed disabled:opacity-60"
                      onClick={() => void onBuildMediaPlan()}
                      disabled={campaignMediaPlanningId === activeCampaign.id}
                      data-testid="casahud-build-media-plan-cta"
                    >
                      {campaignMediaPlanningId === activeCampaign.id ? "Building Media Plan..." : "Build Media Plan"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="rounded-2xl border border-[#D4DDF2] bg-[#F7FAFF] px-4 py-3 text-sm font-semibold text-[#41608E]"
                      onClick={() => setActiveSection("review_package")}
                      data-testid="casahud-media-planning-placeholder"
                    >
                      {activeCampaign.nextPhase.label}
                    </button>
                  )}
                  <button
                    type="button"
                    className="rounded-2xl border border-[#D7CAB8] bg-white px-4 py-3 text-sm font-semibold text-[#172033]"
                    onClick={() => setActiveSection("review_package")}
                  >
                    Review Package
                  </button>
                </div>
              </div>
            ) : (
              <EmptyState
                title="No active campaign yet"
                description="Generate your first viral property video title to start a CasaHUD campaign."
              />
            )}
          </section>

          <section className="grid gap-4">
            <div className="rounded-[1.45rem] border border-[#DDE6DA] bg-[#F5F8F2] p-5" data-testid="casahud-campaign-intelligence">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6C7B6D]">Workflow</p>
                  <h3 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-[#172033]">Opportunity → Properties → Story → Publish</h3>
                </div>
                <StatusPill tone={truthfulnessStatus.tone}>{truthfulnessStatus.headline}</StatusPill>
              </div>

              <div className="mt-4 grid gap-2">
                {commandProgress.slice(0, 8).map((step) => (
                  <div key={step.id} className="grid grid-cols-[110px_1fr_auto] items-center gap-3 rounded-2xl border border-[#DDE6DA] bg-white/80 px-3 py-2">
                    <p className="text-sm font-medium text-[#172033]">{step.label}</p>
                    <div className="h-1.5 rounded-full bg-[#E8EBE5]">
                      <div
                        className={cx(
                          "h-1.5 rounded-full",
                          step.status === "complete"
                            ? "bg-[#233047]"
                            : step.status === "current"
                              ? "bg-[#B37A4C]"
                              : step.status === "blocked"
                                ? "bg-[#B84C4C]"
                                : "bg-[#D6DCD3]",
                        )}
                        style={{ width: step.status === "complete" ? "100%" : step.status === "current" ? "62%" : step.status === "blocked" ? "44%" : "18%" }}
                      />
                    </div>
                    <StatusPill tone={phaseTone(step.status)} className="px-2 py-0.5">
                      {formatCampaignStatus(step.status)}
                    </StatusPill>
                  </div>
                ))}
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl border border-[#DDE6DA] bg-white/80 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7A897E]">Provider health</p>
                  <p className="mt-2 text-sm text-[#526070]">{connectionSummary}</p>
                </div>
                <div className="rounded-2xl border border-[#DDE6DA] bg-white/80 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7A897E]">Visual readiness</p>
                  <p className="mt-2 text-sm font-semibold text-[#172033]">{visualReadiness.headline}</p>
                  <p className="mt-2 text-sm text-[#526070]">{visualReadiness.detail}</p>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-[#DDE6DA] bg-white/80 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7A897E]">Agent Activity</p>
                  <StatusPill tone="neutral">{agentRows.filter((row) => row.state === "complete").length} complete</StatusPill>
                </div>
                <div className="mt-3 grid gap-2">
                  {agentRows.slice(0, 4).map((row) => (
                    <div key={row.name} className="flex items-center justify-between gap-3 rounded-xl border border-[#E7ECE5] bg-[#FCFDFB] px-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-[#172033]">{row.name}</p>
                        <p className="truncate text-xs text-[#6A7687]">{row.detail}</p>
                      </div>
                      <StatusPill tone={operationalTone(row.state)} className="px-2 py-0.5">
                        {formatCampaignStatus(row.state)}
                      </StatusPill>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-[#DDE6DA] bg-white/80 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7A897E]">Story status</p>
                <p className="mt-2 text-sm text-[#526070]">
                  {activeCampaign?.scriptSummary ||
                    activeCampaign?.locationIntelligenceSummary?.headline ||
                    activeCampaign?.listingValidationSummary?.headline ||
                    "Generate a title to open the full CasaHUD workflow."}
                </p>
              </div>
            </div>

            <div className="rounded-[1.45rem] border border-[#E7DCCB] bg-white p-5" data-testid="casahud-recent-campaigns">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8A5A34]">Recent Campaigns</p>
                  <h3 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-[#172033]">Resume where you left off</h3>
                </div>
                {hasRecentCampaigns ? <StatusPill tone="neutral">{campaignCards.length}</StatusPill> : null}
              </div>

              {hasRecentCampaigns ? (
                <div className="mt-4 grid gap-3">
                  {campaignCards.map((campaign) => (
                    <article
                      key={campaign.id}
                      className="rounded-[1.2rem] border border-[#E7DCCB] bg-[#FFFCF6] p-4"
                      data-testid="casahud-campaign-card"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-base font-semibold tracking-[-0.02em] text-[#172033]">{campaign.name}</p>
                          <p className="mt-1 text-sm text-[#526070]">
                            {formatOpportunityCampaignType(campaign.campaignType)} · Updated {formatCampaignTime(campaign.updatedAt || campaign.createdAt)}
                          </p>
                          <p className="mt-2 text-sm leading-6 text-[#526070]">
                            {campaign.scriptSummary ||
                              campaign.locationSummary ||
                              campaign.validationSummary ||
                              campaign.discoverySummary ||
                              campaign.researchSummary}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <StatusPill tone="gold">{formatCampaignStatus(campaign.status)}</StatusPill>
                          <button
                            type="button"
                            className="rounded-2xl border border-[#172033] bg-[#172033] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#26324B] disabled:cursor-not-allowed disabled:opacity-60"
                            onClick={() => void onResumeCampaign(campaign.id)}
                            disabled={campaignOpeningId === campaign.id}
                            data-testid="casahud-resume-campaign"
                          >
                            {campaignOpeningId === campaign.id ? "Opening..." : "Resume"}
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div data-testid="casahud-empty-campaigns" className="mt-4">
                  <EmptyState
                    title="No campaigns yet."
                    description="Generate your first viral property video title to start a CasaHUD campaign."
                  />
                </div>
              )}
            </div>
          </section>
        </div>
      </WorkspaceCard>
    );
  }

  if (activeSection === "viral_titles") {
    const titleSource = opportunityOutput
      ? opportunityOutput
      : activeCampaign
        ? {
            selectedTitle: activeCampaign.selectedTitle,
            titleCandidates: activeCampaign.titleCandidates,
            confidenceSummary: activeCampaign.confidenceReasoning.summary,
            titleOpportunitySummary: activeCampaign.confidenceReasoning.titleOpportunitySummary,
            researchBrief: activeCampaign.researchBrief,
            campaignTypePrediction: activeCampaign.campaignType,
            providerStatus: activeCampaign.generationSource,
          }
        : null;

    const winningTitleCandidate =
      titleSource?.titleCandidates.find((candidate) => candidate.title === titleSource.selectedTitle.title) || null;

    sectionContent = titleSource ? (
      <WorkspaceCard
        eyebrow="Viral Titles"
        title="Selected winning title"
        description="CasaHUD keeps the title strategy reviewable instead of hiding it behind internal workflow steps."
        actions={
          <>
            {opportunityOutput ? (
              <button
                type="button"
                className="rounded-2xl border border-[#172033] bg-[#172033] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#26324B] disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => void onCreateCampaign()}
                disabled={campaignCreating}
                data-testid="casahud-create-campaign-cta"
              >
                {campaignCreating ? "Creating Campaign..." : "Create Campaign"}
              </button>
            ) : (
              <button
                type="button"
                className="rounded-2xl border border-[#D7CAB8] bg-[#F8F3EA] px-4 py-3 text-sm font-semibold text-[#7A897E]"
                disabled
              >
                Use as Campaign Title
              </button>
            )}
            <button
              type="button"
              className="rounded-2xl border border-[#D7CAB8] bg-white px-4 py-3 text-sm font-semibold text-[#172033]"
              onClick={() => void onGenerateViralVideo()}
            >
              Regenerate Titles
            </button>
          </>
        }
        testId="casahud-opportunity-results"
      >
        <div className="grid gap-5 lg:grid-cols-[1.06fr_0.94fr]">
          <section
            className="rounded-[1.75rem] border border-[#E4D7C2] bg-[linear-gradient(160deg,rgba(255,249,239,0.92),rgba(255,255,255,0.86))] p-5 shadow-sm"
            data-testid="casahud-winning-title"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8A5A34]">Winning Title</p>
            <h3 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-[#172033]">{titleSource.selectedTitle.title}</h3>
            <div className="mt-4 flex flex-wrap gap-2">
              <StatusPill tone="neutral">{formatOpportunityCampaignType(titleSource.selectedTitle.campaignType)}</StatusPill>
              <StatusPill tone="blue">Score {titleSource.selectedTitle.score}</StatusPill>
              <StatusPill tone="gold">{Math.round(titleSource.selectedTitle.confidence * 100)}% confidence</StatusPill>
              {titleSource.selectedTitle.regionHint ? <StatusPill tone="neutral">{titleSource.selectedTitle.regionHint}</StatusPill> : null}
            </div>
            <p className="mt-5 text-sm leading-6 text-[#526070]">{titleSource.titleOpportunitySummary}</p>
            <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3">
              {winningTitleCandidate ? <StatusPill tone="neutral">CTR {winningTitleCandidate.ctrPotential}</StatusPill> : null}
              {winningTitleCandidate ? <StatusPill tone="neutral">Search {winningTitleCandidate.searchAppeal}</StatusPill> : null}
              {winningTitleCandidate ? <StatusPill tone="neutral">Novelty {winningTitleCandidate.novelty}</StatusPill> : null}
              {winningTitleCandidate ? <StatusPill tone="neutral">Realism {winningTitleCandidate.realism}</StatusPill> : null}
              {winningTitleCandidate ? <StatusPill tone="neutral">Listing fit {winningTitleCandidate.listingAvailability}</StatusPill> : null}
              {winningTitleCandidate ? <StatusPill tone="neutral">Channel fit {winningTitleCandidate.channelFit}</StatusPill> : null}
            </div>
          </section>

          <section className="rounded-[1.75rem] border border-[#D8E2D9] bg-[#F7FAF8] p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#6C7B6D]">Why this title was chosen</p>
            <p className="mt-3 text-sm leading-7 text-[#344256]">{titleSource.selectedTitle.reasoning}</p>
            <div className="mt-4 rounded-2xl border border-[#D8E2D9] bg-white/80 p-4">
              <p className="text-sm font-semibold text-[#172033]">Confidence summary</p>
              <p className="mt-2 text-sm leading-6 text-[#526070]">{titleSource.confidenceSummary}</p>
            </div>
            <div className="mt-4 rounded-2xl border border-[#D8E2D9] bg-white/80 p-4">
              <p className="text-sm font-semibold text-[#172033]">Research summary</p>
              <p className="mt-2 text-sm leading-6 text-[#526070]">{titleSource.researchBrief.summary}</p>
            </div>
          </section>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-[1.06fr_0.94fr]">
          <section>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8A5A34]">Title Candidates</p>
                <h3 className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-[#172033]">Ranked concepts</h3>
              </div>
              <StatusPill tone="neutral">{formatCountLabel(titleSource.titleCandidates.length, "candidate")}</StatusPill>
            </div>
            <div className="mt-4 grid gap-3">
              {titleSource.titleCandidates.map((candidate: CasaHudOpportunityTitleCandidate, index: number) => (
                <article
                  key={candidate.id}
                  className="rounded-3xl border border-[#E4D7C2] bg-white/[0.88] p-4 shadow-sm"
                  data-testid="casahud-candidate-card"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusPill tone="ink">#{index + 1}</StatusPill>
                        <StatusPill tone="neutral">{formatOpportunityCampaignType(candidate.campaignType)}</StatusPill>
                        {candidate.regionHint ? <StatusPill tone="neutral">{candidate.regionHint}</StatusPill> : null}
                      </div>
                      <h4 className="mt-3 text-lg font-semibold tracking-[-0.02em] text-[#172033]">{candidate.title}</h4>
                    </div>
                    <StatusPill tone="blue">{candidate.score}</StatusPill>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-[#526070]">{candidate.reasoning}</p>
                </article>
              ))}
            </div>
          </section>

          <aside className="grid gap-4">
            <section className="rounded-[1.75rem] border border-[#E4D7C2] bg-[#FFF9EF] p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8A5A34]">Research Brief</p>
              <div className="mt-4 grid gap-3 text-sm leading-6 text-[#526070]">
                <p>{titleSource.researchBrief.summary}</p>
                <p>
                  <span className="font-semibold text-[#172033]">Opportunity categories:</span>{" "}
                  {titleSource.researchBrief.opportunityCategories.join(" · ")}
                </p>
                <p>
                  <span className="font-semibold text-[#172033]">Competitor patterns:</span>{" "}
                  {titleSource.researchBrief.competitorPatterns.join(" · ")}
                </p>
                <p>
                  <span className="font-semibold text-[#172033]">Risk notes:</span> {titleSource.researchBrief.riskNotes.join(" · ")}
                </p>
              </div>
            </section>

            <section className="rounded-[1.75rem] border border-[#D8E2D9] bg-white/90 p-5 shadow-sm" data-testid="casahud-next-step">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#6C7B6D]">Selected Campaign Name</p>
              <h3 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[#172033]">{titleSource.selectedTitle.title}</h3>
              <p className="mt-3 text-sm leading-6 text-[#526070]">
                The selected viral title becomes the campaign name and drives the full command-center package.
              </p>
              <p className="mt-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#8A5A34]">
                Campaign name: {titleSource.selectedTitle.title}
              </p>
              {campaignError ? (
                <p
                  className="mt-4 rounded-2xl border border-[#D8B26A] bg-[#FFF5DA] p-4 text-sm text-[#7A4B13]"
                  data-testid="casahud-campaign-create-error"
                >
                  {campaignError}
                </p>
              ) : null}
            </section>
          </aside>
        </div>
      </WorkspaceCard>
    ) : (
      <WorkspaceCard
        eyebrow="Viral Titles"
        title="No title package yet"
        description="Generate the next opportunity to unlock title strategy, scoring, and research review."
      >
        <EmptyState
          title="Generate the next title package"
          description="CasaHUD will surface a dominant title, ranked alternatives, and the research brief that supports the campaign direction."
          action={
            <button
              type="button"
              className="rounded-2xl border border-[#172033] bg-[#172033] px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_34px_rgba(23,32,51,0.2)] transition hover:bg-[#26324B]"
              onClick={() => void onGenerateViralVideo()}
            >
              Generate Viral Video Title
            </button>
          }
        />
      </WorkspaceCard>
    );
  }

  if (activeSection === "property_shortlist") {
    sectionContent = (
      <WorkspaceCard
        eyebrow="Property Shortlist"
        title="Property Shortlist"
        description="Image-first listing cards, compact filters, and title-fit reasoning."
        actions={
          activeCampaign?.nextPhase.key === "property_discovery" ? (
            <button
              type="button"
              className="rounded-2xl border border-[#172033] bg-[#172033] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#26324B] disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => void onDiscoverListings()}
              disabled={campaignDiscoveringId === activeCampaign.id}
              data-testid="casahud-discover-listings-cta"
            >
              {campaignDiscoveringId === activeCampaign.id ? "Finding Matching Properties..." : "Find Matching Properties"}
            </button>
          ) : activeCampaign?.nextPhase.key === "listing_validation" ? (
            <button
              type="button"
              className="rounded-2xl border border-[#172033] bg-[#172033] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#26324B] disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => void onValidateListings()}
              disabled={campaignValidatingId === activeCampaign.id}
              data-testid="casahud-validate-listings-cta"
            >
              {campaignValidatingId === activeCampaign.id ? "Validating Listings..." : "Validate and Rank Listings"}
            </button>
          ) : activeCampaign?.nextPhase.key === "location_intelligence" ? (
            <button
              type="button"
              className="rounded-2xl border border-[#172033] bg-[#172033] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#26324B] disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => void onAddLocationIntelligence()}
              disabled={campaignLocatingId === activeCampaign.id}
              data-testid="casahud-location-intelligence-cta"
            >
              {campaignLocatingId === activeCampaign.id ? "Building Location Story..." : "Add Location Intelligence"}
            </button>
          ) : null
        }
        testId="casahud-property-shortlist"
      >
        {campaignDiscoveringId === activeCampaign?.id
          ? renderProgressList(discoverySteps, discoveryProgressIndex, "loading", "casahud-discovery-progress")
          : null}
        {campaignValidatingId === activeCampaign?.id
          ? <div className="mt-4">{renderProgressList(validationSteps, validationProgressIndex, "loading", "casahud-validation-progress")}</div>
          : null}

        {activeCampaign ? (
          <div data-testid="casahud-listing-candidates">
            <div
              className="mb-5 grid gap-3 rounded-[1.35rem] border border-[#E7DCCB] bg-[#FFFCF6] p-4 lg:grid-cols-[1.3fr_repeat(4,minmax(0,1fr))_160px]"
              data-testid="casahud-shortlist-toolbar"
            >
              <label className="flex items-center rounded-2xl border border-[#E7DCCB] bg-white px-3 py-2">
                <span className="sr-only">Search listings</span>
                <input
                  type="search"
                  placeholder="Search listings"
                  className="w-full bg-transparent text-sm text-[#172033] outline-none placeholder:text-[#7A897E]"
                />
              </label>
              <div className="rounded-2xl border border-[#E7DCCB] bg-white px-3 py-2 text-sm text-[#526070]">Location</div>
              <div className="rounded-2xl border border-[#E7DCCB] bg-white px-3 py-2 text-sm text-[#526070]">Max price</div>
              <div className="rounded-2xl border border-[#E7DCCB] bg-white px-3 py-2 text-sm text-[#526070]">Property type</div>
              <div className="rounded-2xl border border-[#E7DCCB] bg-white px-3 py-2 text-sm text-[#526070]">More filters</div>
              <div className="rounded-2xl border border-[#E7DCCB] bg-white px-3 py-2 text-sm text-[#526070]">Sort: Match</div>
            </div>

            {activeCampaign.listingValidationSummary ? (
              <div className="mb-5 rounded-[1.6rem] border border-[#D8E2D9] bg-[#F4FAF5] p-5" data-testid="casahud-validation-summary">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[#172033]">{activeCampaign.listingValidationSummary.headline}</p>
                    <p className="mt-2 text-sm leading-6 text-[#526070]">{activeCampaign.listingValidationSummary.rankingExplanation}</p>
                    <p className="mt-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#6C7B6D]">
                      Title support confidence: {formatSupportConfidence(activeCampaign.titleSupportConfidence)}
                    </p>
                  </div>
                  <StatusPill tone="blue">{formatSupportConfidence(activeCampaign.titleSupportConfidence)} support</StatusPill>
                </div>
              </div>
            ) : null}

            {activeCampaign.nextPhase ? (
              <p className="mb-5 text-xs font-semibold uppercase tracking-[0.12em] text-[#8A5A34]">
                Next: {activeCampaign.nextPhase.label}
              </p>
            ) : null}

            {activeListings.length > 0 ? (
              <div className="grid gap-5 xl:grid-cols-2">
                {activeListings.map((listing, index) => (
                  <div
                    key={listing.id}
                    data-testid={
                      activeCampaign.approvedListings.length > 0 ? "casahud-approved-listing-card" : "casahud-listing-candidate-card"
                    }
                  >
                    <PropertyCard campaign={activeCampaign} listing={listing} index={index} onSelect={setSelectedListingId} />
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                title="No property shortlist yet"
                description="Run property discovery first, then CasaHUD will rank the approved shortlist with title-support reasoning."
              />
            )}

            {activeCampaign.rejectedListings.length > 0 ? (
              <details className="mt-5 rounded-[1.6rem] border border-[#E6D8C7] bg-[#FFF9EF] p-5">
                <summary className="cursor-pointer text-lg font-semibold tracking-[-0.02em] text-[#172033]">
                  Rejected with reasons
                </summary>
                <div className="mt-4 grid gap-3">
                  {activeCampaign.rejectedListings.map((listing) => (
                    <div key={listing.id} className="rounded-2xl border border-[#E6D8C7] bg-white/90 p-4" data-testid="casahud-rejected-listing-card">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-[#172033]">{listing.title}</p>
                          <p className="mt-1 text-sm text-[#526070]">{listing.locationText}</p>
                        </div>
                        <StatusPill tone={listingStatusTone(listing)}>{statusLabelFromListing(listing)}</StatusPill>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-[#526070]">
                        {listing.warnings[0] || listing.validationReasons[0] || "Title-fit review flagged this listing for a weaker support profile."}
                      </p>
                    </div>
                  ))}
                </div>
              </details>
            ) : null}

            {activeCampaign.listingProviderStatuses.length > 0 ? (
              <div className="mt-5 rounded-[1.6rem] border border-[#E6D8C7] bg-white/90 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8A5A34]">Listing source status</p>
                <div className="mt-4 grid gap-3">
                  {activeCampaign.listingProviderStatuses.map((providerStatus) => (
                    <div key={providerStatus.provider} className="rounded-2xl border border-[#E6D8C7] bg-[#FFF9EF] p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-[#172033]">{providerStatus.label}</p>
                        <StatusPill tone={providerStatus.state === "error" ? "red" : providerStatus.state === "fallback" ? "gold" : providerStatus.state === "connected" ? "sage" : "neutral"}>
                          {formatCampaignStatus(providerStatus.state)}
                        </StatusPill>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-[#526070]">{providerStatus.detail}</p>
                      {providerStatus.warning ? <p className="mt-2 text-sm leading-6 text-[#526070]">{providerStatus.warning}</p> : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <EmptyState title="No campaign selected" description="Open a campaign to review its shortlist." />
        )}
      </WorkspaceCard>
    );
  }

  if (activeSection === "location_intelligence") {
    sectionContent = (
      <WorkspaceCard
        eyebrow="Location Intelligence"
        title="Why this place matters"
        description="CasaHUD turns raw POI and map context into creator-facing location storytelling."
        actions={
          activeCampaign?.nextPhase.key === "location_intelligence" ? (
            <button
              type="button"
              className="rounded-2xl border border-[#172033] bg-[#172033] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#26324B] disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => void onAddLocationIntelligence()}
              disabled={campaignLocatingId === activeCampaign.id}
              data-testid="casahud-location-intelligence-cta"
            >
              {campaignLocatingId === activeCampaign.id ? "Building Location Story..." : "Add Location Intelligence"}
            </button>
          ) : activeCampaign?.nextPhase.key === "script_narrative_generation" ? (
            <button
              type="button"
              className="rounded-2xl border border-[#172033] bg-[#172033] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#26324B] disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => void onGenerateScript()}
              disabled={campaignScriptingId === activeCampaign.id}
              data-testid="casahud-generate-script-cta"
            >
              {campaignScriptingId === activeCampaign.id ? "Generating Script..." : "Generate Script"}
            </button>
          ) : null
        }
      >
        {campaignLocatingId === activeCampaign?.id ? (
          renderProgressList(locationSteps, locationProgressIndex, "loading", "casahud-location-progress")
        ) : null}

        {activeCampaign?.locationIntelligenceStatus === "location_intelligence_completed" ? (
          <div className="grid gap-5 lg:grid-cols-[1.04fr_0.96fr]">
            <section className="grid gap-4">
              <div className="rounded-[1.75rem] border border-[#E6D8C7] bg-white/90 p-5 shadow-sm" data-testid="casahud-location-intelligence-summary">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8A5A34]">Location Story</p>
                <h3 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[#172033]" data-testid="casahud-location-story">
                  {activeCampaign.locationStory?.headline || activeCampaign.locationIntelligenceSummary?.headline}
                </h3>
                {activeCampaign.locationIntelligenceSummary?.headline ? (
                  <p className="mt-3 text-sm leading-6 text-[#526070]">{activeCampaign.locationIntelligenceSummary.headline}</p>
                ) : null}
                <p className="mt-3 text-sm leading-6 text-[#526070]">
                  {activeCampaign.locationStory?.summary || activeCampaign.locationIntelligenceSummary?.coverageSummary}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {(activeCampaign.locationStory?.lifestyleAnchors || []).map((anchor) => (
                    <StatusPill key={anchor} tone="neutral">
                      {anchor}
                    </StatusPill>
                  ))}
                </div>
              </div>

              <div className="rounded-[1.75rem] border border-[#D8E2D9] bg-[#F4FAF5] p-5 shadow-sm" data-testid="casahud-local-highlights">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#6C7B6D]">Local Highlights</p>
                <div className="mt-4 grid gap-3">
                  {activeCampaign.localHighlights.map((highlight) => (
                    <div key={highlight.id} className="rounded-2xl border border-[#D7E1D8] bg-white/90 p-4">
                      <p className="text-sm font-semibold text-[#172033]">{highlight.title}</p>
                      <p className="mt-2 text-sm leading-6 text-[#526070]">{highlight.description}</p>
                      <p className="mt-2 text-xs uppercase tracking-[0.12em] text-[#7A897E]">{highlight.locationText}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <aside className="grid gap-4">
              <div className="rounded-[1.75rem] border border-[#E6D8C7] bg-[#FFF9EF] p-5 shadow-sm" data-testid="casahud-poi-bundle">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8A5A34]">POI Summary</p>
                <p className="mt-3 text-sm leading-6 text-[#526070]">{activeCampaign.poiBundle?.summary || "POI package is ready once location intelligence completes."}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {(activeCampaign.poiBundle?.categories || []).map((category) => (
                    <StatusPill key={category} tone="neutral">
                      {category}
                    </StatusPill>
                  ))}
                </div>
                {activeCampaign.poiBundle?.cards.length ? (
                  <div className="mt-4 grid gap-3">
                    {activeCampaign.poiBundle.cards.map((poi) => (
                      <div key={poi.id} className="rounded-2xl border border-[#E6D8C7] bg-white/90 p-4">
                        <p className="text-sm font-semibold text-[#172033]">{poi.name}</p>
                        <p className="mt-2 text-sm leading-6 text-[#526070]">{poi.relevanceReason}</p>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="rounded-[1.75rem] border border-[#D8E2D9] bg-white/90 p-5 shadow-sm" data-testid="casahud-map-scene-ideas">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#6C7B6D]">Map Scene Ideas</p>
                <div className="mt-4 grid gap-3">
                  {activeCampaign.mapSceneIdeas.map((scene) => (
                    <div key={scene.id} className="rounded-2xl border border-[#D8E2D9] bg-[#F7FAF8] p-4">
                      <p className="text-sm font-semibold text-[#172033]">{scene.title}</p>
                      <p className="mt-2 text-sm leading-6 text-[#526070]">{scene.description}</p>
                      <p className="mt-2 text-xs uppercase tracking-[0.12em] text-[#7A897E]">{scene.suggestedVisual}</p>
                    </div>
                  ))}
                </div>
              </div>

              <PlaceholderVisual
                label="Scene framing"
                detail="Use the location story to explain why viewers should care, what makes this region click-worthy, and which supporting visuals should appear before render planning."
              />
              <div className="rounded-[1.75rem] border border-[#E6D8C7] bg-white/90 p-5 shadow-sm" data-testid="casahud-listing-location-insights">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8A5A34]">Listing location insights</p>
                <div className="mt-4 grid gap-3">
                  {activeCampaign.listingLocationInsights.map((insight) => (
                    <div key={insight.listingId} className="rounded-2xl border border-[#E6D8C7] bg-[#FFF9EF] p-4">
                      <p className="text-sm leading-6 text-[#526070]">{insight.summary}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-[1.75rem] border border-[#D8E2D9] bg-[#F4FAF5] p-5 shadow-sm" data-testid="casahud-location-provider-statuses">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#6C7B6D]">Provider statuses</p>
                <div className="mt-4 grid gap-3">
                  {activeCampaign.locationProviderStatuses.map((providerStatus) => (
                    <div key={providerStatus.provider} className="rounded-2xl border border-[#D8E2D9] bg-white/90 p-4">
                      <p className="text-sm font-semibold text-[#172033]">{providerStatus.label}</p>
                      <p className="mt-2 text-sm leading-6 text-[#526070]">{providerStatus.detail}</p>
                    </div>
                  ))}
                </div>
              </div>
            </aside>
          </div>
        ) : (
          <EmptyState
            title="Location story is not ready yet"
            description="Complete listing validation first, then CasaHUD will translate POIs and map context into a creator-facing place story."
          />
        )}
      </WorkspaceCard>
    );
  }

  if (activeSection === "script_studio") {
    sectionContent = (
      <WorkspaceCard
        eyebrow="Script Studio"
        title="Review-ready video narrative"
        description="The script stays structured and editorial so CasaHUD never feels like a JSON dump."
        actions={
          <>
            {activeCampaign?.nextPhase.key === "script_narrative_generation" ? (
              <button
                type="button"
                className="rounded-2xl border border-[#172033] bg-[#172033] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#26324B] disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => void onGenerateScript()}
                disabled={campaignScriptingId === activeCampaign.id}
                data-testid="casahud-generate-script-cta"
              >
                {campaignScriptingId === activeCampaign.id ? "Generating Script..." : "Generate Script"}
              </button>
            ) : activeCampaign?.nextPhase.key === "media_planning_asset_assembly" ? (
              <button
                type="button"
                className="rounded-2xl border border-[#172033] bg-[#172033] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#26324B] disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => void onBuildMediaPlan()}
                disabled={campaignMediaPlanningId === activeCampaign.id}
                data-testid="casahud-build-media-plan-cta"
              >
                {campaignMediaPlanningId === activeCampaign.id ? "Building Media Plan..." : "Build Media Plan"}
              </button>
            ) : null}
            <button
              type="button"
              className="rounded-2xl border border-[#D7CAB8] bg-white px-4 py-3 text-sm font-semibold text-[#172033] disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => void onCopyScript()}
              disabled={!activeCampaign?.fullScriptText}
            >
              Copy Script
            </button>
            <button
              type="button"
              className="rounded-2xl border border-[#D7CAB8] bg-[#F8F3EA] px-4 py-3 text-sm font-semibold text-[#7A897E]"
              disabled
            >
              Revise Script
            </button>
          </>
        }
      >
        {campaignScriptingId === activeCampaign?.id ? renderProgressList(scriptSteps, scriptProgressIndex, "loading", "casahud-script-progress") : null}

        {activeCampaign?.scriptGenerationStatus === "script_generated" ? (
          <div className="grid gap-5 xl:grid-cols-[1.06fr_0.94fr]">
            <section className="grid gap-4">
              <div className="rounded-[1.75rem] border border-[#D4DDF2] bg-[#F7FAFF] p-5 shadow-sm" data-testid="casahud-script-summary">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#41608E]">Opening Hook</p>
                <p className="mt-3 text-lg leading-8 text-[#172033]">{activeCampaign.openingHook}</p>
                <p className="mt-4 text-sm leading-6 text-[#526070]">{activeCampaign.scriptSummary}</p>
                <p className="mt-4 text-xs font-semibold uppercase tracking-[0.12em] text-[#41608E]">
                  Next: {activeCampaign.nextPhase.label}
                </p>
              </div>

              <div className="rounded-[1.75rem] border border-[#E6D8C7] bg-white/90 p-5 shadow-sm" data-testid="casahud-script-segments">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8A5A34]">Video Flow / Segment Outline</p>
                <div className="mt-4 grid gap-3">
                  {activeCampaign.scriptSegments.map((segment) => (
                    <div key={segment.id} className="rounded-2xl border border-[#E6D8C7] bg-[#FFF9EF] p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-[#172033]">{segment.title}</p>
                        <StatusPill tone="blue">{formatDuration(segment.durationSeconds)}</StatusPill>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-[#526070]">{segment.narration}</p>
                      {segment.visualNote ? <p className="mt-2 text-xs uppercase tracking-[0.12em] text-[#7A897E]">{segment.visualNote}</p> : null}
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <aside className="grid gap-4">
              <div className="rounded-[1.75rem] border border-[#E6D8C7] bg-[#FFF9EF] p-5 shadow-sm" data-testid="casahud-property-segments">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8A5A34]">Property Segments</p>
                <div className="mt-4 grid gap-3">
                  {activeCampaign.propertySegments.map((segment) => (
                    <div key={segment.listingId} className="rounded-2xl border border-[#E6D8C7] bg-white/90 p-4">
                      <p className="text-sm font-semibold text-[#172033]">{segment.title}</p>
                      <p className="mt-2 text-sm leading-6 text-[#526070]">{segment.narration}</p>
                      <p className="mt-2 text-xs uppercase tracking-[0.12em] text-[#7A897E]">{segment.whyItMadeTheCut}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[1.75rem] border border-[#D8E2D9] bg-white/90 p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#6C7B6D]">Location Storytelling Lines</p>
                <div className="mt-4 grid gap-2">
                  {activeCampaign.locationLifestyleLines.map((line) => (
                    <p key={line} className="rounded-2xl border border-[#D8E2D9] bg-[#F7FAF8] p-3 text-sm leading-6 text-[#526070]">
                      {line}
                    </p>
                  ))}
                </div>
              </div>

              <div className="rounded-[1.75rem] border border-[#D4DDF2] bg-[#F7FAFF] p-5 shadow-sm" data-testid="casahud-script-transitions">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#41608E]">Transitions and Closing CTA</p>
                <div className="mt-4 grid gap-2">
                  {activeCampaign.transitions.map((line) => (
                    <p key={line} className="rounded-2xl border border-[#D4DDF2] bg-white/90 p-3 text-sm leading-6 text-[#526070]">
                      {line}
                    </p>
                  ))}
                  {activeCampaign.closingCta ? (
                    <div className="rounded-2xl border border-[#D4DDF2] bg-white/90 p-4">
                      <p className="text-sm font-semibold text-[#172033]">Closing CTA</p>
                      <p className="mt-2 text-sm leading-6 text-[#526070]">{activeCampaign.closingCta}</p>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="rounded-[1.75rem] border border-[#E6D8C7] bg-white/90 p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8A5A34]">Tone and Pacing Notes</p>
                <div className="mt-4 grid gap-2">
                  {activeCampaign.toneAndPacingNotes.map((note) => (
                    <p key={note} className="rounded-2xl border border-[#E6D8C7] bg-[#FFF9EF] p-3 text-sm leading-6 text-[#526070]">
                      {note}
                    </p>
                  ))}
                </div>
              </div>

              {activeCampaign.scriptWarnings.length > 0 ? (
                <div className="rounded-[1.75rem] border border-[#F1C9C9] bg-[#FFF4F4] p-5 shadow-sm" data-testid="casahud-script-warnings">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#9A2727]">Script Warnings</p>
                  <div className="mt-4 grid gap-2">
                    {activeCampaign.scriptWarnings.map((warning) => (
                      <p key={warning} className="rounded-2xl border border-[#F1C9C9] bg-white/90 p-3 text-sm leading-6 text-[#7C3030]">
                        {warning}
                      </p>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="rounded-[1.75rem] border border-[#D8E2D9] bg-white/90 p-5 shadow-sm" data-testid="casahud-script-preview">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#6C7B6D]">Scene-level narration</p>
                <p className="mt-3 whitespace-pre-line text-sm leading-6 text-[#526070]">
                  {activeCampaign.fullScriptText || activeCampaign.openingHook || "The full script preview appears here once generated."}
                </p>
              </div>

              {scriptCopyNotice ? <p className="text-sm text-[#526070]">{scriptCopyNotice}</p> : null}
            </aside>
          </div>
        ) : (
          <EmptyState
            title="Script package not generated yet"
            description="Once location intelligence is complete, CasaHUD writes the opening hook, scene flow, property copy, transitions, and closing CTA here."
          />
        )}
      </WorkspaceCard>
    );
  }

  if (activeSection === "media_library") {
    sectionContent = (
      <WorkspaceCard
        eyebrow="Media Library"
        title="Media Planning and Asset Assembly"
        description="The visual plan maps listing imagery, location context, and thumbnail inputs onto the approved narrative package."
        actions={
          activeCampaign?.scriptGenerationStatus === "script_generated" && activeCampaign.mediaPlanningStatus !== "media_plan_built" ? (
            <button
              type="button"
              className="rounded-2xl border border-[#172033] bg-[#172033] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#26324B] disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => void onBuildMediaPlan()}
              disabled={campaignMediaPlanningId === activeCampaign.id}
              data-testid="casahud-build-media-plan-cta"
            >
              {campaignMediaPlanningId === activeCampaign.id ? "Building Media Plan..." : "Build Media Plan"}
            </button>
          ) : null
        }
      >
        {campaignMediaPlanningId === activeCampaign?.id ? renderProgressList(mediaSteps, mediaProgressIndex, "loading", "casahud-media-progress") : null}

        {activeCampaign ? activeCampaign.mediaPlanningStatus === "media_plan_built" ? (
          <div className="grid gap-5 xl:grid-cols-[1.08fr_0.92fr]">
            <section className="grid gap-4">
              <div className="rounded-[1.75rem] border border-[#D4DDF2] bg-[#F7FAFF] p-5 shadow-sm" data-testid="casahud-media-plan-summary">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#41608E]">Media Plan Summary</p>
                <p className="mt-3 text-sm leading-7 text-[#172033]">{activeCampaign.mediaPlanSummary}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <StatusPill tone="blue">{formatCountLabel(activeCampaign.visualAssets.length, "visual asset")}</StatusPill>
                  <StatusPill tone="sage">{formatCountLabel(activeCampaign.sceneAssetMapping.length, "scene mapping")}</StatusPill>
                  <StatusPill tone="gold">{formatCountLabel(activeCampaign.thumbnailCandidateInputs.length, "thumbnail input")}</StatusPill>
                </div>
                <p className="mt-4 text-xs font-semibold uppercase tracking-[0.12em] text-[#41608E]">
                  Next: {activeCampaign.nextPhase.label}
                </p>
              </div>

              <div className="rounded-[1.75rem] border border-[#E6D8C7] bg-white/90 p-5 shadow-sm" data-testid="casahud-scene-asset-mapping">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8A5A34]">Scene-to-Asset Mapping</p>
                <div className="mt-4 grid gap-3">
                  {activeCampaign.sceneAssetMapping.map((scene) => (
                    <div key={scene.sceneId} className="rounded-2xl border border-[#E6D8C7] bg-[#FFF9EF] p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-[#172033]">{scene.sceneTitle}</p>
                        <StatusPill tone={scene.coverageStatus === "strong" ? "sage" : scene.coverageStatus === "partial" ? "gold" : "red"}>
                          {formatCampaignStatus(scene.coverageStatus)}
                        </StatusPill>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-[#526070]">{scene.visualPurpose}</p>
                      <p className="mt-2 text-xs uppercase tracking-[0.12em] text-[#7A897E]">
                        {scene.assignedAssetIds.length} assigned asset{scene.assignedAssetIds.length === 1 ? "" : "s"} · Recommended {formatCampaignStatus(scene.recommendedAssetType)}
                      </p>
                      {scene.warnings.length > 0 ? (
                        <div className="mt-3 grid gap-2">
                          {scene.warnings.slice(0, 2).map((warning) => (
                            <p key={warning} className="rounded-2xl border border-[#F1C9C9] bg-white/90 p-3 text-sm leading-6 text-[#7C3030]">
                              {warning}
                            </p>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[1.75rem] border border-[#D8E2D9] bg-[#F4FAF5] p-5 shadow-sm" data-testid="casahud-shot-list">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#6C7B6D]">Shot List</p>
                <div className="mt-4 grid gap-3">
                  {activeCampaign.shotList.map((shot) => (
                    <div key={shot.id} className="rounded-2xl border border-[#D8E2D9] bg-white/90 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-[#172033]">{shot.order}. {shot.title}</p>
                        <StatusPill tone="neutral">{formatCampaignStatus(shot.recommendedVisualType)}</StatusPill>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-[#526070]">{shot.description}</p>
                      <p className="mt-2 text-xs uppercase tracking-[0.12em] text-[#7A897E]">
                        {shot.assetIds.length} linked asset{shot.assetIds.length === 1 ? "" : "s"}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[1.75rem] border border-[#E6D8C7] bg-white/90 p-5 shadow-sm" data-testid="casahud-listing-image-coverage">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8A5A34]">Listing Image Coverage</p>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {activeCampaign.listingImageCoverage.map((coverage) => (
                    <div key={coverage.listingId} className="rounded-2xl border border-[#E6D8C7] bg-[#FFF9EF] p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-[#172033]">{coverage.listingTitle}</p>
                        <StatusPill tone={coverage.coverageStatus === "strong" ? "sage" : coverage.coverageStatus === "partial" ? "gold" : "red"}>
                          {formatCampaignStatus(coverage.coverageStatus)}
                        </StatusPill>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-[#526070]">{coverage.coverageSummary}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <aside className="grid gap-4">
              <div className="rounded-[1.75rem] border border-[#E6D8C7] bg-white/90 p-5 shadow-sm" data-testid="casahud-visual-assets">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8A5A34]">Visual Asset List</p>
                <div className="mt-4 grid gap-3">
                  {activeCampaign.visualAssets.slice(0, 8).map((asset) => (
                    <div key={asset.id} className="rounded-2xl border border-[#E6D8C7] bg-[#FFF9EF] p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-[#172033]">{asset.title}</p>
                        <StatusPill tone={asset.availabilityStatus === "available" ? "sage" : asset.availabilityStatus === "planned" ? "blue" : "gold"}>
                          {formatCampaignStatus(asset.availabilityStatus)}
                        </StatusPill>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-[#526070]">{asset.description}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <StatusPill tone="neutral">{formatCampaignStatus(asset.type)}</StatusPill>
                        <StatusPill tone="neutral">{formatCampaignStatus(asset.sourceProvider)}</StatusPill>
                      </div>
                      {canOpenExternalUrl(asset.sourceUrl) ? (
                        <a
                          href={asset.sourceUrl}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="mt-3 inline-flex rounded-2xl border border-[#D6C9B9] bg-white px-4 py-2 text-sm font-semibold text-[#172033] transition hover:bg-[#FFF9EF]"
                        >
                          Open source media
                        </a>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[1.75rem] border border-[#D8E2D9] bg-[#F4FAF5] p-5 shadow-sm" data-testid="casahud-map-location-plan">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#6C7B6D]">Map and Location Visual Plan</p>
                <div className="mt-4 grid gap-3">
                  {activeCampaign.mapLocationVisualPlan.map((item) => (
                    <div key={item.id} className="rounded-2xl border border-[#D8E2D9] bg-white/90 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-[#172033]">{item.title}</p>
                        <StatusPill tone="blue">{formatCampaignStatus(item.visualType)}</StatusPill>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-[#526070]">{item.suggestedUse}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[1.75rem] border border-[#D4DDF2] bg-[#F7FAFF] p-5 shadow-sm" data-testid="casahud-thumbnail-candidates">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#41608E]">Thumbnail Candidate Inputs</p>
                <div className="mt-4 grid gap-3">
                  {activeCampaign.thumbnailCandidateInputs.map((candidate) => (
                    <div key={candidate.id} className="rounded-2xl border border-[#D4DDF2] bg-white/90 p-4">
                      <p className="text-sm font-semibold text-[#172033]">{candidate.title}</p>
                      <p className="mt-2 text-sm leading-6 text-[#526070]">{candidate.rationale}</p>
                      <p className="mt-2 text-xs uppercase tracking-[0.12em] text-[#6B7FA7]">{candidate.textOverlayIdea}</p>
                      <p className="mt-2 text-sm leading-6 text-[#526070]">{candidate.compositionNotes}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[1.75rem] border border-[#F1C9C9] bg-[#FFF4F4] p-5 shadow-sm" data-testid="casahud-media-warnings">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#9A2727]">Missing / Weak Media Warnings</p>
                <div className="mt-4 grid gap-2">
                  {activeCampaign.missingMediaWarnings.length > 0 ? (
                    activeCampaign.missingMediaWarnings.map((warning) => (
                      <p key={warning} className="rounded-2xl border border-[#F1C9C9] bg-white/90 p-3 text-sm leading-6 text-[#7C3030]">
                        {warning}
                      </p>
                    ))
                  ) : (
                    <p className="rounded-2xl border border-[#D8E2D9] bg-white/90 p-3 text-sm leading-6 text-[#526070]">
                      No major media gaps are flagged on the current plan.
                    </p>
                  )}
                </div>
              </div>

              <div className="rounded-[1.75rem] border border-[#E7DCCB] bg-white/90 p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8A5A34]">Next Phase</p>
                <p className="mt-3 text-lg font-semibold text-[#172033]">{activeCampaign.nextPhase.label}</p>
                <p className="mt-2 text-sm leading-6 text-[#526070]">{activeCampaign.nextPhase.detail}</p>
              </div>
            </aside>
          </div>
        ) : activeCampaign.scriptGenerationStatus === "script_generated" ? (
          <EmptyState
            title="Visual plan not built yet"
            description="Build Media Plan to turn the approved script, listing imagery, map cues, and location context into a scene-by-scene visual package."
            action={
              <button
                type="button"
                className="rounded-2xl border border-[#172033] bg-[#172033] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#26324B] disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => void onBuildMediaPlan()}
                disabled={campaignMediaPlanningId === activeCampaign.id}
                data-testid="casahud-build-media-plan-cta"
              >
                {campaignMediaPlanningId === activeCampaign.id ? "Building Media Plan..." : "Build Media Plan"}
              </button>
            }
          />
        ) : (
          <EmptyState
            title="Media planning is waiting on the script"
            description="Complete Script and Narrative Generation first, then CasaHUD will assemble the visual plan here."
          />
        ) : (
          <EmptyState title="No media coverage yet" description="Open a campaign to review its image and scene coverage." />
        )}
      </WorkspaceCard>
    );
  }

  if (activeSection === "storyboard") {
    sectionContent = (
      <WorkspaceCard
        eyebrow="Storyboard"
        title="Scene-by-scene story plan"
        description="The storyboard turns the script and visual assignments into a production-readable scene plan."
      >
        {activeCampaign ? (
          activeCampaign.mediaPlanningStatus === "media_plan_built" ? (
            <div className="grid gap-4">
              <div className="rounded-[1.75rem] border border-[#D4DDF2] bg-[#F7FAFF] p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#41608E]">Storyboard Status</p>
                <p className="mt-3 text-sm leading-6 text-[#526070]">
                  {activeCampaign.sceneAssetMapping.length} storyboard scene{activeCampaign.sceneAssetMapping.length === 1 ? "" : "s"} are mapped to the media plan.
                </p>
              </div>
              {sceneOutline.map((scene, index) => (
                <article key={scene.id} className="rounded-[1.6rem] border border-[#E6D8C7] bg-white/90 p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusPill tone="ink">Scene {index + 1}</StatusPill>
                        <StatusPill tone={operationalTone(scene.status)}>{formatCampaignStatus(scene.status)}</StatusPill>
                        <StatusPill tone="blue">{formatDuration(scene.durationSeconds)}</StatusPill>
                      </div>
                      <h3 className="mt-3 text-xl font-semibold tracking-[-0.03em] text-[#172033]">{scene.title}</h3>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 lg:grid-cols-[1.05fr_0.95fr]">
                    <div className="rounded-2xl border border-[#E6D8C7] bg-[#FFF9EF] p-4">
                      <p className="text-sm font-semibold text-[#172033]">Narration summary</p>
                      <p className="mt-2 text-sm leading-6 text-[#526070]">{scene.narration}</p>
                    </div>
                    <div className="rounded-2xl border border-[#D8E2D9] bg-[#F4FAF5] p-4">
                      <p className="text-sm font-semibold text-[#172033]">Visual assets and support</p>
                      <p className="mt-2 text-sm leading-6 text-[#526070]">{scene.visualSummary}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : sceneOutline.length > 0 ? (
            <EmptyState
              title="Storyboard is waiting on the media plan"
              description="Build Media Plan first, and CasaHUD will attach scene-level assets, shot order, and coverage notes here."
              action={
                activeCampaign.scriptGenerationStatus === "script_generated" ? (
                  <button
                    type="button"
                    className="rounded-2xl border border-[#172033] bg-[#172033] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#26324B] disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={() => void onBuildMediaPlan()}
                    disabled={campaignMediaPlanningId === activeCampaign.id}
                    data-testid="casahud-build-media-plan-cta"
                  >
                    {campaignMediaPlanningId === activeCampaign.id ? "Building Media Plan..." : "Build Media Plan"}
                  </button>
                ) : null
              }
            />
          ) : (
            <EmptyState
              title="Storyboard is waiting on narrative structure"
              description="Generate the script first, and CasaHUD will reflect the scene-by-scene plan here."
            />
          )
        ) : (
          <EmptyState title="No storyboard yet" description="Open a campaign to review its scene plan." />
        )}
      </WorkspaceCard>
    );
  }

  if (activeSection === "video_builder") {
    const renderStatus = activeCampaign?.futureState.renderStatus
      ? formatCampaignStatus(String(activeCampaign.futureState.renderStatus))
      : "Awaiting media planning and review approval";

    sectionContent = (
      <WorkspaceCard
        eyebrow="Video Builder"
        title="Render plan and preview state"
        description="The command center surfaces existing render-related seams without rewriting the render engine."
      >
        {activeCampaign ? (
          <div className="grid gap-5 lg:grid-cols-[1.04fr_0.96fr]">
            <section className="grid gap-4">
              <div className="rounded-[1.75rem] border border-[#E6D8C7] bg-white/90 p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8A5A34]">Render Plan</p>
                <div className="mt-4 grid gap-3 text-sm leading-6 text-[#526070]">
                  <p>
                    <span className="font-semibold text-[#172033]">Status:</span> {renderStatus}
                  </p>
                  <p>
                    <span className="font-semibold text-[#172033]">Scene count:</span>{" "}
                    {sceneOutline.length > 0 ? sceneOutline.length : "Pending script and storyboard"}
                  </p>
                  <p>
                    <span className="font-semibold text-[#172033]">Preview package:</span>{" "}
                    {activeCampaign.mediaPlanningStatus === "media_plan_built"
                      ? "Visual plan is ready to hand forward into package, review, and render planning."
                      : activeCampaign.scriptGenerationStatus === "script_generated"
                        ? "Narrative package is ready to hand forward into media planning."
                      : "The narrative package must be ready before render planning can become specific."}
                  </p>
                </div>
              </div>

              <div className="rounded-[1.75rem] border border-[#D8E2D9] bg-[#F4FAF5] p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#6C7B6D]">Render Warnings</p>
                <div className="mt-4 grid gap-2">
                  {activeCampaign.scriptWarnings.length > 0 ? (
                    activeCampaign.scriptWarnings.map((warning) => (
                      <p key={warning} className="rounded-2xl border border-[#F1C9C9] bg-white/90 p-3 text-sm leading-6 text-[#7C3030]">
                        {warning}
                      </p>
                    ))
                  ) : (
                    <p className="rounded-2xl border border-[#D8E2D9] bg-white/90 p-3 text-sm leading-6 text-[#526070]">
                      No render-specific warnings are persisted on this campaign yet.
                    </p>
                  )}
                </div>
              </div>
            </section>

            <aside className="grid gap-4">
              <div className="rounded-[1.75rem] border border-[#E6D8C7] bg-[#FFF9EF] p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8A5A34]">Preview Controls</p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    className="rounded-2xl border border-[#D7CAB8] bg-[#F8F3EA] px-4 py-3 text-sm font-semibold text-[#7A897E]"
                    disabled
                  >
                    Preview Render
                  </button>
                  <button
                    type="button"
                    className="rounded-2xl border border-[#D7CAB8] bg-[#F8F3EA] px-4 py-3 text-sm font-semibold text-[#7A897E]"
                    disabled
                  >
                    Download MP4
                  </button>
                </div>
                <p className="mt-4 text-sm leading-6 text-[#526070]">
                  CasaHUD does not fake render completion. These controls activate only when later-phase render outputs exist.
                </p>
              </div>

              <PlaceholderVisual
                label="Render preview"
                detail="Scene timing, assets, and approvals move here after Media Planning and Asset Assembly."
              />
            </aside>
          </div>
        ) : (
          <EmptyState title="Video builder is waiting on a campaign" description="Open a campaign to review render readiness and preview state." />
        )}
      </WorkspaceCard>
    );
  }

  if (activeSection === "review_package") {
    sectionContent = (
      <WorkspaceCard
        eyebrow="Review Package"
        title="Review-ready YouTube package"
        description="This is the premium review surface: title, properties, script, storyboard, thumbnail direction, metadata, and publish gating in one place."
        actions={
          <>
            <button
              type="button"
              className="rounded-2xl border border-[#172033] bg-[#172033] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#26324B] disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => setActiveSection("publishing")}
              disabled={!activeCampaign}
            >
              Publish / Schedule
            </button>
            <button
              type="button"
              className="rounded-2xl border border-[#D7CAB8] bg-[#F8F3EA] px-4 py-3 text-sm font-semibold text-[#7A897E]"
              disabled
            >
              Create/Refresh YouTube Package
            </button>
          </>
        }
        testId="casahud-review-package"
      >
        {activeCampaign ? (
          <div className="grid gap-5 xl:grid-cols-[1.07fr_0.93fr]">
            <section className="grid gap-4">
              <div className="rounded-[1.75rem] border border-[#E6D8C7] bg-white/90 p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8A5A34]">Campaign Title</p>
                <h3 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[#172033]">{activeCampaign.selectedViralTitle}</h3>
                <p className="mt-3 text-sm leading-6 text-[#526070]">
                  {activeCampaign.confidenceReasoning.selectedTitleReasoning || activeCampaign.confidenceReasoning.titleOpportunitySummary}
                </p>
              </div>

              <div className="rounded-[1.75rem] border border-[#D8E2D9] bg-[#F4FAF5] p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#6C7B6D]">Selected Properties</p>
                <div className="mt-4 grid gap-3">
                  {(activeCampaign.approvedListings.length > 0 ? activeCampaign.approvedListings : activeCampaign.listingCandidates)
                    .slice(0, 3)
                    .map((listing) => (
                      <div key={listing.id} className="rounded-2xl border border-[#D8E2D9] bg-white/90 p-4">
                        <div className="flex items-start gap-4">
                          <div className="h-20 w-24 shrink-0 overflow-hidden rounded-2xl bg-[#F2ECE3]">
                            <PropertyImage
                              src={featuredImage(listing)}
                              alt={`${listing.title} review package image`}
                              label={listing.title}
                              className="h-20 w-24"
                            />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-[#172033]">{listing.title}</p>
                            <p className="mt-1 text-sm text-[#526070]">{listing.locationText}</p>
                            <p className="mt-2 text-sm text-[#526070]">{getPropertySupportCopy(activeCampaign, listing)}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-[1.75rem] border border-[#E6D8C7] bg-[#FFF9EF] p-5 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8A5A34]">Local Highlights</p>
                  <p className="mt-3 text-sm leading-6 text-[#526070]">
                    {activeCampaign.locationStory?.summary || activeCampaign.locationIntelligenceSummary?.coverageSummary || "Location story arrives after the shortlist is validated."}
                  </p>
                </div>
                <div className="rounded-[1.75rem] border border-[#D4DDF2] bg-[#F7FAFF] p-5 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#41608E]">Script Preview</p>
                  <p className="mt-3 text-sm leading-6 text-[#526070]">{activeCampaign.scriptSummary || "Script preview appears here once generated."}</p>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-[1.75rem] border border-[#D8E2D9] bg-white/90 p-5 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#6C7B6D]">Storyboard Preview</p>
                  <p className="mt-3 text-sm leading-6 text-[#526070]">
                    {sceneOutline.length > 0
                      ? `${sceneOutline.length} scene${sceneOutline.length === 1 ? "" : "s"} outlined from the current script package.`
                      : "Storyboard preview appears once CasaHUD has scene-level narration or script segments."}
                  </p>
                </div>
                <div className="rounded-[1.75rem] border border-[#E6D8C7] bg-[#FFF9EF] p-5 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8A5A34]">Thumbnail Concept</p>
                  <p className="mt-3 text-sm leading-6 text-[#526070]">
                    {youtubePackagePreview?.thumbnailConcept ||
                      "Thumbnail direction will emerge from the selected title, lead listing, and location story."}
                  </p>
                </div>
              </div>
            </section>

            <aside className="grid gap-4">
              <section className="rounded-[1.75rem] border border-[#E6D8C7] bg-white/90 p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8A5A34]">YouTube Package</p>
                <div className="mt-4 grid gap-3 text-sm leading-6 text-[#526070]">
                  <p>
                    <span className="font-semibold text-[#172033]">Final title:</span>{" "}
                    {youtubePackagePreview?.finalTitle || activeCampaign.selectedViralTitle}
                  </p>
                  <p>
                    <span className="font-semibold text-[#172033]">Description:</span>{" "}
                    {youtubePackagePreview?.description || "Description preview will follow the completed script and review pass."}
                  </p>
                  <p>
                    <span className="font-semibold text-[#172033]">Tags:</span>{" "}
                    {youtubePackagePreview?.tags.join(" · ") || "Pending"}
                  </p>
                  <p>
                    <span className="font-semibold text-[#172033]">Hashtags:</span>{" "}
                    {youtubePackagePreview?.hashtags.join(" " ) || "Pending"}
                  </p>
                  <p>
                    <span className="font-semibold text-[#172033]">Chapters:</span>{" "}
                    {youtubePackagePreview?.chapters.length
                      ? youtubePackagePreview.chapters.map((chapter) => `${chapter.timestamp} ${chapter.title}`).join(" · ")
                      : "Pending"}
                  </p>
                </div>
              </section>

              <section className="rounded-[1.75rem] border border-[#D8E2D9] bg-[#F4FAF5] p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#6C7B6D]">Render / Preview Status</p>
                <p className="mt-3 text-sm leading-6 text-[#526070]">
                  {activeCampaign.futureState.renderStatus
                    ? formatCampaignStatus(String(activeCampaign.futureState.renderStatus))
                    : "No render output is persisted on this campaign yet."}
                </p>
              </section>

              <ReviewStatusCard campaign={activeCampaign} youtubePreview={youtubePackagePreview} />
            </aside>
          </div>
        ) : (
          <EmptyState title="No review package yet" description="Open a campaign to review its package." />
        )}
      </WorkspaceCard>
    );
  }

  if (activeSection === "publishing") {
    const publishStatus = activeCampaign?.futureState.publishStatus
      ? formatCampaignStatus(String(activeCampaign.futureState.publishStatus))
      : "No publish job has been run.";
    const scheduleStatus = activeCampaign?.futureState.scheduleStatus
      ? formatCampaignStatus(String(activeCampaign.futureState.scheduleStatus))
      : "No schedule is currently set.";

    sectionContent = (
      <WorkspaceCard
        eyebrow="Publishing"
        title="Publish and schedule controls"
        description="CasaHUD keeps publishing honest: no fake success states, no raw provider jargon, and review remains visible before anything goes live."
        testId="casahud-publishing-panel"
      >
        {activeCampaign ? (
          <div className="grid gap-5 lg:grid-cols-[1.04fr_0.96fr]">
            <section className="grid gap-4">
              <div className="rounded-[1.75rem] border border-[#E6D8C7] bg-white/90 p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8A5A34]">YouTube Channel</p>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <StatusPill tone={connectionTone(youtubeConnectionCard?.status || "not_connected")}>
                    {youtubeConnectionCard?.statusLabel || "Not Connected"}
                  </StatusPill>
                  <button
                    type="button"
                    className="rounded-2xl border border-[#D7CAB8] bg-white px-4 py-2 text-sm font-semibold text-[#172033]"
                    onClick={() => {
                      setActiveSection("connections");
                      openSetup("Connect the YouTube channel before publishing.", "youtube");
                    }}
                  >
                    Open Connections
                  </button>
                </div>
              </div>

              <div className="rounded-[1.75rem] border border-[#D8E2D9] bg-[#F4FAF5] p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#6C7B6D]">Publishing Controls</p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    className="rounded-2xl border border-[#D7CAB8] bg-[#F8F3EA] px-4 py-3 text-sm font-semibold text-[#7A897E]"
                    disabled
                  >
                    Publish Now
                  </button>
                  <button
                    type="button"
                    className="rounded-2xl border border-[#D7CAB8] bg-[#F8F3EA] px-4 py-3 text-sm font-semibold text-[#7A897E]"
                    disabled
                  >
                    Schedule
                  </button>
                </div>
                <p className="mt-4 text-sm leading-6 text-[#526070]">
                  Publishing stays gated until review is complete and a publish-ready package exists.
                </p>
              </div>
            </section>

            <aside className="grid gap-4">
              <div className="rounded-[1.75rem] border border-[#E6D8C7] bg-[#FFF9EF] p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8A5A34]">Publish Status</p>
                <p className="mt-3 text-sm leading-6 text-[#526070]">{publishStatus}</p>
              </div>
              <div className="rounded-[1.75rem] border border-[#D8E2D9] bg-white/90 p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#6C7B6D]">Schedule Status</p>
                <p className="mt-3 text-sm leading-6 text-[#526070]">{scheduleStatus}</p>
              </div>
              <div className="rounded-[1.75rem] border border-[#F1C9C9] bg-[#FFF4F4] p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#9A2727]">Run History</p>
                <p className="mt-3 text-sm leading-6 text-[#7C3030]">
                  No publish success is shown unless CasaHUD has a real publish or schedule result to display.
                </p>
              </div>
            </aside>
          </div>
        ) : (
          <EmptyState title="Publishing is waiting on a campaign" description="Open a campaign to review publish readiness and channel status." />
        )}
      </WorkspaceCard>
    );
  }

  if (activeSection === "connections") {
    const groups: Array<{
      title: string;
      detail: string;
      ids: CasaHudConnectionCardId[];
    }> = [
      {
        title: "Required to create",
        detail: "The core services CasaHUD needs to research, select properties, build the story, and prepare the package.",
        ids: ["openai", "listing_sources", "mapbox", "google_places", "media_storage"],
      },
      {
        title: "Required to publish",
        detail: "The channel connection needed before publish or schedule becomes available.",
        ids: ["youtube"],
      },
      {
        title: "Optional premium",
        detail: "Add premium narration support when your workflow is ready for it.",
        ids: ["elevenlabs"],
      },
    ];

    sectionContent = (
      <WorkspaceCard
        eyebrow="Connections"
        title="Connections"
        description="Manage the services CasaHUD uses to research, build, package, and publish videos."
        actions={<StatusPill tone={attentionConnectionCount > 0 ? "gold" : "sage"}>{attentionConnectionCount > 0 ? "Needs attention" : "Ready"}</StatusPill>}
        testId="casahud-connections-panel"
      >
        <div className="grid gap-5">
          {groups.map((group) => (
            <section key={group.title} className="rounded-[1.75rem] border border-[#E6D8C7] bg-white/90 p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8A5A34]">{group.title}</p>
              <p className="mt-2 text-sm leading-6 text-[#526070]">{group.detail}</p>
              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                {group.ids.map((id) => {
                  const card = connectionCards.find((item) => item.id === id);
                  if (!card) return null;
                  return (
                    <div key={card.id} className="rounded-[1.4rem] border border-[#E6D8C7] bg-[#FFF9EF] p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-[#172033]">{card.title}</p>
                        <StatusPill tone={connectionTone(card.status)}>{card.statusLabel}</StatusPill>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-[#526070]">{card.enables}</p>
                      <p className="mt-3 text-sm leading-6 text-[#526070]">{card.detail}</p>
                      {card.lastCheckedAt ? (
                        <p className="mt-3 text-xs uppercase tracking-[0.12em] text-[#7A897E]">
                          Last checked {formatCampaignTime(card.lastCheckedAt)}
                        </p>
                      ) : null}
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="rounded-2xl border border-[#172033] bg-[#172033] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#26324B]"
                          onClick={() => openSetup(card.missingSetupGuidance, card.id)}
                        >
                          {card.ctaLabel}
                        </button>
                        <button
                          type="button"
                          className="rounded-2xl border border-[#D7CAB8] bg-white px-4 py-2 text-sm font-semibold text-[#172033]"
                          onClick={() => {
                            openSetup(card.detail, card.id);
                            openConnectionCard(card);
                          }}
                        >
                          Test
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </WorkspaceCard>
    );
  }

  if (activeSection === "settings") {
    sectionContent = (
      <WorkspaceCard
        eyebrow="Settings"
        title="Advanced preferences"
        description="Advanced preferences stay out of the default entry experience so CasaHUD still feels like one click to start."
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-[1.75rem] border border-[#E6D8C7] bg-white/90 p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8A5A34]">Market and channel fit</p>
            <div className="mt-4 grid gap-3 text-sm leading-6 text-[#526070]">
              <p>
                <span className="font-semibold text-[#172033]">Preferred market:</span>{" "}
                {activeCampaign?.preferredMarket || "Italian real-estate YouTube"}
              </p>
              <p>
                <span className="font-semibold text-[#172033]">Campaign type:</span>{" "}
                {activeCampaign ? formatOpportunityCampaignType(activeCampaign.campaignType) : "Auto-selected by CasaHUD"}
              </p>
              <p>
                <span className="font-semibold text-[#172033]">Brand voice:</span>{" "}
                {activeCampaign?.tone || "Premium, clear, cinematic where appropriate"}
              </p>
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-[#D8E2D9] bg-[#F4FAF5] p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#6C7B6D]">Defaults</p>
            <div className="mt-4 grid gap-3 text-sm leading-6 text-[#526070]">
              <p>
                <span className="font-semibold text-[#172033]">Video length:</span>{" "}
                {activeCampaign ? formatDuration(activeCampaign.estimatedDurationSeconds) : "Auto-derived"}
              </p>
              <p>
                <span className="font-semibold text-[#172033]">Publishing default:</span>{" "}
                {youtubeConnectionCard?.status === "connected" ? "Ready for review-gated publish" : "Connect YouTube to enable publish defaults"}
              </p>
              <p>
                <span className="font-semibold text-[#172033]">Admin diagnostics:</span> Available through existing provider status views only.
              </p>
            </div>
          </div>
        </div>
      </WorkspaceCard>
    );
  }

  return (
    <main className="ibrains-shell min-h-screen overflow-hidden bg-[#EFE8DD] text-[#172033]">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_10%_10%,rgba(255,255,255,0.92),transparent_26%),radial-gradient(circle_at_88%_4%,rgba(193,142,87,0.18),transparent_28%),linear-gradient(145deg,#F6F0E5_0%,#EEE7DA_48%,#F4F1EA_100%)]" />

      <div className="mx-auto max-w-[1520px] px-4 py-5 md:px-6 lg:px-8 lg:py-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8A5A34]">CasaHUD</p>
            <p className="mt-1 text-sm text-[#657086]">AI real-estate YouTube content engine inside Studio</p>
          </div>
          <Link
            href="/apps"
            className="rounded-full border border-[#D7C9B6] bg-white/80 px-4 py-2 text-sm font-medium text-[#344256] shadow-sm transition hover:bg-white"
          >
            Apps
          </Link>
        </div>

        <div className="mt-6 lg:grid lg:grid-cols-[236px_minmax(0,1fr)] lg:gap-6">
          <aside className="lg:sticky lg:top-6 lg:self-start">
            <div className="rounded-[1.8rem] border border-[#1A2233] bg-[#111725] p-4 text-white shadow-[0_28px_70px_rgba(17,23,37,0.28)]">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#CBA16E]">CasaHUD Studio</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-white">Generate → Review → Publish</h2>
              </div>

              <div
                className="mt-5 flex gap-2 overflow-x-auto pb-1 lg:grid lg:gap-2 lg:overflow-visible"
                data-testid="casahud-sidebar"
              >
                {sidebarSections.map((section) => (
                  <button
                    key={section.id}
                    type="button"
                    className={cx(
                      "flex min-w-fit items-center gap-3 rounded-[1rem] border px-3 py-3 text-left transition lg:min-w-0",
                      activeSection === section.id
                        ? "border-[#CBA16E]/80 bg-white text-[#111725] shadow-[0_18px_36px_rgba(0,0,0,0.22)]"
                        : "border-white/10 bg-white/5 text-white/80 hover:bg-white/10",
                    )}
                    onClick={() => setActiveSection(section.id)}
                    data-testid={`casahud-nav-${section.id}`}
                    aria-current={activeSection === section.id ? "page" : undefined}
                  >
                    <SidebarGlyph active={activeSection === section.id} />
                    <span className="text-sm font-medium">{section.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </aside>

          <div className="mt-5 min-w-0 lg:mt-0">
            <section className="space-y-4" data-testid="casahud-workspace-shell">
              {generationStatus === "loading" ? (
                <div className="rounded-[1.5rem] border border-[#E1D6C6] bg-white/84 p-4">
                  {renderProgressList(wizardSteps, progressIndex, generationStatus)}
                </div>
              ) : null}
              {generationError ? (
                <div
                  className="rounded-2xl border border-[#D8B26A] bg-[#FFF5DA] p-4 text-sm text-[#7A4B13]"
                  data-testid="casahud-generation-error"
                >
                  {generationError}
                </div>
              ) : null}
              {campaignDiscoveringId ? (
                <div className="rounded-[1.5rem] border border-[#E1D6C6] bg-white/84 p-4">
                  {renderProgressList(discoverySteps, discoveryProgressIndex, "loading", "casahud-discovery-progress")}
                </div>
              ) : null}
              {campaignValidatingId ? (
                <div className="rounded-[1.5rem] border border-[#E1D6C6] bg-white/84 p-4">
                  {renderProgressList(validationSteps, validationProgressIndex, "loading", "casahud-validation-progress")}
                </div>
              ) : null}
              {campaignLocatingId ? (
                <div className="rounded-[1.5rem] border border-[#E1D6C6] bg-white/84 p-4">
                  {renderProgressList(locationSteps, locationProgressIndex, "loading", "casahud-location-progress")}
                </div>
              ) : null}
              {campaignScriptingId ? (
                <div className="rounded-[1.5rem] border border-[#E1D6C6] bg-white/84 p-4">
                  {renderProgressList(scriptSteps, scriptProgressIndex, "loading", "casahud-script-progress")}
                </div>
              ) : null}
              {campaignMediaPlanningId ? (
                <div className="rounded-[1.5rem] border border-[#E1D6C6] bg-white/84 p-4">
                  {renderProgressList(mediaSteps, mediaProgressIndex, "loading", "casahud-media-progress")}
                </div>
              ) : null}

              {sectionContent}
            </section>
          </div>
        </div>
      </div>

      {setupOpen ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-[#172033]/45 p-4 md:items-center">
          <div className="w-full max-w-5xl overflow-hidden rounded-[2rem] border border-white/70 bg-[#FFFDF8] shadow-[0_30px_80px_rgba(23,32,51,0.28)]">
            <div className="flex items-center justify-between border-b border-[#E6D8C7] px-5 py-4 md:px-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8A5A34]">Connections</p>
                <h2 className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-[#172033]">Manage provider connections</h2>
                {setupReason ? <p className="mt-2 text-sm leading-6 text-[#526070]">{setupReason}</p> : null}
              </div>
              <button
                type="button"
                className="rounded-full border border-[#D7CAB8] bg-white px-4 py-2 text-sm font-semibold text-[#172033]"
                onClick={() => setSetupOpen(false)}
                aria-label="Close connections panel"
              >
                Close
              </button>
            </div>

            <div className="grid gap-0 md:grid-cols-[280px_minmax(0,1fr)]">
              <div className="border-b border-[#E6D8C7] bg-[#FFF9EF] p-5 md:border-b-0 md:border-r">
                <div className="grid gap-2">
                  {connectionCards.map((card) => (
                    <button
                      key={card.id}
                      type="button"
                      className={cx(
                        "rounded-[1.4rem] border px-4 py-3 text-left transition",
                        activeConnectionId === card.id
                          ? "border-[#172033] bg-[#172033] text-white"
                          : "border-[#E6D8C7] bg-white text-[#172033] hover:bg-white/90",
                      )}
                      onClick={() => openConnectionCard(card)}
                    >
                      <p className={cx("text-sm font-semibold", activeConnectionId === card.id ? "text-white" : "text-[#172033]")}>{card.title}</p>
                      <p className={cx("mt-1 text-xs leading-5", activeConnectionId === card.id ? "text-white/72" : "text-[#657086]")}>{card.enables}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-5 md:p-6">
                {activeConnectionCard ? (
                  <div className="grid gap-5">
                    <div className="rounded-[1.6rem] border border-[#E6D8C7] bg-[#FFF9EF] p-5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8A5A34]">{activeConnectionCard.title}</p>
                          <h3 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[#172033]">{activeConnectionCard.statusLabel}</h3>
                        </div>
                        <StatusPill tone={connectionTone(activeConnectionCard.status)}>{activeConnectionCard.statusLabel}</StatusPill>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-[#526070]">{activeConnectionCard.detail}</p>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
                      <div className="rounded-[1.6rem] border border-[#E6D8C7] bg-white/90 p-5">
                        <label className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8A5A34]">Provider</label>
                        <select
                          value={activeProviderId}
                          onChange={(event) => setActiveProviderId(event.target.value as DomaraIntegrationProviderId)}
                          className="mt-2 w-full rounded-2xl border border-[#D7CAB8] bg-[#FFFDF8] px-4 py-3 text-sm text-[#172033] outline-none"
                        >
                          {activeConnectionCard.providerIds.map((providerId) => (
                            <option key={providerId} value={providerId}>
                              {providerOptionLabels[providerId]}
                            </option>
                          ))}
                        </select>

                        <label className="mt-4 block text-xs font-semibold uppercase tracking-[0.16em] text-[#8A5A34]">
                          Connection key
                        </label>
                        <input
                          type="password"
                          value={connectionSecret}
                          onChange={(event) => setConnectionSecret(event.target.value)}
                          placeholder={`Paste ${providerOptionLabels[activeProviderId]} connection key`}
                          className="mt-2 w-full rounded-2xl border border-[#D7CAB8] bg-[#FFFDF8] px-4 py-3 text-sm text-[#172033] outline-none"
                        />
                        <div className="mt-4 flex flex-wrap gap-3">
                          <button
                            type="button"
                            className="rounded-2xl border border-[#172033] bg-[#172033] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#26324B] disabled:cursor-not-allowed disabled:opacity-60"
                            onClick={() => void onSaveConnection()}
                            disabled={connectionSaving}
                          >
                            {connectionSaving ? "Saving..." : activeConnectionCard.ctaLabel}
                          </button>
                          <button
                            type="button"
                            className="rounded-2xl border border-[#D7CAB8] bg-white px-4 py-3 text-sm font-semibold text-[#172033] disabled:cursor-not-allowed disabled:opacity-60"
                            onClick={() => void onTestConnection()}
                            disabled={connectionTesting}
                          >
                            {connectionTesting ? "Testing..." : "Test Connection"}
                          </button>
                        </div>
                        {connectionNotice ? (
                          <p className="mt-4 rounded-2xl border border-[#E6D8C7] bg-[#FFF9EF] p-4 text-sm leading-6 text-[#526070]">
                            {connectionNotice}
                          </p>
                        ) : null}
                      </div>

                      <div className="rounded-[1.6rem] border border-[#D8E2D9] bg-[#F4FAF5] p-5">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#6C7B6D]">What it enables</p>
                        <p className="mt-3 text-sm leading-6 text-[#526070]">{activeConnectionCard.enables}</p>
                        <p className="mt-4 text-xs font-semibold uppercase tracking-[0.16em] text-[#6C7B6D]">Friendly helper text</p>
                        <p className="mt-3 text-sm leading-6 text-[#526070]">{activeConnectionCard.missingSetupGuidance}</p>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {activeCampaign && selectedListing ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-[#172033]/45 p-4 md:items-center">
          <div
            className="w-full max-w-5xl overflow-hidden rounded-[2rem] border border-white/70 bg-[#FFFDF8] shadow-[0_30px_80px_rgba(23,32,51,0.28)]"
            role="dialog"
            aria-modal="true"
            aria-label="Property details"
          >
            <div className="flex items-center justify-between border-b border-[#E6D8C7] px-5 py-4 md:px-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8A5A34]">Property Detail</p>
                <h2 className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-[#172033]">{selectedListing.title}</h2>
              </div>
              <button
                type="button"
                className="rounded-full border border-[#D7CAB8] bg-white px-4 py-2 text-sm font-semibold text-[#172033]"
                onClick={() => setSelectedListingId(null)}
                aria-label="Close property details"
              >
                Close
              </button>
            </div>

            <div className="grid gap-0 lg:grid-cols-[1.02fr_0.98fr]">
              <div className="h-full min-h-[320px] bg-[#F2ECE3]">
                <PropertyImage
                  src={featuredImage(selectedListing)}
                  alt={`${selectedListing.title} detail image`}
                  label={selectedListing.locationText}
                  className="min-h-[320px] w-full"
                />
              </div>
              <div className="grid gap-5 p-5 md:p-6">
                <div className="flex flex-wrap gap-2">
                  <StatusPill tone={listingStatusTone(selectedListing)}>{statusLabelFromListing(selectedListing)}</StatusPill>
                  <StatusPill tone="neutral">{formatListingProvider(selectedListing.provider)}</StatusPill>
                  <StatusPill tone="blue">Match {getPropertyMatchScore(selectedListing)}</StatusPill>
                </div>

                <div className="grid gap-3 text-sm leading-6 text-[#526070]">
                  <p>
                    <span className="font-semibold text-[#172033]">Location:</span> {selectedListing.locationText}
                  </p>
                  <p>
                    <span className="font-semibold text-[#172033]">Price:</span> {formatListingPrice(selectedListing.price, selectedListing.currency)}
                  </p>
                  <p>
                    <span className="font-semibold text-[#172033]">Listing facts:</span> {propertyDrawerFacts(selectedListing).join(" · ") || "Facts pending"}
                  </p>
                  <p>
                    <span className="font-semibold text-[#172033]">Validation reasoning:</span>{" "}
                    {isValidatedListing(selectedListing)
                      ? selectedListing.validationReasons.join(" · ")
                      : selectedListing.preliminaryMatchNotes}
                  </p>
                  <p>
                    <span className="font-semibold text-[#172033]">Title-fit explanation:</span> {getPropertySupportCopy(activeCampaign, selectedListing)}
                  </p>
                  <p>
                    <span className="font-semibold text-[#172033]">Scene ideas:</span>{" "}
                    {activeCampaign.mapSceneIdeas.find((scene) => scene.associatedListingId === selectedListing.id)?.suggestedVisual ||
                      activeCampaign.propertySegments.find((segment) => segment.listingId === selectedListing.id)?.locationLine ||
                      "Use this property as an evidence-backed visual beat in the final video."}
                  </p>
                  <p>
                    <span className="font-semibold text-[#172033]">Local context:</span>{" "}
                    {activeCampaign.listingLocationInsights.find((item) => item.listingId === selectedListing.id)?.summary ||
                      "Location context arrives through the campaign-level place story."}
                  </p>
                  <p>
                    <span className="font-semibold text-[#172033]">Media coverage:</span> {formatCountLabel(selectedListing.imageCount, "photo")} available
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  {canOpenExternalUrl(selectedListing.sourceUrl) ? (
                    <a
                      href={selectedListing.sourceUrl!}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="rounded-2xl border border-[#172033] bg-[#172033] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#26324B]"
                    >
                      Open source listing
                    </a>
                  ) : (
                    <span className="rounded-2xl border border-[#D7CAB8] bg-[#F8F3EA] px-4 py-3 text-sm font-semibold text-[#7A897E]">
                      Source unavailable
                    </span>
                  )}
                  <button
                    type="button"
                    className="rounded-2xl border border-[#D7CAB8] bg-[#F8F3EA] px-4 py-3 text-sm font-semibold text-[#7A897E]"
                    disabled
                  >
                    Selection locked from validation
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

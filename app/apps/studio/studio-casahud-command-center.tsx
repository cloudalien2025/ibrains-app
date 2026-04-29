"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type {
  CasaHudCampaign,
  CasaHudCampaignSummary,
  CasaHudListingCandidate,
  CasaHudValidatedListing,
} from "@/lib/studio/domara/campaigns";
import type { CasaHudVisualAsset, CasaHudVisualAssetType } from "@/lib/studio/domara/campaign-media-planning";
import {
  deriveCasaHudFeaturedPropertyMedia,
  type CasaHudFeaturedPropertyMedia,
} from "@/lib/studio/domara/campaign-featured-media";
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
  | "overview"
  | "opportunity_brief"
  | "property_shortlist"
  | "location_story"
  | "video_builder"
  | "youtube_package"
  | "render_publish"
  | "connections";
type CasaHudOperationalState = "ready" | "needs_review" | "missing_media" | "fallback_asset";
type CasaHudCommandStepState = "complete" | "current" | "pending";
type CasaHudNextActionId =
  | "select_campaign"
  | "generate_opportunity"
  | "discover_listings"
  | "validate_listings"
  | "build_location_story"
  | "generate_script"
  | "build_media_plan"
  | "build_youtube_package"
  | "review_render_publish"
  | "review_publish_status";

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

type CasaHudYouTubePackagePayload = {
  ok?: boolean;
  campaign?: CasaHudCampaign;
  summary?: CasaHudCampaignSummary;
  message?: string;
  error?: { message?: string };
};

type CasaHudExecutionPayload = {
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

type CasaHudNextStep = {
  actionId: CasaHudNextActionId;
  workspace: CasaHudWorkspaceSection;
  statusLabel: string;
  title: string;
  detail: string;
  ctaLabel: string;
};

type CasaHudVideoScene = {
  id: string;
  order: number;
  title: string;
  sceneType: string;
  preview: CasaHudFeaturedPropertyMedia;
  assetType: string;
  narration: string;
  onScreenText: string;
  durationLabel: string;
  purpose: string;
  associatedLabel: string;
  sourceProvider: string;
  sourceUrl?: string;
  warnings: string[];
  status: CasaHudOperationalState;
};

const workspaceNav: CasaHudWorkspaceNavItem[] = [
  {
    id: "campaigns",
    label: "Campaigns",
    eyebrow: "Select",
    description: "Create or resume the campaign you want to work on.",
  },
  {
    id: "overview",
    label: "Campaign Overview",
    eyebrow: "Orient",
    description: "See the active campaign, current stage, and next best action.",
  },
  {
    id: "opportunity_brief",
    label: "Opportunity Brief",
    eyebrow: "Strategy",
    description: "Review the selected title, why it won, and the research brief.",
  },
  {
    id: "property_shortlist",
    label: "Property Shortlist",
    eyebrow: "Listings",
    description: "Discover, validate, and review property evidence with featured imagery.",
  },
  {
    id: "location_story",
    label: "Location Story",
    eyebrow: "Place",
    description: "Translate the shortlist into POIs, map scenes, and location context.",
  },
  {
    id: "video_builder",
    label: "Video Builder",
    eyebrow: "Scenes",
    description: "Pair every visual beat with narration, on-screen text, and media coverage.",
  },
  {
    id: "youtube_package",
    label: "YouTube Package",
    eyebrow: "Package",
    description: "Review final title, metadata, chapters, thumbnail concept, and readiness.",
  },
  {
    id: "render_publish",
    label: "Render & Publish",
    eyebrow: "Ship",
    description: "Render, preview, publish, or schedule with honest execution states.",
  },
  {
    id: "connections",
    label: "Connections",
    eyebrow: "Ready",
    description: "Manage the services that power generation, discovery, storage, and YouTube.",
  },
];

const opportunitySteps: CasaHudProgressStep[] = [
  { id: "research", label: "Researching market opportunity" },
  { id: "title", label: "Generating title directions" },
  { id: "brief", label: "Preparing the selected opportunity brief" },
];

const discoverySteps: CasaHudProgressStep[] = [
  { id: "promise", label: "Reading the title promise" },
  { id: "criteria", label: "Preparing search criteria" },
  { id: "search", label: "Finding matching properties" },
  { id: "prepare", label: "Saving candidate properties" },
];

const validationSteps: CasaHudProgressStep[] = [
  { id: "truth", label: "Checking title support" },
  { id: "rank", label: "Ranking discovered properties" },
  { id: "shortlist", label: "Preparing the shortlist" },
];

const locationSteps: CasaHudProgressStep[] = [
  { id: "story", label: "Building the location story" },
  { id: "pois", label: "Preparing POIs and local highlights" },
  { id: "maps", label: "Preparing map scene ideas" },
];

const scriptSteps: CasaHudProgressStep[] = [
  { id: "hook", label: "Writing the opening hook" },
  { id: "segments", label: "Building scene narration" },
  { id: "review", label: "Preparing review-ready script" },
];

const mediaSteps: CasaHudProgressStep[] = [
  { id: "assets", label: "Matching assets to scenes" },
  { id: "coverage", label: "Checking media coverage" },
  { id: "builder", label: "Preparing the video builder" },
];

const packageSteps: CasaHudProgressStep[] = [
  { id: "title", label: "Refining YouTube title and metadata" },
  { id: "review", label: "Preparing package review" },
  { id: "render", label: "Preparing render plan" },
];

const providerOptionLabels: Record<DomaraIntegrationProviderId, string> = {
  openai: "OpenAI",
  elevenlabs: "ElevenLabs",
  mapbox: "Mapbox",
  google_maps_places: "Google Places",
  idealista: "Idealista",
  immobiliare: "Immobiliare",
  cloudinary: "Cloudinary",
  digitalocean_spaces: "DigitalOcean Spaces",
  youtube: "YouTube Channel",
};

const primaryButtonClass =
  "inline-flex items-center justify-center rounded-2xl border border-[#172033] bg-[#172033] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#26324B] disabled:cursor-not-allowed disabled:opacity-60";
const secondaryButtonClass =
  "inline-flex items-center justify-center rounded-2xl border border-[#D8CBB9] bg-white px-4 py-3 text-sm font-semibold text-[#172033] transition hover:bg-[#FFF8EE] disabled:cursor-not-allowed disabled:opacity-60";
const mutedButtonClass =
  "inline-flex items-center justify-center rounded-2xl border border-[#E5D7C6] bg-[#F8F3EA] px-4 py-3 text-sm font-semibold text-[#6F7B8B] transition disabled:cursor-not-allowed disabled:opacity-60";

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function uniq(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value && value.trim().length > 0))));
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
  return "Queued";
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
      return "Niche Category";
    case "location_led":
      return "Location-Led";
    case "lifestyle_relocation":
      return "Lifestyle Relocation";
  }
}

function formatCampaignTime(value?: string | null) {
  if (!value) return "Recently";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatDateTimeLabel(value?: string | null) {
  if (!value) return "Not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not set";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function toDateTimeLocalValue(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function nextScheduleInputValue() {
  const date = new Date(Date.now() + 24 * 60 * 60 * 1000);
  date.setMinutes(0, 0, 0);
  return toDateTimeLocalValue(date.toISOString());
}

function formatCampaignStatus(status?: string | null) {
  if (!status) return "Pending";
  const overrides: Record<string, string> = {
    opportunity_generated: "Opportunity ready",
    campaign_created: "Campaign created",
    ready_for_property_discovery: "Ready for properties",
    listing_candidates_discovered: "Listings discovered",
    listing_candidates_validated: "Shortlist ready",
    location_intelligence_completed: "Location story ready",
    script_narrative_completed: "Script ready",
    media_planning_completed: "Video builder ready",
    youtube_package_review_completed: "Package ready",
    render_completed: "Render complete",
    youtube_scheduled: "Scheduled",
    youtube_published: "Published",
    not_ready: "Not ready",
    not_scheduled: "Not scheduled",
  };
  return (
    overrides[status] ||
    status
      .replace(/_/g, " ")
      .replace(/\b\w/g, (character) => character.toUpperCase())
  );
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
    youtubePackageStatus: campaign.youtubePackageStatus,
    reviewStatus: campaign.reviewStatus,
    approvalStatus: campaign.approvalStatus,
    renderStatus: campaign.renderStatus,
    publishStatus: campaign.publishStatus,
    scheduleStatus: campaign.scheduleStatus,
    discoverySummary: campaign.discoverySummary?.headline,
    validationSummary: campaign.listingValidationSummary?.headline,
    locationSummary: campaign.locationIntelligenceSummary?.headline,
    scriptSummary: campaign.scriptSummary ?? undefined,
    mediaPlanSummary: campaign.mediaPlanSummary ?? undefined,
    packagingSummary: campaign.packagingSummary ?? undefined,
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
  if (tone === "gold") return "border-[#E3C7A0] bg-[#FFF4E0] text-[#835122]";
  if (tone === "sage") return "border-[#CDE4D3] bg-[#F3FBF5] text-[#0F5132]";
  if (tone === "blue") return "border-[#CEDAF0] bg-[#F4F8FF] text-[#274C87]";
  if (tone === "red") return "border-[#F1C9C9] bg-[#FFF4F4] text-[#9A2727]";
  return "border-[#E6D8C7] bg-white text-[#435064]";
}

function connectionTone(status: CasaHudConnectionCard["status"]) {
  if (status === "connected" || status === "partially_connected") return "sage" as const;
  if (status === "needs_attention") return "red" as const;
  if (status === "not_connected") return "gold" as const;
  return "neutral" as const;
}

function phaseTone(status: CasaHudCommandStepState) {
  if (status === "complete") return "sage" as const;
  if (status === "current") return "ink" as const;
  return "neutral" as const;
}

function sceneTone(status: CasaHudOperationalState) {
  if (status === "ready") return "sage" as const;
  if (status === "needs_review") return "gold" as const;
  if (status === "fallback_asset") return "blue" as const;
  return "red" as const;
}

function canOpenExternalUrl(url?: string | null) {
  return Boolean(url && /^https?:\/\//i.test(url));
}

function statusLabelFromListing(listing: CasaHudListingCandidate | CasaHudValidatedListing) {
  if ("validationStatus" in listing) return formatCampaignStatus(listing.validationStatus);
  return "Discovered";
}

function listingStatusTone(listing: CasaHudListingCandidate | CasaHudValidatedListing) {
  if (!("validationStatus" in listing)) return "neutral" as const;
  if (listing.validationStatus === "approved") return "sage" as const;
  if (listing.validationStatus === "needs_attention") return "gold" as const;
  return "red" as const;
}

function propertyFacts(listing: CasaHudListingCandidate | CasaHudValidatedListing) {
  return [
    listing.propertyType ? formatCampaignStatus(listing.propertyType) : null,
    listing.bedrooms ? `${listing.bedrooms} bd` : null,
    listing.bathrooms ? `${listing.bathrooms} ba` : null,
    listing.sizeSqm ? `${listing.sizeSqm} sqm` : null,
  ].filter(Boolean) as string[];
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

function mapVisualType(itemType: "map_scene" | "poi_context" | "location_anchor"): CasaHudVisualAssetType {
  if (itemType === "poi_context") return "poi_visual";
  if (itemType === "location_anchor") return "location_context";
  return "map_visual";
}

function visualAssetLabel(type: CasaHudVisualAssetType) {
  switch (type) {
    case "listing_image":
      return "Listing image";
    case "map_visual":
      return "Map visual";
    case "poi_visual":
      return "POI visual";
    case "location_context":
      return "Location context";
    case "fallback_placeholder":
      return "Fallback placeholder";
  }
}

function sceneTypeLabel(segmentType?: string) {
  switch (segmentType) {
    case "hook":
      return "Hook";
    case "premise":
      return "Premise";
    case "location_context":
      return "Location context";
    case "property_focus":
      return "Property";
    case "comparison":
      return "Comparison";
    case "transition":
      return "Transition";
    case "closing_cta":
      return "Closing CTA";
    default:
      return "Scene";
  }
}

function onScreenTextForScene(params: {
  campaign: CasaHudCampaign;
  segmentTitle: string;
  listing?: CasaHudListingCandidate | CasaHudValidatedListing;
  assetType: CasaHudVisualAssetType;
  mapTitle?: string;
  poiName?: string;
}) {
  const { campaign, segmentTitle, listing, assetType, mapTitle, poiName } = params;
  if (listing) {
    return [listing.city || listing.locationText, formatListingPrice(listing.price, listing.currency), listing.propertyType]
      .filter(Boolean)
      .join(" • ");
  }
  if (assetType === "poi_visual" && poiName) return poiName;
  if ((assetType === "map_visual" || assetType === "location_context") && mapTitle) return mapTitle;
  return campaign.selectedViralTitle || segmentTitle;
}

function buildFallbackScenes(campaign: CasaHudCampaign): CasaHudVideoScene[] {
  const listings = campaign.approvedListings.length > 0 ? campaign.approvedListings : campaign.listingCandidates;
  return listings.map((listing, index) => {
    const media = deriveCasaHudFeaturedPropertyMedia(listing, campaign);
    const warnings = uniq([media.warning, media.stateLabel === "Image needed" ? "Image needed: listing image unavailable." : null]);
    return {
      id: `fallback-scene-${listing.id}`,
      order: index + 1,
      title: listing.title,
      sceneType: "Property",
      preview: media,
      assetType: "Listing image",
      narration: getPropertySupportCopy(campaign, listing),
      onScreenText: onScreenTextForScene({
        campaign,
        segmentTitle: listing.title,
        listing,
        assetType: "listing_image",
      }),
      durationLabel: "TBD",
      purpose: "Ground the campaign in a property-backed proof point.",
      associatedLabel: listing.locationText,
      sourceProvider: media.sourceLabel,
      sourceUrl: listing.sourceUrl,
      warnings,
      status: !media.hasRealImage ? "missing_media" : warnings.length > 0 ? "needs_review" : "ready",
    };
  });
}

function buildVideoScenes(campaign: CasaHudCampaign | null): CasaHudVideoScene[] {
  if (!campaign) return [];

  const assetById = new Map(campaign.visualAssets.map((asset) => [asset.id, asset]));
  const listingById = new Map(
    [...campaign.listingCandidates, ...campaign.approvedListings, ...campaign.rejectedListings].map((listing) => [
      listing.id,
      listing,
    ]),
  );
  const usedMapIds = new Set<string>();
  const usedPoiIds = new Set<string>();
  const scenes: CasaHudVideoScene[] = [];
  const sourceSegments = campaign.scriptSegments.length > 0 ? campaign.scriptSegments : [];

  for (const [index, segment] of sourceSegments.entries()) {
    const mapping = campaign.sceneAssetMapping.find((item) => item.segmentId === segment.id);
    const assignedAssets = (mapping?.assignedAssetIds || [])
      .map((id) => assetById.get(id))
      .filter((item): item is CasaHudVisualAsset => Boolean(item));
    const listing = segment.associatedListingId ? listingById.get(segment.associatedListingId) : undefined;
    const propertySegment = listing ? campaign.propertySegments.find((item) => item.listingId === listing.id) : undefined;
    const coverage = listing ? campaign.listingImageCoverage.find((item) => item.listingId === listing.id) : undefined;
    const mapPlan = campaign.mapLocationVisualPlan.find(
      (item) =>
        (item.assetId && assignedAssets.some((asset) => asset.id === item.assetId)) ||
        (listing && item.associatedListingId === listing.id) ||
        (!listing && segment.segmentType === "location_context"),
    );
    if (mapPlan) usedMapIds.add(mapPlan.id);
    const poi =
      (listing
        ? campaign.poiBundle?.cards.find((item) => item.associatedListingId === listing.id)
        : campaign.poiBundle?.cards[0]) || undefined;
    if (poi) usedPoiIds.add(poi.id);

    const asset = assignedAssets.find((item) => item.sourceUrl) || undefined;
    const preview: CasaHudFeaturedPropertyMedia = listing
      ? deriveCasaHudFeaturedPropertyMedia(listing, campaign)
      : asset?.sourceUrl
        ? {
            kind:
              asset.type === "fallback_placeholder" || asset.availabilityStatus === "placeholder" ? "fallback" : "media_asset",
            url: asset.sourceUrl,
            label:
              asset.type === "fallback_placeholder" || asset.availabilityStatus === "placeholder"
                ? "Media placeholder"
                : "Source thumbnail",
            alt: `${segment.title} scene preview`,
            warning: asset.warning,
            source: asset.sourceProvider,
            hasRealImage: asset.type !== "fallback_placeholder" && asset.availabilityStatus !== "placeholder",
            sourceLabel: asset.sourceProvider,
            stateLabel:
              asset.type === "fallback_placeholder" || asset.availabilityStatus === "placeholder"
                ? "Media placeholder"
                : "Scene visual preview",
            fallbackLabel: "Media placeholder",
            fallbackDetail: asset.warning || "Scene preview is using a planning placeholder.",
          }
        : {
            kind: "fallback",
            url: null,
            label: mapPlan ? "Media placeholder" : poi ? "Media placeholder" : "Image needed",
            alt: `${segment.title} scene preview`,
            warning: mapPlan ? "Map preview is still needed." : poi ? "POI visual still needs a source image." : "Scene preview is still missing.",
            source: mapPlan?.provider || poi?.provider || "CasaHUD fallback",
            hasRealImage: false,
            sourceLabel: mapPlan?.provider || poi?.provider || "CasaHUD fallback",
            stateLabel: mapPlan ? "Map visual planned" : poi ? "POI visual planned" : "Media placeholder",
            fallbackLabel: mapPlan ? "Media placeholder" : "Image needed",
            fallbackDetail: mapPlan
              ? "Map preview is still needed."
              : poi
                ? "POI visual still needs a source image."
                : "Scene preview is still missing.",
          };
    const assetType =
      asset?.type || (listing ? "listing_image" : mapPlan ? mapVisualType(mapPlan.visualType) : poi ? "poi_visual" : "fallback_placeholder");
    const warnings = uniq([
      ...(mapping?.warnings || []),
      asset?.warning,
      coverage?.warning,
      propertySegment?.caution,
      listing ? preview.warning : null,
      !preview.hasRealImage && listing && preview.stateLabel === "Image needed" ? "Image needed: listing image unavailable." : null,
      !preview.hasRealImage && !listing ? preview.fallbackDetail : null,
    ]);
    const status: CasaHudOperationalState = !preview.hasRealImage
      ? assetType === "fallback_placeholder" || preview.stateLabel === "Media placeholder"
        ? "fallback_asset"
        : "missing_media"
      : warnings.length > 0
        ? "needs_review"
        : "ready";

    scenes.push({
      id: segment.id,
      order: index + 1,
      title: segment.title,
      sceneType: sceneTypeLabel(segment.segmentType),
      preview,
      assetType: visualAssetLabel(assetType),
      narration: segment.narration,
      onScreenText: onScreenTextForScene({
        campaign,
        segmentTitle: segment.title,
        listing,
        assetType,
        mapTitle: mapPlan?.title,
        poiName: poi?.name,
      }),
      durationLabel: formatDuration(segment.durationSeconds),
      purpose: mapping?.visualPurpose || segment.visualNote || propertySegment?.whyItMadeTheCut || mapPlan?.suggestedUse || "Pair the narration with a clear visual beat.",
      associatedLabel:
        listing?.title || mapPlan?.title || poi?.name || campaign.locationStory?.headline || campaign.selectedViralTitle,
      sourceProvider: preview.sourceLabel,
      sourceUrl: listing?.sourceUrl || asset?.sourceUrl,
      warnings,
      status,
    });
  }

  const extraMapScenes = campaign.mapLocationVisualPlan
    .filter((item) => !usedMapIds.has(item.id))
    .map((item, index) => {
      const asset = item.assetId ? assetById.get(item.assetId) : undefined;
      const preview: CasaHudFeaturedPropertyMedia =
        asset?.sourceUrl && asset.type !== "fallback_placeholder"
          ? {
              kind: "media_asset",
              url: asset.sourceUrl,
              label: "Source thumbnail",
              alt: `${item.title} map preview`,
              warning: asset.warning,
              source: asset.sourceProvider,
              hasRealImage: true,
              sourceLabel: asset.sourceProvider,
              stateLabel: "Scene visual preview",
              fallbackLabel: "Media placeholder",
              fallbackDetail: asset.warning || "Map preview is still needed.",
            }
          : {
              kind: "fallback",
              url: null,
              label: "Media placeholder",
              alt: `${item.title} map preview`,
              warning: "Map preview is still needed.",
              source: item.provider,
              hasRealImage: false,
              sourceLabel: item.provider,
              stateLabel: "Map visual planned",
              fallbackLabel: "Media placeholder",
              fallbackDetail: "Map preview is still needed.",
            };
      const warnings = uniq([asset?.warning, !preview.hasRealImage ? "Media placeholder: map preview is still needed." : null]);
      return {
        id: `map-scene-${item.id}`,
        order: scenes.length + index + 1,
        title: item.title,
        sceneType: item.visualType === "poi_context" ? "POI" : item.visualType === "location_anchor" ? "Location context" : "Map",
        preview,
        assetType: visualAssetLabel(mapVisualType(item.visualType)),
        narration: item.description,
        onScreenText: item.title,
        durationLabel: "TBD",
        purpose: item.suggestedUse,
        associatedLabel: item.associatedListingId ? listingById.get(item.associatedListingId)?.title || item.title : item.title,
        sourceProvider: preview.sourceLabel,
        sourceUrl: asset?.sourceUrl,
        warnings,
        status: preview.hasRealImage ? (warnings.length > 0 ? "needs_review" : "ready") : "fallback_asset",
      } satisfies CasaHudVideoScene;
    });

  const extraPoiScenes =
    campaign.poiBundle?.cards
      .filter((item) => !usedPoiIds.has(item.id))
      .map((poi, index) => {
        const listing = poi.associatedListingId ? listingById.get(poi.associatedListingId) : undefined;
        const preview: CasaHudFeaturedPropertyMedia = listing
          ? deriveCasaHudFeaturedPropertyMedia(listing, campaign)
          : {
              kind: "fallback",
              url: null,
              label: "Media placeholder",
              alt: `${poi.name} POI preview`,
              warning: "POI visual still needs a source image.",
              source: poi.provider,
              hasRealImage: false,
              sourceLabel: poi.provider,
              stateLabel: "POI visual planned",
              fallbackLabel: "Media placeholder",
              fallbackDetail: "POI visual still needs a source image.",
            };
        const warnings = uniq([!preview.hasRealImage ? "Media placeholder: POI visual still needs a source image." : null]);
        return {
          id: `poi-scene-${poi.id}`,
          order: scenes.length + extraMapScenes.length + index + 1,
          title: poi.name,
          sceneType: "POI",
          preview,
          assetType: "POI visual",
          narration: poi.relevanceReason,
          onScreenText: poi.name,
          durationLabel: "TBD",
          purpose: "Use a local proof point to strengthen the place story.",
          associatedLabel: poi.locationText,
          sourceProvider: preview.sourceLabel,
          sourceUrl: listing?.sourceUrl,
          warnings,
          status: preview.hasRealImage ? "needs_review" : "fallback_asset",
        } satisfies CasaHudVideoScene;
      }) || [];

  const combined = [...scenes, ...extraMapScenes, ...extraPoiScenes];
  return combined.length > 0 ? combined : buildFallbackScenes(campaign);
}

function buildPhaseProgress(campaign: CasaHudCampaign | null): CasaHudPhaseProgressItem[] {
  const steps = [
    { id: "opportunity", label: "Opportunity Brief", complete: Boolean(campaign?.selectedTitle?.title || campaign?.selectedViralTitle) },
    {
      id: "properties",
      label: "Property Shortlist",
      complete: Boolean(campaign?.listingValidationStatus === "listing_candidates_validated" || campaign?.approvedListings.length),
    },
    {
      id: "location",
      label: "Location Story",
      complete: campaign?.locationIntelligenceStatus === "location_intelligence_completed",
    },
    {
      id: "video",
      label: "Video Builder",
      complete: Boolean(campaign?.scriptGenerationStatus === "script_generated" && campaign?.mediaPlanningStatus === "media_plan_built"),
    },
    {
      id: "package",
      label: "YouTube Package",
      complete: campaign?.youtubePackageStatus === "package_prepared",
    },
    {
      id: "render",
      label: "Render & Publish",
      complete: Boolean(campaign?.renderStatus === "rendered" || campaign?.publishStatus === "published" || campaign?.scheduleStatus === "scheduled"),
    },
  ];
  const currentIndex = steps.findIndex((step) => !step.complete);
  return steps.map((step, index) => ({
    ...step,
    status: step.complete ? "complete" : currentIndex === -1 ? "complete" : index === currentIndex ? "current" : "pending",
  }));
}

function buildCampaignWarnings(campaign: CasaHudCampaign | null) {
  if (!campaign) return [];
  return uniq([
    ...(campaign.validationWarnings || []),
    ...(campaign.locationWarnings || []),
    ...(campaign.scriptWarnings || []),
    ...(campaign.missingMediaWarnings || []),
    ...(campaign.packageWarnings || []),
    ...(campaign.reviewWarnings || []),
    ...(campaign.renderWarnings || []),
    ...(campaign.publishWarnings || []),
    ...(campaign.scheduleWarnings || []),
  ]).slice(0, 6);
}

function buildCampaignBlockers(campaign: CasaHudCampaign | null) {
  if (!campaign) return [];
  return uniq([
    ...(campaign.reviewBlockers || []),
    ...(campaign.renderBlockers || []),
    ...(campaign.renderErrors || []),
    ...(campaign.publishErrors || []),
    ...(campaign.scheduleErrors || []),
  ]).slice(0, 6);
}

function buildCompletedArtifacts(campaign: CasaHudCampaign | null) {
  if (!campaign) return [];
  return [
    campaign.selectedTitle?.title ? "Selected title and opportunity brief" : null,
    campaign.listingCandidates.length > 0 ? `${formatCountLabel(campaign.listingCandidates.length, "discovered property")}` : null,
    campaign.approvedListings.length > 0 ? `${formatCountLabel(campaign.approvedListings.length, "approved property")}` : null,
    campaign.locationStory?.headline ? "Location story and map context" : null,
    campaign.scriptGenerationStatus === "script_generated" ? "Scene narration and script package" : null,
    campaign.mediaPlanningStatus === "media_plan_built" ? "Scene asset mapping and media coverage" : null,
    campaign.youtubePackageStatus === "package_prepared" ? "YouTube package and review summary" : null,
    campaign.renderOutput ? "Render output or preview package" : null,
  ].filter(Boolean) as string[];
}

function deriveNextStep(campaign: CasaHudCampaign | null): CasaHudNextStep {
  if (!campaign) {
    return {
      actionId: "select_campaign",
      workspace: "campaigns",
      statusLabel: "No campaign selected",
      title: "Select or create a campaign",
      detail: "Choose a campaign to resume or generate the next viral video title to begin.",
      ctaLabel: "Select Campaign",
    };
  }

  if (campaign.publishStatus === "published" || campaign.scheduleStatus === "scheduled") {
    return {
      actionId: "review_publish_status",
      workspace: "render_publish",
      statusLabel: "Live or scheduled",
      title: "Review render and publish history",
      detail: "This campaign already has a live or scheduled execution state. Review output, run history, and channel status.",
      ctaLabel: "Review Publish Status",
    };
  }

  if (campaign.youtubePackageStatus === "package_prepared") {
    return {
      actionId: "review_render_publish",
      workspace: "render_publish",
      statusLabel: "Package ready",
      title: "Render or publish the current package",
      detail: "The review-ready package is in place. Render it now or move into publish and schedule controls.",
      ctaLabel: "Continue to Render & Publish",
    };
  }

  if (campaign.mediaPlanningStatus === "media_plan_built") {
    return {
      actionId: "build_youtube_package",
      workspace: "youtube_package",
      statusLabel: "Needs YouTube package",
      title: "Build the YouTube package",
      detail: "Turn the finished scene plan into the final title, description, chapters, thumbnail concept, and render plan.",
      ctaLabel: "Build YouTube Package",
    };
  }

  if (campaign.scriptGenerationStatus === "script_generated") {
    return {
      actionId: "build_media_plan",
      workspace: "video_builder",
      statusLabel: "Needs media plan",
      title: "Complete the Video Builder",
      detail: "Match property images, map visuals, and POI coverage to every scripted scene.",
      ctaLabel: "Build Media Plan",
    };
  }

  if (campaign.locationIntelligenceStatus === "location_intelligence_completed") {
    return {
      actionId: "generate_script",
      workspace: "video_builder",
      statusLabel: "Needs script",
      title: "Generate the scene-by-scene script",
      detail: "Use the validated shortlist and location story to build narration, scene flow, and on-screen text.",
      ctaLabel: "Generate Script",
    };
  }

  if (campaign.listingValidationStatus === "listing_candidates_validated") {
    return {
      actionId: "build_location_story",
      workspace: "location_story",
      statusLabel: "Needs place context",
      title: "Add the location story",
      detail: "Build local highlights, POIs, and map scenes that explain why this place matters.",
      ctaLabel: "Continue to Location Story",
    };
  }

  if (campaign.listingDiscoveryStatus === "listing_candidates_discovered" || campaign.listingCandidates.length > 0) {
    return {
      actionId: "validate_listings",
      workspace: "property_shortlist",
      statusLabel: "Needs validation",
      title: "Validate and rank the shortlist",
      detail: "Approve the strongest properties, flag weak support, and tighten title confidence.",
      ctaLabel: "Validate and Rank Listings",
    };
  }

  return {
    actionId: "discover_listings",
    workspace: "property_shortlist",
    statusLabel: "Needs properties",
    title: "Find matching properties",
    detail: "Translate the title promise into real candidate listings and featured media coverage.",
    ctaLabel: "Find Matching Properties",
  };
}

function deriveResumeWorkspace(campaign: CasaHudCampaign | null) {
  if (!campaign) return "campaigns" as const;
  return deriveNextStep(campaign).workspace;
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
            className="grid grid-cols-[12px_1fr_auto] items-center gap-3 rounded-2xl border border-[#E2E8E0] bg-white/85 px-3 py-3"
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

function WorkspacePage({
  eyebrow,
  title,
  description,
  actions,
  children,
  testId,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
  children: ReactNode;
  testId?: string;
}) {
  return (
    <section
      className="rounded-[2rem] border border-[#E7D8C7] bg-[#FFFDF8]/95 p-5 shadow-[0_24px_60px_rgba(70,55,35,0.12)] md:p-6 xl:p-7"
      data-testid={testId}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8A5A34]">{eyebrow}</p>
          <h1 className="mt-2 text-[2rem] font-semibold tracking-[-0.04em] text-[#172033] md:text-[2.4rem]">{title}</h1>
          <p className="mt-3 text-sm leading-6 text-[#556274]">{description}</p>
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      <div className="mt-6">{children}</div>
    </section>
  );
}

function MediaPreview({
  media,
  alt,
  className,
}: {
  media: CasaHudFeaturedPropertyMedia;
  alt: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (!media.url || failed || !media.hasRealImage) {
    return (
      <div
        className={cx(
          "relative flex h-full w-full flex-col justify-end overflow-hidden rounded-[1.4rem] border border-[#DCCDBA] bg-[linear-gradient(135deg,rgba(24,33,51,0.96),rgba(147,109,68,0.9))] p-4 text-white",
          className,
        )}
        role="img"
        aria-label={media.fallbackLabel}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.16),transparent_40%),radial-gradient(circle_at_bottom_left,rgba(250,231,198,0.18),transparent_42%)]" />
        <div className="relative">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#F4DFC0]">{media.fallbackLabel}</p>
          <p className="mt-3 text-sm leading-6 text-white/88">{media.fallbackDetail}</p>
        </div>
      </div>
    );
  }

  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={media.url}
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
    <div className="rounded-[1.9rem] border border-dashed border-[#D9C8B0] bg-[linear-gradient(160deg,rgba(255,248,236,0.84),rgba(255,255,255,0.72))] p-6">
      <p className="text-2xl font-semibold tracking-[-0.03em] text-[#172033]">{title}</p>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-[#526070]">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

function PropertyCard({
  campaign,
  listing,
  testId,
  onSelect,
}: {
  campaign: CasaHudCampaign;
  listing: CasaHudListingCandidate | CasaHudValidatedListing;
  testId: string;
  onSelect: (listingId: string) => void;
}) {
  const media = deriveCasaHudFeaturedPropertyMedia(listing, campaign);
  const facts = propertyFacts(listing);
  const supportCopy = getPropertySupportCopy(campaign, listing);
  const imageWarnings = uniq([media.warning, media.stateLabel === "Image needed" ? "Image needed: listing image unavailable." : null]);

  return (
    <article
      className="overflow-hidden rounded-[1.65rem] border border-[#E7DCCB] bg-white/95 shadow-[0_18px_38px_rgba(70,55,35,0.08)]"
      data-testid={testId}
    >
      <div
        className="relative aspect-[16/10] bg-[#F3EDE4]"
        data-testid="casahud-property-card-media"
        data-media-kind={media.kind}
      >
        <MediaPreview media={media} alt={`${listing.title} featured image`} className="aspect-[16/10]" />
        <div className="absolute left-4 top-4 flex flex-wrap gap-2">
          <StatusPill tone={listingStatusTone(listing)}>{statusLabelFromListing(listing)}</StatusPill>
          <StatusPill tone="neutral">{media.stateLabel}</StatusPill>
        </div>
      </div>
      <div className="grid gap-4 p-4">
        <div className="grid gap-2">
          <h3 className="text-xl font-semibold tracking-[-0.03em] text-[#172033]">{listing.title}</h3>
          <div className="flex flex-wrap gap-2">
            <StatusPill tone="gold">{formatListingProvider(listing.provider)}</StatusPill>
            {listing.propertyType ? <StatusPill tone="neutral">{formatCampaignStatus(listing.propertyType)}</StatusPill> : null}
            {"overallScore" in listing && typeof listing.overallScore === "number" ? (
              <StatusPill tone="blue">Score {Math.round(listing.overallScore)}</StatusPill>
            ) : null}
            {"rank" in listing && typeof listing.rank === "number" ? <StatusPill tone="blue">Rank #{listing.rank}</StatusPill> : null}
          </div>
        </div>

        <div className="grid gap-2 text-sm leading-6 text-[#526070]">
          <p>
            <span className="font-semibold text-[#172033]">Location:</span> {listing.locationText}
          </p>
          <p>
            <span className="font-semibold text-[#172033]">Price:</span> {formatListingPrice(listing.price, listing.currency)}
          </p>
          <p>
            <span className="font-semibold text-[#172033]">Listing facts:</span> {facts.join(" · ") || "Facts pending"}
          </p>
          <p>
            <span className="font-semibold text-[#172033]">
              {"validationStatus" in listing && listing.validationStatus === "rejected"
                ? "Reason rejected"
                : "Why selected"}
              :
            </span>{" "}
            {supportCopy}
          </p>
          <p>
            <span className="font-semibold text-[#172033]">Media status:</span> {media.stateLabel} via {media.sourceLabel}
          </p>
        </div>

        {imageWarnings.length > 0 ? (
          <div className="grid gap-2">
            {imageWarnings.map((warning) => (
              <p key={warning} className="rounded-2xl border border-[#F1C9C9] bg-[#FFF4F4] px-3 py-2 text-sm text-[#8A2D2D]">
                {warning}
              </p>
            ))}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-3">
          {canOpenExternalUrl(listing.sourceUrl) ? (
            <a
              href={listing.sourceUrl!}
              target="_blank"
              rel="noreferrer noopener"
              className={secondaryButtonClass}
            >
              Open source listing
            </a>
          ) : (
            <span className={mutedButtonClass}>Source unavailable</span>
          )}
          <button type="button" className={primaryButtonClass} onClick={() => onSelect(listing.id)}>
            View details
          </button>
        </div>
      </div>
    </article>
  );
}

function PropertyPreview({
  campaign,
  listing,
}: {
  campaign: CasaHudCampaign;
  listing: CasaHudListingCandidate | CasaHudValidatedListing;
}) {
  const media = deriveCasaHudFeaturedPropertyMedia(listing, campaign);

  return (
    <div className="overflow-hidden rounded-[1.4rem] border border-[#E7DCCB] bg-white/92">
      <div className="aspect-[16/10] bg-[#F3EDE4]">
        <MediaPreview media={media} alt={`${listing.title} preview image`} className="aspect-[16/10]" />
      </div>
      <div className="grid gap-2 p-4">
        <p className="text-base font-semibold tracking-[-0.02em] text-[#172033]">{listing.title}</p>
        <p className="text-sm text-[#526070]">{listing.locationText}</p>
        <div className="flex flex-wrap gap-2">
          <StatusPill tone={listingStatusTone(listing)}>{statusLabelFromListing(listing)}</StatusPill>
          <StatusPill tone="neutral">{media.stateLabel}</StatusPill>
        </div>
      </div>
    </div>
  );
}

function VideoSceneCard({ scene }: { scene: CasaHudVideoScene }) {
  return (
    <article
      className="overflow-hidden rounded-[1.7rem] border border-[#E7DCCB] bg-white/95 shadow-[0_18px_38px_rgba(70,55,35,0.08)]"
      data-testid="casahud-video-scene-card"
    >
      <div className="grid gap-0 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="aspect-[16/10] bg-[#F3EDE4] lg:h-full">
          <MediaPreview media={scene.preview} alt={`${scene.title} preview`} className="h-full w-full" />
        </div>
        <div className="grid gap-4 p-4 md:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap gap-2">
                <StatusPill tone="ink">Scene {scene.order}</StatusPill>
                <StatusPill tone="neutral">{scene.sceneType}</StatusPill>
                <StatusPill tone={sceneTone(scene.status)}>{formatCampaignStatus(scene.status.replace(/\s/g, "_"))}</StatusPill>
                <StatusPill tone="neutral">{scene.preview.stateLabel}</StatusPill>
                <StatusPill tone="blue">{scene.durationLabel}</StatusPill>
              </div>
              <h3 className="mt-3 text-xl font-semibold tracking-[-0.03em] text-[#172033]">{scene.title}</h3>
            </div>
            <StatusPill tone="gold">{scene.assetType}</StatusPill>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-[1.3rem] border border-[#E8DCCC] bg-[#FFF9EF] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8A5A34]">Narration</p>
              <p className="mt-3 text-sm leading-6 text-[#526070]">{scene.narration}</p>
            </div>
            <div className="rounded-[1.3rem] border border-[#D8E2D9] bg-[#F4FAF5] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#6C7B6D]">On-screen Text</p>
              <p className="mt-3 text-sm leading-6 text-[#526070]">{scene.onScreenText}</p>
            </div>
          </div>

          <div className="grid gap-3 text-sm leading-6 text-[#526070]">
            <p>
              <span className="font-semibold text-[#172033]">Scene purpose:</span> {scene.purpose}
            </p>
            <p>
              <span className="font-semibold text-[#172033]">Associated story beat:</span> {scene.associatedLabel}
            </p>
            <p>
              <span className="font-semibold text-[#172033]">Source / provider:</span> {scene.sourceProvider}
            </p>
          </div>

          {scene.warnings.length > 0 ? (
            <div className="grid gap-2">
              {scene.warnings.map((warning) => (
                <p key={warning} className="rounded-2xl border border-[#F1C9C9] bg-[#FFF4F4] px-3 py-2 text-sm text-[#8A2D2D]">
                  {warning}
                </p>
              ))}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-3">
            {canOpenExternalUrl(scene.sourceUrl) ? (
              <a href={scene.sourceUrl!} target="_blank" rel="noreferrer noopener" className={secondaryButtonClass}>
                Open source media
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}

function SidebarButton({
  item,
  active,
  onClick,
}: {
  item: CasaHudWorkspaceNavItem;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      data-testid={`casahud-nav-${item.id}`}
      className={cx(
        "w-full rounded-[1.35rem] border px-4 py-3 text-left transition",
        active
          ? "border-[#172033] bg-[#172033] text-white shadow-[0_16px_30px_rgba(23,32,51,0.18)]"
          : "border-transparent bg-white/78 text-[#172033] hover:border-[#E2D4C2] hover:bg-white",
      )}
    >
      <p className={cx("text-[11px] font-semibold uppercase tracking-[0.18em]", active ? "text-white/68" : "text-[#8A5A34]")}>
        {item.eyebrow}
      </p>
      <p className="mt-1 text-sm font-semibold">{item.label}</p>
      <p className={cx("mt-2 text-xs leading-5", active ? "text-white/72" : "text-[#667386]")}>{item.description}</p>
    </button>
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
  const [campaignPackagingId, setCampaignPackagingId] = useState<string | null>(null);
  const [packageProgressIndex, setPackageProgressIndex] = useState(0);
  const [campaignRenderingId, setCampaignRenderingId] = useState<string | null>(null);
  const [campaignPublishingId, setCampaignPublishingId] = useState<string | null>(null);
  const [campaignSchedulingId, setCampaignSchedulingId] = useState<string | null>(null);
  const [scheduledPublishAt, setScheduledPublishAt] = useState(nextScheduleInputValue);
  const [connectionProviders, setConnectionProviders] = useState<DomaraIntegrationProviderStatus[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<"loading" | "ready" | "error">("loading");
  const [connectionSaveSupported, setConnectionSaveSupported] = useState(true);
  const [activeConnectionId, setActiveConnectionId] = useState<CasaHudConnectionCardId | null>(null);
  const [activeProviderId, setActiveProviderId] = useState<DomaraIntegrationProviderId>("youtube");
  const [connectionSecret, setConnectionSecret] = useState("");
  const [connectionNotice, setConnectionNotice] = useState<string | null>(null);
  const [connectionSaving, setConnectionSaving] = useState(false);
  const [connectionTesting, setConnectionTesting] = useState(false);
  const [activeSection, setActiveSection] = useState<CasaHudWorkspaceSection>("campaigns");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedListingId, setSelectedListingId] = useState<string | null>(null);
  const [scriptCopyNotice, setScriptCopyNotice] = useState<string | null>(null);

  const connectionCards = useMemo(() => buildCasaHudConnectionCards(connectionProviders), [connectionProviders]);
  const setupMessage = useMemo(() => getCasaHudSetupMessage(connectionCards), [connectionCards]);
  const activeConnectionCard = useMemo(() => {
    const fallback = connectionCards[0] || null;
    return connectionCards.find((card) => card.id === activeConnectionId) || fallback;
  }, [activeConnectionId, connectionCards]);
  const nextStep = useMemo(() => deriveNextStep(activeCampaign), [activeCampaign]);
  const phaseProgress = useMemo(() => buildPhaseProgress(activeCampaign), [activeCampaign]);
  const warnings = useMemo(() => buildCampaignWarnings(activeCampaign), [activeCampaign]);
  const blockers = useMemo(() => buildCampaignBlockers(activeCampaign), [activeCampaign]);
  const completedArtifacts = useMemo(() => buildCompletedArtifacts(activeCampaign), [activeCampaign]);
  const videoScenes = useMemo(() => buildVideoScenes(activeCampaign), [activeCampaign]);
  const activeListings = useMemo(() => {
    if (!activeCampaign) return [];
    return activeCampaign.approvedListings.length > 0 ? activeCampaign.approvedListings : activeCampaign.listingCandidates;
  }, [activeCampaign]);
  const campaignCards = useMemo(() => recentCampaigns.slice(0, 8), [recentCampaigns]);
  const hasRecentCampaigns = campaignCards.length > 0;
  const selectedListing = useMemo(() => {
    if (!activeCampaign || !selectedListingId) return null;
    return (
      activeCampaign.approvedListings.find((listing) => listing.id === selectedListingId) ||
      activeCampaign.rejectedListings.find((listing) => listing.id === selectedListingId) ||
      activeCampaign.listingCandidates.find((listing) => listing.id === selectedListingId) ||
      null
    );
  }, [activeCampaign, selectedListingId]);
  const currentCampaignLabel = activeCampaign?.name || "No campaign selected";
  const connectionSummary =
    connectionStatus === "loading"
      ? "Checking connection readiness."
      : connectionStatus === "error"
        ? "Connection status needs attention."
        : `${connectionCards.filter((card) => card.status === "connected" || card.status === "partially_connected").length} of ${connectionCards.length} connection groups ready.`;
  const opportunitySource = useMemo(() => {
    if (opportunityOutput) return opportunityOutput;
    if (!activeCampaign) return null;
    return {
      selectedTitle: activeCampaign.selectedTitle,
      titleCandidates: activeCampaign.titleCandidates,
      confidenceSummary: activeCampaign.confidenceReasoning.summary,
      titleOpportunitySummary: activeCampaign.confidenceReasoning.titleOpportunitySummary,
      researchBrief: activeCampaign.researchBrief,
      campaignTypePrediction: activeCampaign.campaignType,
      providerStatus: activeCampaign.generationSource,
    };
  }, [activeCampaign, opportunityOutput]);

  const loadConnectionStatus = useCallback(async () => {
    setConnectionStatus("loading");
    try {
      const response = await fetch("/api/studio/domara/integrations/status", { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as CasaHudConnectionStatusPayload | null;
      if (!response.ok || !payload?.ok) throw new Error("Could not load connections.");
      setConnectionProviders(payload.providers || []);
      setConnectionSaveSupported(payload.saveSupported !== false);
      setConnectionStatus("ready");
      return payload.providers || [];
    } catch {
      setConnectionStatus("error");
      return [];
    }
  }, []);

  const loadCampaigns = useCallback(async () => {
    try {
      const response = await fetch("/api/studio/domara/campaigns", { cache: "no-store" });
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
    if (connectionCards.length === 0 || activeConnectionId) return;
    const target = getMissingCasaHudCoreConnections(connectionCards)[0] || connectionCards[0];
    if (target) setActiveConnectionId(target.id);
  }, [activeConnectionId, connectionCards]);

  useEffect(() => {
    if (!activeConnectionCard) return;
    setActiveProviderId((current) =>
      activeConnectionCard.providerIds.includes(current)
        ? current
        : defaultProviderForCard(activeConnectionCard, connectionProviders),
    );
  }, [activeConnectionCard, connectionProviders]);

  useEffect(() => {
    if (generationStatus !== "loading" || progressIndex >= opportunitySteps.length - 1) return;
    const timeoutId = window.setTimeout(() => {
      setProgressIndex((current) => Math.min(current + 1, opportunitySteps.length - 1));
    }, 850);
    return () => window.clearTimeout(timeoutId);
  }, [generationStatus, progressIndex]);

  useEffect(() => {
    if (!campaignDiscoveringId || discoveryProgressIndex >= discoverySteps.length - 1) return;
    const timeoutId = window.setTimeout(() => {
      setDiscoveryProgressIndex((current) => Math.min(current + 1, discoverySteps.length - 1));
    }, 650);
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
    if (!campaignPackagingId || packageProgressIndex >= packageSteps.length - 1) return;
    const timeoutId = window.setTimeout(() => {
      setPackageProgressIndex((current) => Math.min(current + 1, packageSteps.length - 1));
    }, 620);
    return () => window.clearTimeout(timeoutId);
  }, [campaignPackagingId, packageProgressIndex]);

  useEffect(() => {
    setScheduledPublishAt(toDateTimeLocalValue(activeCampaign?.scheduledPublishAt) || nextScheduleInputValue());
  }, [activeCampaign?.id, activeCampaign?.scheduledPublishAt]);

  useEffect(() => {
    if (!selectedListingId || !activeCampaign) return;
    const listingStillExists =
      activeCampaign.approvedListings.some((listing) => listing.id === selectedListingId) ||
      activeCampaign.rejectedListings.some((listing) => listing.id === selectedListingId) ||
      activeCampaign.listingCandidates.some((listing) => listing.id === selectedListingId);
    if (!listingStillExists) setSelectedListingId(null);
  }, [activeCampaign, selectedListingId]);

  function openWorkspace(section: CasaHudWorkspaceSection) {
    setActiveSection(section);
    setDrawerOpen(false);
  }

  function openConnections(cardId?: CasaHudConnectionCardId) {
    if (cardId) setActiveConnectionId(cardId);
    setConnectionNotice(null);
    openWorkspace("connections");
  }

  async function onSaveConnection() {
    if (!activeConnectionCard) return;
    if (!connectionSaveSupported) {
      setConnectionNotice("This workspace cannot save new connections here yet.");
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionKey: connectionSecret }),
      });
      const payload = (await response.json().catch(() => null)) as CasaHudConnectionSavePayload | null;
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error?.message || "Could not save this connection.");
      }
      setConnectionSecret("");
      setConnectionNotice(`${providerOptionLabels[activeProviderId]} is connected.`);
      await loadConnectionStatus();
    } catch (error) {
      setConnectionNotice(error instanceof Error ? error.message : "Could not save this connection.");
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
        throw new Error(payload?.error?.message || "Could not verify this connection.");
      }
      setConnectionNotice(payload.message || `${providerOptionLabels[activeProviderId]} looks ready.`);
      await loadConnectionStatus();
    } catch (error) {
      setConnectionNotice(error instanceof Error ? error.message : "Could not verify this connection.");
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
      openWorkspace("opportunity_brief");

      const response = await fetch("/api/studio/domara/opportunity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferredMarket: "Italian real-estate YouTube" }),
      });
      const payload = (await response.json().catch(() => null)) as CasaHudOpportunityPayload | null;
      if (!response.ok || !payload?.ok || !payload.output) {
        throw new Error(payload?.error?.message || "Could not generate title opportunities right now.");
      }
      setOpportunityOutput(payload.output);
      setProgressIndex(opportunitySteps.length - 1);
      setGenerationStatus("ready");
    } catch (error) {
      setGenerationStatus("error");
      setGenerationError(error instanceof Error ? error.message : "Could not generate title opportunities right now.");
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opportunity: opportunityOutput }),
      });
      const payload = (await response.json().catch(() => null)) as CasaHudCampaignCreatePayload | null;
      if (!response.ok || !payload?.ok || !payload.campaign) {
        throw new Error(payload?.error?.message || "Could not save this campaign right now.");
      }

      setActiveCampaign(payload.campaign);
      setOpportunityOutput(null);
      setCampaignNotice(payload.message || `Campaign saved. "${payload.campaign.name}" is ready for the next step.`);
      setRecentCampaigns((current) => {
        const summary = payload.summary || summarizeCampaign(payload.campaign!);
        return [summary, ...current.filter((campaign) => campaign.id !== summary.id)];
      });
      openWorkspace(deriveResumeWorkspace(payload.campaign));
    } catch (error) {
      setCampaignError(error instanceof Error ? error.message : "Could not save this campaign right now.");
    } finally {
      setCampaignCreating(false);
    }
  }

  async function onResumeCampaign(campaignId: string) {
    try {
      setCampaignOpeningId(campaignId);
      setCampaignError(null);
      setCampaignNotice(null);
      const response = await fetch(`/api/studio/domara/campaigns/${encodeURIComponent(campaignId)}`, { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as CasaHudCampaignDetailPayload | null;
      if (!response.ok || !payload?.ok || !payload.campaign) {
        throw new Error(payload?.error?.message || "Could not reopen this campaign right now.");
      }
      setOpportunityOutput(null);
      setActiveCampaign(payload.campaign);
      setCampaignNotice(`Resumed "${payload.campaign.name}".`);
      openWorkspace(deriveResumeWorkspace(payload.campaign));
    } catch (error) {
      setCampaignError(error instanceof Error ? error.message : "Could not reopen this campaign right now.");
      openWorkspace("campaigns");
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
      openWorkspace("property_shortlist");

      const response = await fetch(`/api/studio/domara/campaigns/${encodeURIComponent(activeCampaign.id)}/discover-listings`, {
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as CasaHudListingDiscoveryPayload | null;
      if (!response.ok || !payload?.ok || !payload.campaign) {
        throw new Error(payload?.error?.message || "Could not discover listings right now.");
      }
      setActiveCampaign(payload.campaign);
      setCampaignNotice(payload.message || `Property discovery complete for "${payload.campaign.name}".`);
      setRecentCampaigns((current) => {
        const summary = payload.summary || summarizeCampaign(payload.campaign!);
        return [summary, ...current.filter((campaign) => campaign.id !== summary.id)];
      });
      setDiscoveryProgressIndex(discoverySteps.length - 1);
    } catch (error) {
      setCampaignError(error instanceof Error ? error.message : "Could not discover listings right now.");
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
      openWorkspace("property_shortlist");

      const response = await fetch(`/api/studio/domara/campaigns/${encodeURIComponent(activeCampaign.id)}/validate-listings`, {
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as CasaHudListingValidationPayload | null;
      if (!response.ok || !payload?.ok || !payload.campaign) {
        throw new Error(payload?.error?.message || "Could not validate listings right now.");
      }
      setActiveCampaign(payload.campaign);
      setCampaignNotice(payload.message || `Listing validation complete for "${payload.campaign.name}".`);
      setRecentCampaigns((current) => {
        const summary = payload.summary || summarizeCampaign(payload.campaign!);
        return [summary, ...current.filter((campaign) => campaign.id !== summary.id)];
      });
      setValidationProgressIndex(validationSteps.length - 1);
    } catch (error) {
      setCampaignError(error instanceof Error ? error.message : "Could not validate listings right now.");
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
      openWorkspace("location_story");

      const response = await fetch(`/api/studio/domara/campaigns/${encodeURIComponent(activeCampaign.id)}/location-intelligence`, {
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as CasaHudLocationIntelligencePayload | null;
      if (!response.ok || !payload?.ok || !payload.campaign) {
        throw new Error(payload?.error?.message || "Could not build the location story right now.");
      }
      setActiveCampaign(payload.campaign);
      setCampaignNotice(payload.message || `Location story ready for "${payload.campaign.name}".`);
      setRecentCampaigns((current) => {
        const summary = payload.summary || summarizeCampaign(payload.campaign!);
        return [summary, ...current.filter((campaign) => campaign.id !== summary.id)];
      });
      setLocationProgressIndex(locationSteps.length - 1);
    } catch (error) {
      setCampaignError(error instanceof Error ? error.message : "Could not build the location story right now.");
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
      openWorkspace("video_builder");

      const response = await fetch(`/api/studio/domara/campaigns/${encodeURIComponent(activeCampaign.id)}/script`, {
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as CasaHudScriptNarrativePayload | null;
      if (!response.ok || !payload?.ok || !payload.campaign) {
        throw new Error(payload?.error?.message || "Could not generate the script right now.");
      }
      setActiveCampaign(payload.campaign);
      setCampaignNotice(payload.message || `Script ready for "${payload.campaign.name}".`);
      setRecentCampaigns((current) => {
        const summary = payload.summary || summarizeCampaign(payload.campaign!);
        return [summary, ...current.filter((campaign) => campaign.id !== summary.id)];
      });
      setScriptProgressIndex(scriptSteps.length - 1);
    } catch (error) {
      setCampaignError(error instanceof Error ? error.message : "Could not generate the script right now.");
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
      openWorkspace("video_builder");

      const response = await fetch(`/api/studio/domara/campaigns/${encodeURIComponent(activeCampaign.id)}/media-plan`, {
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as CasaHudMediaPlanPayload | null;
      if (!response.ok || !payload?.ok || !payload.campaign) {
        throw new Error(payload?.error?.message || "Could not assemble the media plan right now.");
      }
      setActiveCampaign(payload.campaign);
      setCampaignNotice(payload.message || `Video Builder updated for "${payload.campaign.name}".`);
      setRecentCampaigns((current) => {
        const summary = payload.summary || summarizeCampaign(payload.campaign!);
        return [summary, ...current.filter((campaign) => campaign.id !== summary.id)];
      });
      setMediaProgressIndex(mediaSteps.length - 1);
    } catch (error) {
      setCampaignError(error instanceof Error ? error.message : "Could not assemble the media plan right now.");
    } finally {
      setCampaignMediaPlanningId(null);
    }
  }

  async function onBuildYouTubePackage() {
    if (!activeCampaign) return;
    try {
      setCampaignPackagingId(activeCampaign.id);
      setPackageProgressIndex(0);
      setCampaignError(null);
      setCampaignNotice(null);
      openWorkspace("youtube_package");

      const response = await fetch(`/api/studio/domara/campaigns/${encodeURIComponent(activeCampaign.id)}/youtube-package`, {
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as CasaHudYouTubePackagePayload | null;
      if (!response.ok || !payload?.ok || !payload.campaign) {
        throw new Error(payload?.error?.message || "Could not build the YouTube package right now.");
      }
      setActiveCampaign(payload.campaign);
      setCampaignNotice(payload.message || `YouTube package ready for "${payload.campaign.name}".`);
      setRecentCampaigns((current) => {
        const summary = payload.summary || summarizeCampaign(payload.campaign!);
        return [summary, ...current.filter((campaign) => campaign.id !== summary.id)];
      });
      setPackageProgressIndex(packageSteps.length - 1);
    } catch (error) {
      setCampaignError(error instanceof Error ? error.message : "Could not build the YouTube package right now.");
    } finally {
      setCampaignPackagingId(null);
    }
  }

  async function onRenderVideo() {
    if (!activeCampaign) return;
    try {
      setCampaignRenderingId(activeCampaign.id);
      setCampaignError(null);
      setCampaignNotice(null);
      openWorkspace("render_publish");

      const response = await fetch(`/api/studio/domara/campaigns/${encodeURIComponent(activeCampaign.id)}/render`, {
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as CasaHudExecutionPayload | null;
      if (payload?.campaign) {
        setActiveCampaign(payload.campaign);
        setRecentCampaigns((current) => {
          const summary = payload.summary || summarizeCampaign(payload.campaign!);
          return [summary, ...current.filter((campaign) => campaign.id !== summary.id)];
        });
      }
      if (!response.ok || !payload?.ok || !payload.campaign) {
        throw new Error(payload?.error?.message || payload?.message || "Could not render this campaign right now.");
      }
      setCampaignNotice(payload.message || `Render updated for "${payload.campaign.name}".`);
    } catch (error) {
      setCampaignError(error instanceof Error ? error.message : "Could not render this campaign right now.");
    } finally {
      setCampaignRenderingId(null);
    }
  }

  async function onPublishNow() {
    if (!activeCampaign) return;
    try {
      setCampaignPublishingId(activeCampaign.id);
      setCampaignError(null);
      setCampaignNotice(null);
      openWorkspace("render_publish");

      const response = await fetch(`/api/studio/domara/campaigns/${encodeURIComponent(activeCampaign.id)}/publish`, {
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as CasaHudExecutionPayload | null;
      if (payload?.campaign) {
        setActiveCampaign(payload.campaign);
        setRecentCampaigns((current) => {
          const summary = payload.summary || summarizeCampaign(payload.campaign!);
          return [summary, ...current.filter((campaign) => campaign.id !== summary.id)];
        });
      }
      if (!response.ok || !payload?.ok || !payload.campaign) {
        throw new Error(payload?.error?.message || payload?.message || "Could not publish this campaign right now.");
      }
      setCampaignNotice(payload.message || `Publish complete for "${payload.campaign.name}".`);
    } catch (error) {
      setCampaignError(error instanceof Error ? error.message : "Could not publish this campaign right now.");
    } finally {
      setCampaignPublishingId(null);
    }
  }

  async function onScheduleCampaign() {
    if (!activeCampaign) return;
    const scheduledAt = scheduledPublishAt ? new Date(scheduledPublishAt).toISOString() : "";
    if (!scheduledAt || Number.isNaN(Date.parse(scheduledAt))) {
      setCampaignError("Choose a valid publish time before scheduling this campaign.");
      return;
    }
    try {
      setCampaignSchedulingId(activeCampaign.id);
      setCampaignError(null);
      setCampaignNotice(null);
      openWorkspace("render_publish");

      const response = await fetch(`/api/studio/domara/campaigns/${encodeURIComponent(activeCampaign.id)}/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduledAt }),
      });
      const payload = (await response.json().catch(() => null)) as CasaHudExecutionPayload | null;
      if (payload?.campaign) {
        setActiveCampaign(payload.campaign);
        setRecentCampaigns((current) => {
          const summary = payload.summary || summarizeCampaign(payload.campaign!);
          return [summary, ...current.filter((campaign) => campaign.id !== summary.id)];
        });
      }
      if (!response.ok || !payload?.ok || !payload.campaign) {
        throw new Error(payload?.error?.message || payload?.message || "Could not schedule this campaign right now.");
      }
      setCampaignNotice(payload.message || `Schedule saved for "${payload.campaign.name}".`);
    } catch (error) {
      setCampaignError(error instanceof Error ? error.message : "Could not schedule this campaign right now.");
    } finally {
      setCampaignSchedulingId(null);
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
      setScriptCopyNotice("Could not copy the script right now.");
    }
  }

  function renderNextActionButton(step: CasaHudNextStep, fullWidth = false) {
    const className = cx(primaryButtonClass, fullWidth && "w-full");

    switch (step.actionId) {
      case "select_campaign":
        return (
          <button type="button" className={className} onClick={() => openWorkspace("campaigns")}>
            {step.ctaLabel}
          </button>
        );
      case "generate_opportunity":
        return (
          <button type="button" className={className} onClick={() => void onGenerateViralVideo()}>
            {step.ctaLabel}
          </button>
        );
      case "discover_listings":
        return (
          <button
            type="button"
            className={className}
            onClick={() => void onDiscoverListings()}
            disabled={!activeCampaign || campaignDiscoveringId === activeCampaign.id}
            data-testid="casahud-discover-listings-cta"
          >
            {campaignDiscoveringId === activeCampaign?.id ? "Finding Matching Properties..." : step.ctaLabel}
          </button>
        );
      case "validate_listings":
        return (
          <button
            type="button"
            className={className}
            onClick={() => void onValidateListings()}
            disabled={!activeCampaign || campaignValidatingId === activeCampaign.id}
            data-testid="casahud-validate-listings-cta"
          >
            {campaignValidatingId === activeCampaign?.id ? "Validating Listings..." : step.ctaLabel}
          </button>
        );
      case "build_location_story":
        return (
          <button
            type="button"
            className={className}
            onClick={() => void onAddLocationIntelligence()}
            disabled={!activeCampaign || campaignLocatingId === activeCampaign.id}
            data-testid="casahud-location-intelligence-cta"
          >
            {campaignLocatingId === activeCampaign?.id ? "Building Location Story..." : step.ctaLabel}
          </button>
        );
      case "generate_script":
        return (
          <button
            type="button"
            className={className}
            onClick={() => void onGenerateScript()}
            disabled={!activeCampaign || campaignScriptingId === activeCampaign.id}
            data-testid="casahud-generate-script-cta"
          >
            {campaignScriptingId === activeCampaign?.id ? "Generating Script..." : step.ctaLabel}
          </button>
        );
      case "build_media_plan":
        return (
          <button
            type="button"
            className={className}
            onClick={() => void onBuildMediaPlan()}
            disabled={!activeCampaign || campaignMediaPlanningId === activeCampaign.id}
            data-testid="casahud-build-media-plan-cta"
          >
            {campaignMediaPlanningId === activeCampaign?.id ? "Building Media Plan..." : step.ctaLabel}
          </button>
        );
      case "build_youtube_package":
        return (
          <button
            type="button"
            className={className}
            onClick={() => void onBuildYouTubePackage()}
            disabled={!activeCampaign || campaignPackagingId === activeCampaign.id}
            data-testid="casahud-build-youtube-package-cta"
          >
            {campaignPackagingId === activeCampaign?.id ? "Building YouTube Package..." : step.ctaLabel}
          </button>
        );
      case "review_render_publish":
      case "review_publish_status":
        return (
          <button type="button" className={className} onClick={() => openWorkspace("render_publish")}>
            {step.ctaLabel}
          </button>
        );
    }
  }

  function renderSidebarContent(mobile = false) {
    const currentStep = nextStep;
    return (
      <div className={cx("flex h-full min-h-0 flex-col", mobile ? "p-4" : "p-5 xl:p-6")}>
        <div className="rounded-[1.7rem] border border-[#223149] bg-[#172033] p-5 text-white shadow-[0_20px_40px_rgba(23,32,51,0.18)]">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#E9D5B7]">CasaHUD Studio</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em]">AI real-estate YouTube content engine</h2>
          <p className="mt-3 text-sm leading-6 text-white/74">
            Generate, build, review, and publish campaign-centered property videos without losing the workflow.
          </p>
        </div>

        <div className="mt-5 rounded-[1.7rem] border border-[#E7DCCB] bg-white/92 p-4" data-testid="casahud-current-campaign">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8A5A34]">Current Campaign</p>
          {activeCampaign ? (
            <div className="mt-3 grid gap-3">
              <div>
                <p className="text-lg font-semibold tracking-[-0.03em] text-[#172033]">{activeCampaign.name}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <StatusPill tone="neutral">{formatOpportunityCampaignType(activeCampaign.campaignType)}</StatusPill>
                  <StatusPill tone="gold">{formatCampaignStatus(activeCampaign.status)}</StatusPill>
                </div>
              </div>
              <div className="rounded-[1.2rem] border border-[#EEE3D4] bg-[#FFF9EF] p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8A5A34]">Next Best Action</p>
                <p className="mt-2 text-sm font-semibold text-[#172033]">{currentStep.title}</p>
                <p className="mt-2 text-sm leading-6 text-[#556274]">{currentStep.detail}</p>
              </div>
              <div className="grid gap-2">
                {renderNextActionButton(currentStep, true)}
                <button type="button" className={secondaryButtonClass} onClick={() => openWorkspace("campaigns")}>
                  Switch Campaign
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-3 grid gap-3">
              <p className="text-sm leading-6 text-[#556274]">No campaign selected.</p>
              <div className="grid gap-2">
                <button type="button" className={primaryButtonClass} onClick={() => openWorkspace("campaigns")}>
                  Select Campaign
                </button>
                <button type="button" className={secondaryButtonClass} onClick={() => void onGenerateViralVideo()}>
                  Generate Viral Video Title
                </button>
              </div>
            </div>
          )}
        </div>

        <div
          className={cx(
            "mt-5",
            mobile
              ? "flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain pr-1 pb-[calc(env(safe-area-inset-bottom)+2rem)]"
              : "flex flex-1 flex-col",
          )}
          data-testid={mobile ? "casahud-mobile-drawer-scroll" : undefined}
        >
          <nav className="grid gap-2">
            {workspaceNav.map((item) => (
              <SidebarButton key={item.id} item={item} active={activeSection === item.id} onClick={() => openWorkspace(item.id)} />
            ))}
          </nav>

          <div className={cx(mobile ? "mt-5" : "mt-auto pt-5")}>
          <div className="rounded-[1.5rem] border border-[#E7DCCB] bg-white/92 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8A5A34]">Connection Status</p>
                <p className="mt-2 text-sm leading-6 text-[#556274]">{connectionSummary}</p>
              </div>
              <StatusPill tone={connectionStatus === "error" ? "red" : "neutral"}>{connectionStatus}</StatusPill>
            </div>
            <div className="mt-4 grid gap-2">
              <button type="button" className={secondaryButtonClass} onClick={() => openConnections()}>
                Open Connections
              </button>
            </div>
            {setupMessage ? <p className="mt-3 text-xs leading-5 text-[#6A7687]">{setupMessage}</p> : null}
          </div>
        </div>
        </div>
      </div>
    );
  }

  let sectionContent: ReactNode = null;

  if (activeSection === "campaigns") {
    sectionContent = (
      <WorkspacePage
        eyebrow="Campaigns"
        title="Select the campaign you want to run"
        description="CasaHUD stays campaign-centered. Pick a campaign to resume, or generate a new opportunity when you need a fresh video concept."
        actions={
          <button
            type="button"
            className={primaryButtonClass}
            onClick={() => void onGenerateViralVideo()}
            disabled={generationStatus === "loading"}
            data-testid="casahud-generate-cta"
          >
            {generationStatus === "loading" ? "Generating Viral Video Title..." : "Generate Viral Video Title"}
          </button>
        }
        testId="casahud-campaigns"
      >
        {hasRecentCampaigns ? (
          <div className="grid gap-4">
            {campaignCards.map((campaign) => (
              <article
                key={campaign.id}
                className={cx(
                  "rounded-[1.65rem] border p-5 shadow-[0_16px_34px_rgba(70,55,35,0.08)]",
                  activeCampaign?.id === campaign.id
                    ? "border-[#172033] bg-[#FFF7EA]"
                    : "border-[#E7DCCB] bg-white/95",
                )}
                data-testid="casahud-campaign-card"
              >
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <div className="flex flex-wrap gap-2">
                      <StatusPill tone="neutral">{formatOpportunityCampaignType(campaign.campaignType)}</StatusPill>
                      <StatusPill tone="gold">{formatCampaignStatus(campaign.status)}</StatusPill>
                      {activeCampaign?.id === campaign.id ? <StatusPill tone="ink">Active campaign</StatusPill> : null}
                    </div>
                    <h2 className="text-2xl font-semibold tracking-[-0.03em] text-[#172033]">{campaign.name}</h2>
                  </div>
                  <div className="grid gap-2 text-sm leading-6 text-[#526070]">
                    <p>
                      <span className="font-semibold text-[#172033]">Campaign type:</span> {formatOpportunityCampaignType(campaign.campaignType)}
                    </p>
                    <p>
                      <span className="font-semibold text-[#172033]">Status:</span> {formatCampaignStatus(campaign.status)}
                    </p>
                    <p>
                      <span className="font-semibold text-[#172033]">Updated:</span> {formatCampaignTime(campaign.updatedAt || campaign.createdAt)}
                    </p>
                    <p>
                      <span className="font-semibold text-[#172033]">Summary:</span>{" "}
                      {campaign.scriptSummary ||
                        campaign.locationSummary ||
                        campaign.validationSummary ||
                        campaign.discoverySummary ||
                        campaign.packagingSummary ||
                        campaign.researchSummary}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      className={primaryButtonClass}
                      onClick={() => void onResumeCampaign(campaign.id)}
                      disabled={campaignOpeningId === campaign.id}
                      data-testid="casahud-resume-campaign"
                    >
                      {campaignOpeningId === campaign.id ? "Opening..." : "Resume Campaign"}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No campaigns yet"
            description="Select or create a campaign to begin. Generate the next viral video title when you want CasaHUD to open a fresh opportunity."
            action={
              <button type="button" className={primaryButtonClass} onClick={() => void onGenerateViralVideo()}>
                Generate Viral Video Title
              </button>
            }
          />
        )}
      </WorkspacePage>
    );
  }

  if (activeSection === "overview") {
    sectionContent = activeCampaign ? (
      <WorkspacePage
        eyebrow="Campaign Overview"
        title={activeCampaign.name}
        description="The overview answers where you are, what is done, and what to do next."
        actions={
          <>
            {renderNextActionButton(nextStep)}
            <button type="button" className={secondaryButtonClass} onClick={() => openWorkspace(nextStep.workspace)}>
              Open Next Workspace
            </button>
          </>
        }
        testId="casahud-overview"
      >
        <div className="grid gap-5 xl:grid-cols-[1.08fr_0.92fr]">
          <section className="grid gap-4">
            <div className="rounded-[1.6rem] border border-[#E7DCCB] bg-white/92 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8A5A34]">Current Status</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[#172033]">{formatCampaignStatus(activeCampaign.status)}</h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  <StatusPill tone="neutral">{formatOpportunityCampaignType(activeCampaign.campaignType)}</StatusPill>
                  <StatusPill tone="gold">{nextStep.statusLabel}</StatusPill>
                </div>
              </div>
              <div className="mt-4 grid gap-3 text-sm leading-6 text-[#526070]">
                <p>
                  <span className="font-semibold text-[#172033]">Next best action:</span> {nextStep.title}
                </p>
                <p>
                  <span className="font-semibold text-[#172033]">Campaign type:</span> {formatOpportunityCampaignType(activeCampaign.campaignType)}
                </p>
                <p>
                  <span className="font-semibold text-[#172033]">Updated:</span> {formatCampaignTime(activeCampaign.updatedAt)}
                </p>
                <p>
                  <span className="font-semibold text-[#172033]">Execution state:</span>{" "}
                  {activeCampaign.finalState ? formatCampaignStatus(activeCampaign.finalState) : "In progress"}
                </p>
              </div>
            </div>

            <div className="rounded-[1.6rem] border border-[#D8E2D9] bg-[#F4FAF5] p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#6C7B6D]">Phase Progress</p>
                  <h3 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-[#172033]">Generate → Build → Review → Publish</h3>
                </div>
              </div>
              <div className="mt-4 grid gap-3">
                {phaseProgress.map((step) => (
                  <div key={step.id} className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-2xl border border-[#D7E1D8] bg-white/90 px-4 py-3">
                    <p className="text-sm font-medium text-[#172033]">{step.label}</p>
                    <StatusPill tone={phaseTone(step.status)}>{formatCampaignStatus(step.status)}</StatusPill>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[1.6rem] border border-[#E7DCCB] bg-white/92 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8A5A34]">Completed Artifacts</p>
              <div className="mt-4 grid gap-2">
                {completedArtifacts.length > 0 ? (
                  completedArtifacts.map((artifact) => (
                    <p key={artifact} className="rounded-2xl border border-[#EEE3D4] bg-[#FFF9EF] px-4 py-3 text-sm text-[#526070]">
                      {artifact}
                    </p>
                  ))
                ) : (
                  <p className="rounded-2xl border border-[#EEE3D4] bg-[#FFF9EF] px-4 py-3 text-sm text-[#526070]">
                    The opportunity exists, but campaign artifacts have not been built yet.
                  </p>
                )}
              </div>
            </div>
          </section>

          <aside className="grid gap-4">
            <div className="rounded-[1.6rem] border border-[#E7DCCB] bg-white/92 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8A5A34]">Property Preview</p>
              <div className="mt-4 grid gap-3">
                {activeListings.slice(0, 2).length > 0 ? (
                  activeListings.slice(0, 2).map((listing) => (
                    <PropertyPreview key={listing.id} campaign={activeCampaign} listing={listing} />
                  ))
                ) : (
                  <p className="rounded-2xl border border-[#EEE3D4] bg-[#FFF9EF] px-4 py-3 text-sm text-[#526070]">
                    No properties have been added to this campaign yet.
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-[1.6rem] border border-[#F1C9C9] bg-[#FFF4F4] p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#9A2727]">Blockers & Warnings</p>
              <div className="mt-4 grid gap-2">
                {blockers.length === 0 && warnings.length === 0 ? (
                  <p className="rounded-2xl border border-[#E6D8C7] bg-white/90 px-4 py-3 text-sm text-[#526070]">
                    No blockers are preventing the next step right now.
                  </p>
                ) : (
                  [...blockers, ...warnings].slice(0, 6).map((item) => (
                    <p key={item} className="rounded-2xl border border-[#F1C9C9] bg-white/92 px-4 py-3 text-sm text-[#7C3030]">
                      {item}
                    </p>
                  ))
                )}
              </div>
            </div>
          </aside>
        </div>
      </WorkspacePage>
    ) : (
      <WorkspacePage
        eyebrow="Campaign Overview"
        title="No active campaign"
        description="Select a campaign first so CasaHUD can show what is done and what comes next."
        testId="casahud-overview"
      >
        <EmptyState
          title="No campaign selected"
          description="Select or create a campaign to begin."
          action={
            <button type="button" className={primaryButtonClass} onClick={() => openWorkspace("campaigns")}>
              Select Campaign
            </button>
          }
        />
      </WorkspacePage>
    );
  }

  if (activeSection === "opportunity_brief") {
    const winningTitleCandidate =
      opportunitySource?.titleCandidates.find((candidate) => candidate.title === opportunitySource.selectedTitle.title) || null;

    sectionContent = opportunitySource ? (
      <WorkspacePage
        eyebrow="Opportunity Brief"
        title={opportunitySource.selectedTitle.title}
        description="Review the selected concept, why it won, and how CasaHUD expects it to perform before the campaign moves forward."
        actions={
          <>
            {opportunityOutput ? (
              <button
                type="button"
                className={primaryButtonClass}
                onClick={() => void onCreateCampaign()}
                disabled={campaignCreating}
                data-testid="casahud-create-campaign-cta"
              >
                {campaignCreating ? "Creating Campaign..." : "Create Campaign"}
              </button>
            ) : null}
            <button type="button" className={secondaryButtonClass} onClick={() => void onGenerateViralVideo()}>
              Regenerate Opportunity
            </button>
          </>
        }
        testId="casahud-opportunity-brief"
      >
        {generationStatus === "loading"
          ? renderProgressList(opportunitySteps, progressIndex, "loading", "casahud-opportunity-progress")
          : null}

        <div className="mt-5 grid gap-5 xl:grid-cols-[1.06fr_0.94fr]">
          <section className="grid gap-4">
            <div className="rounded-[1.7rem] border border-[#E7DCCB] bg-[linear-gradient(160deg,rgba(255,249,239,0.96),rgba(255,255,255,0.88))] p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8A5A34]">Selected Opportunity</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-[#172033]">{opportunitySource.selectedTitle.title}</h2>
              <div className="mt-4 flex flex-wrap gap-2">
                <StatusPill tone="neutral">{formatOpportunityCampaignType(opportunitySource.selectedTitle.campaignType)}</StatusPill>
                <StatusPill tone="blue">Score {opportunitySource.selectedTitle.score}</StatusPill>
                <StatusPill tone="gold">{Math.round(opportunitySource.selectedTitle.confidence * 100)}% confidence</StatusPill>
                {opportunitySource.selectedTitle.regionHint ? (
                  <StatusPill tone="neutral">{opportunitySource.selectedTitle.regionHint}</StatusPill>
                ) : null}
              </div>
              <p className="mt-5 text-sm leading-6 text-[#526070]">
                {opportunitySource.titleOpportunitySummary}
              </p>
            </div>

            <div className="rounded-[1.7rem] border border-[#D8E2D9] bg-[#F4FAF5] p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#6C7B6D]">Why this title was chosen</p>
              <p className="mt-3 text-sm leading-7 text-[#344256]">{opportunitySource.selectedTitle.reasoning}</p>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl border border-[#D7E1D8] bg-white/90 p-4">
                  <p className="text-sm font-semibold text-[#172033]">Confidence</p>
                  <p className="mt-2 text-sm leading-6 text-[#526070]">{opportunitySource.confidenceSummary}</p>
                </div>
                <div className="rounded-2xl border border-[#D7E1D8] bg-white/90 p-4">
                  <p className="text-sm font-semibold text-[#172033]">Campaign type</p>
                  <p className="mt-2 text-sm leading-6 text-[#526070]">
                    {formatOpportunityCampaignType(opportunitySource.campaignTypePrediction)}
                  </p>
                </div>
              </div>
            </div>
          </section>

          <aside className="grid gap-4">
            <div className="rounded-[1.7rem] border border-[#E7DCCB] bg-white/92 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8A5A34]">Research Brief</p>
              <div className="mt-4 grid gap-3 text-sm leading-6 text-[#526070]">
                <p>{opportunitySource.researchBrief.summary}</p>
                <p>
                  <span className="font-semibold text-[#172033]">Opportunity categories:</span>{" "}
                  {opportunitySource.researchBrief.opportunityCategories.join(" · ")}
                </p>
                <p>
                  <span className="font-semibold text-[#172033]">Competitor patterns:</span>{" "}
                  {opportunitySource.researchBrief.competitorPatterns.join(" · ")}
                </p>
                <p>
                  <span className="font-semibold text-[#172033]">Risk notes:</span> {opportunitySource.researchBrief.riskNotes.join(" · ")}
                </p>
              </div>
            </div>

            <div className="rounded-[1.7rem] border border-[#D8E2D9] bg-white/92 p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#6C7B6D]">Title Candidates</p>
                  <h3 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-[#172033]">Ranked directions</h3>
                </div>
                <StatusPill tone="neutral">{formatCountLabel(opportunitySource.titleCandidates.length, "candidate")}</StatusPill>
              </div>
              <div className="mt-4 grid gap-3">
                {opportunitySource.titleCandidates.map((candidate: CasaHudOpportunityTitleCandidate, index: number) => (
                  <article key={candidate.id} className="rounded-2xl border border-[#E7DCCB] bg-[#FFF9EF] p-4" data-testid="casahud-candidate-card">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap gap-2">
                          <StatusPill tone="ink">#{index + 1}</StatusPill>
                          <StatusPill tone="neutral">{formatOpportunityCampaignType(candidate.campaignType)}</StatusPill>
                          {candidate.regionHint ? <StatusPill tone="neutral">{candidate.regionHint}</StatusPill> : null}
                        </div>
                        <h4 className="mt-3 text-base font-semibold tracking-[-0.02em] text-[#172033]">{candidate.title}</h4>
                      </div>
                      <StatusPill tone={winningTitleCandidate?.id === candidate.id ? "gold" : "blue"}>{candidate.score}</StatusPill>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-[#526070]">{candidate.reasoning}</p>
                  </article>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </WorkspacePage>
    ) : (
      <WorkspacePage
        eyebrow="Opportunity Brief"
        title="No opportunity brief yet"
        description="Generate the next opportunity to unlock title strategy, research context, and the selected campaign concept."
        testId="casahud-opportunity-brief"
      >
        <EmptyState
          title="Generate the next viral video title"
          description="CasaHUD will surface the selected title, ranked candidates, confidence reasoning, and the research brief that backs the campaign."
          action={
            <button type="button" className={primaryButtonClass} onClick={() => void onGenerateViralVideo()}>
              Generate Viral Video Title
            </button>
          }
        />
      </WorkspacePage>
    );
  }

  if (activeSection === "property_shortlist") {
    sectionContent = (
      <WorkspacePage
        eyebrow="Property Shortlist"
        title="Property Shortlist"
        description="Every discovered, approved, and rejected property includes a featured image area, title-fit reasoning, and media status."
        actions={activeCampaign ? renderNextActionButton(deriveNextStep(activeCampaign)) : undefined}
        testId="casahud-property-shortlist"
      >
        {campaignDiscoveringId === activeCampaign?.id
          ? renderProgressList(discoverySteps, discoveryProgressIndex, "loading", "casahud-discovery-progress")
          : null}
        {campaignValidatingId === activeCampaign?.id
          ? <div className="mt-4">{renderProgressList(validationSteps, validationProgressIndex, "loading", "casahud-validation-progress")}</div>
          : null}

        {activeCampaign ? (
          <div className="grid gap-6" data-testid="casahud-listing-candidates">
            {activeCampaign.discoverySummary ? (
              <div className="rounded-[1.6rem] border border-[#E7DCCB] bg-[#FFF9EF] p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8A5A34]">Discovery Summary</p>
                <p className="mt-3 text-sm leading-6 text-[#526070]">{activeCampaign.discoverySummary.headline}</p>
                <p className="mt-2 text-sm leading-6 text-[#526070]">{activeCampaign.discoverySummary.criteriaSummary}</p>
              </div>
            ) : null}

            {activeCampaign.listingValidationSummary ? (
              <div className="rounded-[1.6rem] border border-[#D8E2D9] bg-[#F4FAF5] p-5" data-testid="casahud-validation-summary">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[#172033]">{activeCampaign.listingValidationSummary.headline}</p>
                    <p className="mt-2 text-sm leading-6 text-[#526070]">{activeCampaign.listingValidationSummary.rankingExplanation}</p>
                  </div>
                  <StatusPill tone="blue">{formatSupportConfidence(activeCampaign.titleSupportConfidence)} support</StatusPill>
                </div>
              </div>
            ) : null}

            {activeCampaign.listingCandidates.length === 0 &&
            activeCampaign.approvedListings.length === 0 &&
            activeCampaign.rejectedListings.length === 0 ? (
              <EmptyState
                title="No listings yet"
                description="Find matching properties to back this title."
                action={renderNextActionButton(deriveNextStep(activeCampaign))}
              />
            ) : (
              <div className="grid gap-6">
                {activeCampaign.listingCandidates.length > 0 && activeCampaign.approvedListings.length === 0 ? (
                  <section className="grid gap-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8A5A34]">Discovered Candidates</p>
                        <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[#172033]">Candidate properties</h2>
                      </div>
                      <StatusPill tone="neutral">{formatCountLabel(activeCampaign.listingCandidates.length, "candidate")}</StatusPill>
                    </div>
                    <div className="grid gap-5 xl:grid-cols-2">
                      {activeCampaign.listingCandidates.map((listing) => (
                        <PropertyCard
                          key={listing.id}
                          campaign={activeCampaign}
                          listing={listing}
                          testId="casahud-listing-candidate-card"
                          onSelect={setSelectedListingId}
                        />
                      ))}
                    </div>
                  </section>
                ) : null}

                {activeCampaign.approvedListings.length > 0 ? (
                  <section className="grid gap-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#6C7B6D]">Approved Properties</p>
                        <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[#172033]">Featured shortlist</h2>
                      </div>
                      <StatusPill tone="sage">{formatCountLabel(activeCampaign.approvedListings.length, "approved property")}</StatusPill>
                    </div>
                    <div className="grid gap-5 xl:grid-cols-2">
                      {activeCampaign.approvedListings.map((listing) => (
                        <PropertyCard
                          key={listing.id}
                          campaign={activeCampaign}
                          listing={listing}
                          testId="casahud-approved-listing-card"
                          onSelect={setSelectedListingId}
                        />
                      ))}
                    </div>
                  </section>
                ) : null}

                {activeCampaign.rejectedListings.length > 0 ? (
                  <section className="grid gap-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#9A2727]">Rejected / Needs Attention</p>
                        <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[#172033]">Properties that did not make the cut</h2>
                      </div>
                      <StatusPill tone="red">{formatCountLabel(activeCampaign.rejectedListings.length, "listing")}</StatusPill>
                    </div>
                    <div className="grid gap-5 xl:grid-cols-2">
                      {activeCampaign.rejectedListings.map((listing) => (
                        <PropertyCard
                          key={listing.id}
                          campaign={activeCampaign}
                          listing={listing}
                          testId="casahud-rejected-listing-card"
                          onSelect={setSelectedListingId}
                        />
                      ))}
                    </div>
                  </section>
                ) : null}
              </div>
            )}
          </div>
        ) : (
          <EmptyState
            title="No campaign selected"
            description="Open a campaign to review its discovered properties and shortlist."
            action={
              <button type="button" className={primaryButtonClass} onClick={() => openWorkspace("campaigns")}>
                Select Campaign
              </button>
            }
          />
        )}
      </WorkspacePage>
    );
  }

  if (activeSection === "location_story") {
    sectionContent = activeCampaign ? (
      <WorkspacePage
        eyebrow="Location Story"
        title="Why this place matters"
        description="CasaHUD turns local highlights, POIs, and map ideas into a creator-facing place story."
        actions={renderNextActionButton(deriveNextStep(activeCampaign))}
        testId="casahud-location-story"
      >
        {campaignLocatingId === activeCampaign.id ? renderProgressList(locationSteps, locationProgressIndex, "loading", "casahud-location-progress") : null}

        {activeCampaign.locationIntelligenceStatus === "location_intelligence_completed" ? (
          <div className="grid gap-5 xl:grid-cols-[1.06fr_0.94fr]">
            <section className="grid gap-4">
              <div className="rounded-[1.7rem] border border-[#E7DCCB] bg-white/92 p-5" data-testid="casahud-location-intelligence-summary">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8A5A34]">Campaign Story</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[#172033]">
                  {activeCampaign.locationStory?.headline || activeCampaign.locationIntelligenceSummary?.headline}
                </h2>
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

              <div className="rounded-[1.7rem] border border-[#D8E2D9] bg-[#F4FAF5] p-5" data-testid="casahud-local-highlights">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#6C7B6D]">Local Highlights</p>
                <div className="mt-4 grid gap-3">
                  {activeCampaign.localHighlights.map((highlight) => (
                    <div key={highlight.id} className="rounded-2xl border border-[#D7E1D8] bg-white/92 p-4">
                      <p className="text-sm font-semibold text-[#172033]">{highlight.title}</p>
                      <p className="mt-2 text-sm leading-6 text-[#526070]">{highlight.description}</p>
                      <p className="mt-2 text-xs uppercase tracking-[0.12em] text-[#7A897E]">{highlight.locationText}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[1.7rem] border border-[#E7DCCB] bg-white/92 p-5" data-testid="casahud-listing-location-insights">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8A5A34]">Listing-specific Location Insights</p>
                <div className="mt-4 grid gap-3">
                  {activeCampaign.listingLocationInsights.map((insight) => (
                    <div key={insight.listingId} className="rounded-2xl border border-[#E7DCCB] bg-[#FFF9EF] p-4">
                      <p className="text-sm font-semibold text-[#172033]">
                        {activeCampaign.approvedListings.find((listing) => listing.id === insight.listingId)?.title ||
                          activeCampaign.listingCandidates.find((listing) => listing.id === insight.listingId)?.title ||
                          "Listing insight"}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-[#526070]">{insight.summary}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <aside className="grid gap-4">
              <div className="rounded-[1.7rem] border border-[#E7DCCB] bg-[#FFF9EF] p-5" data-testid="casahud-poi-bundle">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8A5A34]">POIs</p>
                <p className="mt-3 text-sm leading-6 text-[#526070]">{activeCampaign.poiBundle?.summary || "POI story is ready once the location pass runs."}</p>
                <div className="mt-4 grid gap-3">
                  {(activeCampaign.poiBundle?.cards || []).map((poi) => (
                    <div key={poi.id} className="rounded-2xl border border-[#E7DCCB] bg-white/92 p-4">
                      <p className="text-sm font-semibold text-[#172033]">{poi.name}</p>
                      <p className="mt-2 text-sm leading-6 text-[#526070]">{poi.relevanceReason}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[1.7rem] border border-[#D8E2D9] bg-white/92 p-5" data-testid="casahud-map-scene-ideas">
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

              <div className="rounded-[1.7rem] border border-[#D8E2D9] bg-white/92 p-5" data-testid="casahud-location-provider-statuses">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#6C7B6D]">Provider Status</p>
                <div className="mt-4 grid gap-3">
                  {activeCampaign.locationProviderStatuses.map((providerStatus) => (
                    <div key={providerStatus.provider} className="rounded-2xl border border-[#D8E2D9] bg-[#F7FAF8] p-4">
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
            title="Location story not ready"
            description="Add location intelligence to explain why the place matters."
            action={renderNextActionButton(deriveNextStep(activeCampaign))}
          />
        )}
      </WorkspacePage>
    ) : (
      <WorkspacePage
        eyebrow="Location Story"
        title="No campaign selected"
        description="Select a campaign to review its place story."
        testId="casahud-location-story"
      >
        <EmptyState title="No campaign selected" description="Open a campaign first." />
      </WorkspacePage>
    );
  }

  if (activeSection === "video_builder") {
    sectionContent = activeCampaign ? (
      <WorkspacePage
        eyebrow="Video Builder"
        title="Scene-based video builder"
        description="Every property image, map scene, and POI beat is paired with narration, on-screen text, purpose, and media status."
        actions={
          <>
            {renderNextActionButton(deriveNextStep(activeCampaign))}
            <button
              type="button"
              className={secondaryButtonClass}
              onClick={() => void onCopyScript()}
              disabled={!activeCampaign.fullScriptText}
            >
              Copy Master Script
            </button>
          </>
        }
        testId="casahud-video-builder"
      >
        {campaignScriptingId === activeCampaign.id ? renderProgressList(scriptSteps, scriptProgressIndex, "loading", "casahud-script-progress") : null}
        {campaignMediaPlanningId === activeCampaign.id ? <div className="mt-4">{renderProgressList(mediaSteps, mediaProgressIndex, "loading", "casahud-media-progress")}</div> : null}

        {activeCampaign.scriptGenerationStatus === "script_generated" ? (
          <div className="grid gap-6">
            <div className="grid gap-4 xl:grid-cols-[1.08fr_0.92fr]">
              <div className="rounded-[1.6rem] border border-[#D4DDF2] bg-[#F7FAFF] p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#41608E]">Video Builder Status</p>
                <p className="mt-3 text-sm leading-6 text-[#526070]">
                  {activeCampaign.mediaPlanningStatus === "media_plan_built"
                    ? activeCampaign.mediaPlanSummary || "Script and media plan are merged into the current scene builder."
                    : "The script is ready. Build the media plan to complete scene-to-asset mapping and coverage checks."}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <StatusPill tone="neutral">{formatCountLabel(videoScenes.length, "scene")}</StatusPill>
                  <StatusPill tone="blue">{formatDuration(activeCampaign.estimatedDurationSeconds)}</StatusPill>
                  <StatusPill tone={activeCampaign.mediaPlanningStatus === "media_plan_built" ? "sage" : "gold"}>
                    {activeCampaign.mediaPlanningStatus === "media_plan_built" ? "Media plan ready" : "Media plan pending"}
                  </StatusPill>
                </div>
              </div>

              <div className="rounded-[1.6rem] border border-[#E7DCCB] bg-white/92 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8A5A34]">Master Script</p>
                <p className="mt-3 whitespace-pre-line text-sm leading-6 text-[#526070]">
                  {activeCampaign.fullScriptText || activeCampaign.scriptSummary || activeCampaign.openingHook}
                </p>
                {scriptCopyNotice ? <p className="mt-3 text-sm text-[#526070]">{scriptCopyNotice}</p> : null}
              </div>
            </div>

            <div className="grid gap-4">
              {videoScenes.map((scene) => (
                <VideoSceneCard key={scene.id} scene={scene} />
              ))}
            </div>

            <div className="grid gap-4 xl:grid-cols-[1.02fr_0.98fr]">
              <div className="rounded-[1.6rem] border border-[#E7DCCB] bg-white/92 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8A5A34]">Shot List</p>
                <div className="mt-4 grid gap-3">
                  {activeCampaign.shotList.length > 0 ? (
                    activeCampaign.shotList.map((shot) => (
                      <div key={shot.id} className="rounded-2xl border border-[#E7DCCB] bg-[#FFF9EF] p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-[#172033]">
                            {shot.order}. {shot.title}
                          </p>
                          <StatusPill tone="blue">{formatCampaignStatus(shot.recommendedVisualType)}</StatusPill>
                        </div>
                        <p className="mt-2 text-sm leading-6 text-[#526070]">{shot.description}</p>
                      </div>
                    ))
                  ) : (
                    <p className="rounded-2xl border border-[#E7DCCB] bg-[#FFF9EF] p-4 text-sm leading-6 text-[#526070]">
                      The shot list appears once the media plan is built.
                    </p>
                  )}
                </div>
              </div>

              <div className="rounded-[1.6rem] border border-[#F1C9C9] bg-[#FFF4F4] p-5" data-testid="casahud-media-warnings">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#9A2727]">Missing Media Warnings</p>
                <div className="mt-4 grid gap-2">
                  {(activeCampaign.missingMediaWarnings || []).length > 0 ? (
                    (activeCampaign.missingMediaWarnings || []).map((warning) => (
                      <p key={warning} className="rounded-2xl border border-[#F1C9C9] bg-white/92 p-3 text-sm text-[#7C3030]">
                        {warning}
                      </p>
                    ))
                  ) : (
                    <p className="rounded-2xl border border-[#E6D8C7] bg-white/92 p-3 text-sm text-[#526070]">
                      No major media gaps are flagged on the current scene plan.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <EmptyState
            title="Video Builder not ready yet"
            description="Generate the script and media plan to build your scene-by-scene video."
            action={renderNextActionButton(deriveNextStep(activeCampaign))}
          />
        )}
      </WorkspacePage>
    ) : (
      <WorkspacePage
        eyebrow="Video Builder"
        title="No campaign selected"
        description="Select a campaign to open its scene builder."
        testId="casahud-video-builder"
      >
        <EmptyState title="No campaign selected" description="Open a campaign first." />
      </WorkspacePage>
    );
  }

  if (activeSection === "youtube_package") {
    sectionContent = activeCampaign ? (
      <WorkspacePage
        eyebrow="YouTube Package"
        title="YouTube package"
        description="Review the refined title, description, tags, chapters, thumbnail concept, and render readiness before publishing."
        actions={
          <>
            {renderNextActionButton(deriveNextStep(activeCampaign))}
            <button type="button" className={secondaryButtonClass} onClick={() => openWorkspace("render_publish")}>
              Open Render & Publish
            </button>
          </>
        }
        testId="casahud-youtube-package"
      >
        {campaignPackagingId === activeCampaign.id ? renderProgressList(packageSteps, packageProgressIndex, "loading", "casahud-package-progress") : null}

        {activeCampaign.youtubePackageStatus === "package_prepared" ? (
          <div className="grid gap-5 xl:grid-cols-[1.08fr_0.92fr]">
            <section className="grid gap-4">
              <div className="rounded-[1.7rem] border border-[#E7DCCB] bg-white/92 p-5" data-testid="casahud-package-title">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8A5A34]">Final Title</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[#172033]">
                  {activeCampaign.finalTitle || activeCampaign.selectedViralTitle}
                </h2>
                <p className="mt-3 text-sm leading-6 text-[#526070]">
                  {activeCampaign.titleRationale || activeCampaign.confidenceReasoning.selectedTitleReasoning || activeCampaign.confidenceReasoning.titleOpportunitySummary}
                </p>
              </div>

              <div className="rounded-[1.7rem] border border-[#D8E2D9] bg-[#F4FAF5] p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#6C7B6D]">Description</p>
                <p className="mt-3 whitespace-pre-line text-sm leading-6 text-[#526070]">
                  {activeCampaign.youtubeDescription || "The description draft appears here when the package is ready."}
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-[1.7rem] border border-[#E7DCCB] bg-white/92 p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8A5A34]">Tags & Hashtags</p>
                  <p className="mt-3 text-sm leading-6 text-[#526070]">
                    {activeCampaign.youtubeTags.join(", ") || "No tags"}
                  </p>
                  <p className="mt-3 text-sm leading-6 text-[#526070]">
                    {activeCampaign.youtubeHashtags.join(" ") || "No hashtags"}
                  </p>
                </div>
                <div className="rounded-[1.7rem] border border-[#D4DDF2] bg-[#F7FAFF] p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#41608E]">Chapters</p>
                  <div className="mt-3 grid gap-2">
                    {activeCampaign.youtubeChapters.map((chapter) => (
                      <p key={chapter.id} className="rounded-2xl border border-[#D4DDF2] bg-white/92 px-3 py-2 text-sm text-[#526070]">
                        {toTimestamp(chapter.startTimeSeconds)} · {chapter.title}
                      </p>
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-[1.7rem] border border-[#F1C9C9] bg-[#FFF4F4] p-5" data-testid="casahud-review-summary">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#9A2727]">Review Summary</p>
                <p className="mt-3 text-sm leading-6 text-[#526070]">
                  {activeCampaign.reviewSummary || activeCampaign.packagingSummary || "Review summary is ready."}
                </p>
                <div className="mt-4 grid gap-2">
                  {[...(activeCampaign.reviewBlockers || []), ...(activeCampaign.reviewWarnings || [])].slice(0, 4).map((item) => (
                    <p key={item} className="rounded-2xl border border-[#F1C9C9] bg-white/92 px-3 py-2 text-sm text-[#7C3030]">
                      {item}
                    </p>
                  ))}
                </div>
              </div>
            </section>

            <aside className="grid gap-4">
              <div className="rounded-[1.7rem] border border-[#E7DCCB] bg-white/92 p-5" data-testid="casahud-selected-properties-review">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8A5A34]">Selected Properties</p>
                <div className="mt-4 grid gap-3">
                  {(activeCampaign.approvedListings.length > 0 ? activeCampaign.approvedListings : activeCampaign.listingCandidates)
                    .slice(0, 3)
                    .map((listing) => (
                      <PropertyPreview key={listing.id} campaign={activeCampaign} listing={listing} />
                    ))}
                </div>
              </div>

              <div className="rounded-[1.7rem] border border-[#D4DDF2] bg-[#F7FAFF] p-5" data-testid="casahud-thumbnail-concept">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#41608E]">Thumbnail Concept</p>
                <div className="mt-3 grid gap-2 text-sm leading-6 text-[#526070]">
                  <p>{activeCampaign.thumbnailConcept?.visualDirection || "Thumbnail concept is ready."}</p>
                  <p>
                    <span className="font-semibold text-[#172033]">Headline:</span> {activeCampaign.thumbnailConcept?.headline || "Pending"}
                  </p>
                  <p>
                    <span className="font-semibold text-[#172033]">Text overlay:</span> {activeCampaign.thumbnailConcept?.textOverlay || "Pending"}
                  </p>
                </div>
              </div>

              <div className="rounded-[1.7rem] border border-[#E7DCCB] bg-[#FFF9EF] p-5" data-testid="casahud-render-plan">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8A5A34]">Render Plan Summary</p>
                <div className="mt-3 grid gap-2 text-sm leading-6 text-[#526070]">
                  <p>
                    <span className="font-semibold text-[#172033]">Readiness score:</span>{" "}
                    {typeof activeCampaign.readinessScore === "number" ? activeCampaign.readinessScore : "Pending"}
                  </p>
                  <p>
                    <span className="font-semibold text-[#172033]">Plan status:</span> {formatCampaignStatus(activeCampaign.renderPlanStatus)}
                  </p>
                  <p>{activeCampaign.renderPlan?.assetReadinessSummary || activeCampaign.previewPackage?.assetReadinessSummary || "Render plan summary is ready."}</p>
                </div>
              </div>
            </aside>
          </div>
        ) : (
          <EmptyState
            title="YouTube package not ready"
            description="Build the YouTube package after the video plan is ready."
            action={renderNextActionButton(deriveNextStep(activeCampaign))}
          />
        )}
      </WorkspacePage>
    ) : (
      <WorkspacePage
        eyebrow="YouTube Package"
        title="No campaign selected"
        description="Select a campaign to review its final package."
        testId="casahud-youtube-package"
      >
        <EmptyState title="No campaign selected" description="Open a campaign first." />
      </WorkspacePage>
    );
  }

  if (activeSection === "render_publish") {
    const youtubeCard = connectionCards.find((card) => card.id === "youtube");
    const youtubeConnected = youtubeCard?.status === "connected";
    const renderReady = activeCampaign?.youtubePackageStatus === "package_prepared" && activeCampaign.reviewStatus !== "blocked";
    const renderOutputUrl = activeCampaign?.renderOutputUrl || activeCampaign?.renderOutput?.url || null;
    const renderOutputPath = activeCampaign?.renderOutputPath || activeCampaign?.renderOutput?.path || null;
    const renderSceneCount =
      activeCampaign?.previewPackage?.sceneCount ||
      activeCampaign?.renderPlan?.sceneCount ||
      videoScenes.length ||
      0;
    const renderDurationSeconds =
      activeCampaign?.renderOutput?.durationSeconds ||
      activeCampaign?.previewPackage?.estimatedDurationSeconds ||
      activeCampaign?.renderPlan?.estimatedDurationSeconds ||
      activeCampaign?.estimatedDurationSeconds ||
      null;
    const renderRequiredAssetCount = activeCampaign?.renderPlan?.requiredAssets.length || 0;
    const renderPreviewState =
      activeCampaign?.renderOutput?.type === "mp4"
        ? "final_mp4"
        : activeCampaign?.renderOutput?.type === "preview_package" || activeCampaign?.previewPackage
          ? "preview_package"
          : activeCampaign?.renderStatus === "blocked" || (activeCampaign?.renderBlockers.length || 0) > 0
            ? "blocked"
            : "not_started";
    const renderOutputType =
      activeCampaign?.renderOutput?.type === "mp4"
        ? "Final MP4"
        : activeCampaign?.renderOutput?.type === "preview_package" || activeCampaign?.previewPackage
          ? "Preview package"
          : activeCampaign?.renderOutput?.type === "queued_job"
            ? "Queued job"
            : renderPreviewState === "blocked"
              ? "Blocked"
              : "Not started";
    const renderPreviewTone =
      renderPreviewState === "final_mp4"
        ? "sage"
        : renderPreviewState === "preview_package"
          ? "blue"
          : renderPreviewState === "blocked"
            ? "red"
            : "gold";
    const renderPreviewSummary =
      renderPreviewState === "final_mp4"
        ? "Final MP4 is ready. Review the output below before publishing."
        : renderPreviewState === "preview_package"
          ? "Preview package is ready. This is a preview package, not a final MP4."
          : renderPreviewState === "blocked"
            ? "Render is blocked right now. Resolve the blockers before generating a preview or final MP4."
            : activeCampaign?.renderPlan || videoScenes.length > 0
              ? "Render has not started yet, but the current package already shows what the video will include."
              : "Render has not started yet.";
    const renderNextSteps = uniq([
      renderPreviewState === "not_started" ? "Run Render Video to create the first preview package." : null,
      renderPreviewState === "preview_package" ? "Run the final render when you are ready for the Final MP4." : null,
      renderPreviewState === "blocked" ? activeCampaign?.renderBlockers[0] || "Resolve the listed blockers before rendering." : null,
      activeCampaign?.renderWarnings[0] || null,
      activeCampaign?.renderOutput?.type !== "mp4" ? "Publish stays locked until the Final MP4 exists." : null,
      !youtubeConnected ? "Connect YouTube before publish or scheduling." : null,
      youtubeConnected && activeCampaign?.renderOutput?.type === "mp4" ? "Choose Publish Now or Schedule to YouTube." : null,
    ]).slice(0, 4);
    const previewScenes = videoScenes.slice(0, 3);

    sectionContent = activeCampaign ? (
      <WorkspacePage
        eyebrow="Render & Publish"
        title="Render and publish"
        description="Render the current package, review honest output state, and publish or schedule when YouTube is connected."
        actions={
          <>
            <button
              type="button"
              className={primaryButtonClass}
              onClick={() => void onRenderVideo()}
              disabled={!renderReady || campaignRenderingId === activeCampaign.id}
              data-testid="casahud-render-video-cta"
            >
              {campaignRenderingId === activeCampaign.id ? "Rendering..." : "Render Video"}
            </button>
            <button type="button" className={secondaryButtonClass} onClick={() => openWorkspace("youtube_package")}>
              Back to YouTube Package
            </button>
          </>
        }
        testId="casahud-render-publish"
      >
        <div className="grid gap-5 xl:grid-cols-[1.08fr_0.92fr]">
          <section className="grid gap-4">
            <div className="rounded-[1.7rem] border border-[#E7DCCB] bg-white/92 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8A5A34]">Video Preview</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[#172033]">{renderOutputType}</h2>
                </div>
                <StatusPill tone={renderPreviewTone}>{renderOutputType}</StatusPill>
              </div>

              <p className="mt-3 text-sm leading-6 text-[#526070]" data-testid="casahud-video-preview">
                {renderPreviewSummary}
              </p>

              {renderPreviewState === "final_mp4" && renderOutputUrl ? (
                <div
                  className="mt-5 overflow-hidden rounded-[1.5rem] border border-[#D4DDF2] bg-[#0F1525]"
                  data-testid="casahud-video-preview-player"
                >
                  <video controls preload="metadata" className="h-full max-h-[420px] w-full bg-black">
                    <source src={renderOutputUrl} type={activeCampaign.renderOutput?.format || "video/mp4"} />
                  </video>
                </div>
              ) : null}

              {renderPreviewState !== "final_mp4" ? (
                previewScenes.length > 0 ? (
                  <div className="mt-5 grid gap-3 md:grid-cols-3" data-testid="casahud-video-preview-storyboard">
                    {previewScenes.map((scene) => (
                      <article key={scene.id} className="overflow-hidden rounded-[1.3rem] border border-[#E7DCCB] bg-[#FFF9EF]">
                        <div className="aspect-[16/10] bg-[#F3EDE4]">
                          <MediaPreview media={scene.preview} alt={`${scene.title} storyboard preview`} className="h-full w-full" />
                        </div>
                        <div className="grid gap-2 p-4">
                          <div className="flex flex-wrap gap-2">
                            <StatusPill tone="ink">Scene {scene.order}</StatusPill>
                            <StatusPill tone="neutral">{scene.preview.stateLabel}</StatusPill>
                          </div>
                          <p className="text-sm font-semibold text-[#172033]">{scene.title}</p>
                          <p className="text-sm leading-6 text-[#526070]">{scene.onScreenText}</p>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="mt-5 rounded-[1.4rem] border border-dashed border-[#D7CAB8] bg-[#FFF9EF] p-4 text-sm leading-6 text-[#526070]">
                    CasaHUD does not have a storyboard preview yet. Build the package or render plan first.
                  </div>
                )
              ) : null}

              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                <div className="rounded-[1.4rem] border border-[#D4DDF2] bg-[#F7FAFF] p-4 text-sm leading-6 text-[#526070]">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#41608E]">Preview Details</p>
                  <div className="mt-3 grid gap-2">
                    <p>
                      <span className="font-semibold text-[#172033]">Render status:</span> {formatCampaignStatus(activeCampaign.renderStatus)}
                    </p>
                    <p>
                      <span className="font-semibold text-[#172033]">Scene count:</span> {renderSceneCount || "Pending"}
                    </p>
                    <p>
                      <span className="font-semibold text-[#172033]">Estimated duration:</span> {formatDuration(renderDurationSeconds)}
                    </p>
                    <p>
                      <span className="font-semibold text-[#172033]">Included assets:</span>{" "}
                      {renderRequiredAssetCount > 0 ? formatCountLabel(renderRequiredAssetCount, "asset") : "Pending"}
                    </p>
                    <p>
                      <span className="font-semibold text-[#172033]">Created:</span>{" "}
                      {activeCampaign.renderOutput?.createdAt ? formatDateTimeLabel(activeCampaign.renderOutput.createdAt) : "Pending"}
                    </p>
                    <p>
                      <span className="font-semibold text-[#172033]">Provider:</span>{" "}
                      {activeCampaign.renderProviderStatus ? formatCampaignStatus(activeCampaign.renderProviderStatus.provider) : "Pending"}
                    </p>
                    <p>
                      <span className="font-semibold text-[#172033]">Output:</span> {renderOutputType}
                    </p>
                    <p>
                      <span className="font-semibold text-[#172033]">Asset readiness:</span>{" "}
                      {activeCampaign.renderPlan?.assetReadinessSummary || activeCampaign.previewPackage?.assetReadinessSummary || "Pending"}
                    </p>
                  </div>
                </div>

                <div className="rounded-[1.4rem] border border-[#E7DCCB] bg-[#FFF9EF] p-4 text-sm leading-6 text-[#526070]">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8A5A34]">Before Publish</p>
                  <div className="mt-3 grid gap-2">
                    {renderNextSteps.length > 0 ? (
                      renderNextSteps.map((item) => (
                        <p key={item} className="rounded-2xl border border-[#E6D8C7] bg-white/92 px-3 py-2 text-sm text-[#526070]">
                          {item}
                        </p>
                      ))
                    ) : (
                      <p className="rounded-2xl border border-[#E6D8C7] bg-white/92 px-3 py-2 text-sm text-[#526070]">
                        No remaining steps are blocking publish readiness right now.
                      </p>
                    )}
                    {renderPreviewState === "final_mp4" && renderOutputUrl ? (
                      <a
                        href={renderOutputUrl}
                        target="_blank"
                        rel="noreferrer noopener"
                        className={secondaryButtonClass}
                      >
                        Open Final MP4
                      </a>
                    ) : null}
                    {renderPreviewState === "final_mp4" && !renderOutputUrl && renderOutputPath ? (
                      <p className="rounded-2xl border border-[#E6D8C7] bg-white/92 px-3 py-2 text-sm text-[#526070]">
                        <span className="font-semibold text-[#172033]">Output path:</span> {renderOutputPath}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[1.7rem] border border-[#F1C9C9] bg-[#FFF4F4] p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#9A2727]">Warnings & Blockers</p>
              <div className="mt-4 grid gap-2">
                {[...(activeCampaign.renderBlockers || []), ...(activeCampaign.renderWarnings || [])].length > 0 ? (
                  [...(activeCampaign.renderBlockers || []), ...(activeCampaign.renderWarnings || [])].map((item) => (
                    <p key={item} className="rounded-2xl border border-[#F1C9C9] bg-white/92 p-3 text-sm text-[#7C3030]">
                      {item}
                    </p>
                  ))
                ) : (
                  <p className="rounded-2xl border border-[#E6D8C7] bg-white/92 p-3 text-sm text-[#526070]">
                    No render-specific blockers are recorded on this campaign.
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-[1.7rem] border border-[#E7DCCB] bg-white/92 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8A5A34]">Run History</p>
              <div className="mt-4 grid gap-3">
                {(activeCampaign.executionRunHistory || []).length > 0 ? (
                  (activeCampaign.executionRunHistory || []).slice(0, 6).map((run) => (
                    <div key={run.id} className="rounded-2xl border border-[#E7DCCB] bg-[#FFF9EF] p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-[#172033]">
                          {formatCampaignStatus(run.type)} · {formatCampaignStatus(run.status)}
                        </p>
                        <StatusPill tone="neutral">{formatCampaignTime(run.startedAt)}</StatusPill>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-[#526070]">{run.message}</p>
                    </div>
                  ))
                ) : (
                  <p className="rounded-2xl border border-[#E7DCCB] bg-[#FFF9EF] p-4 text-sm text-[#526070]">
                    No publish job has been run.
                  </p>
                )}
              </div>
            </div>
          </section>

          <aside className="grid gap-4">
            <div className="rounded-[1.7rem] border border-[#D8E2D9] bg-[#F4FAF5] p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#6C7B6D]">Publish Controls</p>
              <p className="mt-3 text-sm leading-6 text-[#526070]">
                {youtubeConnected
                  ? "YouTube is connected. Publish now or schedule the campaign when the render is ready."
                  : "YouTube connection required. Buttons stay visible so the next step is clear, but CasaHUD will not fake success."}
              </p>
              <div className="mt-4 grid gap-3">
                <button
                  type="button"
                  className={primaryButtonClass}
                  onClick={() => void onPublishNow()}
                  disabled={!youtubeConnected || activeCampaign.renderOutput?.type !== "mp4" || campaignPublishingId === activeCampaign.id}
                  data-testid="casahud-publish-now-cta"
                >
                  {campaignPublishingId === activeCampaign.id ? "Publishing..." : "Publish Now"}
                </button>
                <label className="grid gap-2 text-sm text-[#526070]">
                  Schedule to YouTube
                  <input
                    type="datetime-local"
                    value={scheduledPublishAt}
                    onChange={(event) => setScheduledPublishAt(event.target.value)}
                    className="w-full rounded-2xl border border-[#D7CAB8] bg-white px-4 py-3 text-sm text-[#172033] outline-none"
                  />
                </label>
                <button
                  type="button"
                  className={secondaryButtonClass}
                  onClick={() => void onScheduleCampaign()}
                  disabled={!youtubeConnected || activeCampaign.renderOutput?.type !== "mp4" || campaignSchedulingId === activeCampaign.id}
                  data-testid="casahud-schedule-youtube-cta"
                >
                  {campaignSchedulingId === activeCampaign.id ? "Scheduling..." : "Schedule to YouTube"}
                </button>
                {!youtubeConnected ? (
                  <button type="button" className={secondaryButtonClass} onClick={() => openConnections("youtube")}>
                    Connect YouTube
                  </button>
                ) : null}
              </div>
            </div>

            <div className="rounded-[1.7rem] border border-[#D4DDF2] bg-[#F7FAFF] p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#41608E]">Output Preview</p>
              <div className="mt-4 grid gap-2 text-sm leading-6 text-[#526070]">
                <p>
                  <span className="font-semibold text-[#172033]">Provider:</span>{" "}
                  {activeCampaign.renderProviderStatus ? formatCampaignStatus(activeCampaign.renderProviderStatus.provider) : "Pending"}
                </p>
                <p>
                  <span className="font-semibold text-[#172033]">Provider state:</span>{" "}
                  {activeCampaign.renderProviderStatus ? formatCampaignStatus(activeCampaign.renderProviderStatus.state) : "Pending"}
                </p>
                <p>
                  <span className="font-semibold text-[#172033]">Preview package:</span>{" "}
                  {activeCampaign.previewPackage?.assetReadinessSummary || "Not available yet."}
                </p>
                <p>
                  <span className="font-semibold text-[#172033]">Output state:</span>{" "}
                  {renderPreviewState === "preview_package"
                    ? "Preview package only. This is not a final MP4."
                    : renderPreviewState === "final_mp4"
                      ? "Final MP4 recorded."
                      : renderPreviewState === "blocked"
                        ? "Render is blocked until the blockers are resolved."
                        : "Render has not started yet."}
                </p>
                <p>
                  <span className="font-semibold text-[#172033]">Publish status:</span> {formatCampaignStatus(activeCampaign.publishStatus)}
                </p>
                <p>
                  <span className="font-semibold text-[#172033]">Schedule status:</span> {formatCampaignStatus(activeCampaign.scheduleStatus)}
                </p>
                {renderOutputPath ? (
                  <p>
                    <span className="font-semibold text-[#172033]">Output path:</span> {renderOutputPath}
                  </p>
                ) : null}
              </div>
            </div>
          </aside>
        </div>
      </WorkspacePage>
    ) : (
      <WorkspacePage
        eyebrow="Render & Publish"
        title="No campaign selected"
        description="Select a campaign to render or publish."
        testId="casahud-render-publish"
      >
        <EmptyState title="No campaign selected" description="Open a campaign first." />
      </WorkspacePage>
    );
  }

  if (activeSection === "connections") {
    sectionContent = (
      <WorkspacePage
        eyebrow="Connections"
        title="Connections"
        description="Manage creation, discovery, storage, and YouTube services without surfacing raw environment variable language."
        testId="casahud-connections"
      >
        <div className="grid gap-5 xl:grid-cols-[1.02fr_0.98fr]">
          <section className="grid gap-4" data-testid="casahud-connections-panel">
            {connectionCards.map((card) => (
              <button
                key={card.id}
                type="button"
                className={cx(
                  "rounded-[1.6rem] border p-5 text-left transition",
                  activeConnectionCard?.id === card.id
                    ? "border-[#172033] bg-[#172033] text-white shadow-[0_18px_34px_rgba(23,32,51,0.16)]"
                    : "border-[#E7DCCB] bg-white/92 text-[#172033] hover:bg-[#FFF8EE]",
                )}
                onClick={() => {
                  setActiveConnectionId(card.id);
                  setConnectionNotice(null);
                }}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className={cx("text-sm font-semibold", activeConnectionCard?.id === card.id ? "text-white" : "text-[#172033]")}>{card.title}</p>
                    <p className={cx("mt-2 text-sm leading-6", activeConnectionCard?.id === card.id ? "text-white/74" : "text-[#526070]")}>{card.enables}</p>
                  </div>
                  <StatusPill tone={connectionTone(card.status)}>{card.statusLabel}</StatusPill>
                </div>
              </button>
            ))}
          </section>

          <aside className="grid gap-4">
            {activeConnectionCard ? (
              <>
                <div className="rounded-[1.6rem] border border-[#E7DCCB] bg-white/92 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8A5A34]">{activeConnectionCard.title}</p>
                      <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[#172033]">{activeConnectionCard.statusLabel}</h2>
                    </div>
                    <StatusPill tone={connectionTone(activeConnectionCard.status)}>{activeConnectionCard.statusLabel}</StatusPill>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-[#526070]">{activeConnectionCard.detail}</p>
                </div>

                <div className="rounded-[1.6rem] border border-[#D8E2D9] bg-[#F4FAF5] p-5">
                  <label className="text-xs font-semibold uppercase tracking-[0.16em] text-[#6C7B6D]">Provider</label>
                  <select
                    value={activeProviderId}
                    onChange={(event) => setActiveProviderId(event.target.value as DomaraIntegrationProviderId)}
                    className="mt-2 w-full rounded-2xl border border-[#D7CAB8] bg-white px-4 py-3 text-sm text-[#172033] outline-none"
                  >
                    {activeConnectionCard.providerIds.map((providerId) => (
                      <option key={providerId} value={providerId}>
                        {providerOptionLabels[providerId]}
                      </option>
                    ))}
                  </select>

                  <label className="mt-4 block text-xs font-semibold uppercase tracking-[0.16em] text-[#6C7B6D]">
                    Connection Key
                  </label>
                  <input
                    type="password"
                    value={connectionSecret}
                    onChange={(event) => setConnectionSecret(event.target.value)}
                    placeholder={`Paste ${providerOptionLabels[activeProviderId]} connection key`}
                    className="mt-2 w-full rounded-2xl border border-[#D7CAB8] bg-white px-4 py-3 text-sm text-[#172033] outline-none"
                  />

                  <div className="mt-4 flex flex-wrap gap-3">
                    <button type="button" className={primaryButtonClass} onClick={() => void onSaveConnection()} disabled={connectionSaving}>
                      {connectionSaving ? "Saving..." : activeConnectionCard.ctaLabel}
                    </button>
                    <button type="button" className={secondaryButtonClass} onClick={() => void onTestConnection()} disabled={connectionTesting}>
                      {connectionTesting ? "Testing..." : "Test Connection"}
                    </button>
                  </div>

                  {connectionNotice ? (
                    <p className="mt-4 rounded-2xl border border-[#E7DCCB] bg-white/92 p-4 text-sm leading-6 text-[#526070]">
                      {connectionNotice}
                    </p>
                  ) : null}
                </div>

                <div className="rounded-[1.6rem] border border-[#E7DCCB] bg-white/92 p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8A5A34]">What it enables</p>
                  <p className="mt-3 text-sm leading-6 text-[#526070]">{activeConnectionCard.enables}</p>
                  <p className="mt-4 text-xs font-semibold uppercase tracking-[0.16em] text-[#8A5A34]">Friendly helper text</p>
                  <p className="mt-3 text-sm leading-6 text-[#526070]">{activeConnectionCard.missingSetupGuidance}</p>
                </div>
              </>
            ) : null}
          </aside>
        </div>
      </WorkspacePage>
    );
  }

  const selectedListingMedia =
    selectedListing && activeCampaign ? deriveCasaHudFeaturedPropertyMedia(selectedListing, activeCampaign) : null;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(255,242,219,0.72),transparent_34%),linear-gradient(180deg,#FFF7EA_0%,#F7F3EC_42%,#F4F7FB_100%)] text-[#172033]">
      <div className="mx-auto flex min-h-screen max-w-[1780px]" data-testid="casahud-workspace-shell">
        <aside className="hidden w-[330px] shrink-0 border-r border-[#E6D8C7] bg-[#FFFBF4]/82 backdrop-blur lg:flex" data-testid="casahud-sidebar">
          {renderSidebarContent()}
        </aside>

        <div className="flex min-h-screen flex-1 flex-col">
          <header className="sticky top-0 z-30 border-b border-[#E6D8C7] bg-[#FFFDF8]/92 px-4 py-4 backdrop-blur lg:hidden">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8A5A34]">CasaHUD Studio</p>
                <p className="mt-1 truncate text-sm font-semibold text-[#172033]">{currentCampaignLabel}</p>
                <p className="mt-1 text-xs text-[#6A7687]">
                  {activeCampaign ? formatCampaignStatus(activeCampaign.status) : "No campaign selected"}
                </p>
              </div>
              <button
                type="button"
                className={secondaryButtonClass}
                onClick={() => setDrawerOpen(true)}
                data-testid="casahud-mobile-menu"
              >
                Menu
              </button>
            </div>
          </header>

          {drawerOpen ? (
            <div className="fixed inset-0 z-40 flex bg-[#172033]/45 lg:hidden" onClick={() => setDrawerOpen(false)}>
              <div
                className="flex h-[100dvh] max-h-[100dvh] w-[88vw] max-w-[360px] overflow-hidden bg-[#FFFDF8] pb-[env(safe-area-inset-bottom)] shadow-[0_24px_60px_rgba(23,32,51,0.28)]"
                onClick={(event) => event.stopPropagation()}
                data-testid="casahud-mobile-drawer"
              >
                {renderSidebarContent(true)}
              </div>
            </div>
          ) : null}

          <main className="flex-1 p-4 md:p-6 xl:p-8">
            <div className="mx-auto grid max-w-7xl gap-4">
              {campaignNotice ? (
                <div className="rounded-2xl border border-[#C6DFC9] bg-[#F2FBF3] px-4 py-3 text-sm text-[#0F5132]" data-testid="casahud-campaign-create-success">
                  {campaignNotice}
                </div>
              ) : null}
              {campaignError ? (
                <div className="rounded-2xl border border-[#E9C4A5] bg-[#FFF5DA] px-4 py-3 text-sm text-[#7A4B13]">
                  {campaignError}
                </div>
              ) : null}
              {generationError ? (
                <div className="rounded-2xl border border-[#F1C9C9] bg-[#FFF4F4] px-4 py-3 text-sm text-[#7C3030]" data-testid="casahud-generation-error">
                  {generationError}
                </div>
              ) : null}

              {sectionContent}
            </div>
          </main>
        </div>
      </div>

      {selectedListing && activeCampaign && selectedListingMedia ? (
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
                className={secondaryButtonClass}
                onClick={() => setSelectedListingId(null)}
                aria-label="Close property details"
              >
                Close
              </button>
            </div>

            <div className="grid gap-0 lg:grid-cols-[1.02fr_0.98fr]">
              <div className="min-h-[320px] bg-[#F3EDE4]">
                <MediaPreview media={selectedListingMedia} alt={`${selectedListing.title} detail image`} className="min-h-[320px] w-full" />
              </div>
              <div className="grid gap-5 p-5 md:p-6">
                <div className="flex flex-wrap gap-2">
                  <StatusPill tone={listingStatusTone(selectedListing)}>{statusLabelFromListing(selectedListing)}</StatusPill>
                  <StatusPill tone="neutral">{formatListingProvider(selectedListing.provider)}</StatusPill>
                  <StatusPill tone="blue">{selectedListingMedia.stateLabel}</StatusPill>
                </div>

                <div className="grid gap-3 text-sm leading-6 text-[#526070]">
                  <p>
                    <span className="font-semibold text-[#172033]">Location:</span> {selectedListing.locationText}
                  </p>
                  <p>
                    <span className="font-semibold text-[#172033]">Price:</span> {formatListingPrice(selectedListing.price, selectedListing.currency)}
                  </p>
                  <p>
                    <span className="font-semibold text-[#172033]">Listing facts:</span> {propertyFacts(selectedListing).join(" · ") || "Facts pending"}
                  </p>
                  <p>
                    <span className="font-semibold text-[#172033]">Why it matters:</span> {getPropertySupportCopy(activeCampaign, selectedListing)}
                  </p>
                  <p>
                    <span className="font-semibold text-[#172033]">Media status:</span> {selectedListingMedia.stateLabel} via {selectedListingMedia.sourceLabel}
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  {canOpenExternalUrl(selectedListing.sourceUrl) ? (
                    <a href={selectedListing.sourceUrl!} target="_blank" rel="noreferrer noopener" className={primaryButtonClass}>
                      Open source listing
                    </a>
                  ) : (
                    <span className={mutedButtonClass}>Source unavailable</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

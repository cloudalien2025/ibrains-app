"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { CasaHudCampaign, CasaHudCampaignSummary } from "@/lib/studio/domara/campaigns";
import type {
  CasaHudOpportunityCampaignType,
  CasaHudOpportunityResult,
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

type CasaHudProgressStep = {
  id: string;
  label: string;
};

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

function formatCampaignStatus(status?: string) {
  if (!status) return "Saved";
  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
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
  if (provider === "casahud_sample") return "CasaHUD sample listing patterns";
  return provider;
}

function formatSupportConfidence(value?: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "Pending";
  return `${Math.round(value)}%`;
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
    discoverySummary: campaign.discoverySummary?.headline,
    validationSummary: campaign.listingValidationSummary?.headline,
    locationSummary: campaign.locationIntelligenceSummary?.headline,
    scriptSummary: campaign.scriptSummary ?? undefined,
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

export default function StudioDomaraClient() {
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

  const connectionCards = useMemo(() => buildCasaHudConnectionCards(connectionProviders), [connectionProviders]);
  const setupMessage = useMemo(() => getCasaHudSetupMessage(connectionCards), [connectionCards]);
  const activeConnectionCard = useMemo(
    () => connectionCards.find((card) => card.id === activeConnectionId) || null,
    [activeConnectionId, connectionCards],
  );
  const latestSavedCampaign = recentCampaigns[0] || null;
  const visibleCampaign = activeCampaign || latestSavedCampaign;
  const campaignCards = recentCampaigns.slice(0, 3);
  const hasRecentCampaigns = campaignCards.length > 0;
  const requiredConnections = connectionCards.filter((card) => card.required);
  const connectedRequiredConnections = requiredConnections.filter(
    (card) => card.status === "connected" || card.status === "partially_connected",
  ).length;
  const attentionConnectionCount = connectionCards.filter((card) => card.status === "needs_attention").length;
  const youtubeConnectionCard = connectionCards.find((card) => card.id === "youtube");
  const selectedTitle = opportunityOutput?.selectedTitle.title || visibleCampaign?.name;
  const topTitleCandidates = useMemo(
    () => opportunityOutput?.titleCandidates.slice(0, 3) || activeCampaign?.titleCandidates.slice(0, 3) || [],
    [activeCampaign, opportunityOutput],
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
    if (generationStatus !== "loading") return;
    if (progressIndex >= wizardSteps.length - 1) return;

    const timeoutId = window.setTimeout(() => {
      setProgressIndex((current) => Math.min(current + 1, wizardSteps.length - 1));
    }, 850);

    return () => window.clearTimeout(timeoutId);
  }, [generationStatus, progressIndex]);

  useEffect(() => {
    if (!campaignDiscoveringId) return;
    if (discoveryProgressIndex >= discoverySteps.length - 1) return;

    const timeoutId = window.setTimeout(() => {
      setDiscoveryProgressIndex((current) => Math.min(current + 1, discoverySteps.length - 1));
    }, 700);

    return () => window.clearTimeout(timeoutId);
  }, [campaignDiscoveringId, discoveryProgressIndex]);

  useEffect(() => {
    if (!campaignValidatingId) return;
    if (validationProgressIndex >= validationSteps.length - 1) return;

    const timeoutId = window.setTimeout(() => {
      setValidationProgressIndex((current) => Math.min(current + 1, validationSteps.length - 1));
    }, 650);

    return () => window.clearTimeout(timeoutId);
  }, [campaignValidatingId, validationProgressIndex]);

  useEffect(() => {
    if (!campaignLocatingId) return;
    if (locationProgressIndex >= locationSteps.length - 1) return;

    const timeoutId = window.setTimeout(() => {
      setLocationProgressIndex((current) => Math.min(current + 1, locationSteps.length - 1));
    }, 620);

    return () => window.clearTimeout(timeoutId);
  }, [campaignLocatingId, locationProgressIndex]);

  useEffect(() => {
    if (!campaignScriptingId) return;
    if (scriptProgressIndex >= scriptSteps.length - 1) return;

    const timeoutId = window.setTimeout(() => {
      setScriptProgressIndex((current) => Math.min(current + 1, scriptSteps.length - 1));
    }, 620);

    return () => window.clearTimeout(timeoutId);
  }, [campaignScriptingId, scriptProgressIndex]);

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
    } catch (generationError) {
      setGenerationStatus("error");
      setGenerationError(
        generationError instanceof Error
          ? generationError.message
          : "CasaHUD could not generate title opportunities right now.",
      );
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

  const researchModeSummary =
    connectionStatus === "loading"
      ? "Checking whether live YouTube competitive research is available."
      : opportunityOutput
        ? opportunityOutput.providerStatus.detail
        : activeCampaign
          ? activeCampaign.generationSource.detail
        : connectionStatus === "error"
          ? "Live research status is unavailable. CasaHUD can still generate opportunity-backed title concepts."
          : youtubeConnectionCard?.status === "connected"
            ? "Live YouTube competitive research is ready for title discovery."
            : youtubeConnectionCard?.status === "needs_attention"
              ? "YouTube needs attention. CasaHUD can fall back to internal opportunity patterns."
              : "Using CasaHUD opportunity patterns until YouTube connection is enabled.";

  const connectionSummary =
    connectionStatus === "loading"
      ? "Checking connection readiness for CasaHUD."
      : connectionStatus === "error"
        ? "Connection status needs attention. Open Connections to refresh and verify services."
        : attentionConnectionCount > 0
          ? `${attentionConnectionCount} connection${attentionConnectionCount === 1 ? "" : "s"} needs attention.`
          : `${connectedRequiredConnections} of ${requiredConnections.length} later-stage services ready.`;

  const timelineStatus =
    generationStatus === "loading"
      ? "discovering"
      : campaignDiscoveringId
        ? "property discovery"
        : campaignValidatingId
          ? "listing validation"
          : campaignLocatingId
            ? "location intelligence"
            : campaignScriptingId
              ? "script generation"
        : opportunityOutput
          ? "opportunity ready"
        : activeCampaign
          ? activeCampaign.scriptGenerationStatus === "script_generated"
            ? "script ready"
            : activeCampaign.locationIntelligenceStatus === "location_intelligence_completed"
            ? "location story ready"
            : activeCampaign.listingValidationStatus === "listing_candidates_validated"
              ? "validation ready"
            : activeCampaign.listingDiscoveryStatus === "listing_candidates_discovered"
              ? "listing discovery ready"
              : "campaign ready"
          : "ready";

  return (
    <main className="ibrains-shell min-h-screen overflow-hidden bg-[#ECE7DD] text-[#172033]">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_18%_12%,rgba(255,255,255,0.92),transparent_28%),radial-gradient(circle_at_78%_2%,rgba(205,142,86,0.24),transparent_32%),linear-gradient(135deg,#F7F1E7_0%,#E9EDF1_52%,#DCE9E1_100%)]" />
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-5 py-6 md:px-8 lg:py-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8A5A34]">CasaHUD</p>
            <p className="mt-1 text-sm text-[#657086]">AI real-estate YouTube content engine inside Studio</p>
          </div>
          <Link
            href="/apps"
            className="rounded-full border border-[#CFC4B2] bg-white/70 px-4 py-2 text-sm font-medium text-[#344256] shadow-sm transition hover:bg-white"
          >
            Apps
          </Link>
        </div>

        <section
          className="relative mt-6 overflow-hidden rounded-[2rem] border border-white/70 bg-[#FFFDF8]/[0.88] p-6 shadow-[0_28px_75px_rgba(70,55,35,0.18)] backdrop-blur md:p-8"
          data-testid="casahud-entry-hero"
        >
          <div className="absolute right-[-80px] top-[-90px] h-64 w-64 rounded-full bg-[#D59D63]/25 blur-2xl" />
          <div className="absolute bottom-[-120px] left-[-80px] h-72 w-72 rounded-full bg-[#6C9A84]/[0.18] blur-2xl" />
          <div className="relative grid gap-8 lg:grid-cols-[1.08fr_0.92fr] lg:items-end">
            <div>
              <div className="inline-flex rounded-full border border-[#E1D2BC] bg-white/75 px-3 py-1 text-xs font-semibold text-[#8A5A34]">
                Opportunity Discovery Engine
              </div>
              <h1 className="mt-5 max-w-4xl text-4xl font-semibold leading-[0.98] tracking-[-0.045em] text-[#172033] md:text-6xl">
                Generate your next viral property video
              </h1>
              <p className="mt-5 max-w-3xl text-base leading-7 text-[#526070] md:text-lg">
                CasaHUD researches competitive YouTube patterns, ranks title opportunities, and selects the next
                property-video concept in one click.
              </p>

              <div className="mt-7 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  className="rounded-2xl border border-[#172033] bg-[#172033] px-6 py-4 text-sm font-semibold text-white shadow-[0_18px_34px_rgba(23,32,51,0.28)] transition hover:-translate-y-0.5 hover:bg-[#26324B] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
                  onClick={() => void onGenerateViralVideo()}
                  disabled={generationStatus === "loading"}
                  data-testid="casahud-generate-cta"
                >
                  {generationStatus === "loading" ? "Generating Viral Video Title..." : "Generate Viral Video Title"}
                </button>
                <button
                  type="button"
                  className="rounded-2xl border border-[#CFC4B2] bg-white/75 px-5 py-4 text-sm font-semibold text-[#172033] shadow-sm transition hover:bg-white"
                  onClick={() => openSetup()}
                  data-testid="casahud-connections-cta"
                >
                  Connections
                </button>
                <Link
                  href="#recent-campaigns"
                  className="rounded-2xl border border-transparent px-2 py-3 text-sm font-semibold text-[#526070] transition hover:text-[#172033]"
                >
                  Recent Campaigns
                </Link>
              </div>

              <div
                className="mt-5 flex flex-wrap items-center gap-2 rounded-2xl border border-[#E7D8C2] bg-white/[0.58] px-4 py-3 text-sm text-[#526070]"
                data-testid="casahud-research-mode"
              >
                <span className="font-semibold text-[#172033]">
                  {opportunityOutput?.providerStatus.label || activeCampaign?.generationSource.label || "Research mode"}
                </span>
                <span>{researchModeSummary}</span>
              </div>

              {generationError ? (
                <div
                  className="mt-5 rounded-2xl border border-[#D8B26A] bg-[#FFF5DA] p-4 text-sm text-[#7A4B13]"
                  data-testid="casahud-generation-error"
                >
                  {generationError}
                </div>
              ) : null}
            </div>

            <aside className="rounded-[1.75rem] border border-[#E4D7C2] bg-[linear-gradient(160deg,rgba(250,243,231,0.9),rgba(255,255,255,0.82))] p-5 shadow-[0_20px_45px_rgba(70,55,35,0.12)]">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8A5A34]">
                {opportunityOutput ? "Winning concept" : selectedTitle ? "Latest campaign" : "How it starts"}
              </p>

              {opportunityOutput ? (
                <>
                  <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-[#172033]">
                    {opportunityOutput.selectedTitle.title}
                  </h2>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs font-medium text-[#344256]">
                    <span className="rounded-full border border-[#D7CAB8] bg-white/70 px-3 py-1">
                      {formatOpportunityCampaignType(opportunityOutput.selectedTitle.campaignType)}
                    </span>
                    <span className="rounded-full border border-[#D7CAB8] bg-white/70 px-3 py-1">
                      Score {opportunityOutput.selectedTitle.score}
                    </span>
                    <span className="rounded-full border border-[#D7CAB8] bg-white/70 px-3 py-1">
                      {Math.round(opportunityOutput.selectedTitle.confidence * 100)}% confidence
                    </span>
                  </div>
                  <p className="mt-4 text-sm leading-6 text-[#526070]">{opportunityOutput.selectedTitle.reasoning}</p>
                </>
              ) : selectedTitle ? (
                <>
                  <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-[#172033]">{selectedTitle}</h2>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs font-medium text-[#344256]">
                    <span className="rounded-full border border-[#D7CAB8] bg-white/70 px-3 py-1">
                      {visibleCampaign ? formatOpportunityCampaignType(visibleCampaign.campaignType) : "Campaign"}
                    </span>
                    <span className="rounded-full border border-[#D7CAB8] bg-white/70 px-3 py-1">
                      {formatCampaignStatus(visibleCampaign?.status)}
                    </span>
                  </div>
                  <p className="mt-4 text-sm leading-6 text-[#526070]">
                    {activeCampaign
                      ? activeCampaign.researchBrief.summary
                      : latestSavedCampaign?.researchSummary ||
                        "CasaHUD keeps saved campaigns durable, resumable, and ready for the next property-discovery phase."}
                  </p>
                </>
              ) : (
                <>
                  <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-[#172033]">
                    One click creates the next campaign starting point.
                  </h2>
                  <p className="mt-4 text-sm leading-6 text-[#526070]">
                    CasaHUD starts with real opportunity discovery, then selects the most supportable high-potential
                    title before later campaign creation begins.
                  </p>
                </>
              )}

              <div className="mt-5 flex flex-wrap gap-2">
                {["Research", "Rank", "Select"].map((step) => (
                  <span
                    key={step}
                    className="rounded-full border border-[#D7CAB8] bg-white/75 px-3 py-1 text-xs font-semibold text-[#344256]"
                  >
                    {step}
                  </span>
                ))}
              </div>
            </aside>
          </div>
        </section>

        <section className="mt-6 grid gap-5 lg:grid-cols-[1.08fr_0.92fr]">
          <section
            id="recent-campaigns"
            className="rounded-[2rem] border border-white/70 bg-[#FBFCF9]/[0.9] p-5 shadow-[0_24px_64px_rgba(70,55,35,0.14)] backdrop-blur md:p-6"
            data-testid="casahud-recent-campaigns"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6C7B6D]">Recent Campaigns</p>
                <h2 className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-[#172033]">Campaign history</h2>
              </div>
              {hasRecentCampaigns ? (
                <span className="rounded-full border border-[#D8E2D9] bg-white/70 px-3 py-1 text-xs font-medium text-[#344256]">
                  {campaignCards.length} recent
                </span>
              ) : null}
            </div>

            {hasRecentCampaigns ? (
              <div className="mt-5 grid gap-3">
                {campaignCards.map((campaign) => (
                  <article
                    key={campaign.id}
                    className="rounded-3xl border border-[#E2E8E0] bg-white/[0.82] p-4 shadow-sm"
                    data-testid="casahud-campaign-card"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-lg font-semibold tracking-[-0.02em] text-[#172033]">
                          {campaign.name}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-[#526070]">
                          {formatOpportunityCampaignType(campaign.campaignType)} · Updated{" "}
                          {formatCampaignTime(campaign.updatedAt || campaign.createdAt)}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-[#526070]">
                          {campaign.scriptSummary || campaign.locationSummary || campaign.validationSummary || campaign.discoverySummary || campaign.researchSummary}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2 text-xs font-medium text-[#344256]">
                          {campaign.marketRegionHint ? (
                            <span className="rounded-full border border-[#D7CAB8] bg-white px-3 py-1">
                              {campaign.marketRegionHint}
                            </span>
                          ) : null}
                          {campaign.listingCandidateCount > 0 ? (
                            <span className="rounded-full border border-[#D7CAB8] bg-white px-3 py-1">
                              {campaign.listingCandidateCount} candidates
                            </span>
                          ) : null}
                          {campaign.approvedListingCount > 0 ? (
                            <span className="rounded-full border border-[#D7CAB8] bg-white px-3 py-1">
                              {campaign.approvedListingCount} approved
                            </span>
                          ) : null}
                          {typeof campaign.titleSupportConfidence === "number" ? (
                            <span className="rounded-full border border-[#D7CAB8] bg-white px-3 py-1">
                              {formatSupportConfidence(campaign.titleSupportConfidence)} support
                            </span>
                          ) : null}
                          {campaign.locationIntelligenceStatus === "location_intelligence_completed" ? (
                            <span className="rounded-full border border-[#D8E2D9] bg-[#F2FBF3] px-3 py-1 text-[#0F5132]">
                              Location story ready
                            </span>
                          ) : null}
                          {campaign.scriptGenerationStatus === "script_generated" ? (
                            <span className="rounded-full border border-[#C6D7F4] bg-[#EFF4FF] px-3 py-1 text-[#1D4ED8]">
                              Script ready
                            </span>
                          ) : null}
                          <span className="rounded-full border border-[#D7CAB8] bg-white px-3 py-1">
                            Created {formatCampaignTime(campaign.createdAt)}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-3">
                        <span className="rounded-full border border-[#D7CAB8] bg-[#F8F3EA] px-3 py-1 text-xs font-semibold text-[#344256]">
                          {formatCampaignStatus(campaign.status)}
                        </span>
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
              <div
                className="mt-5 rounded-[1.75rem] border border-dashed border-[#D8C8B2] bg-[linear-gradient(160deg,rgba(255,249,239,0.9),rgba(255,255,255,0.74))] p-6"
                data-testid="casahud-empty-campaigns"
              >
                <p className="text-2xl font-semibold tracking-[-0.03em] text-[#172033]">No campaigns yet.</p>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-[#526070]">
                  Generate your first viral property video title to start a CasaHUD campaign.
                </p>
                <button
                  type="button"
                  className="mt-5 rounded-2xl border border-[#172033] bg-[#172033] px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_34px_rgba(23,32,51,0.2)] transition hover:bg-[#26324B]"
                  onClick={() => void onGenerateViralVideo()}
                >
                  Generate Viral Video Title
                </button>
              </div>
            )}
          </section>

          <aside
            className="rounded-[2rem] border border-white/70 bg-white/[0.82] p-5 shadow-[0_24px_64px_rgba(70,55,35,0.12)] backdrop-blur md:p-6"
            data-testid="casahud-connections-entry"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8A5A34]">Connections</p>
                <h2 className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-[#172033]">Service readiness</h2>
              </div>
              <button
                type="button"
                className="rounded-2xl border border-[#CFC4B2] bg-[#172033] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#26324B]"
                onClick={() => openSetup()}
              >
                Manage
              </button>
            </div>

            <p className="mt-4 text-sm leading-6 text-[#526070]">
              Manage the services CasaHUD uses for live competitive research and later production stages such as
              listings, maps, media storage, and publishing.
            </p>

            <div className="mt-4 rounded-2xl border border-[#E7D8C2] bg-[#F8F3EA] px-4 py-3 text-sm text-[#526070]">
              <span className="font-semibold text-[#172033]">Status:</span> {connectionSummary}
            </div>

            <div className="mt-5 grid gap-2">
              {connectionCards.map((card) => (
                <div
                  key={card.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-[#E8DDCD] bg-[#FFFDF8] px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#172033]">{card.title}</p>
                    <p className="mt-1 text-xs leading-5 text-[#718096]">{card.optional ? "Optional later" : "Core service"}</p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      card.status === "connected" || card.status === "partially_connected"
                        ? "bg-[#DFF3E7] text-[#0F5132]"
                        : card.status === "needs_attention"
                          ? "bg-[#FEE2E2] text-[#991B1B]"
                          : card.status === "optional"
                            ? "bg-[#EEF2F6] text-[#526070]"
                            : "bg-[#FFF0D6] text-[#7A4B13]"
                    }`}
                  >
                    {card.statusLabel}
                  </span>
                </div>
              ))}
            </div>
          </aside>
        </section>

        <section
          className="mt-6 rounded-[2rem] border border-white/70 bg-[#F4F7F2]/[0.9] p-5 shadow-[0_24px_64px_rgba(70,55,35,0.12)] backdrop-blur md:p-6"
          data-testid="casahud-progress-shell"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6C7B6D]">Guided Progress</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-[#172033]">
                {generationStatus === "loading" || opportunityOutput
                  ? "CasaHUD is discovering the opportunity"
                  : campaignDiscoveringId
                    ? "CasaHUD is finding matching properties"
                    : campaignValidatingId
                      ? "CasaHUD is validating and ranking listings"
                      : campaignLocatingId
                        ? "CasaHUD is building the location story"
                        : campaignScriptingId
                          ? "CasaHUD is writing the video narrative"
                  : activeCampaign
                    ? activeCampaign.scriptGenerationStatus === "script_generated"
                      ? "Script and narrative are saved on the campaign"
                      : activeCampaign.locationIntelligenceStatus === "location_intelligence_completed"
                      ? "Location intelligence is saved on the campaign"
                      : activeCampaign.listingValidationStatus === "listing_candidates_validated"
                        ? "Validated shortlist is ready for location intelligence"
                      : activeCampaign.listingCandidates.length > 0
                        ? "Property discovery is saved on the campaign"
                        : "Campaign saved and ready for the next phase"
                    : "What happens after you click generate"}
              </h2>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-[#526070]">
                {generationStatus === "loading" || opportunityOutput
                  ? "CasaHUD moves through YouTube opportunity research, title strategy, and final concept selection before handing the result to the next campaign phase."
                  : campaignDiscoveringId
                    ? "CasaHUD is translating the saved title promise into listing search criteria, checking provider availability, and assembling candidate properties for the next validation phase."
                    : campaignValidatingId
                      ? "CasaHUD is checking title truthfulness, removing duplicate listings, scoring fit, and ranking the shortlist that can move forward to location intelligence."
                      : campaignLocatingId
                        ? "CasaHUD is reading approved property locations, checking map and places coverage, shaping POI context, and packaging a place-led story for the next script phase."
                        : campaignScriptingId
                          ? "CasaHUD is turning the validated listings and saved location intelligence into a review-ready narrative package with hooks, scene beats, transitions, and editorial notes."
                  : activeCampaign
                    ? activeCampaign.scriptGenerationStatus === "script_generated"
                      ? "The campaign now includes a script summary, opening hook, scene-level narration, property copy, transitions, closing CTA, tone notes, warnings, and the Phase 8 handoff placeholder."
                      : activeCampaign.locationIntelligenceStatus === "location_intelligence_completed"
                      ? "The campaign now includes a location story, local highlights, POI cards, listing-level context, provider status, warnings, and map scene ideas. CasaHUD can reopen this package and hand it forward to Script and Narrative Generation."
                      : activeCampaign.listingValidationStatus === "listing_candidates_validated"
                        ? "The campaign now includes approved and rejected listing results, ranking context, warnings, and title-support confidence. CasaHUD can reopen this package and hand it forward to Location Intelligence without rerunning validation."
                      : activeCampaign.listingCandidates.length > 0
                        ? "The campaign now includes saved listing candidates, provider status, and derived search criteria. CasaHUD can reopen this package and hand it forward to listing validation without rerunning discovery."
                        : "The viral title, ranked candidates, and research brief are now durable campaign state. CasaHUD can reopen this package and hand it forward to Property Discovery without regenerating titles."
                    : "CasaHUD keeps the process guided and productized. It starts with competitive title opportunity discovery, then hands the winning concept forward for campaign creation."}
              </p>
            </div>
            <span className="rounded-full border border-[#D8E2D9] bg-white/70 px-3 py-1 text-xs font-medium text-[#344256]">
              {timelineStatus}
            </span>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="grid gap-2">
              {(campaignScriptingId
                ? scriptSteps
                : campaignLocatingId
                  ? locationSteps
                  : campaignValidatingId
                    ? validationSteps
                    : campaignDiscoveringId
                      ? discoverySteps
                      : wizardSteps).map((step, index) => {
                const status = campaignScriptingId
                  ? getProgressStepStatus("loading", scriptProgressIndex, index)
                  : campaignLocatingId
                  ? getProgressStepStatus("loading", locationProgressIndex, index)
                  : campaignValidatingId
                  ? getProgressStepStatus("loading", validationProgressIndex, index)
                  : campaignDiscoveringId
                    ? getProgressStepStatus("loading", discoveryProgressIndex, index)
                    : getProgressStepStatus(generationStatus, progressIndex, index);
                return (
                  <div
                    key={step.id}
                    className="grid grid-cols-[12px_1fr_auto] items-center gap-3 rounded-2xl border border-[#E2E8E0] bg-white/[0.82] px-3 py-3"
                  >
                    <span className={`h-2.5 w-2.5 rounded-full ${statusDotClass(status)}`} />
                    <span className={`text-sm font-medium ${stageTextClass(status)}`}>{step.label}</span>
                    <span className="text-xs text-[#718096]">{progressStatusLabel(status)}</span>
                  </div>
                );
              })}
            </div>

            <div className="grid gap-3">
              {topTitleCandidates.length > 0 ? (
                <div className="rounded-3xl border border-[#E4D7C2] bg-[#FFF9EF] p-4">
                  <p className="text-sm font-semibold text-[#172033]">Leading title directions</p>
                  <div className="mt-3 grid gap-2">
                    {topTitleCandidates.map((candidate) => (
                      <div key={candidate.id} className="rounded-2xl bg-white/75 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-medium leading-5 text-[#344256]">{candidate.title}</p>
                            <p className="mt-1 text-xs text-[#718096]">
                              {formatOpportunityCampaignType(candidate.campaignType)}
                              {candidate.regionHint ? ` · ${candidate.regionHint}` : ""}
                            </p>
                          </div>
                          <span className="rounded-full bg-[#172033] px-2 py-1 text-[11px] font-semibold text-white">
                            {candidate.score}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="rounded-3xl border border-[#E4D7C2] bg-[#FFF9EF] p-4">
                  <p className="text-sm font-semibold text-[#172033]">Title-first workflow</p>
                  <p className="mt-3 text-sm leading-6 text-[#526070]">
                    CasaHUD starts by shaping a title with strong YouTube potential, ranking multiple opportunity
                    directions, and selecting the concept that is most likely to hold up when campaign creation begins.
                  </p>
                </div>
              )}

              <div className="rounded-3xl border border-[#D8E2D9] bg-white/[0.84] p-4">
                <p className="text-sm font-semibold text-[#172033]">YouTube connection improves the research</p>
                <p className="mt-3 text-sm leading-6 text-[#526070]">
                  CasaHUD can generate opportunity-backed titles without blocking, and it upgrades the competitive
                  research when the YouTube connection is available.
                </p>
              </div>
            </div>
          </div>
        </section>

        {opportunityOutput ? (
          <section
            className="mt-6 rounded-[2rem] border border-white/70 bg-[#FFFDF8]/[0.92] p-5 shadow-[0_24px_64px_rgba(70,55,35,0.14)] backdrop-blur md:p-6"
            data-testid="casahud-opportunity-results"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8A5A34]">Opportunity Review</p>
                <h2 className="mt-1 text-3xl font-semibold tracking-[-0.035em] text-[#172033]">
                  Selected winning title
                </h2>
              </div>
              <span
                className="rounded-full border border-[#D7CAB8] bg-[#F8F3EA] px-3 py-1 text-xs font-semibold text-[#344256]"
                data-testid="casahud-provider-status"
              >
                {opportunityOutput.providerStatus.label}
              </span>
            </div>

            <div className="mt-5 grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
              <section
                className="rounded-[1.75rem] border border-[#E4D7C2] bg-[linear-gradient(160deg,rgba(255,249,239,0.92),rgba(255,255,255,0.86))] p-5 shadow-sm"
                data-testid="casahud-winning-title"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8A5A34]">Winning Title</p>
                <h3 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-[#172033]">
                  {opportunityOutput.selectedTitle.title}
                </h3>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="rounded-full border border-[#D7CAB8] bg-white/80 px-3 py-1 text-xs font-semibold text-[#344256]">
                    {formatOpportunityCampaignType(opportunityOutput.selectedTitle.campaignType)}
                  </span>
                  <span className="rounded-full border border-[#D7CAB8] bg-white/80 px-3 py-1 text-xs font-semibold text-[#344256]">
                    Score {opportunityOutput.selectedTitle.score}
                  </span>
                  <span className="rounded-full border border-[#D7CAB8] bg-white/80 px-3 py-1 text-xs font-semibold text-[#344256]">
                    {Math.round(opportunityOutput.selectedTitle.confidence * 100)}% confidence
                  </span>
                  {opportunityOutput.selectedTitle.regionHint ? (
                    <span className="rounded-full border border-[#D7CAB8] bg-white/80 px-3 py-1 text-xs font-semibold text-[#344256]">
                      {opportunityOutput.selectedTitle.regionHint}
                    </span>
                  ) : null}
                </div>
                <p className="mt-5 text-sm leading-6 text-[#526070]">{opportunityOutput.titleOpportunitySummary}</p>
              </section>

              <section className="rounded-[1.75rem] border border-[#D8E2D9] bg-[#F7FAF8] p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#6C7B6D]">
                  Why this title was chosen
                </p>
                <p className="mt-3 text-sm leading-7 text-[#344256]">{opportunityOutput.selectedTitle.reasoning}</p>
                <div className="mt-4 rounded-2xl border border-[#D8E2D9] bg-white/80 p-4">
                  <p className="text-sm font-semibold text-[#172033]">Confidence summary</p>
                  <p className="mt-2 text-sm leading-6 text-[#526070]">{opportunityOutput.confidenceSummary}</p>
                </div>
              </section>
            </div>

            <div className="mt-5 grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
              <section>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8A5A34]">Title Candidates</p>
                    <h3 className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-[#172033]">Ranked concepts</h3>
                  </div>
                  <span className="rounded-full border border-[#D7CAB8] bg-white px-3 py-1 text-xs font-semibold text-[#344256]">
                    {opportunityOutput.titleCandidates.length} candidates
                  </span>
                </div>
                <div className="mt-4 grid gap-3">
                  {opportunityOutput.titleCandidates.map((candidate, index) => (
                    <article
                      key={candidate.id}
                      className="rounded-3xl border border-[#E4D7C2] bg-white/[0.88] p-4 shadow-sm"
                      data-testid="casahud-candidate-card"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-[#172033] px-2.5 py-1 text-[11px] font-semibold text-white">
                              #{index + 1}
                            </span>
                            <span className="rounded-full border border-[#D7CAB8] bg-[#F8F3EA] px-2.5 py-1 text-[11px] font-semibold text-[#344256]">
                              {formatOpportunityCampaignType(candidate.campaignType)}
                            </span>
                            {candidate.regionHint ? (
                              <span className="rounded-full border border-[#D7CAB8] bg-[#F8F3EA] px-2.5 py-1 text-[11px] font-semibold text-[#344256]">
                                {candidate.regionHint}
                              </span>
                            ) : null}
                          </div>
                          <h4 className="mt-3 text-lg font-semibold tracking-[-0.02em] text-[#172033]">{candidate.title}</h4>
                        </div>
                        <span className="rounded-full border border-[#D7CAB8] bg-white px-3 py-1 text-sm font-semibold text-[#172033]">
                          {candidate.score}
                        </span>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-[#526070]">{candidate.reasoning}</p>
                    </article>
                  ))}
                </div>
              </section>

              <aside className="grid gap-4">
                <section className="rounded-[1.75rem] border border-[#E4D7C2] bg-[#FFF9EF] p-5 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8A5A34]">Research Brief</p>
                  <p className="mt-3 text-sm leading-6 text-[#526070]">{opportunityOutput.researchBrief.summary}</p>

                  <div className="mt-4 grid gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[#172033]">Opportunity categories</p>
                      <p className="mt-2 text-sm leading-6 text-[#526070]">
                        {opportunityOutput.researchBrief.opportunityCategories.join(" · ")}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[#172033]">Competitor patterns</p>
                      <p className="mt-2 text-sm leading-6 text-[#526070]">
                        {opportunityOutput.researchBrief.competitorPatterns.join(" · ")}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[#172033]">Risk notes</p>
                      <p className="mt-2 text-sm leading-6 text-[#526070]">
                        {opportunityOutput.researchBrief.riskNotes.join(" · ")}
                      </p>
                    </div>
                  </div>
                </section>

                <section className="rounded-[1.75rem] border border-[#D8E2D9] bg-[#F7FAF8] p-5 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#6C7B6D]">Campaign Type</p>
                  <h3 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[#172033]">
                    {formatOpportunityCampaignType(opportunityOutput.campaignTypePrediction)}
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-[#526070]">
                    CasaHUD predicts this concept is best executed as a {formatOpportunityCampaignType(opportunityOutput.campaignTypePrediction).toLowerCase()} campaign.
                  </p>
                </section>

                <section
                  className="rounded-[1.75rem] border border-[#D8E2D9] bg-white/[0.92] p-5 shadow-sm"
                  data-testid="casahud-next-step"
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#6C7B6D]">Next Step</p>
                  <h3 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[#172033]">
                    Create Campaign
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-[#526070]">
                    The winning viral title becomes the campaign name automatically. CasaHUD saves the selected title,
                    ranked candidates, research brief, confidence reasoning, and a Property Discovery handoff state in
                    one step.
                  </p>
                  <button
                    type="button"
                    className="mt-4 rounded-2xl border border-[#172033] bg-[#172033] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#26324B] disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={() => void onCreateCampaign()}
                    disabled={campaignCreating}
                    data-testid="casahud-create-campaign-cta"
                  >
                    {campaignCreating ? "Creating Campaign..." : "Create Campaign"}
                  </button>
                  <p className="mt-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#8A5A34]">
                    Campaign name: {opportunityOutput.selectedTitle.title}
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
          </section>
        ) : null}

        {activeCampaign && !opportunityOutput ? (
          <section
            className="mt-6 rounded-[2rem] border border-white/70 bg-[#FFFDF8]/[0.92] p-5 shadow-[0_24px_64px_rgba(70,55,35,0.14)] backdrop-blur md:p-6"
            data-testid="casahud-campaign-detail"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8A5A34]">Campaign Review</p>
                <h2 className="mt-1 text-3xl font-semibold tracking-[-0.035em] text-[#172033]">{activeCampaign.name}</h2>
              </div>
              <span className="rounded-full border border-[#D7CAB8] bg-[#F8F3EA] px-3 py-1 text-xs font-semibold text-[#344256]">
                {formatCampaignStatus(activeCampaign.status)}
              </span>
            </div>

            {campaignNotice ? (
              <div
                className="mt-5 rounded-2xl border border-[#C6DFC9] bg-[#F2FBF3] p-4 text-sm text-[#0F5132]"
                data-testid="casahud-campaign-create-success"
              >
                {campaignNotice}
              </div>
            ) : null}

            {campaignError ? (
              <div className="mt-5 rounded-2xl border border-[#D8B26A] bg-[#FFF5DA] p-4 text-sm text-[#7A4B13]">
                {campaignError}
              </div>
            ) : null}

            <div className="mt-5 grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
              <section className="rounded-[1.75rem] border border-[#E4D7C2] bg-[linear-gradient(160deg,rgba(255,249,239,0.92),rgba(255,255,255,0.86))] p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8A5A34]">Saved Campaign</p>
                <h3 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-[#172033]">{activeCampaign.name}</h3>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="rounded-full border border-[#D7CAB8] bg-white/80 px-3 py-1 text-xs font-semibold text-[#344256]">
                    {formatOpportunityCampaignType(activeCampaign.campaignType)}
                  </span>
                  <span className="rounded-full border border-[#D7CAB8] bg-white/80 px-3 py-1 text-xs font-semibold text-[#344256]">
                    {Math.round(activeCampaign.confidenceReasoning.selectedTitleConfidence * 100)}% confidence
                  </span>
                  {activeCampaign.marketRegionHint ? (
                    <span className="rounded-full border border-[#D7CAB8] bg-white/80 px-3 py-1 text-xs font-semibold text-[#344256]">
                      {activeCampaign.marketRegionHint}
                    </span>
                  ) : null}
                </div>
                <div className="mt-5 grid gap-3 text-sm leading-6 text-[#526070]">
                  <p>
                    <span className="font-semibold text-[#172033]">Campaign name:</span> {activeCampaign.name}
                  </p>
                  <p>
                    <span className="font-semibold text-[#172033]">Selected viral title:</span>{" "}
                    {activeCampaign.selectedViralTitle}
                  </p>
                  <p>{activeCampaign.confidenceReasoning.titleOpportunitySummary}</p>
                </div>
              </section>

              <section className="rounded-[1.75rem] border border-[#D8E2D9] bg-[#F7FAF8] p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#6C7B6D]">
                  Generation confidence and reasoning
                </p>
                <p className="mt-3 text-sm leading-7 text-[#344256]">
                  {activeCampaign.confidenceReasoning.selectedTitleReasoning}
                </p>
                <div className="mt-4 rounded-2xl border border-[#D8E2D9] bg-white/80 p-4">
                  <p className="text-sm font-semibold text-[#172033]">Confidence summary</p>
                  <p className="mt-2 text-sm leading-6 text-[#526070]">{activeCampaign.confidenceReasoning.summary}</p>
                </div>
                <div className="mt-4 rounded-2xl border border-[#D8E2D9] bg-white/80 p-4">
                  <p className="text-sm font-semibold text-[#172033]">Generation source</p>
                  <p className="mt-2 text-sm leading-6 text-[#526070]">
                    {activeCampaign.generationSource.label} · {activeCampaign.generationSource.detail}
                  </p>
                </div>
              </section>
            </div>

            <div className="mt-5 grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
              <section>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8A5A34]">Title Candidates</p>
                    <h3 className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-[#172033]">Saved ranking</h3>
                  </div>
                  <span className="rounded-full border border-[#D7CAB8] bg-white px-3 py-1 text-xs font-semibold text-[#344256]">
                    {activeCampaign.titleCandidates.length} candidates
                  </span>
                </div>
                <div className="mt-4 grid gap-3">
                  {activeCampaign.titleCandidates.map((candidate, index) => (
                    <article key={candidate.id} className="rounded-3xl border border-[#E4D7C2] bg-white/[0.88] p-4 shadow-sm">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-[#172033] px-2.5 py-1 text-[11px] font-semibold text-white">
                              #{index + 1}
                            </span>
                            <span className="rounded-full border border-[#D7CAB8] bg-[#F8F3EA] px-2.5 py-1 text-[11px] font-semibold text-[#344256]">
                              {formatOpportunityCampaignType(candidate.campaignType)}
                            </span>
                            {candidate.regionHint ? (
                              <span className="rounded-full border border-[#D7CAB8] bg-[#F8F3EA] px-2.5 py-1 text-[11px] font-semibold text-[#344256]">
                                {candidate.regionHint}
                              </span>
                            ) : null}
                          </div>
                          <h4 className="mt-3 text-lg font-semibold tracking-[-0.02em] text-[#172033]">{candidate.title}</h4>
                        </div>
                        <span className="rounded-full border border-[#D7CAB8] bg-white px-3 py-1 text-sm font-semibold text-[#172033]">
                          {candidate.score}
                        </span>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-[#526070]">{candidate.reasoning}</p>
                    </article>
                  ))}
                </div>
              </section>

              <aside className="grid gap-4">
                <section className="rounded-[1.75rem] border border-[#E4D7C2] bg-[#FFF9EF] p-5 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8A5A34]">Research Brief</p>
                  <p className="mt-3 text-sm leading-6 text-[#526070]">{activeCampaign.researchBrief.summary}</p>

                  <div className="mt-4 grid gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[#172033]">Opportunity categories</p>
                      <p className="mt-2 text-sm leading-6 text-[#526070]">
                        {activeCampaign.researchBrief.opportunityCategories.join(" · ")}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[#172033]">Competitor patterns</p>
                      <p className="mt-2 text-sm leading-6 text-[#526070]">
                        {activeCampaign.researchBrief.competitorPatterns.join(" · ")}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[#172033]">Risk notes</p>
                      <p className="mt-2 text-sm leading-6 text-[#526070]">
                        {activeCampaign.researchBrief.riskNotes.join(" · ")}
                      </p>
                    </div>
                  </div>
                </section>

                <section className="rounded-[1.75rem] border border-[#D8E2D9] bg-[#F7FAF8] p-5 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#6C7B6D]">Current Status</p>
                  <h3 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[#172033]">
                    {formatCampaignStatus(activeCampaign.status)}
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-[#526070]">
                    Created {formatCampaignTime(activeCampaign.createdAt)} · Updated{" "}
                    {formatCampaignTime(activeCampaign.updatedAt)}
                  </p>
                  {activeCampaign.discoverySummary ? (
                    <div className="mt-4 rounded-2xl border border-[#D8E2D9] bg-white/80 p-4">
                      <p className="text-sm font-semibold text-[#172033]">Discovery summary</p>
                      <p className="mt-2 text-sm leading-6 text-[#526070]">{activeCampaign.discoverySummary.headline}</p>
                    </div>
                  ) : null}
                  {activeCampaign.listingValidationSummary ? (
                    <div className="mt-4 rounded-2xl border border-[#D8E2D9] bg-white/80 p-4">
                      <p className="text-sm font-semibold text-[#172033]">Validation summary</p>
                      <p className="mt-2 text-sm leading-6 text-[#526070]">
                        {activeCampaign.listingValidationSummary.headline}
                      </p>
                      <p className="mt-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#6C7B6D]">
                        Title support confidence: {formatSupportConfidence(activeCampaign.titleSupportConfidence)}
                      </p>
                    </div>
                  ) : null}
                  {activeCampaign.locationIntelligenceSummary ? (
                    <div className="mt-4 rounded-2xl border border-[#D8E2D9] bg-white/80 p-4">
                      <p className="text-sm font-semibold text-[#172033]">Location intelligence</p>
                      <p className="mt-2 text-sm leading-6 text-[#526070]">
                        {activeCampaign.locationIntelligenceSummary.headline}
                      </p>
                      <p className="mt-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#6C7B6D]">
                        {activeCampaign.scriptGenerationStatus === "script_generated"
                          ? "Media Planning and Asset Assembly is next"
                          : "Script and Narrative Generation is next"}
                      </p>
                    </div>
                  ) : null}
                  {activeCampaign.scriptSummary ? (
                    <div className="mt-4 rounded-2xl border border-[#D4DDF2] bg-[#F7FAFF] p-4">
                      <p className="text-sm font-semibold text-[#172033]">Script summary</p>
                      <p className="mt-2 text-sm leading-6 text-[#526070]">{activeCampaign.scriptSummary}</p>
                      <p className="mt-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#41608E]">
                        Media Planning and Asset Assembly is next
                      </p>
                    </div>
                  ) : null}
                </section>

                <section className="rounded-[1.75rem] border border-[#D8E2D9] bg-white/[0.92] p-5 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#6C7B6D]">Next Step</p>
                  <h3 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[#172033]">
                    Next: {activeCampaign.nextPhase.label}
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-[#526070]">{activeCampaign.nextPhase.detail}</p>
                  {activeCampaign.nextPhase.key === "property_discovery" ? (
                    <>
                      <button
                        type="button"
                        className="mt-4 rounded-2xl border border-[#172033] bg-[#172033] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#26324B] disabled:cursor-not-allowed disabled:opacity-60"
                        onClick={() => void onDiscoverListings()}
                        disabled={campaignDiscoveringId === activeCampaign.id}
                        data-testid="casahud-discover-listings-cta"
                      >
                        {campaignDiscoveringId === activeCampaign.id ? "Finding Matching Properties..." : "Find Matching Properties"}
                      </button>
                      <p className="mt-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#8A5A34]">
                        CasaHUD will persist candidate listings on this campaign and hand the shortlist to validation next.
                      </p>
                    </>
                  ) : activeCampaign.nextPhase.key === "listing_validation" ? (
                    <>
                      <button
                        type="button"
                        className="mt-4 rounded-2xl border border-[#172033] bg-[#172033] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#26324B] disabled:cursor-not-allowed disabled:opacity-60"
                        onClick={() => void onValidateListings()}
                        disabled={campaignValidatingId === activeCampaign.id}
                        data-testid="casahud-validate-listings-cta"
                      >
                        {campaignValidatingId === activeCampaign.id ? "Validating Listings..." : "Validate and Rank Listings"}
                      </button>
                      <p className="mt-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#8A5A34]">
                        CasaHUD will separate approved and rejected listings, rank the shortlist, and prepare Location Intelligence next.
                      </p>
                    </>
                  ) : activeCampaign.nextPhase.key === "location_intelligence" ? (
                    <>
                      <button
                        type="button"
                        className="mt-4 rounded-2xl border border-[#172033] bg-[#172033] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#26324B] disabled:cursor-not-allowed disabled:opacity-60"
                        onClick={() => void onAddLocationIntelligence()}
                        disabled={campaignLocatingId === activeCampaign.id}
                        data-testid="casahud-location-intelligence-cta"
                      >
                        {campaignLocatingId === activeCampaign.id ? "Building Location Story..." : "Add Location Intelligence"}
                      </button>
                      <p className="mt-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#8A5A34]">
                        CasaHUD will connect the approved shortlist to local highlights, POIs, listing-level context, and map scene ideas before Script and Narrative Generation.
                      </p>
                    </>
                  ) : activeCampaign.nextPhase.key === "script_narrative_generation" ? (
                    <>
                      <button
                        type="button"
                        className="mt-4 rounded-2xl border border-[#172033] bg-[#172033] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#26324B] disabled:cursor-not-allowed disabled:opacity-60"
                        onClick={() => void onGenerateScript()}
                        disabled={campaignScriptingId === activeCampaign.id}
                        data-testid="casahud-generate-script-cta"
                      >
                        {campaignScriptingId === activeCampaign.id ? "Generating Script..." : "Generate Script"}
                      </button>
                      <p className="mt-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#6C7B6D]">
                        Location intelligence is saved. Phase 7 will turn this place story into the actual script and narrative flow.
                      </p>
                    </>
                  ) : activeCampaign.nextPhase.key === "media_planning_asset_assembly" ? (
                    <>
                      <button
                        type="button"
                        className="mt-4 rounded-2xl border border-[#D4DDF2] bg-[#F7FAFF] px-4 py-3 text-sm font-semibold text-[#41608E]"
                        disabled
                        data-testid="casahud-media-planning-placeholder"
                      >
                        Media Planning and Asset Assembly
                      </button>
                      <p className="mt-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#41608E]">
                        The narrative package is saved. Phase 8 will connect this script to visuals, assets, and scene planning.
                      </p>
                    </>
                  ) : null}
                </section>

                {campaignDiscoveringId === activeCampaign.id ? (
                  <section
                    className="rounded-[1.75rem] border border-[#D8E2D9] bg-[#F7FAF8] p-5 shadow-sm"
                    data-testid="casahud-discovery-progress"
                  >
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#6C7B6D]">Property Discovery</p>
                    <div className="mt-4 grid gap-2">
                      {discoverySteps.map((step, index) => {
                        const status = getProgressStepStatus("loading", discoveryProgressIndex, index);
                        return (
                          <div
                            key={step.id}
                            className="grid grid-cols-[12px_1fr_auto] items-center gap-3 rounded-2xl border border-[#D8E2D9] bg-white/80 px-3 py-3"
                          >
                            <span className={`h-2.5 w-2.5 rounded-full ${statusDotClass(status)}`} />
                            <span className={`text-sm font-medium ${stageTextClass(status)}`}>{step.label}</span>
                            <span className="text-xs text-[#718096]">{progressStatusLabel(status)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                ) : null}

                {campaignValidatingId === activeCampaign.id ? (
                  <section
                    className="rounded-[1.75rem] border border-[#D8E2D9] bg-[#F7FAF8] p-5 shadow-sm"
                    data-testid="casahud-validation-progress"
                  >
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#6C7B6D]">Listing Validation</p>
                    <div className="mt-4 grid gap-2">
                      {validationSteps.map((step, index) => {
                        const status = getProgressStepStatus("loading", validationProgressIndex, index);
                        return (
                          <div
                            key={step.id}
                            className="grid grid-cols-[12px_1fr_auto] items-center gap-3 rounded-2xl border border-[#D8E2D9] bg-white/80 px-3 py-3"
                          >
                            <span className={`h-2.5 w-2.5 rounded-full ${statusDotClass(status)}`} />
                            <span className={`text-sm font-medium ${stageTextClass(status)}`}>{step.label}</span>
                            <span className="text-xs text-[#718096]">{progressStatusLabel(status)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                ) : null}

                {campaignLocatingId === activeCampaign.id ? (
                  <section
                    className="rounded-[1.75rem] border border-[#D8E2D9] bg-[#F7FAF8] p-5 shadow-sm"
                    data-testid="casahud-location-progress"
                  >
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#6C7B6D]">Location Intelligence</p>
                    <div className="mt-4 grid gap-2">
                      {locationSteps.map((step, index) => {
                        const status = getProgressStepStatus("loading", locationProgressIndex, index);
                        return (
                          <div
                            key={step.id}
                            className="grid grid-cols-[12px_1fr_auto] items-center gap-3 rounded-2xl border border-[#D8E2D9] bg-white/80 px-3 py-3"
                          >
                            <span className={`h-2.5 w-2.5 rounded-full ${statusDotClass(status)}`} />
                            <span className={`text-sm font-medium ${stageTextClass(status)}`}>{step.label}</span>
                            <span className="text-xs text-[#718096]">{progressStatusLabel(status)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                ) : null}

                {campaignScriptingId === activeCampaign.id ? (
                  <section
                    className="rounded-[1.75rem] border border-[#D4DDF2] bg-[#F7FAFF] p-5 shadow-sm"
                    data-testid="casahud-script-progress"
                  >
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#41608E]">Script Generation</p>
                    <div className="mt-4 grid gap-2">
                      {scriptSteps.map((step, index) => {
                        const status = getProgressStepStatus("loading", scriptProgressIndex, index);
                        return (
                          <div
                            key={step.id}
                            className="grid grid-cols-[12px_1fr_auto] items-center gap-3 rounded-2xl border border-[#D4DDF2] bg-white/90 px-3 py-3"
                          >
                            <span className={`h-2.5 w-2.5 rounded-full ${statusDotClass(status)}`} />
                            <span className={`text-sm font-medium ${stageTextClass(status)}`}>{step.label}</span>
                            <span className="text-xs text-[#718096]">{progressStatusLabel(status)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                ) : null}

                {activeCampaign.listingProviderStatuses.length > 0 ? (
                  <section className="rounded-[1.75rem] border border-[#D8E2D9] bg-[#F7FAF8] p-5 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#6C7B6D]">Listing Sources</p>
                    <div className="mt-4 grid gap-3">
                      {activeCampaign.listingProviderStatuses.map((providerStatus) => (
                        <div key={providerStatus.provider} className="rounded-2xl border border-[#D8E2D9] bg-white/80 p-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-[#172033]">{providerStatus.label}</p>
                            <span
                              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                                providerStatus.state === "connected"
                                  ? "bg-[#DFF3E7] text-[#0F5132]"
                                  : providerStatus.state === "fallback"
                                    ? "bg-[#FFF0D6] text-[#7A4B13]"
                                    : providerStatus.state === "error"
                                      ? "bg-[#FEE2E2] text-[#991B1B]"
                                      : "bg-[#EEF2F6] text-[#526070]"
                              }`}
                            >
                              {formatCampaignStatus(providerStatus.state)}
                            </span>
                          </div>
                          <p className="mt-2 text-sm leading-6 text-[#526070]">{providerStatus.detail}</p>
                          {providerStatus.warning ? (
                            <p className="mt-2 text-xs font-medium uppercase tracking-[0.1em] text-[#8A5A34]">
                              {providerStatus.warning}
                            </p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </section>
                ) : null}

                {activeCampaign.listingSearchCriteria ? (
                  <section className="rounded-[1.75rem] border border-[#E4D7C2] bg-[#FFF9EF] p-5 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8A5A34]">Discovery Criteria</p>
                    <p className="mt-3 text-sm leading-6 text-[#526070]">
                      {activeCampaign.discoverySummary?.criteriaSummary ||
                        "CasaHUD derived listing search criteria from the saved title promise."}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-[#344256]">
                      {activeCampaign.listingSearchCriteria.propertyTypes.map((propertyType) => (
                        <span key={propertyType} className="rounded-full border border-[#D7CAB8] bg-white px-3 py-1">
                          {propertyType}
                        </span>
                      ))}
                      {activeCampaign.listingSearchCriteria.featureTags.slice(0, 3).map((feature) => (
                        <span key={feature} className="rounded-full border border-[#D7CAB8] bg-white px-3 py-1">
                          {feature}
                        </span>
                      ))}
                    </div>
                  </section>
                ) : null}
              </aside>
            </div>

            {activeCampaign.listingValidationSummary ? (
              <section
                className="mt-6 rounded-[1.85rem] border border-[#D8E2D9] bg-[linear-gradient(160deg,rgba(244,247,242,0.96),rgba(255,255,255,0.92))] p-5 shadow-sm"
                data-testid="casahud-validation-summary"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#6C7B6D]">Listing Validation</p>
                    <h3 className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-[#172033]">
                      {activeCampaign.listingValidationSummary.headline}
                    </h3>
                  </div>
                  <span className="rounded-full border border-[#D8E2D9] bg-white px-3 py-1 text-xs font-semibold text-[#344256]">
                    {formatSupportConfidence(activeCampaign.titleSupportConfidence)} support
                  </span>
                </div>
                <p className="mt-3 max-w-4xl text-sm leading-6 text-[#526070]">
                  {activeCampaign.listingValidationSummary.rankingExplanation}
                </p>
                <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-[#344256]">
                  <span className="rounded-full border border-[#D8E2D9] bg-white px-3 py-1">
                    {activeCampaign.listingValidationSummary.discoveredCount} discovered
                  </span>
                  <span className="rounded-full border border-[#D8E2D9] bg-white px-3 py-1">
                    {activeCampaign.listingValidationSummary.approvedCount} approved
                  </span>
                  <span className="rounded-full border border-[#D8E2D9] bg-white px-3 py-1">
                    {activeCampaign.listingValidationSummary.rejectedCount} rejected
                  </span>
                  {activeCampaign.listingValidationSummary.needsAttentionCount > 0 ? (
                    <span className="rounded-full border border-[#D8E2D9] bg-white px-3 py-1">
                      {activeCampaign.listingValidationSummary.needsAttentionCount} needs attention
                    </span>
                  ) : null}
                </div>
                {activeCampaign.validationWarnings.length > 0 ? (
                  <div className="mt-4 rounded-2xl border border-[#E7D8C2] bg-[#FFF5DA] p-4 text-sm text-[#7A4B13]">
                    {activeCampaign.validationWarnings.map((warning) => (
                      <p key={warning} className="leading-6">
                        {warning}
                      </p>
                    ))}
                  </div>
                ) : null}
                <p className="mt-4 text-xs font-semibold uppercase tracking-[0.12em] text-[#6C7B6D]">
                  Next: Location Intelligence
                </p>
              </section>
            ) : null}

            {activeCampaign.locationIntelligenceSummary ? (
              <section
                className="mt-6 rounded-[1.85rem] border border-[#D8E2D9] bg-[linear-gradient(160deg,rgba(239,245,242,0.98),rgba(255,255,255,0.94))] p-5 shadow-sm"
                data-testid="casahud-location-intelligence-summary"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#1B8A5A]">Location Intelligence</p>
                    <h3 className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-[#172033]">
                      {activeCampaign.locationIntelligenceSummary.headline}
                    </h3>
                  </div>
                  <span className="rounded-full border border-[#C6DFC9] bg-[#F2FBF3] px-3 py-1 text-xs font-semibold text-[#0F5132]">
                    {activeCampaign.poiBundle?.cards.length || 0} POIs
                  </span>
                </div>
                <p className="mt-3 max-w-4xl text-sm leading-6 text-[#526070]">
                  {activeCampaign.locationIntelligenceSummary.coverageSummary}
                </p>
                <p className="mt-3 text-sm leading-6 text-[#526070]">
                  {activeCampaign.locationIntelligenceSummary.providerSummary}
                </p>
                {activeCampaign.locationWarnings.length > 0 ? (
                  <div className="mt-4 rounded-2xl border border-[#E7D8C2] bg-[#FFF5DA] p-4 text-sm text-[#7A4B13]">
                    {activeCampaign.locationWarnings.map((warning) => (
                      <p key={warning} className="leading-6">
                        {warning}
                      </p>
                    ))}
                  </div>
                ) : null}
                <p className="mt-4 text-xs font-semibold uppercase tracking-[0.12em] text-[#6C7B6D]">
                  {activeCampaign.scriptGenerationStatus === "script_generated"
                    ? "Next: Media Planning and Asset Assembly"
                    : "Next: Script and Narrative Generation"}
                </p>
              </section>
            ) : null}

            {activeCampaign.locationStory ? (
              <section
                className="mt-6 grid gap-5 lg:grid-cols-[1.05fr_0.95fr]"
                data-testid="casahud-location-story"
              >
                <section className="rounded-[1.85rem] border border-[#D8E2D9] bg-white/[0.94] p-5 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#6C7B6D]">Campaign Location Story</p>
                  <h3 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-[#172033]">
                    {activeCampaign.locationStory.headline}
                  </h3>
                  <p className="mt-4 text-sm leading-7 text-[#526070]">{activeCampaign.locationStory.summary}</p>
                  {activeCampaign.locationStory.fallbackNotice ? (
                    <p className="mt-4 text-xs font-semibold uppercase tracking-[0.12em] text-[#8A5A34]">
                      {activeCampaign.locationStory.fallbackNotice}
                    </p>
                  ) : null}
                </section>

                <aside className="grid gap-4">
                  <section className="rounded-[1.75rem] border border-[#E4D7C2] bg-[#FFF9EF] p-5 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8A5A34]">Lifestyle Anchors</p>
                    <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-[#344256]">
                      {activeCampaign.locationStory.lifestyleAnchors.map((anchor) => (
                        <span key={anchor} className="rounded-full border border-[#D7CAB8] bg-white px-3 py-1">
                          {anchor}
                        </span>
                      ))}
                    </div>
                  </section>

                  <section className="rounded-[1.75rem] border border-[#D8E2D9] bg-[#F7FAF8] p-5 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#6C7B6D]">Narrative Angles</p>
                    <div className="mt-4 grid gap-3">
                      {activeCampaign.locationStory.narrativeAngles.map((angle) => (
                        <div key={angle} className="rounded-2xl border border-[#D8E2D9] bg-white/80 p-4 text-sm leading-6 text-[#526070]">
                          {angle}
                        </div>
                      ))}
                    </div>
                  </section>
                </aside>
              </section>
            ) : null}

            {activeCampaign.localHighlights.length > 0 ? (
              <section className="mt-6" data-testid="casahud-local-highlights">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8A5A34]">Local Highlights</p>
                    <h3 className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-[#172033]">Why the place matters</h3>
                  </div>
                  <span className="rounded-full border border-[#D7CAB8] bg-white px-3 py-1 text-xs font-semibold text-[#344256]">
                    {activeCampaign.localHighlights.length} highlights
                  </span>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  {activeCampaign.localHighlights.map((highlight) => (
                    <article key={highlight.id} className="rounded-3xl border border-[#E4D7C2] bg-white/[0.92] p-5 shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#8A5A34]">{highlight.locationText}</p>
                      <h4 className="mt-2 text-xl font-semibold tracking-[-0.02em] text-[#172033]">{highlight.title}</h4>
                      <p className="mt-3 text-sm leading-6 text-[#526070]">{highlight.description}</p>
                      <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6C7B6D]">
                        {highlight.provider === "casahud_location_patterns" ? "CasaHUD location patterns" : highlight.provider === "google_places" ? "Google Places" : "Mapbox"}
                      </p>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}

            {activeCampaign.poiBundle ? (
              <section className="mt-6" data-testid="casahud-poi-bundle">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#6C7B6D]">Points of Interest</p>
                    <h3 className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-[#172033]">Context cards for the shortlist</h3>
                  </div>
                  <span className="rounded-full border border-[#D8E2D9] bg-white px-3 py-1 text-xs font-semibold text-[#344256]">
                    {activeCampaign.poiBundle.cards.length} cards
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-[#526070]">{activeCampaign.poiBundle.summary}</p>
                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  {activeCampaign.poiBundle.cards.map((poi) => (
                    <article key={poi.id} className="rounded-3xl border border-[#D8E2D9] bg-white/[0.94] p-5 shadow-sm">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full border border-[#D8E2D9] bg-[#F7FAF8] px-2.5 py-1 text-[11px] font-semibold text-[#344256]">
                              {poi.category}
                            </span>
                            {poi.associatedListingId ? (
                              <span className="rounded-full border border-[#D7CAB8] bg-[#FFF9EF] px-2.5 py-1 text-[11px] font-semibold text-[#8A5A34]">
                                Linked to shortlist
                              </span>
                            ) : null}
                          </div>
                          <h4 className="mt-3 text-xl font-semibold tracking-[-0.02em] text-[#172033]">{poi.name}</h4>
                          <p className="mt-2 text-sm leading-6 text-[#526070]">{poi.locationText}</p>
                        </div>
                        <span className="rounded-full border border-[#D8E2D9] bg-white px-3 py-1 text-xs font-semibold text-[#344256]">
                          {poi.distanceText || "Area context"}
                        </span>
                      </div>
                      <p className="mt-4 text-sm leading-6 text-[#526070]">{poi.relevanceReason}</p>
                      <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6C7B6D]">
                        {poi.provider === "casahud_location_patterns" ? "CasaHUD location patterns" : poi.provider === "google_places" ? "Google Places" : "Mapbox"}
                      </p>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}

            {activeCampaign.mapSceneIdeas.length > 0 ? (
              <section className="mt-6" data-testid="casahud-map-scene-ideas">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8A5A34]">Map Scene Ideas</p>
                    <h3 className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-[#172033]">Visual anchors for later scripting</h3>
                  </div>
                  <span className="rounded-full border border-[#D7CAB8] bg-white px-3 py-1 text-xs font-semibold text-[#344256]">
                    {activeCampaign.mapSceneIdeas.length} scene ideas
                  </span>
                </div>
                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  {activeCampaign.mapSceneIdeas.map((scene) => (
                    <article key={scene.id} className="rounded-3xl border border-[#E4D7C2] bg-[#FFFDF8]/[0.95] p-5 shadow-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-[#D7CAB8] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#344256]">
                          {formatCampaignStatus(scene.sceneType)}
                        </span>
                        <span className="rounded-full border border-[#D8E2D9] bg-[#F7FAF8] px-2.5 py-1 text-[11px] font-semibold text-[#344256]">
                          {scene.provider === "casahud_location_patterns" ? "CasaHUD patterns" : scene.provider === "google_places" ? "Google Places" : "Mapbox"}
                        </span>
                      </div>
                      <h4 className="mt-3 text-xl font-semibold tracking-[-0.02em] text-[#172033]">{scene.title}</h4>
                      <p className="mt-2 text-sm leading-6 text-[#526070]">{scene.description}</p>
                      <p className="mt-4 text-sm leading-6 text-[#344256]">
                        <span className="font-semibold text-[#172033]">Suggested visual:</span> {scene.suggestedVisual}
                      </p>
                      <p className="mt-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#6C7B6D]">
                        {scene.locationText}
                      </p>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}

            {activeCampaign.listingLocationInsights.length > 0 ? (
              <section className="mt-6" data-testid="casahud-listing-location-insights">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#1B8A5A]">Listing Location Insights</p>
                    <h3 className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-[#172033]">Why each approved listing fits its place</h3>
                  </div>
                  <span className="rounded-full border border-[#C6DFC9] bg-[#F2FBF3] px-3 py-1 text-xs font-semibold text-[#0F5132]">
                    {activeCampaign.listingLocationInsights.length} insights
                  </span>
                </div>
                <div className="mt-4 grid gap-3">
                  {activeCampaign.listingLocationInsights.map((insight) => (
                    <article key={insight.listingId} className="rounded-3xl border border-[#CFE2D2] bg-white/[0.95] p-5 shadow-sm">
                      <h4 className="text-xl font-semibold tracking-[-0.02em] text-[#172033]">{insight.summary}</h4>
                      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_0.95fr]">
                        <div>
                          <p className="text-sm font-semibold text-[#172033]">Highlights</p>
                          <div className="mt-3 grid gap-2">
                            {insight.highlights.map((highlight) => (
                              <p key={highlight} className="rounded-2xl border border-[#D8E2D9] bg-[#F7FAF8] px-4 py-3 text-sm leading-6 text-[#526070]">
                                {highlight}
                              </p>
                            ))}
                          </div>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-[#172033]">Location strengths</p>
                          <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-[#344256]">
                            {insight.locationStrengths.map((strength) => (
                              <span key={strength} className="rounded-full border border-[#D7CAB8] bg-[#FFF9EF] px-3 py-1">
                                {strength}
                              </span>
                            ))}
                          </div>
                          {insight.nearbyPois.length > 0 ? (
                            <div className="mt-4 rounded-2xl border border-[#D8E2D9] bg-white/80 p-4">
                              <p className="text-sm font-semibold text-[#172033]">Nearby POIs</p>
                              <p className="mt-2 text-sm leading-6 text-[#526070]">
                                {insight.nearbyPois.map((poi) => poi.name).join(" · ")}
                              </p>
                            </div>
                          ) : null}
                        </div>
                      </div>
                      {insight.warnings.length > 0 ? (
                        <p className="mt-4 text-xs font-semibold uppercase tracking-[0.12em] text-[#8A5A34]">
                          {insight.warnings.join(" · ")}
                        </p>
                      ) : null}
                    </article>
                  ))}
                </div>
              </section>
            ) : null}

            {activeCampaign.locationProviderStatuses.length > 0 ? (
              <section className="mt-6" data-testid="casahud-location-provider-statuses">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#6C7B6D]">Provider Status</p>
                    <h3 className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-[#172033]">Coverage and fallback state</h3>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  {activeCampaign.locationProviderStatuses.map((providerStatus) => (
                    <article key={providerStatus.provider} className="rounded-3xl border border-[#D8E2D9] bg-white/[0.94] p-5 shadow-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-[#172033]">{providerStatus.label}</p>
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                            providerStatus.state === "connected"
                              ? "bg-[#DFF3E7] text-[#0F5132]"
                              : providerStatus.state === "fallback"
                                ? "bg-[#FFF0D6] text-[#7A4B13]"
                                : providerStatus.state === "error"
                                  ? "bg-[#FEE2E2] text-[#991B1B]"
                                  : "bg-[#EEF2F6] text-[#526070]"
                          }`}
                        >
                          {formatCampaignStatus(providerStatus.state)}
                        </span>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-[#526070]">{providerStatus.detail}</p>
                      {providerStatus.coverage ? (
                        <p className="mt-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#6C7B6D]">
                          {providerStatus.coverage}
                        </p>
                      ) : null}
                      {providerStatus.warning ? (
                        <p className="mt-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#8A5A34]">
                          {providerStatus.warning}
                        </p>
                      ) : null}
                    </article>
                  ))}
                </div>
              </section>
            ) : null}

            {activeCampaign.scriptSummary ? (
              <section
                className="mt-6 rounded-[1.85rem] border border-[#D4DDF2] bg-[linear-gradient(160deg,rgba(247,250,255,0.98),rgba(255,255,255,0.94))] p-5 shadow-sm"
                data-testid="casahud-script-summary"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#41608E]">Script Summary</p>
                    <h3 className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-[#172033]">
                      {activeCampaign.scriptSummary}
                    </h3>
                  </div>
                  {activeCampaign.estimatedDurationSeconds ? (
                    <span className="rounded-full border border-[#D4DDF2] bg-white px-3 py-1 text-xs font-semibold text-[#344256]">
                      {activeCampaign.estimatedDurationSeconds}s
                    </span>
                  ) : null}
                </div>
                {activeCampaign.tone ? (
                  <p className="mt-3 max-w-4xl text-sm leading-6 text-[#526070]">{activeCampaign.tone}</p>
                ) : null}
                {activeCampaign.scriptProviderStatus ? (
                  <div className="mt-4 rounded-2xl border border-[#D4DDF2] bg-white/85 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-[#172033]">{activeCampaign.scriptProviderStatus.label}</p>
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          activeCampaign.scriptProviderStatus.state === "connected"
                            ? "bg-[#DFF3E7] text-[#0F5132]"
                            : activeCampaign.scriptProviderStatus.state === "error"
                              ? "bg-[#FEE2E2] text-[#991B1B]"
                              : "bg-[#FFF0D6] text-[#7A4B13]"
                        }`}
                      >
                        {formatCampaignStatus(activeCampaign.scriptProviderStatus.state)}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-[#526070]">{activeCampaign.scriptProviderStatus.detail}</p>
                  </div>
                ) : null}
                <p className="mt-4 text-xs font-semibold uppercase tracking-[0.12em] text-[#41608E]">
                  Next: Media Planning and Asset Assembly
                </p>
              </section>
            ) : null}

            {activeCampaign.openingHook ? (
              <section className="mt-6 grid gap-5 lg:grid-cols-[0.98fr_1.02fr]" data-testid="casahud-script-preview">
                <section className="rounded-[1.85rem] border border-[#D4DDF2] bg-white/[0.94] p-5 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#41608E]">Opening Hook</p>
                  <h3 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-[#172033]">
                    {activeCampaign.openingHook}
                  </h3>
                  {activeCampaign.closingCta ? (
                    <div className="mt-5 rounded-2xl border border-[#D4DDF2] bg-[#F7FAFF] p-4">
                      <p className="text-sm font-semibold text-[#172033]">Closing CTA</p>
                      <p className="mt-2 text-sm leading-6 text-[#526070]">{activeCampaign.closingCta}</p>
                    </div>
                  ) : null}
                </section>

                <aside className="grid gap-4">
                  {activeCampaign.locationLifestyleLines.length > 0 ? (
                    <section className="rounded-[1.75rem] border border-[#D4DDF2] bg-[#F7FAFF] p-5 shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#41608E]">Location Storytelling Lines</p>
                      <div className="mt-4 grid gap-3">
                        {activeCampaign.locationLifestyleLines.map((line) => (
                          <div key={line} className="rounded-2xl border border-[#D4DDF2] bg-white/85 p-4 text-sm leading-6 text-[#526070]">
                            {line}
                          </div>
                        ))}
                      </div>
                    </section>
                  ) : null}

                  {activeCampaign.toneAndPacingNotes.length > 0 ? (
                    <section className="rounded-[1.75rem] border border-[#E4D7C2] bg-[#FFF9EF] p-5 shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8A5A34]">Tone and Pacing Notes</p>
                      <div className="mt-4 grid gap-3">
                        {activeCampaign.toneAndPacingNotes.map((note) => (
                          <div key={note} className="rounded-2xl border border-[#E4D7C2] bg-white/85 p-4 text-sm leading-6 text-[#526070]">
                            {note}
                          </div>
                        ))}
                      </div>
                    </section>
                  ) : null}
                </aside>
              </section>
            ) : null}

            {activeCampaign.scriptSegments.length > 0 ? (
              <section className="mt-6" data-testid="casahud-script-segments">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#41608E]">Video Flow</p>
                    <h3 className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-[#172033]">Scene-level narration</h3>
                  </div>
                  <span className="rounded-full border border-[#D4DDF2] bg-white px-3 py-1 text-xs font-semibold text-[#344256]">
                    {activeCampaign.scriptSegments.length} segments
                  </span>
                </div>
                <div className="mt-4 grid gap-3">
                  {activeCampaign.scriptSegments.map((segment) => (
                    <article key={segment.id} className="rounded-3xl border border-[#D4DDF2] bg-white/[0.95] p-5 shadow-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full border border-[#D4DDF2] bg-[#F7FAFF] px-2.5 py-1 text-[11px] font-semibold text-[#41608E]">
                            {formatCampaignStatus(segment.segmentType)}
                          </span>
                          {segment.associatedListingId ? (
                            <span className="rounded-full border border-[#D7CAB8] bg-[#FFF9EF] px-2.5 py-1 text-[11px] font-semibold text-[#8A5A34]">
                              Listing-linked
                            </span>
                          ) : null}
                        </div>
                        <span className="rounded-full border border-[#D4DDF2] bg-white px-3 py-1 text-xs font-semibold text-[#344256]">
                          {segment.durationSeconds}s
                        </span>
                      </div>
                      <h4 className="mt-3 text-xl font-semibold tracking-[-0.02em] text-[#172033]">{segment.title}</h4>
                      <p className="mt-3 text-sm leading-6 text-[#526070]">{segment.narration}</p>
                      {segment.visualNote ? (
                        <p className="mt-4 text-sm leading-6 text-[#344256]">
                          <span className="font-semibold text-[#172033]">Editorial note:</span> {segment.visualNote}
                        </p>
                      ) : null}
                    </article>
                  ))}
                </div>
              </section>
            ) : null}

            {activeCampaign.propertySegments.length > 0 ? (
              <section className="mt-6" data-testid="casahud-property-segments">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#1B8A5A]">Property Segments</p>
                    <h3 className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-[#172033]">Validated listing copy</h3>
                  </div>
                  <span className="rounded-full border border-[#CFE2D2] bg-[#F2FBF3] px-3 py-1 text-xs font-semibold text-[#0F5132]">
                    {activeCampaign.propertySegments.length} segments
                  </span>
                </div>
                <div className="mt-4 grid gap-3">
                  {activeCampaign.propertySegments.map((segment) => (
                    <article key={segment.listingId} className="rounded-3xl border border-[#CFE2D2] bg-white/[0.95] p-5 shadow-sm">
                      <h4 className="text-xl font-semibold tracking-[-0.02em] text-[#172033]">{segment.title}</h4>
                      <p className="mt-2 text-sm leading-6 text-[#526070]">{segment.locationText}</p>
                      <p className="mt-4 text-sm leading-6 text-[#526070]">{segment.narration}</p>
                      <div className="mt-4 rounded-2xl border border-[#D8E2D9] bg-[#F7FAF8] p-4">
                        <p className="text-sm font-semibold text-[#172033]">Why it made the cut</p>
                        <p className="mt-2 text-sm leading-6 text-[#526070]">{segment.whyItMadeTheCut}</p>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-[#344256]">
                        {segment.supportedFacts.map((fact) => (
                          <span key={fact} className="rounded-full border border-[#D7CAB8] bg-white px-3 py-1">
                            {fact}
                          </span>
                        ))}
                      </div>
                      {segment.locationLine ? (
                        <p className="mt-4 text-sm leading-6 text-[#344256]">
                          <span className="font-semibold text-[#172033]">Location line:</span> {segment.locationLine}
                        </p>
                      ) : null}
                      {segment.caution ? (
                        <p className="mt-4 text-xs font-semibold uppercase tracking-[0.12em] text-[#8A5A34]">{segment.caution}</p>
                      ) : null}
                    </article>
                  ))}
                </div>
              </section>
            ) : null}

            {activeCampaign.transitions.length > 0 ? (
              <section className="mt-6" data-testid="casahud-script-transitions">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#6C7B6D]">Transitions</p>
                    <h3 className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-[#172033]">How the story moves</h3>
                  </div>
                </div>
                <div className="mt-4 grid gap-3">
                  {activeCampaign.transitions.map((transition) => (
                    <div key={transition} className="rounded-3xl border border-[#D8E2D9] bg-white/[0.94] p-5 shadow-sm text-sm leading-6 text-[#526070]">
                      {transition}
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {activeCampaign.scriptWarnings.length > 0 ? (
              <section className="mt-6" data-testid="casahud-script-warnings">
                <div className="rounded-[1.75rem] border border-[#E7D8C2] bg-[#FFF5DA] p-5 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8A5A34]">Script Warnings</p>
                  <div className="mt-4 grid gap-3">
                    {activeCampaign.scriptWarnings.map((warning) => (
                      <p key={warning} className="text-sm leading-6 text-[#7A4B13]">
                        {warning}
                      </p>
                    ))}
                  </div>
                </div>
              </section>
            ) : null}

            {activeCampaign.approvedListings.length > 0 ? (
              <section className="mt-6" data-testid="casahud-approved-listings">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#1B8A5A]">Approved Listings</p>
                    <h3 className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-[#172033]">Validated shortlist</h3>
                  </div>
                  <span className="rounded-full border border-[#C6DFC9] bg-[#F2FBF3] px-3 py-1 text-xs font-semibold text-[#0F5132]">
                    {activeCampaign.approvedListings.length} approved
                  </span>
                </div>
                <div className="mt-4 grid gap-3">
                  {activeCampaign.approvedListings.map((listing) => (
                    <article
                      key={listing.id}
                      className="rounded-3xl border border-[#CFE2D2] bg-white/[0.94] p-5 shadow-sm"
                      data-testid="casahud-approved-listing-card"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            {typeof listing.rank === "number" ? (
                              <span className="rounded-full bg-[#1B8A5A] px-2.5 py-1 text-[11px] font-semibold text-white">
                                #{listing.rank}
                              </span>
                            ) : null}
                            <span className="rounded-full border border-[#CFE2D2] bg-[#F2FBF3] px-2.5 py-1 text-[11px] font-semibold text-[#0F5132]">
                              Approved
                            </span>
                            <span className="rounded-full border border-[#D7CAB8] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#344256]">
                              {formatListingProvider(listing.provider)}
                            </span>
                            {listing.propertyType ? (
                              <span className="rounded-full border border-[#D7CAB8] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#344256]">
                                {listing.propertyType}
                              </span>
                            ) : null}
                          </div>
                          <h4 className="mt-3 text-xl font-semibold tracking-[-0.02em] text-[#172033]">{listing.title}</h4>
                          <p className="mt-2 text-sm leading-6 text-[#526070]">{listing.locationText}</p>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <span className="rounded-full border border-[#D7CAB8] bg-white px-3 py-1 text-sm font-semibold text-[#172033]">
                            {formatListingPrice(listing.price, listing.currency)}
                          </span>
                          <span className="rounded-full border border-[#CFE2D2] bg-[#F2FBF3] px-3 py-1 text-xs font-semibold text-[#0F5132]">
                            Score {listing.overallScore}
                          </span>
                        </div>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-[#344256]">
                        <span className="rounded-full border border-[#D7CAB8] bg-[#F8F3EA] px-3 py-1">
                          Photos: {listing.photoAvailability}
                        </span>
                        <span className="rounded-full border border-[#D7CAB8] bg-[#F8F3EA] px-3 py-1">
                          {listing.imageCount} images
                        </span>
                        {typeof listing.sizeSqm === "number" ? (
                          <span className="rounded-full border border-[#D7CAB8] bg-[#F8F3EA] px-3 py-1">
                            {listing.sizeSqm} sqm
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-4 text-sm leading-6 text-[#526070]">
                        {listing.validationReasons.slice(0, 3).join(" · ")}
                      </p>
                      {listing.warnings.length > 0 ? (
                        <p className="mt-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#8A5A34]">
                          {listing.warnings.join(" · ")}
                        </p>
                      ) : null}
                    </article>
                  ))}
                </div>
              </section>
            ) : null}

            {activeCampaign.rejectedListings.length > 0 ? (
              <section className="mt-6" data-testid="casahud-rejected-listings">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8A5A34]">Rejected Or Needs Attention</p>
                    <h3 className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-[#172033]">Listings that did not clear the bar</h3>
                  </div>
                  <span className="rounded-full border border-[#E7D8C2] bg-[#FFF5DA] px-3 py-1 text-xs font-semibold text-[#7A4B13]">
                    {activeCampaign.rejectedListings.length} reviewed out
                  </span>
                </div>
                <div className="mt-4 grid gap-3">
                  {activeCampaign.rejectedListings.map((listing) => (
                    <article
                      key={listing.id}
                      className="rounded-3xl border border-[#E7D8C2] bg-white/[0.9] p-5 shadow-sm"
                      data-testid="casahud-rejected-listing-card"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                                listing.validationStatus === "needs_attention"
                                  ? "border border-[#D7CAB8] bg-[#FFF5DA] text-[#7A4B13]"
                                  : "border border-[#E8CFCF] bg-[#FDECEC] text-[#991B1B]"
                              }`}
                            >
                              {listing.validationStatus === "needs_attention" ? "Needs attention" : "Rejected"}
                            </span>
                            <span className="rounded-full border border-[#D7CAB8] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#344256]">
                              {formatListingProvider(listing.provider)}
                            </span>
                            {listing.rejectionCategory ? (
                              <span className="rounded-full border border-[#D7CAB8] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#344256]">
                                {formatCampaignStatus(listing.rejectionCategory)}
                              </span>
                            ) : null}
                          </div>
                          <h4 className="mt-3 text-xl font-semibold tracking-[-0.02em] text-[#172033]">{listing.title}</h4>
                          <p className="mt-2 text-sm leading-6 text-[#526070]">{listing.locationText}</p>
                        </div>
                        <span className="rounded-full border border-[#D7CAB8] bg-white px-3 py-1 text-sm font-semibold text-[#172033]">
                          Score {listing.overallScore}
                        </span>
                      </div>
                      <p className="mt-4 text-sm leading-6 text-[#526070]">
                        {listing.validationReasons.slice(0, 3).join(" · ")}
                      </p>
                      {listing.warnings.length > 0 ? (
                        <p className="mt-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#8A5A34]">
                          {listing.warnings.join(" · ")}
                        </p>
                      ) : null}
                    </article>
                  ))}
                </div>
              </section>
            ) : null}

            {activeCampaign.listingCandidates.length > 0 ? (
              <section className="mt-6" data-testid="casahud-listing-candidates">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8A5A34]">Candidate Listings</p>
                    <h3 className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-[#172033]">Property shortlist</h3>
                  </div>
                  <span className="rounded-full border border-[#D7CAB8] bg-white px-3 py-1 text-xs font-semibold text-[#344256]">
                    {activeCampaign.listingCandidates.length} candidates
                  </span>
                </div>

                {activeCampaign.discoverySummary?.providerSummary ? (
                  <div className="mt-4 rounded-2xl border border-[#E7D8C2] bg-[#FFF5DA] p-4 text-sm text-[#7A4B13]">
                    {activeCampaign.discoverySummary.providerSummary}
                  </div>
                ) : null}

                <div className="mt-4 grid gap-3">
                  {activeCampaign.listingCandidates.map((candidate) => (
                    <article
                      key={candidate.id}
                      className="rounded-3xl border border-[#E4D7C2] bg-white/[0.9] p-5 shadow-sm"
                      data-testid="casahud-listing-candidate-card"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full border border-[#D7CAB8] bg-[#F8F3EA] px-2.5 py-1 text-[11px] font-semibold text-[#344256]">
                              {formatListingProvider(candidate.provider)}
                            </span>
                            {candidate.propertyType ? (
                              <span className="rounded-full border border-[#D7CAB8] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#344256]">
                                {candidate.propertyType}
                              </span>
                            ) : null}
                            <span className="rounded-full border border-[#D7CAB8] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#344256]">
                              {candidate.imageCount} photos
                            </span>
                          </div>
                          <h4 className="mt-3 text-xl font-semibold tracking-[-0.02em] text-[#172033]">{candidate.title}</h4>
                          <p className="mt-2 text-sm leading-6 text-[#526070]">{candidate.locationText}</p>
                        </div>
                        <span className="rounded-full border border-[#D7CAB8] bg-white px-3 py-1 text-sm font-semibold text-[#172033]">
                          {formatListingPrice(candidate.price, candidate.currency)}
                        </span>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-[#344256]">
                        {typeof candidate.bedrooms === "number" ? (
                          <span className="rounded-full border border-[#D7CAB8] bg-[#F8F3EA] px-3 py-1">
                            {candidate.bedrooms} bed
                          </span>
                        ) : null}
                        {typeof candidate.bathrooms === "number" ? (
                          <span className="rounded-full border border-[#D7CAB8] bg-[#F8F3EA] px-3 py-1">
                            {candidate.bathrooms} bath
                          </span>
                        ) : null}
                        {typeof candidate.sizeSqm === "number" ? (
                          <span className="rounded-full border border-[#D7CAB8] bg-[#F8F3EA] px-3 py-1">
                            {candidate.sizeSqm} sqm
                          </span>
                        ) : null}
                        <span className="rounded-full border border-[#D7CAB8] bg-[#F8F3EA] px-3 py-1">
                          Photo availability: {candidate.photoAvailability}
                        </span>
                      </div>

                      {candidate.descriptionSnippet ? (
                        <p className="mt-4 text-sm leading-6 text-[#526070]">{candidate.descriptionSnippet}</p>
                      ) : null}
                      <p className="mt-4 text-sm leading-6 text-[#526070]">
                        <span className="font-semibold text-[#172033]">Preliminary match notes:</span>{" "}
                        {candidate.preliminaryMatchNotes}
                      </p>

                      <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto]">
                        <div>
                          <p className="text-sm font-semibold text-[#172033]">Key features</p>
                          <p className="mt-2 text-sm leading-6 text-[#526070]">{candidate.features.join(" · ")}</p>
                        </div>
                        <div className="text-sm leading-6 text-[#526070]">
                          {candidate.sourceUrl ? (
                            <p>
                              <span className="font-semibold text-[#172033]">Source URL:</span> {candidate.sourceUrl}
                            </p>
                          ) : null}
                          <p>
                            <span className="font-semibold text-[#172033]">Discovered:</span>{" "}
                            {formatCampaignTime(candidate.discoveredAt)}
                          </p>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}
          </section>
        ) : null}
      </div>

      {setupOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end bg-[#172033]/45 p-3 backdrop-blur-sm md:items-center md:justify-center md:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="casahud-connect-title"
          data-testid="casahud-connect-wizard"
        >
          <section className="max-h-[92vh] w-full overflow-y-auto rounded-[1.75rem] border border-white/70 bg-[#FFFDF8] shadow-[0_30px_90px_rgba(23,32,51,0.34)] md:max-w-5xl">
            <div className="border-b border-[#E6D8C6] p-5 md:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8A5A34]">Connections</p>
                  <h2 id="casahud-connect-title" className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-[#172033]">
                    Manage CasaHUD connections
                  </h2>
                  <p className="mt-3 max-w-3xl text-sm leading-6 text-[#526070]" data-testid="casahud-setup-message">
                    {setupReason || setupMessage}
                  </p>
                </div>
                <button
                  type="button"
                  className="rounded-full border border-[#D7CAB8] bg-white px-4 py-2 text-sm font-semibold text-[#344256] transition hover:bg-[#F8F0E5]"
                  onClick={() => setSetupOpen(false)}
                >
                  Close
                </button>
              </div>
            </div>

            <div className="grid gap-5 p-5 lg:grid-cols-[1.08fr_0.92fr] md:p-6">
              <div className="grid gap-4" data-testid="casahud-connection-cards">
                {[
                  { id: "create", title: "Required to Create Videos" },
                  { id: "publish", title: "Required to Publish/Schedule" },
                  { id: "optional", title: "Optional Premium Upgrade" },
                ].map((group) => (
                  <div key={group.id} className="grid gap-2">
                    <p className="px-1 text-xs font-semibold uppercase tracking-[0.16em] text-[#8A5A34]">{group.title}</p>
                    {connectionCards
                      .filter((card) => card.group === group.id)
                      .map((card) => (
                        <article
                          key={card.id}
                          className={`rounded-2xl border p-4 transition ${
                            activeConnectionId === card.id
                              ? "border-[#172033] bg-white shadow-[0_16px_36px_rgba(23,32,51,0.12)]"
                              : "border-[#E7D8C2] bg-white/[0.72]"
                          }`}
                          data-testid={`casahud-connection-card-${card.id}`}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="text-lg font-semibold tracking-[-0.02em] text-[#172033]">{card.title}</h3>
                                <span
                                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                                    card.status === "connected" || card.status === "partially_connected"
                                      ? "bg-[#DFF3E7] text-[#0F5132]"
                                      : card.status === "needs_attention"
                                        ? "bg-[#FEE2E2] text-[#991B1B]"
                                        : card.status === "optional"
                                          ? "bg-[#EEF2F6] text-[#526070]"
                                          : "bg-[#FFF0D6] text-[#7A4B13]"
                                  }`}
                                >
                                  {card.statusLabel}
                                </span>
                                {card.optional ? (
                                  <span className="rounded-full bg-[#EEF2F6] px-2.5 py-1 text-xs font-semibold text-[#526070]">
                                    Optional
                                  </span>
                                ) : (
                                  <span className="rounded-full bg-[#EAF0FF] px-2.5 py-1 text-xs font-semibold text-[#274690]">
                                    Required
                                  </span>
                                )}
                              </div>
                              <p className="mt-2 text-sm leading-6 text-[#526070]">{card.enables}</p>
                              <p className="mt-1 text-xs leading-5 text-[#718096]">{card.detail}</p>
                              {card.supportedSourceLabels ? (
                                <p className="mt-2 text-xs font-medium leading-5 text-[#526070]">
                                  {card.supportedSourceLabels.join(" · ")}
                                </p>
                              ) : null}
                            </div>
                            <button
                              type="button"
                              className="rounded-xl border border-[#CFC4B2] bg-[#172033] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#26324B]"
                              onClick={() => openConnectionCard(card)}
                            >
                              {card.ctaLabel}
                            </button>
                          </div>
                        </article>
                      ))}
                  </div>
                ))}
              </div>

              <aside className="rounded-2xl border border-[#E7D8C2] bg-[#F9F4EC] p-4" data-testid="casahud-connection-form">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8A5A34]">Connection setup</p>
                    <h3 className="mt-1 text-xl font-semibold tracking-[-0.025em] text-[#172033]">
                      {activeConnectionCard?.title || "Choose a connection"}
                    </h3>
                  </div>
                  {activeConnectionCard ? (
                    <span className="rounded-full border border-[#D7CAB8] bg-white px-3 py-1 text-xs font-semibold text-[#526070]">
                      {activeConnectionCard.optional ? "Optional" : "Required"}
                    </span>
                  ) : null}
                </div>

                <p className="mt-3 text-sm leading-6 text-[#526070]">
                  Add or update the connection key for this service. CasaHUD protects it for your account and never
                  shows the full value back on screen.
                </p>

                {activeConnectionCard?.id === "listing_sources" || activeConnectionCard?.id === "media_storage" ? (
                  <label className="mt-4 block text-sm font-semibold text-[#344256]">
                    {activeConnectionCard.id === "listing_sources" ? "Listing source" : "Storage provider"}
                    <select
                      className="mt-2 w-full rounded-xl border border-[#D7CAB8] bg-white px-3 py-3 text-sm text-[#172033] outline-none transition focus:border-[#172033]"
                      value={activeProviderId}
                      onChange={(event) => setActiveProviderId(event.target.value as DomaraIntegrationProviderId)}
                    >
                      {activeConnectionCard.providerIds.map((providerId) => (
                        <option key={providerId} value={providerId}>
                          {providerOptionLabels[providerId]}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}

                <label className="mt-4 block text-sm font-semibold text-[#344256]">
                  Connection key
                  <input
                    className="mt-2 w-full rounded-xl border border-[#D7CAB8] bg-white px-3 py-3 text-sm text-[#172033] outline-none transition placeholder:text-[#98A1AE] focus:border-[#172033]"
                    type="password"
                    value={connectionSecret}
                    onChange={(event) => setConnectionSecret(event.target.value)}
                    placeholder={`Paste ${providerOptionLabels[activeProviderId]} connection key`}
                    autoComplete="off"
                  />
                </label>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded-xl border border-[#172033] bg-[#172033] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#26324B] disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={() => void onSaveConnection()}
                    disabled={connectionSaving || !activeConnectionCard}
                  >
                    {connectionSaving ? "Saving..." : "Save Connection"}
                  </button>
                  <button
                    type="button"
                    className="rounded-xl border border-[#CFC4B2] bg-white px-4 py-3 text-sm font-semibold text-[#344256] transition hover:bg-[#F8F0E5] disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={() => void onTestConnection()}
                    disabled={connectionTesting || !activeConnectionCard}
                  >
                    {connectionTesting ? "Testing..." : "Test Connection"}
                  </button>
                  <button
                    type="button"
                    className="rounded-xl border border-[#CFC4B2] bg-white px-4 py-3 text-sm font-semibold text-[#344256] transition hover:bg-[#F8F0E5]"
                    onClick={() => void loadConnectionStatus()}
                  >
                    Refresh Status
                  </button>
                </div>

                {connectionNotice ? (
                  <p className="mt-4 rounded-xl border border-[#E1D2BC] bg-white p-3 text-sm leading-6 text-[#526070]">
                    {connectionNotice}
                  </p>
                ) : null}

                <div className="mt-5 rounded-2xl border border-[#E1D2BC] bg-white p-4">
                  <p className="text-sm font-semibold text-[#172033]">Later-stage checklist</p>
                  <div className="mt-3 grid gap-2 text-sm text-[#526070]">
                    {connectionCards
                      .filter((card) => card.required)
                      .map((card) => (
                        <div key={card.id} className="flex items-center justify-between gap-3">
                          <span>{card.title}</span>
                          <span
                            className={
                              card.status === "connected" || card.status === "partially_connected"
                                ? "font-semibold text-[#0F5132]"
                                : "font-semibold text-[#7A4B13]"
                            }
                          >
                            {card.status === "connected" || card.status === "partially_connected"
                              ? card.statusLabel
                              : "Needed"}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              </aside>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}

// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import StudioDomaraClient from "@/app/casaflix/studio-domara-client";
import { applyCasaHudMediaPlan, type CasaHudCampaign, type CasaHudCampaignSummary } from "@/lib/studio/domara/campaigns";
import { createEmptyCasaHudExecutionData } from "@/lib/studio/domara/campaign-execution";
import { createEmptyCasaHudLocationData } from "@/lib/studio/domara/campaign-location-intelligence";
import { createEmptyCasaHudMediaPlanData } from "@/lib/studio/domara/campaign-media-planning";
import { createEmptyCasaHudScriptData } from "@/lib/studio/domara/campaign-script-narrative";
import { createEmptyCasaHudYouTubePackageData } from "@/lib/studio/domara/campaign-youtube-package";
import type { DomaraIntegrationProviderStatus } from "@/lib/studio/domara/integrations";
import type { CasaHudOpportunityResult } from "@/lib/studio/domara/opportunity-engine/types";
import { runCasaHudMediaPlanning } from "@/lib/studio/domara/media-planning-engine";

vi.mock("next/link", async () => {
  const React = await import("react");

  return {
    default: ({
      href,
      children,
      ...props
    }: {
      href: string;
      children?: ReactNode;
    }) => React.createElement("a", { href, ...props }, children),
  };
});

const providers: DomaraIntegrationProviderStatus[] = [
  {
    providerId: "openai",
    displayName: "OpenAI",
    category: "ai_generation",
    requiredEnvVars: [],
    configured: true,
    validationStatus: "configured",
    safeSetupHelp: "Connect OpenAI.",
    capabilitiesEnabled: ["strategy"],
    configuredBy: "saved",
    maskedKey: "••••1234",
  },
  {
    providerId: "idealista",
    displayName: "Idealista",
    category: "listing_ingestion",
    requiredEnvVars: [],
    configured: true,
    validationStatus: "configured",
    safeSetupHelp: "Connect Idealista.",
    capabilitiesEnabled: ["listings"],
    configuredBy: "saved",
    maskedKey: "••••4567",
  },
  {
    providerId: "mapbox",
    displayName: "Mapbox",
    category: "maps",
    requiredEnvVars: [],
    configured: true,
    validationStatus: "configured",
    safeSetupHelp: "Connect Mapbox.",
    capabilitiesEnabled: ["maps"],
    configuredBy: "saved",
    maskedKey: "••••2345",
  },
  {
    providerId: "google_maps_places",
    displayName: "Google Places",
    category: "maps",
    requiredEnvVars: [],
    configured: true,
    validationStatus: "configured",
    safeSetupHelp: "Connect Google Places.",
    capabilitiesEnabled: ["pois"],
    configuredBy: "saved",
    maskedKey: "••••3456",
  },
  {
    providerId: "cloudinary",
    displayName: "Cloudinary",
    category: "media_storage",
    requiredEnvVars: [],
    configured: true,
    validationStatus: "configured",
    safeSetupHelp: "Connect Cloudinary.",
    capabilitiesEnabled: ["media"],
    configuredBy: "saved",
    maskedKey: "••••5678",
  },
  {
    providerId: "youtube",
    displayName: "YouTube Channel",
    category: "publishing",
    requiredEnvVars: [],
    configured: false,
    validationStatus: "missing",
    safeSetupHelp: "Connect YouTube.",
    capabilitiesEnabled: ["publishing"],
  },
];

const opportunity: CasaHudOpportunityResult = {
  generatedAt: "2026-04-28T00:00:00.000Z",
  preferredMarket: "Italian real-estate YouTube",
  researchBrief: {
    summary: "CasaFlix identified the strongest opportunity in regional affordability plus relocation intent.",
    opportunityCategories: ["affordable coastal roundups", "retirement relocation"],
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
    reasoning: "CasaFlix chose this title because it balances click potential with a believable promise.",
    regionHint: "Southern Italy",
    listingSearchHints: ["Southern Italy homes under 300k", "relocation-friendly towns"],
  },
  campaignTypePrediction: "lifestyle_relocation",
  titleOpportunitySummary:
    "Could You Retire in Southern Italy for Under $300K? rose to the top because it gives CasaFlix a clear, searchable concept that can still hold up when listing discovery begins.",
  confidenceSummary:
    "89% confidence. CasaFlix prefers titles that can earn clicks without forcing unsupported claims.",
  providerStatus: {
    mode: "casahud_patterns",
    label: "CasaFlix opportunity patterns",
    detail: "Using CasaFlix opportunity patterns until YouTube is connected for live research.",
    canImproveWithYouTube: true,
  },
  nextStep: {
    action: "create_campaign",
    label: "Create campaign",
    detail: "Turn this winning concept into a saved CasaFlix campaign.",
  },
};

const emptyLocationState = createEmptyCasaHudLocationData();
const emptyScriptState = createEmptyCasaHudScriptData();
const emptyMediaPlanState = createEmptyCasaHudMediaPlanData();
const emptyYouTubePackageState = createEmptyCasaHudYouTubePackageData();
const emptyExecutionState = createEmptyCasaHudExecutionData();

const savedCampaign: CasaHudCampaign = {
  id: "campaign-opportunity-flow",
  name: opportunity.selectedTitle.title,
  selectedViralTitle: opportunity.selectedTitle.title,
  selectedTitle: opportunity.selectedTitle,
  titleCandidates: opportunity.titleCandidates,
  researchBrief: opportunity.researchBrief,
  campaignType: opportunity.campaignTypePrediction,
  marketRegionHint: "Southern Italy",
  preferredMarket: opportunity.preferredMarket,
  generationSource: opportunity.providerStatus,
  confidenceReasoning: {
    summary: opportunity.confidenceSummary,
    titleOpportunitySummary: opportunity.titleOpportunitySummary,
    selectedTitleReasoning: opportunity.selectedTitle.reasoning,
    selectedTitleConfidence: opportunity.selectedTitle.confidence,
  },
  status: "campaign_created",
  listingCandidates: [],
  listingSearchCriteria: null,
  listingProviderStatuses: [],
  discoverySummary: null,
  listingDiscoveryStatus: "not_started",
  approvedListings: [],
  rejectedListings: [],
  listingRankOrder: [],
  listingValidationStatus: "not_started",
  listingValidationSummary: null,
  titleSupportConfidence: null,
  validationWarnings: [],
  ...emptyLocationState,
  ...emptyScriptState,
  ...emptyMediaPlanState,
  ...emptyYouTubePackageState,
  ...emptyExecutionState,
  nextPhase: {
    key: "property_discovery",
    label: "Find matching properties",
    detail:
      "Property Discovery comes next. CasaFlix will translate the saved title promise into real candidate listings without regenerating the title package.",
    implemented: false,
  },
  createdAt: "2026-04-28T00:10:00.000Z",
  updatedAt: "2026-04-28T00:10:00.000Z",
  generatedAt: opportunity.generatedAt,
  futureState: {
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
  },
};

const discoveredCampaign: CasaHudCampaign = {
  ...savedCampaign,
  status: "listing_candidates_discovered",
  listingCandidates: [
    {
      id: "listing-1",
      provider: "idealista",
      providerListingId: "idealista-1",
      sourceUrl: "https://example.com/listing-1",
      title: "Tropea apartment candidate",
      locationText: "Tropea, Calabria, Italy",
      country: "Italy",
      region: "Calabria",
      city: "Tropea",
      price: 284000,
      currency: "USD",
      propertyType: "apartment",
      bedrooms: 2,
      bathrooms: 2,
      sizeSqm: 88,
      descriptionSnippet: "Candidate listing pattern with strong relocation fit.",
      features: ["budget-conscious", "move-in ready", "coastal lifestyle"],
      imageUrls: ["https://images.example.com/1.jpg"],
      imageCount: 1,
      photoAvailability: "limited",
      discoveredAt: "2026-04-28T00:20:00.000Z",
      preliminaryMatchNotes: "Fits the title promise and budget.",
    },
    {
      id: "listing-2",
      provider: "idealista",
      providerListingId: "idealista-2",
      sourceUrl: "https://example.com/listing-2",
      thumbnailUrl: "https://images.example.com/listing-2-thumb.jpg",
      title: "Lecce villa candidate",
      locationText: "Lecce, Puglia, Italy",
      country: "Italy",
      region: "Puglia",
      city: "Lecce",
      price: 296000,
      currency: "USD",
      propertyType: "villa",
      bedrooms: 3,
      bathrooms: 2,
      sizeSqm: 112,
      descriptionSnippet: "Candidate listing pattern with weaker visual support.",
      features: ["courtyard"],
      imageUrls: [],
      imageCount: 0,
      photoAvailability: "none",
      discoveredAt: "2026-04-28T00:20:00.000Z",
      preliminaryMatchNotes: "Matches the retirement angle but needs stronger proof.",
    },
  ],
  discoverySummary: {
    headline: `Prepared 2 candidate properties for "${savedCampaign.selectedViralTitle}".`,
    criteriaSummary: "Searching sale listings around Southern Italy up to USD 300,000.",
    providerSummary: "Using Idealista for source-backed discovery.",
    candidateCount: 2,
    liveCandidateCount: 2,
    fallbackCandidateCount: 0,
    fallbackUsed: false,
    warnings: [],
    discoveredAt: "2026-04-28T00:20:00.000Z",
  },
  listingDiscoveryStatus: "listing_candidates_discovered",
  nextPhase: {
    key: "listing_validation",
    label: "Validate and rank listings",
    detail:
      "Validation and ranking arrive next. CasaFlix will confirm which discovered candidates truly support the title promise.",
    implemented: false,
  },
  updatedAt: "2026-04-28T00:20:00.000Z",
};

const scriptedCampaign: CasaHudCampaign = {
  ...discoveredCampaign,
  status: "script_narrative_completed",
  approvedListings: [
    {
      ...discoveredCampaign.listingCandidates[0]!,
      validationStatus: "approved",
      overallScore: 88,
      scoreBreakdown: {
        titleMatchScore: 92,
        geographyScore: 100,
        priceFitScore: 100,
        propertyTypeScore: 100,
        featureClaimScore: 76,
        mediaAvailabilityScore: 52,
        listingCompletenessScore: 78,
        providerQualityScore: 64,
        uniquenessScore: 100,
        overallScore: 88,
      },
      validationReasons: ["Location aligns with the campaign region."],
      warnings: [],
      rank: 1,
    },
  ],
  rejectedListings: [],
  listingValidationStatus: "listing_candidates_validated",
  locationIntelligenceStatus: "location_intelligence_completed",
  locationIntelligenceSummary: {
    headline: "Location story prepared across the shortlist.",
    providerSummary: "Maps and POIs are available.",
    coverageSummary: "Tropea anchors the relocation story with coastal lifestyle proof points.",
    warningCount: 0,
    generatedAt: "2026-04-28T00:30:00.000Z",
    fallbackUsed: false,
  },
  locationStory: {
    headline: "Tropea turns the shortlist into a place-led story.",
    summary: "CasaFlix frames the property through coastal day-to-day life.",
    narrativeAngles: ["Lead with place before property."],
    lifestyleAnchors: ["Waterside lifestyle context"],
    regionHighlights: ["Tropea", "Calabria"],
  },
  localHighlights: [],
  poiBundle: {
    summary: "POI story ready.",
    cards: [
      {
        id: "poi-1",
        name: "Coastal access context",
        category: "Beach",
        locationText: "Tropea, Calabria, Italy",
        associatedListingId: "listing-1",
        relevanceReason: "Supports the daily-life coastal promise in the title.",
        provider: "google_places",
        sourceConfidence: "high",
      },
    ],
    categories: ["Beach"],
    generatedAt: "2026-04-28T00:30:00.000Z",
  },
  mapSceneIdeas: [
    {
      id: "map-1",
      title: "Open on Tropea",
      sceneType: "regional_anchor",
      description: "Establish Tropea before the property details arrive.",
      associatedListingId: "listing-1",
      locationText: "Tropea, Calabria, Italy",
      suggestedVisual: "Wide regional map pull-back with the property highlighted.",
      provider: "mapbox",
      confidence: "high",
    },
  ],
  listingLocationInsights: [],
  scriptGenerationStatus: "script_generated",
  scriptSummary: "A relocation-oriented narrative that uses the validated shortlist and place story.",
  openingHook: "What does life in Southern Italy actually look like when the homes are real and the budget still matters?",
  estimatedDurationSeconds: 104,
  tone: "Premium, clear, cinematic where appropriate.",
  scriptSegments: [
    {
      id: "segment-hook",
      title: "Opening Hook",
      segmentType: "hook",
      narration: "What does life in Southern Italy actually look like when the homes are real and the budget still matters?",
      durationSeconds: 14,
      visualNote: "Open on the region before the listing.",
    },
    {
      id: "segment-property",
      title: "Property 1: Tropea apartment candidate",
      segmentType: "property_focus",
      narration: "Ground the story with the validated property and its real price, layout, and coastal location.",
      durationSeconds: 24,
      associatedListingId: "listing-1",
      visualNote: "Keep the segment anchored to verified listing facts.",
    },
  ],
  propertySegments: [
    {
      listingId: "listing-1",
      title: "Tropea apartment candidate",
      locationText: "Tropea, Calabria, Italy",
      narration: "Use the listing to ground the relocation story in real budget and location support.",
      whyItMadeTheCut: "It gives the story a believable mix of budget, livability, and place.",
      supportedFacts: ["USD 284,000", "2 bedrooms", "88 sqm"],
      locationLine: "Lead with Tropea as the lifestyle anchor.",
    },
  ],
  locationLifestyleLines: ["Lead the place story through Tropea before drilling into property specifics."],
  transitions: ["Bridge the property segment through daily-life fit."],
  closingCta: "Invite the viewer to follow for the next relocation-focused shortlist.",
  toneAndPacingNotes: ["Keep the delivery premium and clear."],
  scriptWarnings: [],
  scriptProviderStatus: {
    provider: "casahud_script_patterns",
    label: "CasaFlix script patterns",
    state: "fallback",
    configured: true,
    used: true,
    detail: "Using deterministic CasaFlix script composition.",
  },
  fullScriptText:
    "Opening Hook\nWhat does life in Southern Italy actually look like when the homes are real and the budget still matters?",
  nextPhase: {
    key: "media_planning_asset_assembly",
    label: "Media Planning and Asset Assembly",
    detail:
      "Media Planning and Asset Assembly comes next. CasaFlix will organize visuals, map scenes, and asset needs around the approved narrative package.",
    implemented: false,
  },
};

const mediaPlannedCampaign = applyCasaHudMediaPlan(scriptedCampaign, runCasaHudMediaPlanning(scriptedCampaign));

function toSummary(campaign: CasaHudCampaign): CasaHudCampaignSummary {
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

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("CasaFlix opportunity flow", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    delete (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("generates a viral title package and creates a saved campaign in the properties workspace", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.includes("/api/studio/domara/integrations/status")) {
        return new Response(JSON.stringify({ ok: true, providers, saveSupported: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.endsWith("/api/studio/domara/campaigns") && !init?.method) {
        return new Response(JSON.stringify({ ok: true, campaigns: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.endsWith("/api/studio/domara/opportunity") && init?.method === "POST") {
        return new Response(JSON.stringify({ ok: true, output: opportunity }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.endsWith("/api/studio/domara/campaigns") && init?.method === "POST") {
        return new Response(
          JSON.stringify({
            ok: true,
            campaign: savedCampaign,
            summary: toSummary(savedCampaign),
            message: `Campaign saved. "${savedCampaign.name}" is ready for the next step.`,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      throw new Error(`Unhandled fetch: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    await act(async () => {
      root.render(<StudioDomaraClient />);
    });
    await flush();

    await act(async () => {
      container.querySelector('[data-testid="casahud-generate-cta"]')?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    expect(container.querySelector('[data-testid="casahud-viral-titles"]')?.textContent).toContain(opportunity.selectedTitle.title);
    expect(container.querySelector('[data-testid="casahud-viral-titles"]')?.textContent).toContain("Viral Titles");
    expect(container.querySelector('[data-testid="casahud-viral-titles"]')?.textContent).toContain(
      "YouTube not connected — CasaFlix strategy fallback",
    );
    expect(container.querySelectorAll('[data-testid="casahud-candidate-card"]').length).toBe(2);

    await act(async () => {
      container.querySelector('[data-testid="casahud-create-campaign-cta"]')?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    expect(container.querySelector('[data-testid="casahud-current-campaign"]')?.textContent).toContain(savedCampaign.name);
    expect(container.querySelector('[data-testid="casahud-properties"]')?.textContent).toContain("Find Matching Properties");
  });

  it("discovers property candidates and keeps every card image-first with a fallback placeholder when a listing image is missing", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.includes("/api/studio/domara/integrations/status")) {
        return new Response(JSON.stringify({ ok: true, providers, saveSupported: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.endsWith("/api/studio/domara/campaigns")) {
        return new Response(JSON.stringify({ ok: true, campaigns: [toSummary(savedCampaign)] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.endsWith(`/api/studio/domara/campaigns/${savedCampaign.id}`)) {
        return new Response(JSON.stringify({ ok: true, campaign: savedCampaign }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.endsWith(`/api/studio/domara/campaigns/${savedCampaign.id}/discover-listings`) && init?.method === "POST") {
        return new Response(
          JSON.stringify({
            ok: true,
            campaign: discoveredCampaign,
            summary: toSummary(discoveredCampaign),
            message: `Property discovery complete for "${discoveredCampaign.name}".`,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      throw new Error(`Unhandled fetch: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    await act(async () => {
      root.render(<StudioDomaraClient />);
    });
    await flush();

    await act(async () => {
      container.querySelector('[data-testid="casahud-resume-campaign"]')?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    await act(async () => {
      container.querySelector('[data-testid="casahud-discover-listings-cta"]')?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    expect(container.querySelectorAll('[data-testid="casahud-listing-candidate-card"]').length).toBe(2);
    expect(container.querySelectorAll('[data-testid="casahud-property-card-media"]').length).toBeGreaterThanOrEqual(2);
    expect(container.querySelector('[data-testid="casahud-properties"]')?.textContent).toContain("Source thumbnail");
  });

  it("builds the media workspace from script plus media plan and renders scene cards with paired narration and on-screen text", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.includes("/api/studio/domara/integrations/status")) {
        return new Response(JSON.stringify({ ok: true, providers, saveSupported: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.endsWith("/api/studio/domara/campaigns")) {
        return new Response(JSON.stringify({ ok: true, campaigns: [toSummary(scriptedCampaign)] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.endsWith(`/api/studio/domara/campaigns/${scriptedCampaign.id}`)) {
        return new Response(JSON.stringify({ ok: true, campaign: scriptedCampaign }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.endsWith(`/api/studio/domara/campaigns/${scriptedCampaign.id}/media-plan`) && init?.method === "POST") {
        return new Response(
          JSON.stringify({
            ok: true,
            campaign: mediaPlannedCampaign,
            summary: toSummary(mediaPlannedCampaign),
            message: `Media plan updated for "${mediaPlannedCampaign.name}".`,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      throw new Error(`Unhandled fetch: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    await act(async () => {
      root.render(<StudioDomaraClient />);
    });
    await flush();

    await act(async () => {
      container.querySelector('[data-testid="casahud-resume-campaign"]')?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    expect(container.querySelector('[data-testid="casahud-media"]')?.textContent).toContain("Build Media Plan");

    await act(async () => {
      container.querySelector('[data-testid="casahud-build-media-plan-cta"]')?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    expect(container.querySelectorAll('[data-testid="casahud-video-scene-card"]').length).toBeGreaterThan(1);
    expect(container.querySelector('[data-testid="casahud-media"]')?.textContent).toContain("Narration");
    expect(container.querySelector('[data-testid="casahud-media"]')?.textContent).toContain("On-screen Text");
    expect(container.querySelector('[data-testid="casahud-media"]')?.textContent).toContain("Scene 1");
  });

  it("shows a safe recoverable error if campaign creation fails", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.includes("/api/studio/domara/integrations/status")) {
        return new Response(JSON.stringify({ ok: true, providers, saveSupported: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.endsWith("/api/studio/domara/campaigns") && !init?.method) {
        return new Response(JSON.stringify({ ok: true, campaigns: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.endsWith("/api/studio/domara/opportunity") && init?.method === "POST") {
        return new Response(JSON.stringify({ ok: true, output: opportunity }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.endsWith("/api/studio/domara/campaigns") && init?.method === "POST") {
        return new Response(JSON.stringify({ ok: false, error: { message: "Campaign persistence failed." } }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }

      throw new Error(`Unhandled fetch: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    await act(async () => {
      root.render(<StudioDomaraClient />);
    });
    await flush();

    await act(async () => {
      container.querySelector('[data-testid="casahud-generate-cta"]')?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    await act(async () => {
      container.querySelector('[data-testid="casahud-create-campaign-cta"]')?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    expect(container.textContent).toContain("Campaign persistence failed.");
  });
});

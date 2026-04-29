// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import StudioDomaraClient from "@/app/apps/studio/studio-domara-client";
import type { CasaHudCampaign, CasaHudCampaignSummary } from "@/lib/studio/domara/campaigns";
import type { DomaraIntegrationProviderStatus } from "@/lib/studio/domara/integrations";

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

const connectedProviders: DomaraIntegrationProviderStatus[] = [
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
    providerId: "elevenlabs",
    displayName: "ElevenLabs",
    category: "voice",
    requiredEnvVars: [],
    configured: false,
    validationStatus: "missing",
    safeSetupHelp: "Connect ElevenLabs.",
    capabilitiesEnabled: ["voice"],
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
    providerId: "immobiliare",
    displayName: "Immobiliare",
    category: "listing_ingestion",
    requiredEnvVars: [],
    configured: false,
    validationStatus: "missing",
    safeSetupHelp: "Connect Immobiliare.",
    capabilitiesEnabled: ["listings"],
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
    providerId: "digitalocean_spaces",
    displayName: "DigitalOcean Spaces",
    category: "media_storage",
    requiredEnvVars: [],
    configured: false,
    validationStatus: "missing",
    safeSetupHelp: "Connect Spaces.",
    capabilitiesEnabled: ["media"],
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

const activeCampaign: CasaHudCampaign = {
  id: "campaign-scripted",
  name: "Could You Retire in Southern Italy for Under $300K?",
  selectedViralTitle: "Could You Retire in Southern Italy for Under $300K?",
  selectedTitle: {
    title: "Could You Retire in Southern Italy for Under $300K?",
    score: 92,
    campaignType: "lifestyle_relocation",
    confidence: 0.88,
    reasoning: "Strong relocation intent plus believable support.",
    regionHint: "Southern Italy",
    listingSearchHints: ["Southern Italy homes under 300k"],
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
      listingSearchHints: ["Southern Italy homes under 300k"],
      reasoning: "Strong relocation intent plus believable support.",
    },
  ],
  researchBrief: {
    summary: "CasaHUD identified the strongest relocation opportunity in Southern Italy.",
    opportunityCategories: ["relocation"],
    competitorPatterns: ["Budget-led relocation titles perform well."],
    audienceIntent: ["retire in Italy"],
    suggestedTitleDirections: ["price-led relocation"],
    riskNotes: ["Avoid unsupported lifestyle claims."],
  },
  campaignType: "lifestyle_relocation",
  marketRegionHint: "Southern Italy",
  preferredMarket: "Italian real-estate YouTube",
  generationSource: {
    mode: "casahud_patterns",
    label: "CasaHUD opportunity patterns",
    detail: "Using CasaHUD opportunity patterns.",
    canImproveWithYouTube: true,
  },
  confidenceReasoning: {
    summary: "CasaHUD picked the most supportable title direction.",
    titleOpportunitySummary: "The title stays specific enough to be validated against the shortlist.",
    selectedTitleReasoning: "It balances click appeal with believable support.",
    selectedTitleConfidence: 0.88,
  },
  status: "script_narrative_completed",
  listingCandidates: [
    {
      id: "listing-1",
      provider: "idealista",
      providerListingId: "idealista-1",
      sourceUrl: "https://example.com/listing-1",
      title: "Tropea apartment with sea views",
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
      descriptionSnippet: "Move-in ready apartment with sea views.",
      features: ["move-in ready", "sea views"],
      imageUrls: ["https://images.example.com/1.jpg"],
      imageCount: 1,
      photoAvailability: "limited",
      coordinates: { latitude: 38.675, longitude: 15.895 },
      discoveredAt: "2026-04-29T00:00:00.000Z",
      preliminaryMatchNotes: "Fits the title promise and budget.",
    },
  ],
  listingSearchCriteria: {
    operation: "sale",
    campaignType: "lifestyle_relocation",
    titlePromise: "Could You Retire in Southern Italy for Under $300K?",
    regionHint: "Southern Italy",
    country: "Italy",
    cities: ["Tropea"],
    propertyTypes: ["apartment"],
    featureTags: ["move-in ready"],
    lifestyleTags: ["retirement"],
    searchTerms: ["Southern Italy homes under 300k"],
    pricePositioning: "affordable",
    targetListingCount: 4,
    singlePropertyFocus: false,
    maxPrice: 300000,
    currency: "USD",
  },
  listingProviderStatuses: [
    {
      provider: "idealista",
      label: "Idealista",
      state: "connected",
      configured: true,
      used: true,
      candidateCount: 1,
      detail: "Idealista returned shortlisted properties.",
    },
  ],
  discoverySummary: {
    headline: 'Prepared 1 candidate property for "Could You Retire in Southern Italy for Under $300K?".',
    criteriaSummary: "Searching Southern Italy up to USD 300,000.",
    providerSummary: "Using Idealista for source-backed discovery.",
    candidateCount: 1,
    liveCandidateCount: 1,
    fallbackCandidateCount: 0,
    fallbackUsed: false,
    warnings: [],
    discoveredAt: "2026-04-29T00:00:00.000Z",
  },
  listingDiscoveryStatus: "listing_candidates_discovered",
  approvedListings: [
    {
      id: "listing-1",
      provider: "idealista",
      providerListingId: "idealista-1",
      sourceUrl: "https://example.com/listing-1",
      title: "Tropea apartment with sea views",
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
      descriptionSnippet: "Move-in ready apartment with sea views.",
      features: ["move-in ready", "sea views"],
      imageUrls: ["https://images.example.com/1.jpg"],
      imageCount: 1,
      photoAvailability: "limited",
      coordinates: { latitude: 38.675, longitude: 15.895 },
      discoveredAt: "2026-04-29T00:00:00.000Z",
      preliminaryMatchNotes: "Fits the title promise and budget.",
      validationStatus: "approved",
      overallScore: 88,
      scoreBreakdown: {
        titleMatchScore: 92,
        geographyScore: 100,
        priceFitScore: 100,
        propertyTypeScore: 100,
        featureClaimScore: 78,
        mediaAvailabilityScore: 52,
        listingCompletenessScore: 80,
        providerQualityScore: 84,
        uniquenessScore: 100,
        overallScore: 88,
      },
      validationReasons: ["Location aligns with the campaign region."],
      warnings: [],
      rank: 1,
    },
  ],
  rejectedListings: [],
  listingRankOrder: ["listing-1"],
  listingValidationStatus: "listing_candidates_validated",
  listingValidationSummary: {
    headline: "Approved 1 of 1 discovered listing for the title promise.",
    rankingExplanation: "CasaHUD kept the title support tight and reviewable.",
    discoveredCount: 1,
    approvedCount: 1,
    rejectedCount: 0,
    needsAttentionCount: 0,
    titleSupportConfidence: 86,
    warnings: [],
    completedAt: "2026-04-29T00:00:00.000Z",
  },
  titleSupportConfidence: 86,
  validationWarnings: [],
  locationIntelligenceStatus: "location_intelligence_completed",
  locationIntelligenceSummary: {
    headline: "Location story prepared across 1 shortlist anchor.",
    providerSummary: "Google Places and Mapbox coverage are available.",
    coverageSummary: "Tropea anchors the relocation story with coastal lifestyle proof points.",
    warningCount: 0,
    generatedAt: "2026-04-29T00:00:00.000Z",
    fallbackUsed: false,
  },
  locationStory: {
    headline: "Tropea turns the shortlist into a place-led story.",
    summary: "CasaHUD frames the property through coastal day-to-day life instead of generic travel filler.",
    narrativeAngles: ["Lead with place before the property."],
    lifestyleAnchors: ["Waterside lifestyle context", "Travel-friendly arrival story"],
    regionHighlights: ["Tropea", "Calabria"],
  },
  localHighlights: [
    {
      id: "highlight-1",
      title: "Regional anchor",
      description: "Tropea gives the campaign a specific place identity.",
      locationText: "Tropea, Calabria, Italy",
      associatedListingId: "listing-1",
      provider: "google_places",
      sourceConfidence: "high",
    },
  ],
  poiBundle: {
    summary: "3 location proof points prepared for the approved shortlist.",
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
    generatedAt: "2026-04-29T00:00:00.000Z",
  },
  mapSceneIdeas: [
    {
      id: "scene-1",
      title: "Open on Tropea",
      sceneType: "regional_anchor",
      description: "Establish Tropea before the property details arrive.",
      locationText: "Tropea, Calabria, Italy",
      suggestedVisual: "Wide regional map pull-back with the property highlighted.",
      provider: "mapbox",
      confidence: "high",
    },
  ],
  listingLocationInsights: [
    {
      listingId: "listing-1",
      summary: "Tropea apartment with sea views plays best as a waterside lifestyle story.",
      highlights: ["Coastal day-to-day context"],
      nearbyPois: [],
      locationStrengths: ["Waterside lifestyle context"],
      warnings: [],
    },
  ],
  locationProviderStatuses: [
    {
      provider: "google_places",
      label: "Google Places",
      state: "connected",
      configured: true,
      used: true,
      detail: "Live local highlights are available.",
      coverage: "POIs ready",
    },
    {
      provider: "mapbox",
      label: "Mapbox",
      state: "connected",
      configured: true,
      used: true,
      detail: "Map anchoring is available.",
      coverage: "Maps ready",
    },
  ],
  locationWarnings: [],
  scriptGenerationStatus: "script_generated",
  scriptSummary: "A relocation-oriented narrative that uses the validated shortlist and place story.",
  openingHook:
    "What does life in Southern Italy actually look like when the homes are real and the budget still matters?",
  estimatedDurationSeconds: 104,
  tone: "Premium, clear, cinematic where appropriate.",
  scriptSegments: [
    {
      id: "segment-hook",
      title: "Opening Hook",
      segmentType: "hook",
      narration:
        "What does life in Southern Italy actually look like when the homes are real and the budget still matters?",
      durationSeconds: 14,
      visualNote: "Open on the region before the listing.",
    },
  ],
  propertySegments: [
    {
      listingId: "listing-1",
      title: "Tropea apartment with sea views",
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
  scriptWarnings: ["Keep the hook specific to the approved listing support."],
  scriptProviderStatus: {
    provider: "casahud_script_patterns",
    label: "CasaHUD script patterns",
    state: "fallback",
    configured: true,
    used: true,
    detail: "Using deterministic CasaHUD script composition.",
  },
  fullScriptText:
    "Opening Hook\nWhat does life in Southern Italy actually look like when the homes are real and the budget still matters?",
  nextPhase: {
    key: "media_planning_asset_assembly",
    label: "Media Planning and Asset Assembly",
    detail:
      "Media Planning and Asset Assembly comes next. CasaHUD will organize visuals, map scenes, and asset needs around the approved narrative package.",
    implemented: false,
  },
  createdAt: "2026-04-29T00:00:00.000Z",
  updatedAt: "2026-04-29T00:10:00.000Z",
  generatedAt: "2026-04-29T00:00:00.000Z",
  futureState: {
    listingCandidates: [],
    approvedListings: [],
    rejectedListings: [],
    listingRankOrder: ["listing-1"],
    locationIntelligence: {
      status: "location_intelligence_completed",
      storyHeadline: "Tropea turns the shortlist into a place-led story.",
      generatedAt: "2026-04-29T00:00:00.000Z",
    },
    mapPoiBundle: {
      summary: "3 location proof points prepared for the approved shortlist.",
      cards: [],
      categories: ["Beach"],
      generatedAt: "2026-04-29T00:00:00.000Z",
    },
    script: {
      status: "script_generated",
      summary: "A relocation-oriented narrative that uses the validated shortlist and place story.",
      generatedAt: "2026-04-29T00:10:00.000Z",
    },
    storyboard: null,
    mediaPlan: null,
    packaging: null,
    renderStatus: null,
    reviewStatus: null,
    publishStatus: null,
    scheduleStatus: null,
  },
};

const activeCampaignSummary: CasaHudCampaignSummary = {
  id: activeCampaign.id,
  name: activeCampaign.name,
  campaignType: activeCampaign.campaignType,
  marketRegionHint: activeCampaign.marketRegionHint,
  status: activeCampaign.status,
  createdAt: activeCampaign.createdAt,
  updatedAt: activeCampaign.updatedAt,
  researchSummary: activeCampaign.researchBrief.summary,
  listingCandidateCount: activeCampaign.listingCandidates.length,
  listingDiscoveryStatus: activeCampaign.listingDiscoveryStatus,
  approvedListingCount: activeCampaign.approvedListings.length,
  listingValidationStatus: activeCampaign.listingValidationStatus,
  titleSupportConfidence: activeCampaign.titleSupportConfidence ?? undefined,
  locationIntelligenceStatus: activeCampaign.locationIntelligenceStatus,
  scriptGenerationStatus: activeCampaign.scriptGenerationStatus,
  discoverySummary: activeCampaign.discoverySummary?.headline,
  validationSummary: activeCampaign.listingValidationSummary?.headline,
  locationSummary: activeCampaign.locationIntelligenceSummary?.headline,
  scriptSummary: activeCampaign.scriptSummary ?? undefined,
};

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("CasaHUD premium command center UI", () => {
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

  it("renders the premium shell with sidebar navigation and no old mock-first copy", () => {
    const html = renderToStaticMarkup(<StudioDomaraClient />);

    expect(html).toContain(">Generate Viral Video Title<");
    expect(html).toContain(">Campaigns<");
    expect(html).toContain(">Viral Titles<");
    expect(html).toContain(">Review Package<");
    expect(html).toContain(">Publishing<");
    expect(html).toContain(">Connections<");
    expect(html).toContain("casahud-workspace-shell");
    expect(html).toContain('data-testid="casahud-nav-campaigns" aria-current="page"');
    expect(html).toContain(">Campaigns</h2>");
    expect(html).not.toContain("Generate your next viral property video");
    expect(html).not.toContain(">DB<");
    expect(html).not.toContain(">VT<");
    expect(html).not.toContain(">PS<");
    expect(html).not.toContain(">LI<");
    expect(html).not.toContain("casahud-entry-hero");
    expect(html).not.toContain("Generate Mock Viral Titles");
    expect(html).not.toContain("Mock-first MVP");
  });

  it("shows the command header, review package, publishing panel, connections panel, and property shortlist for an active campaign", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("/api/studio/domara/integrations/status")) {
        return new Response(JSON.stringify({ ok: true, providers: connectedProviders, saveSupported: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.endsWith("/api/studio/domara/campaigns")) {
        return new Response(JSON.stringify({ ok: true, campaigns: [activeCampaignSummary] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.endsWith(`/api/studio/domara/campaigns/${activeCampaign.id}`)) {
        return new Response(JSON.stringify({ ok: true, campaign: activeCampaign }), {
          status: 200,
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

    const resumeButton = container.querySelector('[data-testid="casahud-resume-campaign"]');
    expect(resumeButton?.textContent).toContain("Resume");

    await act(async () => {
      resumeButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    expect(container.querySelector('[data-testid="casahud-command-header"]')?.textContent).toContain(activeCampaign.name);
    expect(container.querySelector('[data-testid="casahud-campaign-intelligence"]')?.textContent).toContain("Agent Activity");

    const reviewNav = container.querySelector('[data-testid="casahud-nav-review_package"]');
    await act(async () => {
      reviewNav?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    expect(container.querySelector('[data-testid="casahud-review-package"]')?.textContent).toContain(activeCampaign.selectedViralTitle);
    expect(container.querySelector('[data-testid="casahud-review-package"]')?.textContent).toContain("Tropea apartment with sea views");
    expect(container.querySelector('[data-testid="casahud-review-package"]')?.textContent).toContain("YouTube Package");
    expect(container.querySelector('[data-testid="casahud-review-package"]')?.textContent).toContain("Publish / Schedule");

    const publishingNav = container.querySelector('[data-testid="casahud-nav-publishing"]');
    await act(async () => {
      publishingNav?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    expect(container.querySelector('[data-testid="casahud-publishing-panel"]')?.textContent).toContain("Publish Now");
    expect(container.querySelector('[data-testid="casahud-publishing-panel"]')?.textContent).toContain("Schedule");
    expect(container.querySelector('[data-testid="casahud-publishing-panel"]')?.textContent).toContain("No publish job has been run.");
    expect(container.querySelector('[data-testid="casahud-publishing-panel"]')?.textContent).not.toContain("Published successfully");

    const connectionsNav = container.querySelector('[data-testid="casahud-nav-connections"]');
    await act(async () => {
      connectionsNav?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    expect(container.querySelector('[data-testid="casahud-workspace-shell"]')?.textContent).toContain("Connections");
    expect(container.querySelector('[data-testid="casahud-connections-panel"]')?.textContent).toContain("OpenAI");
    expect(container.querySelector('[data-testid="casahud-connections-panel"]')?.textContent).toContain("Listing Sources");
    expect(container.querySelector('[data-testid="casahud-connections-panel"]')?.textContent).toContain("YouTube Channel");
    expect(container.querySelector('[data-testid="casahud-connections-panel"]')?.textContent).not.toContain("OPENAI_API_KEY");
    expect(container.querySelector('[data-testid="casahud-connections-panel"]')?.textContent).not.toContain("Manage Connections");

    const shortlistNav = container.querySelector('[data-testid="casahud-nav-property_shortlist"]');
    await act(async () => {
      shortlistNav?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    expect(container.querySelector('[data-testid="casahud-property-shortlist"]')?.textContent).toContain("Tropea apartment with sea views");
    expect(container.querySelector('[data-testid="casahud-shortlist-toolbar"]')?.textContent).toContain("Sort: Match");
    const sourceLink = container.querySelector('[data-testid="casahud-property-shortlist"] a[href="https://example.com/listing-1"]');
    expect(sourceLink).not.toBeNull();
    expect(sourceLink?.getAttribute("target")).toBe("_blank");
  });
});

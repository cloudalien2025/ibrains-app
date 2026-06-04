import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CasaHudCampaign } from "@/lib/studio/domara/campaigns";
import { createEmptyCasaHudMediaPlanData } from "@/lib/studio/domara/campaign-media-planning";
import { createEmptyCasaHudYouTubePackageData } from "@/lib/studio/domara/campaign-youtube-package";
import { reviewCasaHudViewerScript } from "@/lib/studio/domara/agents/review-agent";
import { buildCasaHudFallbackScript, SCRIPT_QUALITY_REGEN_WARNING } from "@/lib/studio/domara/agents/script-agent";
import { runCasaHudScriptNarrative } from "@/lib/studio/domara/script-narrative-engine";

function buildLocationReadyCampaign(
  campaignType: CasaHudCampaign["campaignType"] = "lifestyle_relocation",
): CasaHudCampaign {
  return {
    id: `casahud-project-phase7-${campaignType}`,
    name: "Could You Retire in Southern Italy for Under $300K?",
    selectedViralTitle: "Could You Retire in Southern Italy for Under $300K?",
    selectedTitle: {
      title: "Could You Retire in Southern Italy for Under $300K?",
      score: 92,
      campaignType,
      confidence: 0.89,
      reasoning: "Balanced click potential with a believable promise.",
      regionHint: "Southern Italy",
      listingSearchHints: ["Southern Italy homes under 300k", "relocation-friendly towns"],
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
        campaignType,
        regionHint: "Southern Italy",
        listingSearchHints: ["Southern Italy homes under 300k", "relocation-friendly towns"],
        reasoning: "Strong relocation intent plus a concrete budget makes this highly clickable and supportable.",
      },
    ],
    researchBrief: {
      summary: "CasaFlix identified the strongest opportunity in regional affordability plus relocation intent.",
      opportunityCategories: ["affordable coastal roundups", "retirement relocation"],
      competitorPatterns: ["Top videos frequently anchor the title with a price ceiling."],
      audienceIntent: ["buyable Italy homes", "retire in Italy"],
      suggestedTitleDirections: ["Southern Italy affordability roundups"],
      riskNotes: ["Very cheap Italy claims can become hard to prove with current listings."],
    },
    campaignType,
    marketRegionHint: "Southern Italy",
    preferredMarket: "Italian real-estate YouTube",
    generationSource: {
      mode: "casahud_patterns",
      label: "CasaFlix opportunity patterns",
      detail: "Using CasaFlix opportunity patterns until YouTube connection is enabled for live competitive research.",
      canImproveWithYouTube: true,
    },
    confidenceReasoning: {
      summary: "89% confidence.",
      titleOpportunitySummary:
        "The title gives CasaFlix a clear, searchable concept that can still hold up when listing discovery begins.",
      selectedTitleReasoning: "The price ceiling and geography are strong but still believable.",
      selectedTitleConfidence: 0.89,
    },
    status: "location_intelligence_completed",
    listingCandidates: [],
    listingSearchCriteria: null,
    listingProviderStatuses: [],
    discoverySummary: null,
    listingDiscoveryStatus: "listing_candidates_discovered",
    approvedListings: [
      {
        id: "listing-1",
        provider: "casahud_sample",
        providerListingId: "sample-1",
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
        descriptionSnippet: "Move-in ready apartment with sea views and strong retirement appeal.",
        features: ["budget-conscious", "move-in ready", "coastal lifestyle"],
        imageUrls: ["https://images.example.com/1.jpg"],
        imageCount: 1,
        photoAvailability: "available",
        coordinates: {
          latitude: 38.6762,
          longitude: 15.8988,
        },
        discoveredAt: "2026-04-28T00:20:00.000Z",
        preliminaryMatchNotes: "Fits the title promise and budget.",
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
        duplicateGroupKey: "listing-1",
      },
      {
        id: "listing-2",
        provider: "casahud_sample",
        providerListingId: "sample-2",
        sourceUrl: "https://example.com/listing-2",
        title: "Lecce townhouse near the historic center",
        locationText: "Lecce, Puglia, Italy",
        country: "Italy",
        region: "Puglia",
        city: "Lecce",
        price: 298000,
        currency: "USD",
        propertyType: "townhouse",
        bedrooms: 3,
        bathrooms: 2,
        sizeSqm: 104,
        descriptionSnippet: "Compact townhouse that keeps the shortlist broad without breaking the budget ceiling.",
        features: ["historic center context", "move-in ready"],
        imageUrls: ["https://images.example.com/2.jpg"],
        imageCount: 1,
        photoAvailability: "limited",
        discoveredAt: "2026-04-28T00:21:00.000Z",
        preliminaryMatchNotes: "Adds variety to the shortlist while staying inside the budget claim.",
        validationStatus: "approved",
        overallScore: 81,
        scoreBreakdown: {
          titleMatchScore: 84,
          geographyScore: 92,
          priceFitScore: 100,
          propertyTypeScore: 86,
          featureClaimScore: 68,
          mediaAvailabilityScore: 44,
          listingCompletenessScore: 72,
          providerQualityScore: 64,
          uniquenessScore: 88,
          overallScore: 81,
        },
        validationReasons: ["Broadens the shortlist while staying on-brief."],
        warnings: ["Photo coverage is thinner on this listing."],
        rank: 2,
        duplicateGroupKey: "listing-2",
      },
    ],
    rejectedListings: [],
    listingRankOrder: ["listing-1", "listing-2"],
    listingValidationStatus: "listing_candidates_validated",
    listingValidationSummary: {
      headline: "Approved 2 of 2 discovered listings for the title promise.",
      rankingExplanation:
        "CasaFlix ranked the shortlist by title truthfulness, geography fit, price support, feature alignment, media coverage, and duplicate reduction.",
      discoveredCount: 2,
      approvedCount: 2,
      rejectedCount: 0,
      needsAttentionCount: 0,
      titleSupportConfidence: 74,
      warnings: [],
      completedAt: "2026-04-28T00:25:00.000Z",
    },
    titleSupportConfidence: 74,
    validationWarnings: [],
    locationIntelligenceStatus: "location_intelligence_completed",
    locationIntelligenceSummary: {
      headline: "Location story prepared across 2 shortlist anchors.",
      providerSummary: "Using CasaFlix location patterns until Google Places or Mapbox has full live coverage.",
      coverageSummary: "CasaFlix connected the shortlist to local proof points, regional lifestyle context, and map scene ideas.",
      warningCount: 1,
      generatedAt: "2026-04-29T00:00:00.000Z",
      fallbackUsed: true,
    },
    locationStory: {
      headline: "Southern Italy turns the shortlist into a place-led story.",
      summary: "CasaFlix positioned the approved properties around coastal and historic-center context so the campaign reads as property plus place.",
      narrativeAngles: [
        "Open with the region before dropping into the strongest listing.",
        "Use local proof points as support for the property promise instead of generic travel filler.",
      ],
      lifestyleAnchors: ["Waterside lifestyle context", "Travel-friendly arrival story"],
      regionHighlights: ["Tropea", "Calabria", "Lecce"],
      fallbackNotice: "Using CasaFlix location patterns where live provider coverage was limited.",
    },
    localHighlights: [
      {
        id: "highlight-1",
        title: "Regional anchor",
        description: "Tropea gives the campaign a specific place identity instead of a generic property roundup.",
        locationText: "Tropea, Calabria, Italy",
        associatedListingId: "listing-1",
        provider: "casahud_location_patterns",
        sourceConfidence: "fallback",
      },
    ],
    poiBundle: {
      summary: "Location proof points prepared for the approved shortlist.",
      cards: [
        {
          id: "poi-1",
          name: "Coastal access context",
          category: "Beach",
          locationText: "Tropea, Calabria, Italy",
          associatedListingId: "listing-1",
          relevanceReason: "Helps the shortlist read as a day-to-day coastal lifestyle story instead of a price-only claim.",
          provider: "casahud_location_patterns",
          sourceConfidence: "fallback",
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
        description: "Start with the region around Tropea to establish the place before the property details arrive.",
        locationText: "Tropea, Calabria, Italy",
        suggestedVisual: "Wide regional map pull-back with the strongest listing location highlighted first.",
        provider: "casahud_location_patterns",
        confidence: "fallback",
      },
    ],
    listingLocationInsights: [
      {
        listingId: "listing-1",
        summary: "Tropea apartment with sea views plays best as a waterside lifestyle story around Tropea, Calabria, Italy.",
        highlights: ["Coastal day-to-day context helps the property feel like a lifestyle move, not just a budget win."],
        nearbyPois: [],
        locationStrengths: ["Waterside lifestyle context"],
        warnings: ["Using CasaFlix location patterns until Google Places is connected."],
      },
      {
        listingId: "listing-2",
        summary: "Lecce adds a second beat built around compact historic-center texture and daily walkability.",
        highlights: ["The historic-center angle broadens the shortlist without changing the title promise."],
        nearbyPois: [],
        locationStrengths: ["Historic core context"],
        warnings: [],
      },
    ],
    locationProviderStatuses: [
      {
        provider: "google_places",
        label: "Google Places",
        state: "missing_credentials",
        configured: false,
        used: false,
        detail: "Using CasaFlix location patterns until Google Places is connected for live POIs.",
        warning: "Connect Google Places for live points of interest and local highlights.",
        coverage: "No live POIs",
      },
      {
        provider: "mapbox",
        label: "Mapbox",
        state: "missing_credentials",
        configured: false,
        used: false,
        detail: "Using listing coordinates and CasaFlix location patterns until Mapbox is connected for live map anchoring.",
        warning: "Connect Mapbox for live geocoding and richer map scene anchoring.",
        coverage: "No live map anchoring",
      },
      {
        provider: "casahud_location_patterns",
        label: "CasaFlix location patterns",
        state: "fallback",
        configured: true,
        used: true,
        detail: "Using CasaFlix location patterns until Google Places or Mapbox has full live coverage.",
        warning: "Connect location providers for live POIs and richer map context.",
        coverage: "2 fallback context sets",
      },
    ],
    locationWarnings: ["Using CasaFlix location patterns until Google Places is connected."],
    scriptGenerationStatus: "not_started",
    scriptSummary: null,
    openingHook: null,
    estimatedDurationSeconds: null,
    tone: null,
    scriptSegments: [],
    propertySegments: [],
    locationLifestyleLines: [],
    transitions: [],
    closingCta: null,
    toneAndPacingNotes: [],
    scriptWarnings: [],
    scriptProviderStatus: null,
    fullScriptText: null,
    ...createEmptyCasaHudMediaPlanData(),
    ...createEmptyCasaHudYouTubePackageData(),
    nextPhase: {
      key: "script_narrative_generation",
      label: "Script and Narrative Generation",
      detail:
        "Script and Narrative Generation comes next. CasaFlix will turn the validated property story and location intelligence into the video narrative package.",
      implemented: false,
    },
    createdAt: "2026-04-28T00:10:00.000Z",
    updatedAt: "2026-04-29T00:00:00.000Z",
    generatedAt: "2026-04-28T00:00:00.000Z",
    futureState: {
      listingCandidates: [],
      approvedListings: [],
      rejectedListings: [],
      listingRankOrder: ["listing-1", "listing-2"],
      locationIntelligence: {
        status: "location_intelligence_completed",
        storyHeadline: "Southern Italy turns the shortlist into a place-led story.",
        generatedAt: "2026-04-29T00:00:00.000Z",
      },
      mapPoiBundle: {
        summary: "Location proof points prepared for the approved shortlist.",
        cards: [],
        categories: ["Beach"],
        generatedAt: "2026-04-29T00:00:00.000Z",
      },
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
}

describe("CasaFlix script narrative engine", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-29T00:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns deterministic fallback script output when no live provider is configured", async () => {
    const campaign = buildLocationReadyCampaign();

    const first = await runCasaHudScriptNarrative(campaign, {});
    const second = await runCasaHudScriptNarrative(campaign, {});

    expect(first.scriptGenerationStatus).toBe("script_generated");
    expect(first.scriptProviderStatus?.provider).toBe("casahud_script_patterns");
    expect(first.openingHook).toBe(second.openingHook);
    expect(first.scriptSummary).toBe(second.scriptSummary);
    expect(first.scriptSegments.map((segment) => segment.title)).toEqual(second.scriptSegments.map((segment) => segment.title));
    expect(first.propertySegments[0]?.title).toBe("Tropea apartment with sea views");
    expect(first.locationLifestyleLines.join(" ")).toContain("Tropea");
    expect(first.fullScriptText).not.toContain("title promise");
    expect(first.fullScriptText).not.toContain("validation phase");
    expect(first.fullScriptText).not.toContain("candidate listing pattern");
    expect(first.fullScriptText).not.toContain("location signal");
    expect(first.fullScriptText).not.toContain("If this title is going to resonate");
    expect(first.fullScriptText).not.toContain("Keep the narrative anchored");
    expect(first.fullScriptText).not.toContain("provider metadata");
    expect(first.fullScriptText).not.toContain("deterministic fallback");
    expect(first.fullScriptText).not.toContain("Video Premise");
  });

  it("times out slow live providers and falls back without hanging the run", async () => {
    const campaign = buildLocationReadyCampaign();
    const neverResolvingFetch = vi.fn(() => new Promise<Response>(() => undefined));

    const resultPromise = runCasaHudScriptNarrative(campaign, {
      openAiApiKey: "openai-test-key",
      fetchImpl: neverResolvingFetch as typeof fetch,
      providerTimeoutMs: 5,
    });

    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(result.scriptProviderStatus?.provider).toBe("casahud_script_patterns");
    expect(result.scriptSegments.length).toBeGreaterThan(0);
  });

  it("changes the structure based on campaign type", async () => {
    const roundup = await runCasaHudScriptNarrative(buildLocationReadyCampaign("roundup"));
    const single = await runCasaHudScriptNarrative(buildLocationReadyCampaign("single_property_showcase"));
    const locationLed = await runCasaHudScriptNarrative(buildLocationReadyCampaign("location_led"));

    expect(roundup.scriptSummary).toContain("roundup");
    expect(roundup.propertySegments).toHaveLength(2);
    expect(single.scriptSummary).toContain("showcase");
    expect(single.propertySegments).toHaveLength(1);
    expect(locationLed.scriptSummary).toContain("place-first");
    expect(locationLed.scriptSegments[2]?.title).toBe("Location Story");
  });

  it("does not invent unsupported facts when listing data is thin", async () => {
    const campaign = buildLocationReadyCampaign();
    campaign.approvedListings[0] = {
      ...campaign.approvedListings[0]!,
      bedrooms: undefined,
      bathrooms: undefined,
      sizeSqm: undefined,
      descriptionSnippet: undefined,
      features: [],
    };

    const result = await runCasaHudScriptNarrative(campaign);
    const propertySegment = result.propertySegments[0]!;

    expect(propertySegment.narration).not.toContain("bedrooms");
    expect(propertySegment.narration).not.toContain("bathrooms");
    expect(propertySegment.narration).not.toContain("sqm");
    expect(propertySegment.narration).not.toContain("airport");
  });

  it("keeps imported listing narration viewer-ready and free of developer phrases", async () => {
    const campaign = buildLocationReadyCampaign();
    campaign.approvedListings[0] = {
      ...campaign.approvedListings[0]!,
      provider: "immobiliare",
      sourceType: "imported_url",
      title: "Altavilla Silentina Country House with Olive Grove",
      locationText: "Altavilla Silentina, Campania, Italy",
      price: 198000,
      currency: "EUR",
      propertyType: "Country house",
      bedrooms: 4,
      bathrooms: 2,
      sizeSqm: 300,
      descriptionSnippet:
        "A country house in Altavilla Silentina with four bedrooms, two bathrooms, 300 m² of interior space, more than 12,000 m² of land, and an olive grove, priced at €198,000.",
      preliminaryMatchNotes:
        "A country house in Altavilla Silentina with four bedrooms, two bathrooms, 300 m² of interior space, more than 12,000 m² of land, and an olive grove, priced at €198,000.",
      features: ["12,900 m² land", "olive grove", "Cilento countryside"],
    };

    const result = await runCasaHudScriptNarrative(campaign);
    const narration = result.propertySegments[0]?.narration || "";

    expect(narration).toContain("Country house");
    expect(narration).toContain("EUR 198,000");
    expect(narration).toContain("olive grove");
    expect(narration).not.toContain("Imported URL");
    expect(narration).not.toContain("candidate listing pattern");
    expect(narration).not.toContain("location signal");
  });

  it("exposes the script-agent module and uses review-agent quality guardrails", () => {
    const campaign = buildLocationReadyCampaign("lifestyle_relocation");
    const fallback = buildCasaHudFallbackScript(campaign, { generatedAt: "2026-04-29T00:00:00.000Z" });

    expect(fallback.scriptProviderStatus?.detail.toLowerCase()).toContain("script agent");

    const reviewed = reviewCasaHudViewerScript({
      ...fallback,
      fullScriptText: "Sale villa MessinaHouses for sale Messina Real estate agencies.",
    });
    expect(reviewed.passed).toBe(false);
    expect(reviewed.warning).toBe(SCRIPT_QUALITY_REGEN_WARNING);
  });

  it("keeps one-listing Messina narration clean, viewer-facing, and free of provider SEO junk", async () => {
    const campaign = buildLocationReadyCampaign("lifestyle_relocation");
    campaign.approvedListings = [
      {
        ...campaign.approvedListings[0]!,
        id: "listing-messina-1",
        provider: "immobiliare",
        sourceType: "browser_assisted_import",
        title: "Contrada Lacagnina Messina Single family villa with Terrace",
        locationText: "Acqualadrone - Sparta, Messina, Sicily, Italy",
        city: "Messina",
        region: "Sicily",
        country: "Italy",
        price: 300000,
        currency: "EUR",
        propertyType: "Single family villa",
        rooms: 5,
        bathrooms: 2,
        sizeSqm: 187,
        features: ["Car parking", "Sea access"],
        descriptionSnippet:
          "Exclusive Seaside Retreat in Acqualadrone – Direct Access to the Sea. Sale villa MessinaHouses for sale MessinaHouses for sale Acqualadrone - Sparta Real estate agencies.",
        validationStatus: "approved",
        overallScore: 69,
        scoreBreakdown: {
          titleMatchScore: 71,
          geographyScore: 88,
          priceFitScore: 86,
          propertyTypeScore: 78,
          featureClaimScore: 72,
          mediaAvailabilityScore: 64,
          listingCompletenessScore: 79,
          providerQualityScore: 70,
          uniquenessScore: 90,
          overallScore: 69,
        },
        warnings: [],
      },
    ];
    campaign.listingRankOrder = ["listing-messina-1"];
    campaign.locationStory = {
      headline: "Messina turns the shortlist into a place-led story.",
      summary: "CasaFlix positioned the current home around Messina and Sicily coastal context.",
      narrativeAngles: ["Open in Messina, then evaluate the home as a relocation fit."],
      lifestyleAnchors: ["Coastal daily routine", "Access to Messina services"],
      regionHighlights: ["Messina", "Sicily"],
    };
    campaign.localHighlights = [
      {
        id: "messina-highlight-1",
        title: "Messina coastal context",
        description: "This shoreline context near Messina is the real lifestyle anchor for the episode.",
        locationText: "Messina, Sicily, Italy",
        associatedListingId: "listing-messina-1",
        provider: "casahud_location_patterns",
        sourceConfidence: "fallback",
      },
    ];
    campaign.listingLocationInsights = [
      {
        listingId: "listing-messina-1",
        summary: "This listing sits in the Messina area and should be framed as a one-property relocation test case.",
        highlights: ["Use practical relocation framing over generic marketplace language."],
        nearbyPois: [],
        locationStrengths: ["Messina/Sicily context"],
        warnings: [],
      },
    ];

    const result = await runCasaHudScriptNarrative(campaign);
    const narration = result.fullScriptText || "";

    expect(narration).toContain("Messina");
    expect(narration).not.toContain("Tropea");
    expect(narration).not.toContain("script-ready listings");
    expect(narration).not.toContain("approved listings");
    expect(narration).not.toContain("with EUR 300,000, Single family villa");
    expect(narration).not.toContain("Sale villa");
    expect(narration).not.toContain("Houses for sale");
    expect(narration).not.toContain("Real estate agencies");
    expect(narration).not.toContain("deterministic fallback");
    expect(narration).not.toContain("provider metadata");
    expect(narration).not.toContain("video premise");
  });
});

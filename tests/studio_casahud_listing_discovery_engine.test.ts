import { describe, expect, it } from "vitest";
import type { CasaHudCampaign } from "@/lib/studio/domara/campaigns";
import { createEmptyCasaHudMediaPlanData } from "@/lib/studio/domara/campaign-media-planning";
import { createEmptyCasaHudYouTubePackageData } from "@/lib/studio/domara/campaign-youtube-package";
import {
  deriveCasaHudListingSearchCriteria,
  runCasaHudListingDiscovery,
} from "@/lib/studio/domara/listing-discovery-engine";

function campaignFor(title: string, campaignType: CasaHudCampaign["campaignType"], regionHint?: string): CasaHudCampaign {
  return {
    id: `campaign-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    name: title,
    selectedViralTitle: title,
    selectedTitle: {
      title,
      score: 92,
      campaignType,
      confidence: 0.9,
      reasoning: "Strong title fit for CasaFlix.",
      regionHint,
      listingSearchHints: [title],
    },
    titleCandidates: [
      {
        id: "title-1",
        title,
        score: 92,
        ctrPotential: 91,
        searchAppeal: 90,
        novelty: 82,
        realism: 89,
        listingAvailability: 86,
        channelFit: 90,
        titleTruthfulness: 92,
        campaignType,
        regionHint,
        listingSearchHints: [title],
        reasoning: "Primary candidate.",
      },
    ],
    researchBrief: {
      summary: "CasaFlix sees a credible listing-backed angle with strong visual potential.",
      opportunityCategories: ["regional affordability", "home tours", "lifestyle relocation"],
      competitorPatterns: ["Price ceilings and clear geographies perform best."],
      audienceIntent: ["buyable Italy homes", "retire in Italy", "lake villa tours"],
      suggestedTitleDirections: [title],
      riskNotes: ["Discovery still needs provider-backed listings."],
    },
    campaignType,
    marketRegionHint: regionHint,
    preferredMarket: "Italian real-estate YouTube",
    generationSource: {
      mode: "casahud_patterns",
      label: "CasaFlix opportunity patterns",
      detail: "Using CasaFlix opportunity patterns until YouTube connection is enabled for live competitive research.",
      canImproveWithYouTube: true,
    },
    confidenceReasoning: {
      summary: "90% confidence.",
      titleOpportunitySummary: "The title has a clear property promise CasaFlix can search for.",
      selectedTitleReasoning: "It balances click potential with supportable listing search criteria.",
      selectedTitleConfidence: 0.9,
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
    locationIntelligenceStatus: "not_started",
    locationIntelligenceSummary: null,
    locationStory: null,
    localHighlights: [],
    poiBundle: null,
    mapSceneIdeas: [],
    listingLocationInsights: [],
    locationProviderStatuses: [],
    locationWarnings: [],
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
      key: "property_discovery",
      label: "Find matching properties",
      detail:
        "Property Discovery comes next. CasaFlix will translate the saved title promise into real candidate listings without regenerating the title package.",
      implemented: false,
    },
    createdAt: "2026-04-28T00:00:00.000Z",
    updatedAt: "2026-04-28T00:00:00.000Z",
    generatedAt: "2026-04-28T00:00:00.000Z",
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
}

describe("CasaFlix listing discovery engine", () => {
  it("derives structured search criteria for roundup titles", () => {
    const criteria = deriveCasaHudListingSearchCriteria(
      campaignFor("7 Affordable Beachfront Homes in Southern Italy", "roundup", "Southern Italy"),
    );

    expect(criteria.targetListingCount).toBe(7);
    expect(criteria.regionHint).toBe("Southern Italy");
    expect(criteria.pricePositioning).toBe("affordable");
    expect(criteria.featureTags).toContain("beachfront");
    expect(criteria.featureTags).toContain("beach proximity");
  });

  it("derives structured search criteria for niche, location-led, relocation, and single-property titles", () => {
    const niche = deriveCasaHudListingSearchCriteria(
      campaignFor("Best Tuscany Farmhouses Under €1M", "niche_category", "Tuscany"),
    );
    expect(niche.propertyTypes).toContain("farmhouse");
    expect(niche.maxPrice).toBe(1_000_000);
    expect(niche.currency).toBe("EUR");

    const locationLed = deriveCasaHudListingSearchCriteria(
      campaignFor("Why Puglia Is Italy's Smartest Second-Home Market", "location_led", "Puglia"),
    );
    expect(locationLed.regionHint).toBe("Puglia");
    expect(locationLed.cities).toContain("Bari");

    const relocation = deriveCasaHudListingSearchCriteria(
      campaignFor("Could You Retire in Southern Italy for Under $300K?", "lifestyle_relocation", "Southern Italy"),
    );
    expect(relocation.lifestyleTags).toContain("retirement");
    expect(relocation.lifestyleTags).toContain("relocation");
    expect(relocation.maxPrice).toBe(300_000);
    expect(relocation.currency).toBe("USD");

    const showcase = deriveCasaHudListingSearchCriteria(
      campaignFor("Inside a Modern Lake Como Villa With Stunning Views", "single_property_showcase", "Lake Como"),
    );
    expect(showcase.singlePropertyFocus).toBe(true);
    expect(showcase.targetListingCount).toBe(1);
    expect(showcase.propertyTypes).toEqual(["villa"]);
    expect(showcase.featureTags).toContain("modern finishes");
    expect(showcase.featureTags).toContain("stunning views");
  });

  it("returns no demo candidates when live provider credentials are absent", async () => {
    const campaign = campaignFor(
      "Could You Retire in Southern Italy for Under $300K?",
      "lifestyle_relocation",
      "Southern Italy",
    );

    const result = await runCasaHudListingDiscovery(campaign, { allowDemoData: false });

    expect(result.discoverySummary.fallbackUsed).toBe(false);
    expect(result.discoverySummary.fallbackCandidateCount).toBe(0);
    expect(result.listingCandidates.length).toBe(0);
    expect(result.listingProviderStatuses.some((status) => status.provider === "idealista" && status.state === "missing_credentials")).toBe(true);
    expect(result.listingProviderStatuses.some((status) => status.provider === "immobiliare" && status.state === "missing_credentials")).toBe(true);
    expect(result.listingProviderStatuses.some((status) => status.provider === "casahud_sample" && status.state === "fallback")).toBe(false);
  });

  it("can return deterministic demo candidates only when demo mode is explicitly enabled", async () => {
    const campaign = campaignFor(
      "Could You Retire in Southern Italy for Under $300K?",
      "lifestyle_relocation",
      "Southern Italy",
    );

    const first = await runCasaHudListingDiscovery(campaign, { allowDemoData: true });
    const second = await runCasaHudListingDiscovery(campaign, { allowDemoData: true });

    expect(first.discoverySummary.fallbackUsed).toBe(true);
    expect(first.listingCandidates.length).toBeGreaterThan(0);
    expect(first.listingCandidates.map((candidate) => candidate.id)).toEqual(
      second.listingCandidates.map((candidate) => candidate.id),
    );
    expect(first.listingProviderStatuses.some((status) => status.provider === "casahud_sample" && status.state === "fallback")).toBe(true);
  });
});

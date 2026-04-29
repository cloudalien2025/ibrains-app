import { describe, expect, it } from "vitest";
import type { CasaHudCampaign } from "@/lib/studio/domara/campaigns";
import { runCasaHudListingValidation } from "@/lib/studio/domara/listing-validation-engine";

function baseCampaign(): CasaHudCampaign {
  return {
    id: "casahud-project-phase5",
    name: "Could You Retire in Southern Italy for Under $300K?",
    selectedViralTitle: "Could You Retire in Southern Italy for Under $300K?",
    selectedTitle: {
      title: "Could You Retire in Southern Italy for Under $300K?",
      score: 92,
      campaignType: "lifestyle_relocation",
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
        campaignType: "lifestyle_relocation",
        regionHint: "Southern Italy",
        listingSearchHints: ["Southern Italy homes under 300k", "relocation-friendly towns"],
        reasoning: "Strong relocation intent plus a concrete budget makes this highly clickable and supportable.",
      },
    ],
    researchBrief: {
      summary: "CasaHUD identified the strongest opportunity in regional affordability plus relocation intent.",
      opportunityCategories: ["affordable coastal roundups", "retirement relocation"],
      competitorPatterns: ["Top videos frequently anchor the title with a price ceiling."],
      audienceIntent: ["buyable Italy homes", "retire in Italy"],
      suggestedTitleDirections: ["Southern Italy affordability roundups"],
      riskNotes: ["Very cheap Italy claims can become hard to prove with current listings."],
    },
    campaignType: "lifestyle_relocation",
    marketRegionHint: "Southern Italy",
    preferredMarket: "Italian real-estate YouTube",
    generationSource: {
      mode: "casahud_patterns",
      label: "CasaHUD opportunity patterns",
      detail: "Using CasaHUD opportunity patterns until YouTube connection is enabled for live competitive research.",
      canImproveWithYouTube: true,
    },
    confidenceReasoning: {
      summary: "89% confidence.",
      titleOpportunitySummary:
        "The title gives CasaHUD a clear, searchable concept that can still hold up when listing discovery begins.",
      selectedTitleReasoning: "The price ceiling and geography are strong but still believable.",
      selectedTitleConfidence: 0.89,
    },
    status: "listing_candidates_discovered",
    listingCandidates: [
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
        imageUrls: ["https://images.example.com/1.jpg", "https://images.example.com/2.jpg"],
        imageCount: 2,
        photoAvailability: "available",
        discoveredAt: "2026-04-28T00:20:00.000Z",
        preliminaryMatchNotes: "Fits the title promise and budget.",
      },
      {
        id: "listing-1-dup",
        provider: "casahud_sample",
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
        descriptionSnippet: "Same apartment carried through a duplicate source path.",
        features: ["budget-conscious", "move-in ready", "coastal lifestyle"],
        imageUrls: ["https://images.example.com/3.jpg"],
        imageCount: 1,
        photoAvailability: "limited",
        discoveredAt: "2026-04-28T00:20:00.000Z",
        preliminaryMatchNotes: "Duplicate of the Tropea apartment candidate.",
      },
      {
        id: "listing-2",
        provider: "casahud_sample",
        providerListingId: "sample-2",
        sourceUrl: "https://example.com/listing-2",
        title: "Lake Como villa asking $920K",
        locationText: "Como, Lombardy, Italy",
        country: "Italy",
        region: "Lombardy",
        city: "Como",
        price: 920000,
        currency: "USD",
        propertyType: "villa",
        bedrooms: 4,
        bathrooms: 3,
        sizeSqm: 210,
        descriptionSnippet: "Premium villa far above the relocation budget.",
        features: ["stunning views", "premium home tour"],
        imageUrls: ["https://images.example.com/4.jpg"],
        imageCount: 1,
        photoAvailability: "limited",
        discoveredAt: "2026-04-28T00:20:00.000Z",
        preliminaryMatchNotes: "Mismatched geography and price for the title promise.",
      },
    ],
    listingSearchCriteria: {
      operation: "sale",
      campaignType: "lifestyle_relocation",
      titlePromise: "Could You Retire in Southern Italy for Under $300K?",
      regionHint: "Southern Italy",
      country: "Italy",
      cities: ["Tropea", "Lecce", "Bari"],
      propertyTypes: ["apartment", "villa", "house"],
      featureTags: ["budget-conscious", "move-in ready"],
      lifestyleTags: ["retirement", "relocation"],
      searchTerms: ["Southern Italy homes under 300k", "relocation-friendly towns"],
      pricePositioning: "affordable",
      targetListingCount: 6,
      singlePropertyFocus: false,
      maxPrice: 300000,
      currency: "USD",
    },
    listingProviderStatuses: [
      {
        provider: "casahud_sample",
        label: "CasaHUD sample listing patterns",
        state: "fallback",
        configured: true,
        used: true,
        candidateCount: 3,
        detail: "Using CasaHUD sample listing patterns until listing sources are connected.",
        warning: "Connect Idealista or Immobiliare to search live listings.",
      },
    ],
    discoverySummary: {
      headline: 'Prepared 3 candidate properties for "Could You Retire in Southern Italy for Under $300K?".',
      criteriaSummary:
        "Searching sale listings around Southern Italy up to USD 300,000, focused on budget-conscious and move-in ready properties.",
      providerSummary: "Using CasaHUD sample listing patterns until listing sources are connected.",
      candidateCount: 3,
      liveCandidateCount: 0,
      fallbackCandidateCount: 3,
      fallbackUsed: true,
      warnings: ["Using CasaHUD sample listing patterns until listing sources are connected."],
      discoveredAt: "2026-04-28T00:20:00.000Z",
    },
    listingDiscoveryStatus: "listing_candidates_discovered",
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
    nextPhase: {
      key: "listing_validation",
      label: "Validate and rank listings",
      detail:
        "Validation and ranking arrive next. CasaHUD will confirm which discovered candidates truly support the title promise.",
      implemented: false,
    },
    createdAt: "2026-04-28T00:10:00.000Z",
    updatedAt: "2026-04-28T00:20:00.000Z",
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

describe("CasaHUD listing validation engine", () => {
  it("scores title fit, removes duplicates, and ranks approved listings", () => {
    const result = runCasaHudListingValidation(baseCampaign());

    expect(result.approvedListings).toHaveLength(1);
    expect(result.approvedListings[0]?.id).toBe("listing-1");
    expect(result.approvedListings[0]?.rank).toBe(1);
    expect(result.approvedListings[0]?.scoreBreakdown.geographyScore).toBeGreaterThan(80);
    expect(result.approvedListings[0]?.scoreBreakdown.priceFitScore).toBe(100);
    expect(result.approvedListings[0]?.scoreBreakdown.mediaAvailabilityScore).toBeGreaterThan(60);
    expect(result.listingRankOrder).toEqual(["listing-1"]);

    const duplicate = result.rejectedListings.find((listing) => listing.id === "listing-1-dup");
    expect(duplicate?.rejectionCategory).toBe("duplicate");
    expect(duplicate?.duplicateOfListingId).toBe("listing-1");

    const mismatch = result.rejectedListings.find((listing) => listing.id === "listing-2");
    expect(mismatch?.rejectionCategory).toBe("price_mismatch");
    expect(mismatch?.scoreBreakdown.geographyScore).toBeLessThan(60);
    expect(result.validationWarnings.some((warning) => warning.includes("Duplicate source overlap"))).toBe(true);
  });

  it("falls back to derived criteria and warns when title support remains weak", () => {
    const campaign = baseCampaign();
    campaign.listingSearchCriteria = null;
    campaign.listingCandidates = [
      {
        ...campaign.listingCandidates[2]!,
        id: "listing-weak",
      },
    ];

    const result = runCasaHudListingValidation(campaign);

    expect(result.approvedListings).toHaveLength(0);
    expect(result.rejectedListings[0]?.rejectionCategory).toBeTruthy();
    expect(result.titleSupportConfidence).toBeLessThan(50);
    expect(
      result.validationWarnings.some((warning) => warning.includes("only partially support the title promise")),
    ).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import {
  createDefaultCampaign,
  createNarrationAssetSeam,
  createVideoProjectSeam,
  enrichListingCandidate,
  generatePublishingPackage,
  generateResearchBrief,
  generateStoryboard,
  generateTitleIdeas,
  mockDiscoverListings,
  rankListingCandidates,
  scoreListingCandidate,
} from "@/lib/studio/domara/campaign-workflow";

describe("Domara campaign workflow", () => {
  it("converts selected title idea into structured research brief", () => {
    const campaign = createDefaultCampaign();
    const ideas = generateTitleIdeas(campaign);
    const selected = ideas.find((idea) => idea.selected);

    expect(selected).toBeDefined();

    const brief = generateResearchBrief(campaign, selected!);

    expect(brief.campaignId).toBe(campaign.id);
    expect(brief.titleIdeaId).toBe(selected!.id);
    expect(brief.markets).toEqual(["Sicily", "Puglia", "Calabria", "Liguria"]);
    expect(brief.poiPriorities).toEqual(["beach", "marina", "airport", "restaurants", "historic_center"]);
    expect(brief.priceMax).toBe(400000);
  });

  it("builds deterministic mock listing candidates from research brief", () => {
    const campaign = createDefaultCampaign();
    const selected = generateTitleIdeas(campaign)[0]!;
    const brief = generateResearchBrief(campaign, selected);

    const candidates = mockDiscoverListings(brief, ["immobiliare", "idealista", "gate_away", "agency_site", "csv_manual"]);

    expect(candidates).toHaveLength(5);
    expect(candidates[0]?.campaignId).toBe(campaign.id);
    expect(candidates[0]?.source).toBe("immobiliare");
    expect(candidates[1]?.source).toBe("idealista");
    expect(candidates.every((candidate) => candidate.imageUrls.every((url) => url.startsWith("http")))).toBe(true);
  });

  it("ranks strong under-budget coastal candidate above weak mismatched candidate", () => {
    const campaign = createDefaultCampaign();
    const selected = generateTitleIdeas(campaign)[0]!;
    const brief = generateResearchBrief(campaign, selected);

    const strongCandidate = {
      id: "strong-1",
      campaignId: campaign.id,
      source: "immobiliare" as const,
      sourceUrl: "https://example.com/immobiliare",
      listingUrl: "https://example.com/strong",
      title: "Tropea apartment with beach and marina access",
      price: 330000,
      currency: "EUR",
      locationText: "Tropea, Calabria, Italy",
      city: "Tropea",
      region: "Calabria",
      country: "Italy",
      propertyType: "apartment",
      bedrooms: 3,
      bathrooms: 2,
      sqm: 102,
      description: "Coastal lifestyle listing with beach, marina, restaurants, and strong short-term rental potential for remote workers.",
      imageUrls: Array.from({ length: 12 }, (_, index) => `https://images.example.com/strong-${index}.jpg`),
      thumbnailUrl: "https://images.example.com/strong-thumb.jpg",
      status: "new" as const,
      extractionConfidence: 0.94,
      discoveredAt: "2026-04-27T00:00:00.000Z",
    };

    const weakCandidate = {
      id: "weak-1",
      campaignId: campaign.id,
      source: "future_api" as const,
      sourceUrl: "https://example.com/future",
      listingUrl: "https://example.com/weak",
      title: "Mountain micro flat",
      price: 545000,
      currency: "EUR",
      locationText: "Inland, Other Region, Italy",
      city: "Unknown",
      region: "Umbria",
      country: "Italy",
      propertyType: "studio",
      bedrooms: 1,
      bathrooms: 1,
      sqm: 34,
      description: "Sparse details.",
      imageUrls: ["https://images.example.com/weak-1.jpg", "https://images.example.com/weak-2.jpg"],
      thumbnailUrl: "https://images.example.com/weak-thumb.jpg",
      status: "new" as const,
      extractionConfidence: 0.54,
      discoveredAt: "2026-04-27T00:00:00.000Z",
    };

    const strongScore = scoreListingCandidate(campaign, brief, strongCandidate);
    const weakScore = scoreListingCandidate(campaign, brief, weakCandidate);

    expect(strongScore.totalScore).toBeGreaterThan(weakScore.totalScore);
    expect(strongScore.scoreBand === "excellent" || strongScore.scoreBand === "strong").toBe(true);
    expect(weakScore.scoreBand).toBe("skip");
  });

  it("returns enrichment with poi/map placeholders and confidence metadata", () => {
    const campaign = createDefaultCampaign();
    const brief = generateResearchBrief(campaign, generateTitleIdeas(campaign)[0]!);
    const candidate = mockDiscoverListings(brief, ["immobiliare"])[0]!;

    const enrichment = enrichListingCandidate(candidate, brief);

    expect(enrichment.locationConfidence).toMatch(/high|medium|low/);
    expect(enrichment.pois.length).toBeGreaterThan(0);
    expect(enrichment.mapAssets.provider).toBe("mock_location_media");
    expect(enrichment.mapAssets.staticMapUrl).toContain("https://maps.example.com/location-media/");
    expect(enrichment.locationMedia.providerStatus).toBe("mock");
    expect(enrichment.locationMedia.poiMediaCandidates.length).toBeGreaterThan(0);
    expect(enrichment.distanceHighlights.length).toBe(enrichment.pois.length);
  });

  it("generates storyboard, narration seam, video seam, and publishing package without credentials", () => {
    const campaign = createDefaultCampaign();
    const brief = generateResearchBrief(campaign, generateTitleIdeas(campaign)[0]!);
    const candidate = rankListingCandidates(campaign, brief, mockDiscoverListings(brief, campaign.sources))[0]!.candidate;
    const enrichment = enrichListingCandidate(candidate, brief);

    const storyboard = generateStoryboard(campaign, candidate, enrichment);
    const narration = createNarrationAssetSeam(storyboard);
    const videoProject = createVideoProjectSeam(campaign, storyboard, narration, enrichment);
    const publishingPackage = generatePublishingPackage(campaign, candidate, storyboard, videoProject);

    expect(storyboard.scenes.length).toBeGreaterThanOrEqual(4);
    expect(storyboard.narrationScript).toContain("Scene 1");
    expect(storyboard.locationMediaAssetIds.length).toBeGreaterThan(0);
    expect(narration.fallbackUsed).toBe(true);
    expect(videoProject.renderStatus).toBe("provider_seam_ready");
    expect(videoProject.assets.locationMediaAssetIds.length).toBeGreaterThan(0);
    expect(publishingPackage.youtubeTitle.toLowerCase()).toContain(candidate.city.toLowerCase());
    expect(publishingPackage.status).toBe("draft_ready");
  });
});

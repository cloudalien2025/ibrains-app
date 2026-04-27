import { describe, expect, it } from "vitest";
import {
  buildMapboxStaticMapUrl,
  createGooglePlacesPhotoCandidates,
  createLocationMediaRequest,
  generateLocationMediaAssets,
} from "@/lib/studio/domara/location-media-provider";
import {
  createDefaultCampaign,
  createNarrationAssetSeam,
  createVideoProjectSeam,
  enrichListingCandidate,
  generateResearchBrief,
  generateStoryboard,
  generateTitleIdeas,
  mockDiscoverListings,
} from "@/lib/studio/domara/campaign-workflow";

describe("Domara location media provider seam", () => {
  it("generates deterministic mock location media assets from resolved listing location", () => {
    const request = createLocationMediaRequest({
      candidateId: "candidate-1",
      title: "Palermo apartment",
      resolvedAddress: "Palermo, Sicily, Italy",
      latitude: 38.1157,
      longitude: 13.3615,
      locationConfidence: "high",
      pois: [
        {
          id: "poi-1",
          name: "Beach spot",
          category: "beach",
          distanceKm: 1.2,
          travelMinutes: 8,
          confidence: "high",
          source: "mock",
        },
      ],
    });

    const result = generateLocationMediaAssets(request, {});

    expect(result.providerStatus).toBe("mock");
    expect(result.assets.some((asset) => asset.kind === "property_pin")).toBe(true);
    expect(result.assets.some((asset) => asset.kind === "regional_orientation")).toBe(true);
    expect(result.assets.some((asset) => asset.kind === "local_poi")).toBe(true);
    expect(result.poiMediaCandidates.length).toBeGreaterThan(0);
    expect(result.assets.every((asset) => (asset.url || asset.placeholderUrl || "").startsWith("https://"))).toBe(true);
  });

  it("returns missing_credentials fallback status in live mode without credentials", () => {
    const request = createLocationMediaRequest({
      candidateId: "candidate-2",
      title: "Bari listing",
      resolvedAddress: "Bari, Puglia, Italy",
      latitude: 41.1171,
      longitude: 16.8719,
      locationConfidence: "medium",
      pois: [],
    });

    const result = generateLocationMediaAssets(request, { DOMARA_ENABLE_LIVE_LOCATION_MEDIA: "true" });

    expect(result.providerStatus).toBe("missing_credentials");
    expect(result.assets.some((asset) => asset.status === "fallback" || asset.status === "placeholder")).toBe(true);
  });

  it("builds a plausible Mapbox static map URL shape without fetching", () => {
    const url = buildMapboxStaticMapUrl({
      latitude: 43.76956,
      longitude: 11.25581,
      zoom: 12,
      width: 1280,
      height: 720,
      stylePath: "mapbox/streets-v12",
      token: "mapbox-token",
      markers: [
        { latitude: 43.76956, longitude: 11.25581 },
        { latitude: 43.775, longitude: 11.26, color: "0ea5e9" },
      ],
      pathOverlay: [
        { latitude: 43.76956, longitude: 11.25581 },
        { latitude: 43.775, longitude: 11.26 },
      ],
    });

    expect(url).toContain("https://api.mapbox.com/styles/v1/");
    expect(url).toContain("/static/");
    expect(url).toContain("1280x720");
    expect(url).toContain("access_token=");
  });

  it("normalizes Google POI photo candidate metadata without live calls", () => {
    const request = createLocationMediaRequest({
      candidateId: "candidate-3",
      title: "Taormina villa",
      resolvedAddress: "Taormina, Sicily, Italy",
      latitude: 37.8532,
      longitude: 15.2866,
      locationConfidence: "high",
      pois: [
        {
          id: "poi-2",
          name: "Historic center",
          category: "historic_center",
          distanceKm: 0.9,
          travelMinutes: 7,
          confidence: "high",
          source: "google_places",
          providerMetadata: {
            googlePlaceId: "place-123",
            googlePhotoName: "places/place-123/photos/photo-abc",
          },
        },
      ],
    });

    const candidates = createGooglePlacesPhotoCandidates(request, {});

    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.placeId).toBe("place-123");
    expect(candidates[0]?.photoName).toBe("places/place-123/photos/photo-abc");
    expect(candidates[0]?.status).toBe("placeholder");
    expect(candidates[0]?.photoUrl).toBeUndefined();
    expect(candidates[0]?.placeholderUrl).toContain("https://images.example.com/location-media/");
  });

  it("keeps storyboard/video project linked to generated location media assets", () => {
    const campaign = createDefaultCampaign();
    const brief = generateResearchBrief(campaign, generateTitleIdeas(campaign)[0]!);
    const candidate = mockDiscoverListings(brief, ["immobiliare"])[0]!;
    const enrichment = enrichListingCandidate(candidate, brief);

    const storyboard = generateStoryboard(campaign, candidate, enrichment);
    const narration = createNarrationAssetSeam(storyboard);
    const videoProject = createVideoProjectSeam(campaign, storyboard, narration, enrichment);

    expect(storyboard.locationMediaAssetIds.length).toBeGreaterThan(0);
    expect(videoProject.assets.locationMediaAssetIds).toEqual(storyboard.locationMediaAssetIds);
    expect(videoProject.assets.poiMediaCandidateIds.length).toBe(enrichment.locationMedia.poiMediaCandidates.length);
    expect(videoProject.assets.mapAssets.length).toBeGreaterThan(0);
  });
});

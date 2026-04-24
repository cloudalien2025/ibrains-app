import { describe, expect, it } from "vitest";
import { applyMapVisualsToRenderPlan, resolveDomaraMapVisuals } from "@/lib/studio/domara/map-visual-provider";
import { DomaraVideoRenderPlan } from "@/lib/studio/domara/render-plan";
import { PropertyVideoPlan } from "@/lib/studio/domara/types";

const plan: PropertyVideoPlan = {
  id: "plan-map-1",
  channel: "Expat AI",
  status: "draft_plan_ready",
  listingSummary: "summary",
  hook: "hook",
  scenes: [
    {
      order: 1,
      title: "Opening Hook",
      visualDirection: "",
      narration: "",
      overlayText: "",
      suggestedMedia: [],
      durationSeconds: 8,
    },
  ],
  narrationScript: "script",
  youtubeTitle: "title",
  youtubeDescription: "description",
  enrichmentSummary: "enrichment",
  renderPlaceholder: {
    status: "pending_provider_connection",
    nextStep: "next",
    provider: "mock",
  },
};

const baseRenderPlan: DomaraVideoRenderPlan = {
  id: "domara-render-plan-map",
  channel: "Expat AI",
  useCase: "property_video_engine",
  market: "Italy",
  title: "Map Listing",
  imageUrls: ["https://example.com/1.jpg"],
  requestedImageCount: 1,
  skippedImageCount: 0,
  imageValidationWarnings: [],
  totalDurationSeconds: 8,
  timeline: [
    {
      order: 1,
      title: "Opening Hook",
      overlayText: "Hook",
      narration: "Narration",
      durationSeconds: 8,
      imageUrl: "https://example.com/1.jpg",
    },
  ],
  renderMode: "mock-first local render",
  stylePreset: "expat_ai_editorial",
  mapVisualMode: "off",
  mapVisualProvider: "none",
};

describe("Domara map visual provider", () => {
  it("returns fallback when Mapbox token is missing", () => {
    const result = resolveDomaraMapVisuals(
      {
        mode: "mapbox",
        listingInput: {
          country: "Italy",
          city: "Florence",
          title: "Map Listing",
          latitude: "43.76956",
          longitude: "11.25581",
          imageUrls: [],
        },
        plan,
      },
      {},
    );

    expect(result.provider).toBe("mapbox");
    expect(result.visualType).toBe("placeholder");
    expect(result.fallbackReason).toContain("MAPBOX_ACCESS_TOKEN");
  });

  it("builds deterministic Mapbox static visual when token exists", () => {
    const result = resolveDomaraMapVisuals(
      {
        mode: "mapbox",
        listingInput: {
          country: "Italy",
          city: "Florence",
          title: "Map Listing",
          latitude: 43.76956,
          longitude: 11.25581,
          imageUrls: [],
        },
        plan,
      },
      { MAPBOX_ACCESS_TOKEN: "token-123" },
    );

    expect(result.provider).toBe("mapbox");
    expect(result.visualType).toBe("image");
    expect(result.scenes[0]?.imageUrl).toContain("api.mapbox.com");
    expect(result.scenes[0]?.imageUrl).toContain("access_token=");
  });

  it("falls back to Google Static Maps when auto mode has no Mapbox token", () => {
    const result = resolveDomaraMapVisuals(
      {
        mode: "auto",
        listingInput: {
          country: "Italy",
          city: "Florence",
          title: "Map Listing",
          latitude: 43.76956,
          longitude: 11.25581,
          imageUrls: [],
        },
        plan,
      },
      { GOOGLE_MAPS_API_KEY: "google-key" },
    );

    expect(result.provider).toBe("google_static");
    expect(result.visualType).toBe("image");
    expect(result.scenes[0]?.imageUrl).toContain("maps.googleapis.com/maps/api/staticmap");
  });

  it("keeps Earth-style placeholder honest", () => {
    const result = resolveDomaraMapVisuals(
      {
        mode: "earth_style_placeholder",
        listingInput: {
          country: "Italy",
          city: "Florence",
          title: "Map Listing",
          imageUrls: [],
        },
        plan,
      },
      {},
    );

    expect(result.provider).toBe("earth_style_placeholder");
    expect(result.fallbackReason?.toLowerCase()).toContain("placeholder");
    expect(result.fallbackReason?.toLowerCase()).not.toContain("live earth api");
  });

  it("injects map scenes into render plan timeline and preserves attribution", () => {
    const visual = resolveDomaraMapVisuals(
      {
        mode: "mapbox",
        listingInput: {
          country: "Italy",
          city: "Florence",
          title: "Map Listing",
          latitude: 43.76956,
          longitude: 11.25581,
          imageUrls: [],
        },
        plan,
      },
      { MAPBOX_ACCESS_TOKEN: "token-123" },
    );

    const mapped = applyMapVisualsToRenderPlan(baseRenderPlan, visual);
    expect(mapped.timeline.length).toBeGreaterThan(baseRenderPlan.timeline.length);
    expect(mapped.mapVisualProvider).toBe("mapbox");
    expect(mapped.mapAttribution).toContain("Mapbox");
  });

  it("uses branded fallback when coordinates are absent", () => {
    const result = resolveDomaraMapVisuals(
      {
        mode: "auto",
        listingInput: {
          country: "Italy",
          city: "Florence",
          title: "Map Listing",
          imageUrls: [],
        },
        plan,
      },
      { MAPBOX_ACCESS_TOKEN: "token-123" },
    );

    expect(result.visualType).toBe("placeholder");
    expect(result.fallbackReason).toContain("Coordinates unavailable");
  });
});

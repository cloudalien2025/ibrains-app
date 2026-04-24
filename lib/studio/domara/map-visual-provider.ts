import type { DomaraRenderTimelineScene, DomaraVideoRenderPlan } from "@/lib/studio/domara/render-plan";
import { earthStyleRoadmapMessage } from "@/lib/studio/domara/earth-style-roadmap";
import { buildGoogleStaticMapUrl } from "@/lib/studio/domara/google-static-map-provider";
import { buildMapboxStaticImageUrl } from "@/lib/studio/domara/mapbox-visual-provider";
import type { PropertyListingInput, PropertyVideoPlan } from "@/lib/studio/domara/types";

export type DomaraMapVisualProviderId = "mapbox" | "google_static" | "earth_style_placeholder" | "none";
export type DomaraMapVisualMode = "off" | "auto" | "mapbox" | "google_static" | "earth_style_placeholder";

export type DomaraMapSceneType =
  | "city_context"
  | "neighborhood_context"
  | "poi_markers"
  | "route_placeholder"
  | "earth_style_intro_placeholder";

export type DomaraMapVisualRequest = {
  mode: DomaraMapVisualMode;
  listingInput: PropertyListingInput;
  plan: PropertyVideoPlan;
};

export type DomaraMapScene = {
  title: string;
  overlayText: string;
  narration: string;
  durationSeconds: number;
  imageUrl?: string;
  type: DomaraMapSceneType;
};

export type DomaraMapVisualResult = {
  provider: DomaraMapVisualProviderId;
  visualType: "image" | "placeholder";
  scenes: DomaraMapScene[];
  attribution?: string;
  fallbackReason?: string;
};

function asNumber(value: string | number | undefined): number | null {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function resolveCoordinates(input: PropertyListingInput): { latitude: number; longitude: number } | null {
  const latitude = asNumber(input.latitude);
  const longitude = asNumber(input.longitude);
  if (latitude === null || longitude === null) return null;
  return { latitude, longitude };
}

function locationLabel(input: PropertyListingInput): string {
  return [input.neighborhood, input.city, input.region, input.country].filter(Boolean).join(", ") || input.country || "Italy";
}

function mapScenesFromUrl(url: string, input: PropertyListingInput, provider: DomaraMapVisualProviderId): DomaraMapScene[] {
  const label = locationLabel(input);
  return [
    {
      title: "Map Scene: City Context",
      overlayText: `City Context | ${label}`,
      narration: `Location overview for ${label}.`,
      durationSeconds: 10,
      imageUrl: url,
      type: "city_context",
    },
    {
      title: "Map Scene: POI Lifestyle",
      overlayText: `Lifestyle POIs | ${label}`,
      narration: `Lifestyle and practical context map scene for ${label}.`,
      durationSeconds: 10,
      imageUrl: url,
      type: provider === "mapbox" ? "poi_markers" : "neighborhood_context",
    },
  ];
}

function earthPlaceholderScenes(input: PropertyListingInput): DomaraMapScene[] {
  const label = locationLabel(input);
  return [
    {
      title: "Earth-style Intro Placeholder",
      overlayText: `Earth-style Fly-In Placeholder | ${label}`,
      narration: earthStyleRoadmapMessage(),
      durationSeconds: 9,
      type: "earth_style_intro_placeholder",
    },
    {
      title: "Route Context Placeholder",
      overlayText: `Regional Route Placeholder | ${label}`,
      narration: "Regional route context remains placeholder until map provider assets are configured.",
      durationSeconds: 8,
      type: "route_placeholder",
    },
  ];
}

function chooseMode(requested: DomaraMapVisualMode, env: NodeJS.ProcessEnv): DomaraMapVisualMode {
  if (requested !== "auto") return requested;
  if ((env.MAPBOX_ACCESS_TOKEN || "").trim()) return "mapbox";
  if (((env.GOOGLE_STATIC_MAPS_API_KEY || "").trim() || (env.GOOGLE_MAPS_API_KEY || "").trim()).length > 0)
    return "google_static";
  return "earth_style_placeholder";
}

export function resolveDomaraMapVisuals(
  request: DomaraMapVisualRequest,
  env: NodeJS.ProcessEnv = process.env,
): DomaraMapVisualResult {
  const mode = chooseMode(request.mode, env);
  if (mode === "off") {
    return {
      provider: "none",
      visualType: "placeholder",
      scenes: [],
      fallbackReason: "Map visual mode is off.",
    };
  }

  if (mode === "earth_style_placeholder") {
    return {
      provider: "earth_style_placeholder",
      visualType: "placeholder",
      scenes: earthPlaceholderScenes(request.listingInput),
      attribution: "Earth-style placeholder. Future workflow: imported Google Earth Studio clips.",
      fallbackReason: "Earth-style placeholder selected; no live Earth Studio API path is claimed.",
    };
  }

  const coordinates = resolveCoordinates(request.listingInput);
  if (!coordinates) {
    return {
      provider: mode === "mapbox" ? "mapbox" : "google_static",
      visualType: "placeholder",
      scenes: earthPlaceholderScenes(request.listingInput),
      fallbackReason: "Coordinates unavailable. Rendered branded map placeholders instead of live map imagery.",
    };
  }

  if (mode === "mapbox") {
    const url = buildMapboxStaticImageUrl(
      {
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
        title: request.listingInput.title,
        locationLabel: locationLabel(request.listingInput),
      },
      env,
    );
    if (!url) {
      return {
        provider: "mapbox",
        visualType: "placeholder",
        scenes: earthPlaceholderScenes(request.listingInput),
        fallbackReason: "MAPBOX_ACCESS_TOKEN is missing. Rendered placeholders.",
      };
    }
    return {
      provider: "mapbox",
      visualType: "image",
      scenes: mapScenesFromUrl(url, request.listingInput, "mapbox"),
      attribution: "Map visuals © Mapbox / OpenStreetMap",
    };
  }

  const googleUrl = buildGoogleStaticMapUrl(
    {
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
      locationLabel: locationLabel(request.listingInput),
    },
    env,
  );
  if (!googleUrl) {
    return {
      provider: "google_static",
      visualType: "placeholder",
      scenes: earthPlaceholderScenes(request.listingInput),
      fallbackReason: "Google Static Maps key is missing. Rendered placeholders.",
    };
  }

  return {
    provider: "google_static",
    visualType: "image",
    scenes: mapScenesFromUrl(googleUrl, request.listingInput, "google_static"),
    attribution: "Map imagery © Google Maps Platform",
  };
}

export function applyMapVisualsToRenderPlan(plan: DomaraVideoRenderPlan, visual: DomaraMapVisualResult): DomaraVideoRenderPlan {
  if (visual.scenes.length === 0) {
    return {
      ...plan,
      mapVisualProvider: visual.provider,
      mapAttribution: visual.attribution,
      mapFallbackReason: visual.fallbackReason,
    };
  }

  const mapTimeline: DomaraRenderTimelineScene[] = visual.scenes.map((scene) => ({
    order: 0,
    title: scene.title,
    overlayText: scene.overlayText,
    narration: scene.narration,
    durationSeconds: scene.durationSeconds,
    imageUrl: scene.imageUrl,
  }));

  const insertionIndex = Math.min(3, plan.timeline.length);
  const timeline = [...plan.timeline.slice(0, insertionIndex), ...mapTimeline, ...plan.timeline.slice(insertionIndex)].map(
    (scene, index) => ({
      ...scene,
      order: index + 1,
    }),
  );

  const imageUrls = Array.from(new Set([...plan.imageUrls, ...mapTimeline.map((scene) => scene.imageUrl).filter(Boolean)])) as string[];

  return {
    ...plan,
    timeline,
    imageUrls,
    totalDurationSeconds: timeline.reduce((sum, scene) => sum + scene.durationSeconds, 0),
    mapVisualProvider: visual.provider,
    mapAttribution: visual.attribution,
    mapFallbackReason: visual.fallbackReason,
  };
}

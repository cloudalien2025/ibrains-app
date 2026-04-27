import type {
  EnrichedPoi,
  LocationMediaAsset,
  LocationMediaAttribution,
  LocationMediaRequest,
  LocationMediaResult,
  LocationMediaProviderStatus,
  MapSceneKind,
  PoiMediaCandidate,
} from "@/lib/studio/domara/types";

export type LocationMediaEnv = Partial<
  Record<
    | "MAPBOX_ACCESS_TOKEN"
    | "MAPBOX_STYLE_ID"
    | "MAPBOX_STYLE_URL"
    | "GOOGLE_MAPS_API_KEY"
    | "GOOGLE_PLACES_API_KEY"
    | "DOMARA_ENABLE_LIVE_LOCATION_MEDIA",
    string | undefined
  >
>;

function resolveEnv(env?: LocationMediaEnv): LocationMediaEnv {
  return env || (process.env as unknown as LocationMediaEnv);
}

function stableHash(seed: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return hash >>> 0;
}

function stableId(prefix: string, seed: string): string {
  return `${prefix}-${stableHash(seed).toString(16).slice(0, 10)}`;
}

function toMarker(lng: number, lat: number, color = "2563EB"): string {
  return `pin-s+${color}(${lng.toFixed(5)},${lat.toFixed(5)})`;
}

function resolveMapboxStylePath(env: LocationMediaEnv): string {
  const styleId = (env.MAPBOX_STYLE_ID || "").trim();
  if (styleId) return styleId;

  const styleUrl = (env.MAPBOX_STYLE_URL || "").trim();
  if (styleUrl.startsWith("mapbox://styles/")) {
    return styleUrl.replace("mapbox://styles/", "");
  }
  return "mapbox/streets-v12";
}

function buildMapboxPathOverlay(points: Array<{ latitude: number; longitude: number }>): string | null {
  if (points.length < 2) return null;
  const serialized = points.map((point) => `${point.longitude.toFixed(5)},${point.latitude.toFixed(5)}`).join(";");
  return `path-4+0ea5e9-0.7(${serialized})`;
}

export function buildMapboxStaticMapUrl(input: {
  latitude: number;
  longitude: number;
  zoom: number;
  width: number;
  height: number;
  stylePath: string;
  token: string;
  markers?: Array<{ latitude: number; longitude: number; color?: string }>;
  pathOverlay?: Array<{ latitude: number; longitude: number }>;
}): string {
  const overlays: string[] = [];
  if (input.markers?.length) {
    overlays.push(...input.markers.map((marker) => toMarker(marker.longitude, marker.latitude, marker.color || "2563EB")));
  }

  const pathOverlay = input.pathOverlay ? buildMapboxPathOverlay(input.pathOverlay) : null;
  if (pathOverlay) overlays.push(pathOverlay);

  const center = `${input.longitude.toFixed(5)},${input.latitude.toFixed(5)},${input.zoom}`;
  const overlaySegment = overlays.length ? `${encodeURIComponent(overlays.join(","))}/` : "";

  return `https://api.mapbox.com/styles/v1/${input.stylePath}/static/${overlaySegment}${center}/${input.width}x${input.height}?access_token=${encodeURIComponent(input.token)}`;
}

function resolveProviderStatus(env: LocationMediaEnv): {
  status: LocationMediaProviderStatus;
  liveEnabled: boolean;
  mapboxToken: string;
  googlePlacesKey: string;
} {
  const liveEnabled = (env.DOMARA_ENABLE_LIVE_LOCATION_MEDIA || "").trim().toLowerCase() === "true";
  const mapboxToken = (env.MAPBOX_ACCESS_TOKEN || "").trim();
  const googlePlacesKey = ((env.GOOGLE_PLACES_API_KEY || "").trim() || (env.GOOGLE_MAPS_API_KEY || "").trim()) as string;

  if (!liveEnabled) {
    return {
      status: "mock",
      liveEnabled,
      mapboxToken,
      googlePlacesKey,
    };
  }

  if (!mapboxToken || !googlePlacesKey) {
    return {
      status: "missing_credentials",
      liveEnabled,
      mapboxToken,
      googlePlacesKey,
    };
  }

  return {
    status: "live",
    liveEnabled,
    mapboxToken,
    googlePlacesKey,
  };
}

function defaultAttribution(): LocationMediaAttribution[] {
  return [
    {
      provider: "mapbox",
      sourceLabel: "Mapbox Static Images API",
      sourceUrl: "https://docs.mapbox.com/api/maps/static-images/",
      required: true,
      note: "Map scenes are generated as URL assets only in this lane.",
    },
    {
      provider: "google_places",
      sourceLabel: "Google Places API (New)",
      sourceUrl: "https://developers.google.com/maps/documentation/places/web-service",
      required: true,
      note: "POI photo candidates are metadata/placeholders unless live mode is explicitly enabled.",
    },
  ];
}

function placeholderAssetUrl(request: LocationMediaRequest, kind: MapSceneKind): string {
  const seed = `${request.candidateId}-${request.latitude.toFixed(4)}-${request.longitude.toFixed(4)}-${kind}`;
  return `https://maps.example.com/location-media/${kind}-${stableHash(seed).toString(16).slice(0, 10)}.png`;
}

function firstPoi(request: LocationMediaRequest): EnrichedPoi | null {
  return request.pois.length ? request.pois[0]! : null;
}

export function createMapboxStaticMapAsset(input: {
  id: string;
  kind: MapSceneKind;
  label: string;
  request: LocationMediaRequest;
  providerStatus: LocationMediaProviderStatus;
  env?: LocationMediaEnv;
  zoom: number;
  width?: number;
  height?: number;
  includePoiMarkers?: boolean;
  includeRoutePath?: boolean;
}): LocationMediaAsset {
  const env = resolveEnv(input.env);
  const width = input.width ?? 1280;
  const height = input.height ?? 720;
  const providerStatus = input.providerStatus;
  const markers = [
    { latitude: input.request.latitude, longitude: input.request.longitude, color: "2563EB" },
    ...(input.includePoiMarkers
      ? input.request.pois.slice(0, 3).map((poi, index) => ({
          latitude: input.request.latitude + 0.004 * (index + 1),
          longitude: input.request.longitude + 0.004 * (index + 1),
          color: "0ea5e9",
        }))
      : []),
  ];

  const routeTarget = firstPoi(input.request);
  const pathOverlay =
    input.includeRoutePath && routeTarget
      ? [
          { latitude: input.request.latitude, longitude: input.request.longitude },
          {
            latitude: input.request.latitude + Math.min(0.02, routeTarget.distanceKm / 400),
            longitude: input.request.longitude + Math.min(0.02, routeTarget.distanceKm / 450),
          },
        ]
      : undefined;

  const stylePath = resolveMapboxStylePath(env);
  const token = (env.MAPBOX_ACCESS_TOKEN || "").trim();

  if (providerStatus === "live" && token) {
    return {
      id: input.id,
      kind: input.kind,
      label: input.label,
      sourceProvider: "mapbox_static_images",
      url: buildMapboxStaticMapUrl({
        latitude: input.request.latitude,
        longitude: input.request.longitude,
        zoom: input.zoom,
        width,
        height,
        stylePath,
        token,
        markers,
        pathOverlay,
      }),
      width,
      height,
      attribution: defaultAttribution(),
      confidence: input.request.locationConfidence,
      status: "ready",
      metadata: {
        providerStatus,
        resolvedAddress: input.request.resolvedAddress,
      },
    };
  }

  const status = providerStatus === "missing_credentials" ? "fallback" : providerStatus === "mock" ? "placeholder" : "fallback";
  return {
    id: input.id,
    kind: input.kind,
    label: input.label,
    sourceProvider: "mapbox_static_images",
    placeholderUrl: placeholderAssetUrl(input.request, input.kind),
    width,
    height,
    attribution: defaultAttribution(),
    confidence: "placeholder",
    status,
    usageNote:
      providerStatus === "missing_credentials"
        ? "Live location media is enabled but credentials are missing. Placeholder scene emitted."
        : "Deterministic mock location media scene emitted.",
    metadata: {
      providerStatus,
      resolvedAddress: input.request.resolvedAddress,
    },
  };
}

function maybeBuildGooglePhotoUrl(photoName: string, apiKey: string): string {
  const encodedPhotoPath = photoName
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `https://places.googleapis.com/v1/${encodedPhotoPath}/media?maxHeightPx=720&maxWidthPx=1280&key=${encodeURIComponent(apiKey)}`;
}

export function createGooglePlacesPhotoCandidates(
  request: LocationMediaRequest,
  env?: LocationMediaEnv,
): PoiMediaCandidate[] {
  const resolvedEnv = resolveEnv(env);
  const { status, googlePlacesKey } = resolveProviderStatus(resolvedEnv);

  return request.pois.slice(0, 5).map((poi) => {
    const placeId = typeof poi.providerMetadata?.googlePlaceId === "string" ? poi.providerMetadata.googlePlaceId : undefined;
    const photoName = typeof poi.providerMetadata?.googlePhotoName === "string" ? poi.providerMetadata.googlePhotoName : undefined;
    const candidateId = stableId("poi-media", `${request.candidateId}-${poi.id}-${poi.name}`);
    const placeholderUrl = `https://images.example.com/location-media/poi-${stableHash(candidateId).toString(16).slice(0, 10)}.jpg`;
    const livePhotoUrl = photoName && status === "live" && googlePlacesKey ? maybeBuildGooglePhotoUrl(photoName, googlePlacesKey) : undefined;

    return {
      id: candidateId,
      poiId: poi.id,
      placeId,
      placeName: poi.name,
      displayName: poi.name,
      category: poi.category,
      photoName,
      photoUrl: livePhotoUrl,
      placeholderUrl,
      attribution: defaultAttribution(),
      confidence: livePhotoUrl ? poi.confidence : "placeholder",
      status: livePhotoUrl ? "ready" : status === "missing_credentials" ? "fallback" : "placeholder",
      metadata: {
        source: poi.source,
        providerStatus: status,
      },
    };
  });
}

export function createMockLocationMediaAssets(request: LocationMediaRequest): LocationMediaResult {
  const attribution = defaultAttribution();
  const mapAssets: LocationMediaAsset[] = [
    {
      id: stableId("loc-media", `${request.candidateId}-regional_orientation`),
      kind: "regional_orientation",
      label: "Regional orientation map",
      sourceProvider: "mock_location_media",
      placeholderUrl: placeholderAssetUrl(request, "regional_orientation"),
      width: 1280,
      height: 720,
      attribution,
      confidence: "placeholder",
      status: "placeholder",
      usageNote: "Deterministic mock regional map scene.",
    },
    {
      id: stableId("loc-media", `${request.candidateId}-local_poi`),
      kind: "local_poi",
      label: "Local POI map",
      sourceProvider: "mock_location_media",
      placeholderUrl: placeholderAssetUrl(request, "local_poi"),
      width: 1280,
      height: 720,
      attribution,
      confidence: "placeholder",
      status: "placeholder",
      usageNote: "Deterministic mock local POI scene.",
    },
    {
      id: stableId("loc-media", `${request.candidateId}-property_pin`),
      kind: "property_pin",
      label: "Property pin map",
      sourceProvider: "mock_location_media",
      placeholderUrl: placeholderAssetUrl(request, "property_pin"),
      width: 1280,
      height: 720,
      attribution,
      confidence: "placeholder",
      status: "placeholder",
      usageNote: "Deterministic mock property-pin scene.",
    },
    {
      id: stableId("loc-media", `${request.candidateId}-route_context`),
      kind: "route_context",
      label: "Route context placeholder",
      sourceProvider: "mock_location_media",
      placeholderUrl: placeholderAssetUrl(request, "route_context"),
      width: 1280,
      height: 720,
      attribution,
      confidence: "placeholder",
      status: "fallback",
      usageNote: "Route scene is placeholder until route calculation is enabled.",
    },
    {
      id: stableId("loc-media", `${request.candidateId}-distance_context`),
      kind: "distance_context",
      label: "Distance context placeholder",
      sourceProvider: "mock_location_media",
      placeholderUrl: placeholderAssetUrl(request, "distance_context"),
      width: 1280,
      height: 720,
      attribution,
      confidence: "placeholder",
      status: "fallback",
      usageNote: "Distance-context scene is placeholder metadata only in this lane.",
    },
  ];

  const poiMediaCandidates = createGooglePlacesPhotoCandidates(request, {});
  const poiAssets: LocationMediaAsset[] = poiMediaCandidates.map((candidate) => ({
    id: candidate.id,
    kind: "poi_photo",
    label: `POI photo candidate: ${candidate.displayName}`,
    sourceProvider: "google_places_photo_seam",
    url: candidate.photoUrl,
    placeholderUrl: candidate.placeholderUrl,
    width: 1280,
    height: 720,
    attribution: candidate.attribution,
    confidence: candidate.confidence,
    status: candidate.status,
    metadata: {
      poiId: candidate.poiId,
      category: candidate.category,
    },
  }));

  return {
    provider: "mock_location_media",
    providerStatus: "mock",
    mapSceneKinds: mapAssets.map((asset) => asset.kind).filter((kind): kind is MapSceneKind => kind !== "poi_photo"),
    assets: [...mapAssets, ...poiAssets],
    poiMediaCandidates,
    attribution,
    sourceNotes: [
      "Deterministic mock/fallback output enabled by default.",
      "Live provider usage requires DOMARA_ENABLE_LIVE_LOCATION_MEDIA=true and server-side credentials.",
    ],
  };
}

export function createLocationMediaRequest(input: {
  candidateId: string;
  title: string;
  resolvedAddress: string;
  latitude: number;
  longitude: number;
  locationConfidence: "high" | "medium" | "low";
  pois: EnrichedPoi[];
}): LocationMediaRequest {
  return {
    candidateId: input.candidateId,
    title: input.title,
    resolvedAddress: input.resolvedAddress,
    latitude: input.latitude,
    longitude: input.longitude,
    locationConfidence: input.locationConfidence,
    pois: input.pois,
  };
}

export function generateLocationMediaAssets(
  request: LocationMediaRequest,
  env?: LocationMediaEnv,
): LocationMediaResult {
  const resolvedEnv = resolveEnv(env);
  const { status } = resolveProviderStatus(resolvedEnv);

  if (status === "mock") {
    return createMockLocationMediaAssets(request);
  }

  const attribution = defaultAttribution();
  const providerStatus: LocationMediaProviderStatus = status;
  const mapAssets: LocationMediaAsset[] = [
    createMapboxStaticMapAsset({
      id: stableId("loc-media", `${request.candidateId}-regional_orientation`),
      kind: "regional_orientation",
      label: "Regional orientation map",
      request,
      providerStatus,
      env: resolvedEnv,
      zoom: 7,
      includePoiMarkers: false,
    }),
    createMapboxStaticMapAsset({
      id: stableId("loc-media", `${request.candidateId}-local_poi`),
      kind: "local_poi",
      label: "Local POI map",
      request,
      providerStatus,
      env: resolvedEnv,
      zoom: 12,
      includePoiMarkers: true,
    }),
    createMapboxStaticMapAsset({
      id: stableId("loc-media", `${request.candidateId}-property_pin`),
      kind: "property_pin",
      label: "Property pin map",
      request,
      providerStatus,
      env: resolvedEnv,
      zoom: 14,
      includePoiMarkers: false,
    }),
    createMapboxStaticMapAsset({
      id: stableId("loc-media", `${request.candidateId}-route_context`),
      kind: "route_context",
      label: "Route context map",
      request,
      providerStatus,
      env: resolvedEnv,
      zoom: 11,
      includePoiMarkers: true,
      includeRoutePath: true,
    }),
    createMapboxStaticMapAsset({
      id: stableId("loc-media", `${request.candidateId}-distance_context`),
      kind: "distance_context",
      label: "Distance context map",
      request,
      providerStatus,
      env: resolvedEnv,
      zoom: 10,
      includePoiMarkers: true,
    }),
  ];

  const poiMediaCandidates = createGooglePlacesPhotoCandidates(request, resolvedEnv);
  const poiAssets: LocationMediaAsset[] = poiMediaCandidates.map((candidate) => ({
    id: candidate.id,
    kind: "poi_photo",
    label: `POI photo candidate: ${candidate.displayName}`,
    sourceProvider: "google_places_photo_seam",
    url: candidate.photoUrl,
    placeholderUrl: candidate.placeholderUrl,
    width: 1280,
    height: 720,
    attribution: candidate.attribution,
    confidence: candidate.confidence,
    status: candidate.status,
    metadata: {
      poiId: candidate.poiId,
      category: candidate.category,
      placeId: candidate.placeId,
      photoName: candidate.photoName,
    },
  }));

  return {
    provider: "mapbox_google_places_location_media",
    providerStatus,
    mapSceneKinds: mapAssets.map((asset) => asset.kind).filter((kind): kind is MapSceneKind => kind !== "poi_photo"),
    assets: [...mapAssets, ...poiAssets],
    poiMediaCandidates,
    attribution,
    sourceNotes:
      providerStatus === "live"
        ? [
            "Live URL asset generation is enabled server-side.",
            "This lane emits URL metadata and placeholders; it does not fetch media during tests.",
          ]
        : [
            "Live location media is enabled but required credentials are missing.",
            "Fallback placeholders are emitted to preserve deterministic workflow behavior.",
          ],
  };
}

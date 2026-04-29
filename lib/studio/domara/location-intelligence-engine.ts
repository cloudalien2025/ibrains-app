import { nowIso, stableCasaHudId } from "@/lib/studio/domara/ai-channel-engine/ids";
import {
  type CasaHudListingLocationInsight,
  type CasaHudLocationData,
  type CasaHudLocationProvider,
  type CasaHudLocationProviderStatus,
  type CasaHudLocationSourceConfidence,
  type CasaHudMapSceneIdea,
  type CasaHudPoi,
  createEmptyCasaHudLocationData,
} from "@/lib/studio/domara/campaign-location-intelligence";
import type { CasaHudCampaign, CasaHudValidatedListing } from "@/lib/studio/domara/campaigns";

type FetchLike = typeof fetch;

type Coordinates = {
  latitude: number;
  longitude: number;
};

type LocationSignals = {
  coastal: boolean;
  waterfront: boolean;
  historic: boolean;
  relocation: boolean;
  retirement: boolean;
  school: boolean;
  airport: boolean;
  transit: boolean;
  restaurant: boolean;
  golf: boolean;
  ski: boolean;
  luxury: boolean;
};

type ResolvedLocationContext = {
  locationText: string;
  coordinates?: Coordinates;
  city?: string;
  region?: string;
  country?: string;
  provider: CasaHudLocationProvider;
  confidence: CasaHudLocationSourceConfidence;
  warning?: string;
};

type ListingLocationContext = {
  listing: CasaHudValidatedListing;
  resolvedLocation: ResolvedLocationContext;
  poiCards: CasaHudPoi[];
  signals: LocationSignals;
  highlights: string[];
  locationStrengths: string[];
  warnings: string[];
};

type ProviderMetrics = {
  configured: boolean;
  used: boolean;
  successCount: number;
  errorCount: number;
  skippedCount: number;
};

type CasaHudLocationIntelligenceOptions = {
  googlePlacesApiKey?: string | null;
  mapboxAccessToken?: string | null;
  fetchImpl?: FetchLike;
  providerTimeoutMs?: {
    googlePlaces?: number;
    mapbox?: number;
  };
  generatedAt?: string;
};

type MapboxGeocodingResponse = {
  features?: Array<{
    place_name?: string;
    center?: [number, number];
    context?: Array<{
      id?: string;
      text?: string;
      short_code?: string;
    }>;
  }>;
};

type GoogleNearbyResponse = {
  results?: Array<{
    place_id?: string;
    name?: string;
    vicinity?: string;
    geometry?: {
      location?: {
        lat?: number;
        lng?: number;
      };
    };
    types?: string[];
  }>;
  status?: string;
  error_message?: string;
};

type MapboxFeature = NonNullable<MapboxGeocodingResponse["features"]>[number];

const DEFAULT_MAPBOX_TIMEOUT_MS = 2_000;
const DEFAULT_GOOGLE_TIMEOUT_MS = 2_500;
const MAX_POIS_PER_LISTING = 4;

function uniqueStrings(values: Array<string | undefined>): string[] {
  return Array.from(
    new Set(
      values
        .flatMap((value) => (typeof value === "string" ? [value.trim()] : []))
        .filter((value) => value.length > 0),
    ),
  );
}

function normalizeText(value: string | undefined): string {
  return (value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function joinNatural(values: string[]): string {
  if (values.length === 0) return "";
  if (values.length === 1) return values[0]!;
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(", ")}, and ${values[values.length - 1]}`;
}

function formatDistanceText(distanceKm: number): string {
  if (!Number.isFinite(distanceKm) || distanceKm <= 0) return "Nearby";
  if (distanceKm < 1) return `${Math.max(100, Math.round(distanceKm * 1000 / 100) * 100)} m away`;
  if (distanceKm < 10) return `${distanceKm.toFixed(1)} km away`;
  return `${Math.round(distanceKm)} km away`;
}

function haversineDistanceKm(from: Coordinates, to: Coordinates): number {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const earthRadiusKm = 6_371;
  const deltaLat = toRadians(to.latitude - from.latitude);
  const deltaLon = toRadians(to.longitude - from.longitude);
  const lat1 = toRadians(from.latitude);
  const lat2 = toRadians(to.latitude);

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

function orderedApprovedListings(campaign: CasaHudCampaign): CasaHudValidatedListing[] {
  const rankMap = new Map(campaign.listingRankOrder.map((id, index) => [id, index]));
  return [...campaign.approvedListings].sort((left, right) => {
    const leftRank = rankMap.get(left.id) ?? left.rank ?? Number.MAX_SAFE_INTEGER;
    const rightRank = rankMap.get(right.id) ?? right.rank ?? Number.MAX_SAFE_INTEGER;
    if (leftRank !== rightRank) return leftRank - rightRank;
    return right.overallScore - left.overallScore;
  });
}

function deriveSignals(campaign: CasaHudCampaign, listing: CasaHudValidatedListing): LocationSignals {
  const corpus = normalizeText(
    [
      campaign.selectedViralTitle,
      campaign.researchBrief.summary,
      campaign.marketRegionHint,
      campaign.preferredMarket,
      listing.title,
      listing.locationText,
      listing.descriptionSnippet,
      listing.preliminaryMatchNotes,
      ...listing.features,
    ].join(" "),
  );

  return {
    coastal: /beach|coast|coastal|seaside|sea view|ocean|shore/.test(corpus),
    waterfront: /waterfront|lake|lakeside|marina|harbor|harbour|sea view/.test(corpus),
    historic: /historic|old town|piazza|village|heritage|center|centre/.test(corpus),
    relocation: /relocat|move to|live in|expat/.test(corpus),
    retirement: /retire|retirement/.test(corpus),
    school: /family|school|international school/.test(corpus),
    airport: /airport|flight|international/.test(corpus),
    transit: /train|rail|station|commute|access/.test(corpus) || /retire|relocat/.test(corpus),
    restaurant: /food|restaurant|dining|lifestyle|walkable|piazza/.test(corpus) || true,
    golf: /golf/.test(corpus),
    ski: /ski|alpine|mountain/.test(corpus),
    luxury: /luxury|villa|premium|stunning/.test(corpus),
  };
}

function categoryLabel(category: string): string {
  switch (category) {
    case "beach":
      return "Beach";
    case "marina":
      return "Marina";
    case "airport":
      return "Airport";
    case "train_station":
      return "Train Station";
    case "school":
      return "School";
    case "restaurant":
      return "Restaurant";
    case "landmark":
      return "Landmark";
    case "golf":
      return "Golf";
    case "ski_area":
      return "Ski Area";
    case "historic_center":
      return "Historic Center";
    case "waterfront":
      return "Waterfront";
    default:
      return category
        .replace(/_/g, " ")
        .replace(/\b\w/g, (character) => character.toUpperCase());
  }
}

function buildFallbackPoiCategories(signals: LocationSignals): string[] {
  const categories: string[] = [];
  if (signals.coastal) categories.push("beach");
  if (signals.waterfront) categories.push("marina", "waterfront");
  if (signals.historic) categories.push("historic_center", "landmark");
  if (signals.golf) categories.push("golf");
  if (signals.ski) categories.push("ski_area");
  if (signals.airport || signals.relocation || signals.retirement) categories.push("airport");
  if (signals.transit) categories.push("train_station");
  if (signals.school || signals.relocation) categories.push("school");
  if (signals.restaurant) categories.push("restaurant");
  if (categories.length === 0) categories.push("landmark", "restaurant", "train_station");
  return Array.from(new Set(categories)).slice(0, 4);
}

function buildFallbackPois(listing: CasaHudValidatedListing, locationText: string, signals: LocationSignals): CasaHudPoi[] {
  return buildFallbackPoiCategories(signals).map((category) => {
    let name = `${categoryLabel(category)} context`;
    let reason = `Supports the campaign's place story around ${locationText}.`;

    if (category === "beach") {
      name = "Coastal access context";
      reason = "Helps the shortlist read as a day-to-day coastal lifestyle story instead of a price-only claim.";
    } else if (category === "marina" || category === "waterfront") {
      name = "Waterfront lifestyle context";
      reason = "Gives the location story a clear waterside anchor for map-led scenes and lifestyle beats.";
    } else if (category === "airport") {
      name = "Regional airport connection";
      reason = "Supports travel convenience, weekend access, and relocation framing without inventing a live route claim.";
    } else if (category === "train_station") {
      name = "Rail access context";
      reason = "Adds grounded mobility context for arrivals, day trips, and regional reach.";
    } else if (category === "school") {
      name = "School corridor context";
      reason = "Supports family or expat-readiness framing where education access matters to the move.";
    } else if (category === "restaurant") {
      name = "Dining and piazza context";
      reason = "Adds everyday neighborhood texture that helps the property feel lived in, not isolated.";
    } else if (category === "historic_center" || category === "landmark") {
      name = "Historic core context";
      reason = "Adds character, walkable texture, and regional identity to the shortlist story.";
    } else if (category === "golf") {
      name = "Golf access context";
      reason = "Strengthens leisure-led positioning for premium or lifestyle-driven buyers.";
    } else if (category === "ski_area") {
      name = "Ski area context";
      reason = "Adds seasonal lifestyle value and altitude-based scenery to the location story.";
    }

    return {
      id: stableCasaHudId("casahud-poi", `${listing.id}:${category}:${locationText}`),
      name,
      category: categoryLabel(category),
      locationText,
      associatedListingId: listing.id,
      relevanceReason: reason,
      provider: "casahud_location_patterns",
      sourceConfidence: "fallback",
    };
  });
}

function buildLocationHighlights(
  listing: CasaHudValidatedListing,
  signals: LocationSignals,
  poiCards: CasaHudPoi[],
  locationText: string,
): string[] {
  const highlights = uniqueStrings([
    signals.coastal ? "Coastal day-to-day context helps the property feel like a lifestyle move, not just a budget win." : undefined,
    signals.historic ? "Historic texture gives the location story editorial depth for map and walking scenes." : undefined,
    signals.retirement || signals.relocation
      ? "Arrival and everyday-convenience framing supports the relocation promise in the title."
      : undefined,
    poiCards[0] ? `${poiCards[0].name} adds a clear local proof point around ${locationText}.` : undefined,
    listing.preliminaryMatchNotes,
  ]);

  return highlights.slice(0, 3);
}

function buildLocationStrengths(signals: LocationSignals, poiCards: CasaHudPoi[]): string[] {
  return uniqueStrings([
    signals.coastal || signals.waterfront ? "Waterside lifestyle context" : undefined,
    signals.historic ? "Distinctive regional character" : undefined,
    signals.retirement || signals.relocation ? "Travel-friendly arrival story" : undefined,
    signals.school ? "Everyday livability for longer stays" : undefined,
    signals.golf ? "Leisure-led premium appeal" : undefined,
    signals.ski ? "Mountain and seasonal lifestyle value" : undefined,
    poiCards[0] ? `Nearby ${poiCards[0].category.toLowerCase()} context` : undefined,
  ]).slice(0, 4);
}

function googleTypePlan(signals: LocationSignals): Array<{ type: string; category: string }> {
  const plan: Array<{ type: string; category: string }> = [{ type: "tourist_attraction", category: signals.historic ? "historic_center" : "landmark" }];

  if (signals.coastal || signals.waterfront) {
    plan.push({ type: "marina", category: signals.waterfront ? "waterfront" : "marina" });
  } else if (signals.golf) {
    plan.push({ type: "golf_course", category: "golf" });
  } else if (signals.ski) {
    plan.push({ type: "ski_resort", category: "ski_area" });
  } else {
    plan.push({ type: "restaurant", category: "restaurant" });
  }

  if (signals.airport || signals.relocation || signals.retirement) {
    plan.push({ type: "airport", category: "airport" });
  } else if (signals.transit) {
    plan.push({ type: "train_station", category: "train_station" });
  }

  return Array.from(new Map(plan.map((item) => [item.type, item])).values()).slice(0, 3);
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, onTimeout?: () => void): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      onTimeout?.();
      reject(new Error(`timeout after ${timeoutMs}ms`));
    }, timeoutMs);

    promise.then(
      (value) => {
        clearTimeout(timeoutId);
        resolve(value);
      },
      (error) => {
        clearTimeout(timeoutId);
        reject(error);
      },
    );
  });
}

async function fetchJsonWithTimeout<T>(
  input: string,
  init: RequestInit,
  fetchImpl: FetchLike,
  timeoutMs: number,
): Promise<T> {
  const controller = new AbortController();
  const response = await withTimeout(
    fetchImpl(input, {
      ...init,
      signal: controller.signal,
    }),
    timeoutMs,
    () => controller.abort(),
  );

  if (!response.ok) {
    throw new Error(`request failed with ${response.status}`);
  }

  return (await response.json()) as T;
}

function mapboxContextValue(feature: MapboxFeature | undefined, prefix: string): string | undefined {
  return feature?.context?.find((item) => typeof item.id === "string" && item.id.startsWith(prefix))?.text?.trim() || undefined;
}

async function resolveMapContext(
  listing: CasaHudValidatedListing,
  mapboxAccessToken: string | null,
  fetchImpl: FetchLike,
  timeoutMs: number,
  metrics: ProviderMetrics,
): Promise<ResolvedLocationContext> {
  if (listing.coordinates) {
    metrics.skippedCount += 1;
    return {
      locationText: listing.locationText,
      coordinates: listing.coordinates,
      city: listing.city,
      region: listing.region,
      country: listing.country,
      provider: "casahud_location_patterns",
      confidence: "medium",
    };
  }

  if (!mapboxAccessToken) {
    metrics.skippedCount += 1;
    return {
      locationText: listing.locationText,
      city: listing.city,
      region: listing.region,
      country: listing.country,
      provider: "casahud_location_patterns",
      confidence: "fallback",
      warning: "Using listing location text until Mapbox is connected for live anchoring.",
    };
  }

  const query = uniqueStrings([listing.locationText, listing.city, listing.region, listing.country]).join(", ");
  if (!query) {
    metrics.skippedCount += 1;
    return {
      locationText: listing.locationText,
      provider: "casahud_location_patterns",
      confidence: "fallback",
      warning: "Listing location fields were too thin for live geocoding.",
    };
  }

  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?limit=1&language=en&access_token=${encodeURIComponent(mapboxAccessToken)}`;

  try {
    const payload = await fetchJsonWithTimeout<MapboxGeocodingResponse>(url, { method: "GET" }, fetchImpl, timeoutMs);
    const feature = payload.features?.[0];
    const center = feature?.center;
    if (!Array.isArray(center) || center.length < 2 || !Number.isFinite(center[0]) || !Number.isFinite(center[1])) {
      metrics.errorCount += 1;
      return {
        locationText: listing.locationText,
        city: listing.city,
        region: listing.region,
        country: listing.country,
        provider: "casahud_location_patterns",
        confidence: "fallback",
        warning: "Mapbox returned limited anchoring, so CasaHUD stayed with listing location text.",
      };
    }

    metrics.used = true;
    metrics.successCount += 1;
    return {
      locationText: feature?.place_name?.trim() || listing.locationText,
      coordinates: {
        latitude: center[1],
        longitude: center[0],
      },
      city: mapboxContextValue(feature, "place") || mapboxContextValue(feature, "locality") || listing.city,
      region: mapboxContextValue(feature, "region") || listing.region,
      country: mapboxContextValue(feature, "country") || listing.country,
      provider: "mapbox",
      confidence: "high",
    };
  } catch (error) {
    metrics.used = true;
    metrics.errorCount += 1;
    return {
      locationText: listing.locationText,
      city: listing.city,
      region: listing.region,
      country: listing.country,
      provider: "casahud_location_patterns",
      confidence: "fallback",
      warning:
        error instanceof Error && error.message.includes("timeout")
          ? "Map context timed out, so CasaHUD used the saved listing location."
          : "Map context was unavailable, so CasaHUD used the saved listing location.",
    };
  }
}

function dedupePois(pois: CasaHudPoi[]): CasaHudPoi[] {
  const seen = new Set<string>();
  const result: CasaHudPoi[] = [];
  for (const poi of pois) {
    const key = normalizeText(`${poi.name}:${poi.category}:${poi.locationText}`);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(poi);
  }
  return result;
}

async function fetchGooglePois(
  listing: CasaHudValidatedListing,
  resolvedLocation: ResolvedLocationContext,
  signals: LocationSignals,
  googlePlacesApiKey: string | null,
  fetchImpl: FetchLike,
  timeoutMs: number,
  metrics: ProviderMetrics,
): Promise<CasaHudPoi[]> {
  if (!googlePlacesApiKey || !resolvedLocation.coordinates) {
    metrics.skippedCount += 1;
    return [];
  }

  const plan = googleTypePlan(signals);
  const origin = resolvedLocation.coordinates;

  const responses = await Promise.all(
    plan.map(async (item) => {
      const url =
        `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${encodeURIComponent(`${origin.latitude},${origin.longitude}`)}` +
        `&radius=6000&type=${encodeURIComponent(item.type)}&key=${encodeURIComponent(googlePlacesApiKey)}`;

      try {
        const payload = await fetchJsonWithTimeout<GoogleNearbyResponse>(url, { method: "GET" }, fetchImpl, timeoutMs);
        if (payload.status && payload.status !== "OK" && payload.status !== "ZERO_RESULTS") {
          throw new Error(payload.error_message || payload.status);
        }

        metrics.used = true;
        if (payload.status === "OK") {
          metrics.successCount += 1;
        } else {
          metrics.skippedCount += 1;
        }

        return (payload.results || []).slice(0, 2).flatMap((place) => {
          const latitude = place.geometry?.location?.lat;
          const longitude = place.geometry?.location?.lng;
          const coordinates =
            typeof latitude === "number" && typeof longitude === "number"
              ? {
                  latitude,
                  longitude,
                }
              : undefined;

          return [
            {
              id: stableCasaHudId("casahud-poi", `${listing.id}:${item.type}:${place.place_id || place.name || place.vicinity || resolvedLocation.locationText}`),
              name: place.name?.trim() || categoryLabel(item.category),
              category: categoryLabel(item.category),
              locationText: place.vicinity?.trim() || resolvedLocation.locationText,
              associatedListingId: listing.id,
              distanceText: coordinates ? formatDistanceText(haversineDistanceKm(origin, coordinates)) : undefined,
              relevanceReason: `Live Google Places context for ${listing.title} near ${resolvedLocation.locationText}.`,
              provider: "google_places" as const,
              sourceConfidence: "high" as const,
              coordinates,
            },
          ];
        });
      } catch {
        metrics.used = true;
        metrics.errorCount += 1;
        return [];
      }
    }),
  );

  return dedupePois(responses.flat()).slice(0, MAX_POIS_PER_LISTING);
}

function primaryLocationLabel(context: ListingLocationContext): string {
  return context.resolvedLocation.city || context.listing.city || context.resolvedLocation.locationText;
}

function buildListingInsight(context: ListingLocationContext): CasaHudListingLocationInsight {
  return {
    listingId: context.listing.id,
    summary: `${context.listing.title} plays best as a ${joinNatural(context.locationStrengths.slice(0, 2)).toLowerCase()} story around ${context.resolvedLocation.locationText}.`,
    highlights: context.highlights,
    nearbyPois: context.poiCards.slice(0, 3),
    locationStrengths: context.locationStrengths,
    warnings: context.warnings,
  };
}

function buildMapSceneIdeas(contexts: ListingLocationContext[]): CasaHudMapSceneIdea[] {
  const ideas: CasaHudMapSceneIdea[] = [];
  const top = contexts[0];

  if (top) {
    ideas.push({
      id: stableCasaHudId("casahud-map-scene", `${top.listing.id}:regional_anchor`),
      title: `Open on ${primaryLocationLabel(top)}`,
      sceneType: "regional_anchor",
      description: `Start with the region around ${top.resolvedLocation.locationText} to establish the place before the property details arrive.`,
      locationText: top.resolvedLocation.locationText,
      suggestedVisual: "Wide regional map pull-back with the strongest listing location highlighted first.",
      provider: top.resolvedLocation.provider,
      confidence: top.resolvedLocation.confidence,
    });
  }

  for (const context of contexts.slice(0, 3)) {
    ideas.push({
      id: stableCasaHudId("casahud-map-scene", `${context.listing.id}:listing_orbit`),
      title: `${primaryLocationLabel(context)} lifestyle orbit`,
      sceneType: "listing_orbit",
      description: `Move from the property pin into nearby lifestyle anchors so the listing feels rooted in a real place.`,
      associatedListingId: context.listing.id,
      locationText: context.resolvedLocation.locationText,
      suggestedVisual: `Map pin on ${context.listing.title} with orbiting callouts for ${joinNatural(context.poiCards.slice(0, 2).map((poi) => poi.category.toLowerCase())) || "local context"}.`,
      provider: context.resolvedLocation.provider,
      confidence: context.resolvedLocation.confidence,
    });
  }

  const accessContext = contexts.find((context) =>
    context.poiCards.some((poi) => poi.category === "Airport" || poi.category === "Train Station"),
  );
  if (accessContext) {
    ideas.push({
      id: stableCasaHudId("casahud-map-scene", `${accessContext.listing.id}:travel_context`),
      title: "Arrival and access beat",
      sceneType: "travel_context",
      description: "Use a quick access scene to show how the area connects for arrivals, weekend trips, or relocation logistics.",
      associatedListingId: accessContext.listing.id,
      locationText: accessContext.resolvedLocation.locationText,
      suggestedVisual: "Animated route line from the nearest travel anchor into the listing area.",
      provider: accessContext.resolvedLocation.provider,
      confidence: accessContext.resolvedLocation.confidence,
    });
  }

  const poiContext = contexts.find((context) => context.poiCards.length > 0);
  if (poiContext) {
    ideas.push({
      id: stableCasaHudId("casahud-map-scene", `${poiContext.listing.id}:poi_highlight`),
      title: "Neighborhood proof points",
      sceneType: "poi_highlight",
      description: "Use POI callouts as short proof points instead of turning the video into a travel guide.",
      associatedListingId: poiContext.listing.id,
      locationText: poiContext.resolvedLocation.locationText,
      suggestedVisual: `Fast POI callouts for ${joinNatural(poiContext.poiCards.slice(0, 3).map((poi) => poi.name))}.`,
      provider: poiContext.poiCards[0]?.provider || poiContext.resolvedLocation.provider,
      confidence: poiContext.poiCards[0]?.sourceConfidence || poiContext.resolvedLocation.confidence,
    });
  }

  return ideas;
}

function buildLocalHighlights(contexts: ListingLocationContext[]): CasaHudLocationData["localHighlights"] {
  const top = contexts[0];
  if (!top) return [];

  const allLocations = uniqueStrings(contexts.map((context) => primaryLocationLabel(context)));
  const allPoiCategories = uniqueStrings(contexts.flatMap((context) => context.poiCards.map((poi) => poi.category)));
  const fallbackUsed = contexts.some((context) => context.poiCards.some((poi) => poi.provider === "casahud_location_patterns"));

  return [
    {
      id: stableCasaHudId("casahud-highlight", `${top.listing.id}:regional_story`),
      title: "Regional anchor",
      description: `${joinNatural(allLocations.slice(0, 3))} gives the campaign a specific place identity instead of a generic property roundup.`,
      locationText: top.resolvedLocation.locationText,
      associatedListingId: top.listing.id,
      provider: top.resolvedLocation.provider,
      sourceConfidence: top.resolvedLocation.confidence,
    },
    {
      id: stableCasaHudId("casahud-highlight", `${top.listing.id}:lifestyle_story`),
      title: "Lifestyle proof",
      description: `Local context leans on ${joinNatural(allPoiCategories.slice(0, 3).map((category) => category.toLowerCase())) || "everyday neighborhood texture"} to support the story.`,
      locationText: top.resolvedLocation.locationText,
      associatedListingId: top.listing.id,
      provider: fallbackUsed ? "casahud_location_patterns" : top.poiCards[0]?.provider || top.resolvedLocation.provider,
      sourceConfidence: fallbackUsed ? "fallback" : top.poiCards[0]?.sourceConfidence || top.resolvedLocation.confidence,
    },
    {
      id: stableCasaHudId("casahud-highlight", `${top.listing.id}:arrival_story`),
      title: "Arrival and reach",
      description: "Travel convenience and regional reach are framed as supporting context for the property story, not as unsupported hard claims.",
      locationText: top.resolvedLocation.locationText,
      associatedListingId: top.listing.id,
      provider: fallbackUsed ? "casahud_location_patterns" : top.resolvedLocation.provider,
      sourceConfidence: fallbackUsed ? "fallback" : top.resolvedLocation.confidence,
    },
  ];
}

function buildLocationStory(contexts: ListingLocationContext[], warnings: string[], generatedAt: string): CasaHudLocationData["locationStory"] {
  const top = contexts[0];
  if (!top) return null;

  const regionHighlights = uniqueStrings(
    contexts.flatMap((context) => [
      context.resolvedLocation.city,
      context.resolvedLocation.region,
      context.listing.city,
      context.listing.region,
    ]),
  ).slice(0, 4);
  const lifestyleAnchors = uniqueStrings(
    contexts.flatMap((context) => [
      ...context.locationStrengths,
      ...context.poiCards.map((poi) => `${poi.category} context`),
    ]),
  ).slice(0, 5);

  return {
    headline: `${primaryLocationLabel(top)} turns the shortlist into a place-led story.`,
    summary: `CasaHUD positioned the approved properties around ${joinNatural(regionHighlights)} so the campaign reads as property plus place, with ${joinNatural(lifestyleAnchors.slice(0, 3)).toLowerCase()} carrying the lifestyle context.`,
    narrativeAngles: [
      "Open with the region before dropping into the strongest listing.",
      "Use local proof points as support for the property promise instead of generic travel filler.",
      "Keep the location context tightly tied to buyer relevance, convenience, and visual texture.",
    ],
    lifestyleAnchors,
    regionHighlights,
    fallbackNotice:
      warnings.length > 0
        ? `Using CasaHUD location patterns where live provider coverage was limited. Updated ${generatedAt}.`
        : undefined,
  };
}

function providerStatusLabel(provider: CasaHudLocationProvider): string {
  if (provider === "google_places") return "Google Places";
  if (provider === "mapbox") return "Mapbox";
  return "CasaHUD location patterns";
}

function buildProviderStatuses(
  contexts: ListingLocationContext[],
  googlePlacesApiKey: string | null,
  mapboxAccessToken: string | null,
  googleMetrics: ProviderMetrics,
  mapboxMetrics: ProviderMetrics,
): CasaHudLocationProviderStatus[] {
  const googleCoverage = contexts.filter((context) => context.poiCards.some((poi) => poi.provider === "google_places")).length;
  const fallbackCoverage = contexts.filter((context) => context.poiCards.some((poi) => poi.provider === "casahud_location_patterns")).length;
  const mapboxCoverage = contexts.filter((context) => context.resolvedLocation.provider === "mapbox").length;

  const statuses: CasaHudLocationProviderStatus[] = [
    {
      provider: "google_places",
      label: providerStatusLabel("google_places"),
      state: !googlePlacesApiKey
        ? "missing_credentials"
        : googleMetrics.errorCount > 0 && googleCoverage === 0
          ? "error"
          : "connected",
      configured: Boolean(googlePlacesApiKey),
      used: googleMetrics.used,
      detail: !googlePlacesApiKey
        ? "Using CasaHUD location patterns until Google Places is connected for live POIs."
        : googleCoverage > 0
          ? `Google Places returned live POI context for ${googleCoverage} approved ${googleCoverage === 1 ? "listing" : "listings"}.`
          : "Google Places was available, but live nearby places were limited for the saved shortlist.",
      warning:
        !googlePlacesApiKey
          ? "Connect Google Places for live points of interest and local highlights."
          : googleMetrics.errorCount > 0
            ? "Google Places timed out or failed on part of the shortlist, so CasaHUD leaned on fallback location patterns."
            : undefined,
      coverage: googleCoverage > 0 ? `${googleCoverage} live POI set${googleCoverage === 1 ? "" : "s"}` : "No live POIs",
    },
    {
      provider: "mapbox",
      label: providerStatusLabel("mapbox"),
      state: !mapboxAccessToken
        ? "missing_credentials"
        : mapboxMetrics.errorCount > 0 && mapboxCoverage === 0
          ? "error"
          : "connected",
      configured: Boolean(mapboxAccessToken),
      used: mapboxMetrics.used,
      detail: !mapboxAccessToken
        ? "Using listing coordinates and CasaHUD location patterns until Mapbox is connected for live map anchoring."
        : mapboxCoverage > 0
          ? `Mapbox anchored ${mapboxCoverage} approved ${mapboxCoverage === 1 ? "listing" : "listings"} for map context and scene ideas.`
          : "Existing listing coordinates were enough, so live Mapbox anchoring was not required on this run.",
      warning:
        !mapboxAccessToken
          ? "Connect Mapbox for live geocoding and richer map scene anchoring."
          : mapboxMetrics.errorCount > 0
            ? "Mapbox timed out or returned limited context for part of the shortlist."
            : undefined,
      coverage: mapboxCoverage > 0 ? `${mapboxCoverage} live map anchor${mapboxCoverage === 1 ? "" : "s"}` : "No live map anchoring",
    },
    {
      provider: "casahud_location_patterns",
      label: providerStatusLabel("casahud_location_patterns"),
      state: "fallback",
      configured: true,
      used: fallbackCoverage > 0 || !googlePlacesApiKey || !mapboxAccessToken,
      detail:
        fallbackCoverage > 0 || !googlePlacesApiKey || !mapboxAccessToken
          ? "Using CasaHUD location patterns until Google Places or Mapbox has full live coverage."
          : "Fallback location patterns remained on standby during this run.",
      warning:
        fallbackCoverage > 0 || !googlePlacesApiKey || !mapboxAccessToken
          ? "Connect location providers for live POIs and richer map context."
          : undefined,
      coverage: `${fallbackCoverage} fallback context set${fallbackCoverage === 1 ? "" : "s"}`,
    },
  ];

  return statuses;
}

function buildSummary(
  contexts: ListingLocationContext[],
  providerStatuses: CasaHudLocationProviderStatus[],
  warnings: string[],
  generatedAt: string,
): CasaHudLocationData["locationIntelligenceSummary"] {
  const locations = uniqueStrings(contexts.map((context) => primaryLocationLabel(context)));
  const fallbackUsed = providerStatuses.some((status) => status.provider === "casahud_location_patterns" && status.used);

  return {
    headline: `Location story prepared across ${locations.length} shortlist ${locations.length === 1 ? "anchor" : "anchors"}.`,
    providerSummary: providerStatuses.map((status) => status.detail).join(" "),
    coverageSummary: `CasaHUD connected ${joinNatural(locations.slice(0, 3))} to local proof points, regional lifestyle context, and map scene ideas.`,
    warningCount: warnings.length,
    generatedAt,
    fallbackUsed,
  };
}

export async function runCasaHudLocationIntelligence(
  campaign: CasaHudCampaign,
  options: CasaHudLocationIntelligenceOptions = {},
): Promise<CasaHudLocationData> {
  if (campaign.approvedListings.length === 0) {
    throw new Error("CasaHUD needs approved listings before it can build location intelligence.");
  }

  const approvedListings = orderedApprovedListings(campaign);
  const fetchImpl = options.fetchImpl ?? fetch;
  const googlePlacesApiKey = options.googlePlacesApiKey?.trim() || null;
  const mapboxAccessToken = options.mapboxAccessToken?.trim() || null;
  const generatedAt = options.generatedAt || nowIso();
  const googleTimeoutMs = options.providerTimeoutMs?.googlePlaces ?? DEFAULT_GOOGLE_TIMEOUT_MS;
  const mapboxTimeoutMs = options.providerTimeoutMs?.mapbox ?? DEFAULT_MAPBOX_TIMEOUT_MS;
  const googleMetrics: ProviderMetrics = {
    configured: Boolean(googlePlacesApiKey),
    used: false,
    successCount: 0,
    errorCount: 0,
    skippedCount: 0,
  };
  const mapboxMetrics: ProviderMetrics = {
    configured: Boolean(mapboxAccessToken),
    used: false,
    successCount: 0,
    errorCount: 0,
    skippedCount: 0,
  };

  const listingContexts = await Promise.all(
    approvedListings.map(async (listing) => {
      const signals = deriveSignals(campaign, listing);
      const resolvedLocation = await resolveMapContext(listing, mapboxAccessToken, fetchImpl, mapboxTimeoutMs, mapboxMetrics);
      const livePois = await fetchGooglePois(
        listing,
        resolvedLocation,
        signals,
        googlePlacesApiKey,
        fetchImpl,
        googleTimeoutMs,
        googleMetrics,
      );
      const fallbackPois = buildFallbackPois(listing, resolvedLocation.locationText, signals);
      const poiCards = livePois.length > 0 ? livePois : fallbackPois;
      const warnings = uniqueStrings([
        resolvedLocation.warning,
        !googlePlacesApiKey ? "Using CasaHUD location patterns until Google Places is connected." : undefined,
        googlePlacesApiKey && livePois.length === 0 ? "Live POIs were limited, so CasaHUD emphasized broader regional context." : undefined,
      ]);

      return {
        listing,
        resolvedLocation,
        poiCards,
        signals,
        highlights: buildLocationHighlights(listing, signals, poiCards, resolvedLocation.locationText),
        locationStrengths: buildLocationStrengths(signals, poiCards),
        warnings,
      } satisfies ListingLocationContext;
    }),
  );

  const providerStatuses = buildProviderStatuses(listingContexts, googlePlacesApiKey, mapboxAccessToken, googleMetrics, mapboxMetrics);
  const locationWarnings = uniqueStrings([
    ...listingContexts.flatMap((context) => context.warnings),
    ...providerStatuses.flatMap((status) => [status.warning]),
  ]);
  const poiCards = dedupePois(listingContexts.flatMap((context) => context.poiCards));
  const locationStory = buildLocationStory(listingContexts, locationWarnings, generatedAt);
  const localHighlights = buildLocalHighlights(listingContexts);
  const mapSceneIdeas = buildMapSceneIdeas(listingContexts);
  const listingLocationInsights: CasaHudListingLocationInsight[] = listingContexts.map((context) => buildListingInsight(context));
  const locationIntelligenceSummary = buildSummary(listingContexts, providerStatuses, locationWarnings, generatedAt);
  const emptyState = createEmptyCasaHudLocationData();

  return {
    ...emptyState,
    locationIntelligenceStatus: "location_intelligence_completed",
    locationIntelligenceSummary,
    locationStory,
    localHighlights,
    poiBundle: {
      summary: `${poiCards.length} location proof point${poiCards.length === 1 ? "" : "s"} prepared for the approved shortlist.`,
      cards: poiCards,
      categories: uniqueStrings(poiCards.map((poi) => poi.category)),
      generatedAt,
    },
    mapSceneIdeas,
    listingLocationInsights,
    locationProviderStatuses: providerStatuses,
    locationWarnings,
  };
}

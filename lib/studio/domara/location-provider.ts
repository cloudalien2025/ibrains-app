import { DomaraPoiCategory, buildDomaraLocationRequest, regionAwarePoiCategories } from "@/lib/studio/domara/location-intelligence";
import { DomaraLocationEnrichment, NormalizedPropertyListing } from "@/lib/studio/domara/types";

export type DomaraLocationPointOfInterest = {
  name: string;
  category: DomaraPoiCategory;
  distanceLabel?: string;
  travelTimeLabel?: string;
  source: string;
  confidence: "placeholder" | "high" | "medium";
  notes?: string;
};

export type DomaraGeocodeRequest = {
  locationLabel: string;
  country: string;
  city?: string;
  region?: string;
  neighborhood?: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
};

export type DomaraGeocodeResult = {
  locationLabel: string;
  coordinates?: {
    latitude: number;
    longitude: number;
    confidence: "provided" | "estimated";
  };
  provider: "google_maps_places" | "mock";
};

export type DomaraPlacesRequest = {
  locationLabel: string;
  country: string;
  region?: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
};

export interface GeocodingProvider {
  providerName: "google_maps" | "mock";
  geocode(request: DomaraGeocodeRequest): Promise<DomaraGeocodeResult>;
}

export interface PlacesProvider {
  providerName: "google_places" | "mock";
  fetchPointsOfInterest(request: DomaraPlacesRequest): Promise<DomaraLocationPointOfInterest[]>;
}

export interface LocationProvider {
  providerName: "google_maps_places" | "mock";
  enrich(listing: NormalizedPropertyListing): Promise<DomaraLocationEnrichment>;
}

const PLACEHOLDER_MESSAGE = "Location enrichment placeholder - Google Maps / Places integration pending.";

function placeholderPois(request: DomaraPlacesRequest, source: string): DomaraLocationPointOfInterest[] {
  const categories = regionAwarePoiCategories({ region: request.region, country: request.country });
  return categories.map((category) => ({
    name: category === "city_center" ? "Historic center context" : `${category.replace(/_/g, " ")} context`,
    category,
    source,
    confidence: "placeholder",
    notes: PLACEHOLDER_MESSAGE,
  }));
}

const mockGeocodingProvider: GeocodingProvider = {
  providerName: "mock",
  async geocode(request) {
    return {
      locationLabel: request.locationLabel,
      coordinates: request.coordinates
        ? {
            latitude: request.coordinates.latitude,
            longitude: request.coordinates.longitude,
            confidence: "provided",
          }
        : undefined,
      provider: "mock",
    };
  },
};

const mockPlacesProvider: PlacesProvider = {
  providerName: "mock",
  async fetchPointsOfInterest(request) {
    return placeholderPois(request, "mock_location_provider");
  },
};

const googleMapsGeocodingProvider: GeocodingProvider = {
  providerName: "google_maps",
  async geocode(request) {
    return {
      locationLabel: request.locationLabel,
      coordinates: request.coordinates
        ? {
            latitude: request.coordinates.latitude,
            longitude: request.coordinates.longitude,
            confidence: "provided",
          }
        : undefined,
      provider: "google_maps_places",
    };
  },
};

const googlePlacesProvider: PlacesProvider = {
  providerName: "google_places",
  async fetchPointsOfInterest(request) {
    return placeholderPois(request, "google_places_placeholder");
  },
};

class MockLocationProvider implements LocationProvider {
  providerName = "mock" as const;

  constructor(
    private readonly geocodingProvider: GeocodingProvider = mockGeocodingProvider,
    private readonly placesProvider: PlacesProvider = mockPlacesProvider,
  ) {}

  async enrich(listing: NormalizedPropertyListing): Promise<DomaraLocationEnrichment> {
    const request = buildDomaraLocationRequest({
      country: listing.location.country,
      city: listing.location.city,
      region: listing.location.region,
      neighborhood: listing.location.neighborhood,
      title: listing.title,
      imageUrls: listing.imageUrls,
      latitude: listing.sourceMetadata.coordinates?.latitude,
      longitude: listing.sourceMetadata.coordinates?.longitude,
    });

    const geocode = await this.geocodingProvider.geocode(request);
    const pointsOfInterest = await this.placesProvider.fetchPointsOfInterest({
      locationLabel: request.locationLabel,
      country: request.country,
      region: request.region,
      coordinates: request.coordinates,
    });

    if (geocode.coordinates) {
      return {
        status: "placeholder",
        provider: "mock",
        locationLabel: geocode.locationLabel,
        coordinates: geocode.coordinates,
        pointsOfInterest,
        placeholderMessage: PLACEHOLDER_MESSAGE,
        summary: `Coordinates received (${geocode.coordinates.latitude.toFixed(5)}, ${geocode.coordinates.longitude.toFixed(5)}). ${PLACEHOLDER_MESSAGE}`,
        poiNotes: [
          "POI categories prepared: airports, rail, hospitals, restaurants, museums, landmarks, city center, and region-aware lifestyle categories.",
          "Travel-time and exact-distance claims are intentionally withheld until live provider data is available.",
        ],
      };
    }

    return {
      status: "placeholder",
      provider: "mock",
      locationLabel: geocode.locationLabel,
      pointsOfInterest,
      placeholderMessage: PLACEHOLDER_MESSAGE,
      summary: `Location enrichment pending for ${geocode.locationLabel}. ${PLACEHOLDER_MESSAGE}`,
      poiNotes: [
        "Awaiting geocode resolution and POI extraction.",
        "No exact distance or travel-time labels are emitted in placeholder mode.",
      ],
    };
  }
}

class GoogleMapsLocationProvider implements LocationProvider {
  providerName = "google_maps_places" as const;

  constructor(
    private readonly geocodingProvider: GeocodingProvider = googleMapsGeocodingProvider,
    private readonly placesProvider: PlacesProvider = googlePlacesProvider,
  ) {}

  async enrich(listing: NormalizedPropertyListing): Promise<DomaraLocationEnrichment> {
    const request = buildDomaraLocationRequest({
      country: listing.location.country,
      city: listing.location.city,
      region: listing.location.region,
      neighborhood: listing.location.neighborhood,
      title: listing.title,
      imageUrls: listing.imageUrls,
      latitude: listing.sourceMetadata.coordinates?.latitude,
      longitude: listing.sourceMetadata.coordinates?.longitude,
    });

    const geocode = await this.geocodingProvider.geocode(request);
    const pointsOfInterest = await this.placesProvider.fetchPointsOfInterest({
      locationLabel: request.locationLabel,
      country: request.country,
      region: request.region,
      coordinates: request.coordinates,
    });

    return {
      status: "placeholder",
      provider: "google_maps_places",
      locationLabel: geocode.locationLabel,
      coordinates: geocode.coordinates,
      pointsOfInterest,
      placeholderMessage: PLACEHOLDER_MESSAGE,
      summary: `Google Maps / Places credentials detected for ${geocode.locationLabel}. ${PLACEHOLDER_MESSAGE}`,
      poiNotes: [
        "Provider seam selected: google_maps_places.",
        "Exact distances and travel times are not emitted until live API integration is enabled.",
      ],
    };
  }
}

export function createLocationProvider(env: NodeJS.ProcessEnv = process.env): LocationProvider {
  const mapsKey = (env.GOOGLE_MAPS_API_KEY || "").trim();
  const placesKey = (env.GOOGLE_PLACES_API_KEY || "").trim();

  if (mapsKey && placesKey) {
    return new GoogleMapsLocationProvider();
  }

  return new MockLocationProvider();
}

export { GoogleMapsLocationProvider, MockLocationProvider };

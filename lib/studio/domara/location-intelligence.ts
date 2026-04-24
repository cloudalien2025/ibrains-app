import { PropertyListingInput } from "@/lib/studio/domara/types";

export type DomaraPoiCategory =
  | "airports"
  | "train_stations"
  | "hospitals"
  | "restaurants"
  | "museums"
  | "landmarks"
  | "beaches"
  | "ski_areas"
  | "city_center";

export type DomaraLocationRequest = {
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

function asFiniteNumber(value: string | number | undefined): number | null {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function buildDomaraLocationRequest(input: PropertyListingInput): DomaraLocationRequest {
  const city = input.city?.trim() || undefined;
  const region = input.region?.trim() || undefined;
  const neighborhood = input.neighborhood?.trim() || undefined;
  const country = input.country?.trim() || "Italy";
  const latitude = asFiniteNumber(input.latitude);
  const longitude = asFiniteNumber(input.longitude);
  const locationLabel = [neighborhood, city, region, country].filter(Boolean).join(", ") || country;

  return {
    locationLabel,
    country,
    city,
    region,
    neighborhood,
    coordinates:
      latitude !== null && longitude !== null
        ? {
            latitude,
            longitude,
          }
        : undefined,
  };
}

export function regionAwarePoiCategories(input: { region?: string; country?: string }): DomaraPoiCategory[] {
  const base: DomaraPoiCategory[] = [
    "airports",
    "train_stations",
    "hospitals",
    "restaurants",
    "museums",
    "landmarks",
    "city_center",
  ];
  const regionText = `${input.region || ""} ${input.country || ""}`.toLowerCase();
  if (/coast|beach|sicily|sardinia|amalfi|liguria|adriatic|mediterranean/.test(regionText)) {
    base.push("beaches");
  }
  if (/alps|dolomites|trentino|aosta|ski|mont|mountain/.test(regionText)) {
    base.push("ski_areas");
  }
  return base;
}


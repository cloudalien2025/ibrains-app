import type { ListingFaqContext } from "@/lib/directoryiq/faq/types";

function uniq(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

export function enrichLocalContext(context: ListingFaqContext): ListingFaqContext {
  const locationSignals = uniq([
    ...context.location_signals,
    context.neighborhood,
    context.city,
    context.region,
    context.country,
  ]);

  const nearbyActivities = uniq([
    ...context.nearby_activities,
    ...(context.listing_archetype === "vacation_rental" ? ["outdoor recreation", "seasonal events"] : []),
    ...(context.listing_archetype === "restaurant" ? ["local dining", "takeout and reservations"] : []),
  ]);

  const seasonalRelevance = uniq([
    ...context.seasonal_relevance,
    ...(context.listing_archetype === "vacation_rental" ? ["peak season planning", "weather impact"] : []),
  ]);

  return {
    ...context,
    location_signals: locationSignals,
    nearby_activities: nearbyActivities,
    seasonal_relevance: seasonalRelevance,
  };
}

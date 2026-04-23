import type { ListingFaqContext, ResolvedIntentCluster } from "@/lib/directoryiq/faq/types";

const ARCHETYPE_CLUSTERS: Record<string, string[]> = {
  vacation_rental: [
    "location",
    "attraction proximity",
    "seasonal access",
    "amenities",
    "occupancy",
    "family suitability",
    "pet suitability",
    "parking / transit",
    "check-in logistics",
    "cancellation / booking rules",
    "ideal traveler type",
    "differentiators",
  ],
  hotel: ["location", "amenities", "check-in logistics", "parking / transit", "cancellation / booking rules", "differentiators"],
  restaurant: ["location", "reservation logistics", "menu fit", "parking / transit", "peak-time access", "differentiators"],
  local_service: ["service area", "response times", "pricing model", "scheduling", "qualifications", "differentiators"],
  other_business: ["location", "fit", "policies", "availability", "differentiators"],
};

function clampScore(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function factsAvailableScore(cluster: string, context: ListingFaqContext): number {
  const rawSignals: Record<string, string[]> = {
    location: [context.city, context.region, ...context.location_signals],
    "attraction proximity": context.nearby_landmarks,
    "seasonal access": context.seasonal_relevance,
    amenities: context.amenities,
    occupancy: [context.occupancy, context.bedrooms, context.bathrooms],
    "family suitability": [context.family_friendly, ...context.child_friendly_signals],
    "pet suitability": [context.pet_policy],
    "parking / transit": [context.parking],
    "check-in logistics": [context.checkin_info, context.checkout_info],
    "cancellation / booking rules": [context.cancellation_policy, ...context.booking_rules],
    "ideal traveler type": context.differentiators,
    differentiators: context.differentiators,
    "service area": [context.city, context.region, ...context.location_signals],
    "response times": context.differentiators,
    "pricing model": context.booking_rules,
    scheduling: [context.checkin_info],
    qualifications: context.differentiators,
    fit: [context.category, context.subcategory],
    policies: [context.cancellation_policy, ...context.booking_rules],
    availability: [context.checkin_info, context.checkout_info],
    "reservation logistics": [context.checkin_info],
    "menu fit": context.amenities,
    "peak-time access": context.seasonal_relevance,
  };

  const populated = (rawSignals[cluster] ?? []).filter((value) => value.trim().length > 0).length;
  return clampScore(populated / 3);
}

export function resolveFaqIntentClusters(context: ListingFaqContext): ResolvedIntentCluster[] {
  const clusters = ARCHETYPE_CLUSTERS[context.listing_archetype] ?? ARCHETYPE_CLUSTERS.other_business;

  return clusters
    .map((cluster, index) => {
      const factsScore = factsAvailableScore(cluster, context);
      const relevance = clampScore(0.4 + factsScore * 0.6 - index * 0.01);

      return {
        cluster_name: cluster,
        relevance_score: relevance,
        facts_available_score: factsScore,
        selection_reason:
          factsScore > 0
            ? `Selected because listing has usable facts for ${cluster}.`
            : `Selected to explicitly qualify unknowns for ${cluster}.`,
      };
    })
    .sort((a, b) => b.relevance_score - a.relevance_score);
}

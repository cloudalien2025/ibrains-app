import type { FactConfidence, ListingArchetype, ListingFaqContext } from "@/lib/directoryiq/faq/types";

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
}

function pickFirstString(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = asString(record[key]);
    if (value) return value;
  }
  return "";
}

function factValue(value: string): FactConfidence {
  return value ? "confirmed" : "unknown";
}

function normalizeUrl(value: string): string {
  if (!value) return "";
  try {
    return new URL(value).toString();
  } catch {
    return value;
  }
}

export function resolveListingFacts(input: {
  listingId: string;
  siteId: string | null;
  listingName: string;
  listingType: string;
  listingArchetype: ListingArchetype;
  canonicalUrl: string;
  title: string;
  description: string;
  raw: Record<string, unknown>;
}): ListingFaqContext {
  const raw = input.raw ?? {};

  const category = pickFirstString(raw, ["group_category", "category", "category_name", "listing_category"]);
  const subcategory = pickFirstString(raw, ["subcategory", "listing_subcategory", "sub_category"]);
  const city = pickFirstString(raw, ["city", "post_location_city", "location_city", "post_location"]);
  const region = pickFirstString(raw, ["state", "region", "location_region", "province"]);
  const neighborhood = pickFirstString(raw, ["neighborhood", "district", "area"]);
  const country = pickFirstString(raw, ["country", "country_code"]);

  const amenities = Array.from(
    new Set([
      ...asStringArray(raw.amenities),
      ...asStringArray(raw.features),
      ...asStringArray(raw.tags),
      ...asStringArray(raw.property_amenities),
    ])
  );

  const occupancy = pickFirstString(raw, ["occupancy", "max_guests", "guest_capacity"]);
  const bedrooms = pickFirstString(raw, ["bedrooms", "beds"]);
  const bathrooms = pickFirstString(raw, ["bathrooms", "baths"]);
  const petPolicy = pickFirstString(raw, ["pet_policy", "pets", "pet_friendly"]);
  const parking = pickFirstString(raw, ["parking", "parking_info"]);
  const wifi = pickFirstString(raw, ["wifi", "internet"]);
  const kitchen = pickFirstString(raw, ["kitchen", "kitchen_access"]);
  const pool = pickFirstString(raw, ["pool"]);
  const hotTub = pickFirstString(raw, ["hot_tub", "hottub"]);
  const fireplace = pickFirstString(raw, ["fireplace"]);
  const familyFriendly = pickFirstString(raw, ["family_friendly", "kid_friendly"]);

  const checkinInfo = pickFirstString(raw, ["checkin_info", "check_in", "checkin"]);
  const checkoutInfo = pickFirstString(raw, ["checkout_info", "check_out", "checkout"]);
  const cancellationPolicy = pickFirstString(raw, ["cancellation_policy", "cancellation"]);

  const bookingRules = Array.from(
    new Set([...asStringArray(raw.booking_rules), ...asStringArray(raw.house_rules), ...asStringArray(raw.rules)])
  );

  const locationSignals = Array.from(
    new Set([
      ...asStringArray(raw.location_signals),
      ...asStringArray(raw.nearby_neighborhoods),
      city,
      neighborhood,
      region,
    ])
  ).filter(Boolean);

  const nearbyLandmarks = Array.from(
    new Set([...asStringArray(raw.nearby_landmarks), ...asStringArray(raw.landmarks), ...asStringArray(raw.poi)])
  );

  const nearbyActivities = Array.from(
    new Set([...asStringArray(raw.nearby_activities), ...asStringArray(raw.activities), ...asStringArray(raw.local_activities)])
  );

  const seasonalRelevance = Array.from(new Set([...asStringArray(raw.seasonal_relevance), ...asStringArray(raw.seasons)]));
  const differentiators = Array.from(new Set([...asStringArray(raw.differentiators), ...asStringArray(raw.unique_selling_points)]));
  const childFriendlySignals = Array.from(new Set([...asStringArray(raw.child_friendly_signals), ...asStringArray(raw.family_signals)]));

  const supportLinks = Array.from(
    new Set([
      normalizeUrl(input.canonicalUrl),
      ...asStringArray(raw.support_links).map((value) => normalizeUrl(value)),
    ])
  ).filter(Boolean);

  const factConfidenceMap: Record<string, FactConfidence> = {
    occupancy: factValue(occupancy),
    bedrooms: factValue(bedrooms),
    bathrooms: factValue(bathrooms),
    pet_policy: factValue(petPolicy),
    parking: factValue(parking),
    wifi: factValue(wifi),
    kitchen: factValue(kitchen),
    pool: factValue(pool),
    hot_tub: factValue(hotTub),
    fireplace: factValue(fireplace),
    checkin_info: factValue(checkinInfo),
    checkout_info: factValue(checkoutInfo),
    cancellation_policy: factValue(cancellationPolicy),
    family_friendly: factValue(familyFriendly),
  };

  const inferredFacts: string[] = [];
  if (!familyFriendly && (Number(bedrooms) >= 2 || childFriendlySignals.length > 0)) {
    inferredFacts.push("Likely suitable for families based on bedroom count or child-friendly signals.");
    factConfidenceMap.family_friendly = "inferred";
  }

  const knownFacts = Object.entries(factConfidenceMap)
    .filter(([, confidence]) => confidence === "confirmed")
    .map(([key]) => key);

  const unknownFacts = Object.entries(factConfidenceMap)
    .filter(([, confidence]) => confidence === "unknown")
    .map(([key]) => key);

  return {
    listing_id: input.listingId,
    site_id: input.siteId,
    listing_name: input.listingName,
    listing_type: input.listingType,
    listing_archetype: input.listingArchetype,
    category,
    subcategory,
    city,
    region,
    neighborhood,
    country,
    canonical_url: normalizeUrl(input.canonicalUrl),
    title: input.title,
    description: input.description,
    amenities,
    occupancy,
    bedrooms,
    bathrooms,
    pet_policy: petPolicy,
    parking,
    wifi,
    kitchen,
    pool,
    hot_tub: hotTub,
    fireplace,
    family_friendly: familyFriendly,
    child_friendly_signals: childFriendlySignals,
    checkin_info: checkinInfo,
    checkout_info: checkoutInfo,
    cancellation_policy: cancellationPolicy,
    booking_rules: bookingRules,
    location_signals: locationSignals,
    nearby_landmarks: nearbyLandmarks,
    nearby_activities: nearbyActivities,
    seasonal_relevance: seasonalRelevance,
    differentiators,
    known_facts: knownFacts,
    inferred_facts: inferredFacts,
    unknown_facts: unknownFacts,
    fact_confidence_map: factConfidenceMap,
    support_links: supportLinks,
  };
}

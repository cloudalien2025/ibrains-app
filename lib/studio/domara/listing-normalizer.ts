import { NormalizedPropertyListing, PropertyListingInput } from "@/lib/studio/domara/types";

function normalizeNumberish(value?: string | number): number | null {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function stableId(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return `domara-${Math.abs(hash).toString(16)}`;
}

export function normalizePropertyListingInput(input: PropertyListingInput): NormalizedPropertyListing {
  const city = input.city?.trim();
  const region = input.region?.trim();
  const neighborhood = input.neighborhood?.trim();
  const country = input.country?.trim() || "Italy";
  const title = input.title.trim();
  const price = input.price?.trim();
  const propertyType = input.propertyType?.trim();
  const bedrooms = normalizeNumberish(input.bedrooms);
  const bathrooms = normalizeNumberish(input.bathrooms);
  const squareMeters = normalizeNumberish(input.squareMeters);
  const latitude = normalizeNumberish(input.latitude);
  const longitude = normalizeNumberish(input.longitude);
  const locationLabel = [neighborhood, city, region, country].filter(Boolean).join(", ");

  const facts: string[] = [];
  if (propertyType) facts.push(propertyType);
  if (bedrooms !== null) facts.push(`${bedrooms} bedrooms`);
  if (bathrooms !== null) facts.push(`${bathrooms} bathrooms`);
  if (squareMeters !== null) facts.push(`${squareMeters} sqm`);

  return {
    id: stableId(
      [
        title,
        country,
        city ?? "",
        region ?? "",
        neighborhood ?? "",
        price ?? "",
        input.listingUrl ?? "",
        input.source ?? "",
      ].join("|"),
    ),
    title,
    market: country,
    locationLabel: locationLabel || country,
    priceLabel: price || "Price on request",
    propertyFacts: facts,
    imageUrls: input.imageUrls.filter(Boolean),
    sourceMetadata: {
      listingUrl: input.listingUrl?.trim() || undefined,
      source: input.source?.trim() || undefined,
      coordinates:
        latitude !== null && longitude !== null
          ? {
              latitude,
              longitude,
            }
          : undefined,
    },
  };
}


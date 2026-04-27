import { validateDomaraImageUrls } from "@/lib/studio/domara/image-handling";
import { PropertyListingInput } from "@/lib/studio/domara/types";

export type DomaraListingProviderName = "manual" | "idealista" | "immobiliare" | "mock";

export type DomaraProviderListingRaw = {
  listingId: string;
  listingUrl?: string;
  source?: string;
  provider: DomaraListingProviderName;
  country?: string;
  city?: string;
  region?: string;
  neighborhood?: string;
  title: string;
  description?: string;
  price?: string;
  propertyType?: string;
  bedrooms?: number;
  bathrooms?: number;
  squareMeters?: number;
  imageUrls?: string[];
  latitude?: number;
  longitude?: number;
  agency?: string;
  fetchedAt?: string;
  providerMetadata?: Record<string, string | number | boolean | null | undefined>;
};

export type DomaraListingFetchRequest = {
  provider: Exclude<DomaraListingProviderName, "manual">;
  listingRef: string;
  country?: string;
  fallbackToMock?: boolean;
};

export type DomaraFetchedListing = {
  listing: PropertyListingInput;
  providerUsed: DomaraListingProviderName;
  fallbackUsed: boolean;
  fetchStatus: "success" | "fallback";
  warnings: string[];
};

export interface ListingProvider {
  providerName: DomaraListingProviderName;
  fetchListing(request: DomaraListingFetchRequest): Promise<DomaraProviderListingRaw>;
}

function normalizedRef(input: string): string {
  return input.trim().toLowerCase();
}

function stableHash(seed: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return Math.abs(hash >>> 0);
}

function mockListingFromRef(reference: string, country: string): DomaraProviderListingRaw {
  const ref = normalizedRef(reference);
  const hash = stableHash(ref || "domara");
  const rooms = (hash % 4) + 1;
  const baths = Math.max(1, rooms - 1);
  const sqm = 55 + (hash % 180);
  const city = country.toLowerCase() === "italy" ? "Florence" : "Lisbon";
  const region = country.toLowerCase() === "italy" ? "Tuscany" : "Lisbon District";
  const titlePrefix = hash % 2 === 0 ? "Historic Center" : "Panoramic";
  const imageBase = `https://images.example.com/casahud/${hash}`;

  return {
    listingId: `mock-${hash}`,
    listingUrl: reference.startsWith("http") ? reference : `https://example.com/listings/${hash}`,
    source: "Mock Listing Feed",
    provider: "mock",
    country,
    city,
    region,
    neighborhood: hash % 2 === 0 ? "Oltrarno" : "Santa Croce",
    title: `${titlePrefix} ${rooms}-Bedroom ${hash % 2 === 0 ? "Apartment" : "Villa"}`,
    description:
      "Deterministic mock listing for CasaHUD ingestion testing. Replace with official provider APIs when credentials and contracts are available.",
    price: `€${(220000 + (hash % 700000)).toLocaleString("en-US")}`,
    propertyType: hash % 2 === 0 ? "Apartment" : "Villa",
    bedrooms: rooms,
    bathrooms: baths,
    squareMeters: sqm,
    imageUrls: [
      `${imageBase}-1.jpg`,
      `${imageBase}-2.jpg`,
      `${imageBase}-3.jpg`,
      "javascript:alert('invalid')",
    ],
    latitude: country.toLowerCase() === "italy" ? 43.76956 : 38.72225,
    longitude: country.toLowerCase() === "italy" ? 11.25581 : -9.13934,
    agency: "CasaHUD Mock Agency",
    fetchedAt: new Date().toISOString(),
    providerMetadata: {
      sourceId: `mock-${hash}`,
      mockDeterministicSeed: hash,
      ingestionMode: "fixture",
    },
  };
}

class MockListingProvider implements ListingProvider {
  providerName = "mock" as const;

  async fetchListing(request: DomaraListingFetchRequest): Promise<DomaraProviderListingRaw> {
    const country = request.country?.trim() || "Italy";
    if (!request.listingRef.trim()) {
      throw new Error("Listing reference is required for fetch workflow.");
    }
    return mockListingFromRef(request.listingRef, country);
  }
}

class IdealistaProvider implements ListingProvider {
  providerName = "idealista" as const;

  async fetchListing(): Promise<DomaraProviderListingRaw> {
    throw new Error("Idealista provider credentials or API contract are not configured in this environment.");
  }
}

class ImmobiliareProvider implements ListingProvider {
  providerName = "immobiliare" as const;

  async fetchListing(): Promise<DomaraProviderListingRaw> {
    throw new Error("Immobiliare provider credentials or API contract are not configured in this environment.");
  }
}

function normalizeProviderListing(raw: DomaraProviderListingRaw): PropertyListingInput {
  const validatedImages = validateDomaraImageUrls(raw.imageUrls || []);
  const sourceName = raw.source || raw.provider;

  return {
    listingUrl: raw.listingUrl,
    source: sourceName,
    provider: raw.provider,
    country: raw.country || "Italy",
    city: raw.city,
    region: raw.region,
    neighborhood: raw.neighborhood,
    title: raw.title,
    description: raw.description,
    price: raw.price,
    propertyType: raw.propertyType,
    bedrooms: raw.bedrooms,
    bathrooms: raw.bathrooms,
    squareMeters: raw.squareMeters,
    imageUrls: validatedImages.acceptedUrls,
    latitude: raw.latitude,
    longitude: raw.longitude,
    agency: raw.agency,
    fetchedAt: raw.fetchedAt || new Date().toISOString(),
    providerMetadata: {
      ...(raw.providerMetadata || {}),
      listingId: raw.listingId,
      skippedImageCount: validatedImages.skippedUrls.length,
    },
    sourceAttribution: [sourceName, raw.listingUrl].filter(Boolean).join(" | "),
  };
}

function providerForName(name: Exclude<DomaraListingProviderName, "manual">): ListingProvider {
  if (name === "idealista") return new IdealistaProvider();
  if (name === "immobiliare") return new ImmobiliareProvider();
  return new MockListingProvider();
}

export async function fetchListing(request: DomaraListingFetchRequest): Promise<DomaraFetchedListing> {
  const provider = providerForName(request.provider);

  try {
    const raw = await provider.fetchListing(request);
    const normalized = normalizeProviderListing(raw);
    const skippedImageCount = Number(normalized.providerMetadata?.skippedImageCount || 0);

    return {
      listing: normalized,
      providerUsed: provider.providerName,
      fallbackUsed: false,
      fetchStatus: "success",
      warnings: skippedImageCount > 0 ? [`Skipped ${skippedImageCount} invalid or unsafe image URL(s).`] : [],
    };
  } catch (error) {
    if (!request.fallbackToMock) {
      throw error;
    }

    const fallbackRaw = await new MockListingProvider().fetchListing({
      provider: "mock",
      listingRef: request.listingRef,
      country: request.country,
      fallbackToMock: false,
    });
    const normalized = normalizeProviderListing(fallbackRaw);

    return {
      listing: normalized,
      providerUsed: "mock",
      fallbackUsed: true,
      fetchStatus: "fallback",
      warnings: [
        error instanceof Error ? error.message : "Listing provider fetch failed.",
        "Using deterministic mock listing fallback so CasaHUD workflow remains operational.",
      ],
    };
  }
}

export { normalizeProviderListing, MockListingProvider, IdealistaProvider, ImmobiliareProvider };

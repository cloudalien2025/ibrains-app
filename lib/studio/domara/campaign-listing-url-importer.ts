import { nowIso, stableCasaHudId } from "@/lib/studio/domara/ai-channel-engine/ids";
import type { CasaHudCampaign, CasaHudListingCandidate } from "@/lib/studio/domara/campaigns";
import {
  extractListingUrlMetadata,
  type CasaHudImportedListingExtractionResult,
} from "@/lib/studio/domara/listing-url-extractor";
import { validateListingImportUrl } from "@/lib/studio/domara/listing-url-importer";

const MAX_URLS_PER_REQUEST = 12;

type FetchResponse = {
  ok: boolean;
  status: number;
  headers: Headers;
  text: () => Promise<string>;
  url: string;
};

type FetchLike = (input: string, init?: RequestInit) => Promise<FetchResponse>;

export type CasaHudImportedUrlCandidateResult = {
  inputUrl: string;
  normalizedUrl?: string;
  status: "imported" | "duplicate" | "invalid" | "failed";
  candidate?: CasaHudListingCandidate;
  warnings: string[];
  reason?: string;
};

export type ImportCasaHudListingUrlsResult = {
  results: CasaHudImportedUrlCandidateResult[];
  importedCandidates: CasaHudListingCandidate[];
  importedCount: number;
  duplicateCount: number;
  invalidCount: number;
  failedCount: number;
  skippedCount: number;
  warnings: string[];
  importedAt: string;
};

function dedupeKey(input: string): string {
  try {
    const parsed = new URL(input);
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return input.trim();
  }
}

function existingUrlKeys(campaign: CasaHudCampaign): Set<string> {
  const urls = [
    ...campaign.listingCandidates,
    ...campaign.approvedListings,
    ...campaign.rejectedListings,
  ].flatMap((listing) => [listing.sourceUrl, listing.canonicalUrl]);

  return new Set(urls.filter(Boolean).map((value) => dedupeKey(value!)));
}

function normalizePhotoAvailability(imageUrls: string[]) {
  if (imageUrls.length >= 2) return "available" as const;
  if (imageUrls.length === 1) return "limited" as const;
  return "none" as const;
}

function buildImportedNarrationNote(
  sourceLabel: string,
  extraction: CasaHudImportedListingExtractionResult,
): string {
  if (extraction.data.casaHudNarrationSeed) return extraction.data.casaHudNarrationSeed;
  if (extraction.needsReviewFields.length === 0) {
    return `Public listing facts imported from ${sourceLabel} and ready for shortlist review.`;
  }
  return `Public listing facts imported from ${sourceLabel}. Review the flagged details before validation.`;
}

function buildFallbackDescription(sourceLabel: string, extraction: CasaHudImportedListingExtractionResult) {
  if (extraction.data.casaHudShortSummary) return extraction.data.casaHudShortSummary;
  if (extraction.data.description) return extraction.data.description;
  return `Imported from ${sourceLabel} using public page metadata. Review any missing facts before validation.`;
}

function shouldImportExtraction(extraction: CasaHudImportedListingExtractionResult) {
  return extraction.extractionStatus === "extracted" || extraction.extractionStatus === "partial";
}

function buildImportedCandidate(params: {
  extraction: CasaHudImportedListingExtractionResult;
  importedAt: string;
}): CasaHudListingCandidate {
  const { extraction, importedAt } = params;
  const sourceLabel = extraction.data.sourceLabel;
  const imageUrls = extraction.data.imageUrls;
  const photoAvailability = normalizePhotoAvailability(imageUrls);

  return {
    id: stableCasaHudId("listing", extraction.data.canonicalUrl || extraction.normalizedUrl),
    provider: extraction.provider,
    sourceType: "imported_url",
    providerListingId: extraction.providerListingId,
    sourceUrl: extraction.data.sourceUrl,
    sourceHost: extraction.data.sourceHost,
    sourceLabel,
    importedAt,
    featuredImageUrl: extraction.data.featuredImageUrl,
    thumbnailUrl: extraction.data.featuredImageUrl,
    sourceThumbnailUrl: extraction.data.featuredImageUrl,
    metadataTitle: extraction.data.metadataTitle,
    metadataDescription: extraction.data.metadataDescription,
    metadataImageUrl: extraction.data.featuredImageUrl,
    canonicalUrl: extraction.data.canonicalUrl,
    extractionStatus: extraction.extractionStatus,
    extractionProvider: extraction.extractionProvider,
    extractionFields: extraction.extractionFields,
    extractionWarnings: extraction.warnings,
    needsReviewFields: extraction.needsReviewFields,
    title: extraction.data.casaHudDisplayTitle || extraction.data.title || `Imported listing from ${sourceLabel}`,
    addressText: extraction.data.addressText,
    locationText: extraction.data.locationText || extraction.data.addressText || "Location needs review",
    country: extraction.data.country,
    region: extraction.data.region,
    city: extraction.data.city,
    price: extraction.data.price,
    currency: extraction.data.priceCurrency,
    propertyType: extraction.data.propertyType,
    rooms: extraction.data.rooms,
    bedrooms: extraction.data.bedrooms,
    bathrooms: extraction.data.bathrooms,
    sizeSqm: extraction.data.interiorSizeSqm || extraction.data.commercialSurfaceSqm,
    commercialSurfaceSqm: extraction.data.commercialSurfaceSqm,
    landSizeSqm: extraction.data.landSizeSqm,
    floorCount: extraction.data.floorCount,
    floorText: extraction.data.floorText,
    garageParking: extraction.data.garageParking,
    balcony: extraction.data.balcony,
    terrace: extraction.data.terrace,
    furnished: extraction.data.furnished,
    condition: extraction.data.condition,
    heating: extraction.data.heating,
    energyClass: extraction.data.energyClass,
    pricePerSquareMeter: extraction.data.pricePerSquareMeter,
    referenceCode: extraction.data.referenceCode,
    updatedDate: extraction.data.updatedDate,
    photoCount: extraction.data.photoCount,
    floorPlanCount: extraction.data.floorPlanCount,
    descriptionSnippet: extraction.data.description || buildFallbackDescription(sourceLabel, extraction),
    summary: extraction.data.summary || extraction.data.casaHudShortSummary,
    keyFeatures: extraction.data.keyFeatures,
    lifestyleHighlights: extraction.data.lifestyleHighlights,
    imageStatus: extraction.data.imageStatus,
    casaHudDisplayTitle: extraction.data.casaHudDisplayTitle,
    casaHudShortSummary: extraction.data.casaHudShortSummary,
    casaHudNarrationSeed: extraction.data.casaHudNarrationSeed,
    features: Array.from(new Set([...extraction.data.keyFeatures, ...extraction.data.lifestyleHighlights])).slice(0, 10),
    imageUrls,
    imageCount: extraction.data.photoCount || imageUrls.length,
    photoAvailability,
    coordinates: extraction.data.coordinates,
    rawProviderMetadata: {
      importMethod: "safe_public_html",
      extractionProvider: extraction.extractionProvider,
      extractionStatus: extraction.extractionStatus,
      extractionFields: extraction.extractionFields,
      sourceHost: extraction.data.sourceHost,
      sourceLabel,
      providerName: extraction.providerName,
      providerListingId: extraction.providerListingId || null,
      canonicalUrl: extraction.data.canonicalUrl || null,
      priceText: extraction.data.priceText || null,
      updatedDate: extraction.data.updatedDate || null,
      referenceCode: extraction.data.referenceCode || null,
      notOfficialApi: true,
    },
    discoveredAt: importedAt,
    preliminaryMatchNotes: buildImportedNarrationNote(sourceLabel, extraction),
  };
}

export function parseListingUrlLines(rawUrls: string): string[] {
  return Array.from(
    new Set(
      rawUrls
        .split(/\r?\n/)
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  );
}

export async function importCasaHudListingUrls(params: {
  campaign: CasaHudCampaign;
  rawUrls: string;
  fetchFn?: FetchLike;
  importedAt?: string;
}): Promise<ImportCasaHudListingUrlsResult> {
  const fetchFn = params.fetchFn || (fetch as FetchLike);
  const importedAt = params.importedAt || nowIso();
  const urls = parseListingUrlLines(params.rawUrls);

  if (urls.length === 0) {
    throw new Error("Paste at least one listing URL to import.");
  }
  if (urls.length > MAX_URLS_PER_REQUEST) {
    throw new Error(`Import up to ${MAX_URLS_PER_REQUEST} listing URLs at a time.`);
  }

  const existingKeys = existingUrlKeys(params.campaign);
  const seenInRequest = new Set<string>();
  const results: CasaHudImportedUrlCandidateResult[] = [];
  const importedCandidates: CasaHudListingCandidate[] = [];

  for (const inputUrl of urls) {
    let parsedUrl: URL;
    try {
      parsedUrl = validateListingImportUrl(inputUrl);
    } catch (error) {
      results.push({
        inputUrl,
        status: "invalid",
        warnings: [],
        reason: error instanceof Error ? error.message : "Invalid URL.",
      });
      continue;
    }

    const normalizedUrl = parsedUrl.toString();
    const requestKey = dedupeKey(normalizedUrl);
    if (existingKeys.has(requestKey) || seenInRequest.has(requestKey)) {
      results.push({
        inputUrl,
        normalizedUrl,
        status: "duplicate",
        warnings: [],
        reason: "Duplicate URL skipped.",
      });
      continue;
    }

    const extraction = await extractListingUrlMetadata({
      url: normalizedUrl,
      fetchImpl: fetchFn,
    });

    if (!shouldImportExtraction(extraction)) {
      results.push({
        inputUrl,
        normalizedUrl,
        status: "failed",
        warnings: extraction.warnings,
        reason:
          extraction.extractionStatus === "blocked_or_unavailable"
            ? "Source page blocked or unavailable for safe extraction."
            : "Source page did not expose enough public listing data to import.",
      });
      continue;
    }

    const candidate = buildImportedCandidate({
      extraction,
      importedAt,
    });
    const candidateKeys = [candidate.sourceUrl, candidate.canonicalUrl]
      .filter(Boolean)
      .map((value) => dedupeKey(value!));

    if (candidateKeys.some((key) => existingKeys.has(key) || seenInRequest.has(key))) {
      results.push({
        inputUrl,
        normalizedUrl,
        status: "duplicate",
        warnings: extraction.warnings,
        reason: "Duplicate URL skipped.",
      });
      continue;
    }

    seenInRequest.add(requestKey);
    candidateKeys.forEach((key) => seenInRequest.add(key));

    results.push({
      inputUrl,
      normalizedUrl,
      status: "imported",
      candidate,
      warnings: extraction.warnings,
    });
    importedCandidates.push(candidate);
  }

  const duplicateCount = results.filter((result) => result.status === "duplicate").length;
  const invalidCount = results.filter((result) => result.status === "invalid").length;
  const failedCount = results.filter((result) => result.status === "failed").length;

  return {
    results,
    importedCandidates,
    importedCount: importedCandidates.length,
    duplicateCount,
    invalidCount,
    failedCount,
    skippedCount: duplicateCount + invalidCount + failedCount,
    warnings: Array.from(new Set(results.flatMap((result) => result.warnings))),
    importedAt,
  };
}

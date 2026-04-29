import { nowIso, stableCasaHudId } from "@/lib/studio/domara/ai-channel-engine/ids";
import type {
  CasaHudCampaign,
  CasaHudListingCandidate,
  CasaHudListingExtractionStatus,
  CasaHudListingProvider,
  CasaHudListingUrlClassification,
} from "@/lib/studio/domara/campaigns";
import { normalizeImportedListingCandidate } from "@/lib/studio/domara/imported-listing-candidate";
import {
  classifyListingImportUrl,
  extractListingUrlMetadata,
  type CasaHudImportedListingExtractionResult,
} from "@/lib/studio/domara/listing-url-extractor";
import { normalizeListingImportUrl } from "@/lib/studio/domara/listing-url-importer";

const MAX_URLS_PER_REQUEST = 12;
const MAX_SEARCH_PAGE_DISCOVERIES = 4;

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
  provider?: CasaHudListingProvider;
  providerName?: string;
  urlClassification?: CasaHudListingUrlClassification;
  extractionStatus?: CasaHudListingExtractionStatus;
  status: "imported" | "partial" | "manual_draft" | "duplicate" | "invalid" | "failed" | "search_results";
  candidate?: CasaHudListingCandidate;
  warnings: string[];
  reason?: string;
  nextAction?: string;
  discoveredListingUrls?: string[];
};

export type ImportCasaHudListingUrlsResult = {
  results: CasaHudImportedUrlCandidateResult[];
  importedCandidates: CasaHudListingCandidate[];
  importedCount: number;
  partialCount: number;
  manualDraftCount: number;
  duplicateCount: number;
  searchPageCount: number;
  invalidCount: number;
  failedCount: number;
  skippedCount: number;
  warnings: string[];
  importedAt: string;
};

function dedupeKey(input: string): string {
  try {
    return normalizeListingImportUrl(input).toString();
  } catch {
    return input.trim();
  }
}

function existingUrlKeys(campaign: CasaHudCampaign): Set<string> {
  const urls = [
    ...campaign.listingCandidates,
    ...campaign.approvedListings,
    ...campaign.rejectedListings,
  ].flatMap((listing) => [
    listing.originalSourceUrl,
    listing.normalizedSourceUrl,
    listing.canonicalSourceUrl,
    listing.sourceUrl,
    listing.canonicalUrl,
  ]);

  return new Set(urls.filter(Boolean).map((value) => dedupeKey(value!)));
}

function normalizePhotoAvailability(imageUrls: string[]) {
  if (imageUrls.length >= 2) return "available" as const;
  if (imageUrls.length === 1) return "limited" as const;
  return "none" as const;
}

function buildImportedNarrationNote(sourceLabel: string, listing: CasaHudListingCandidate): string {
  if (listing.casaHudNarrationSeed) return listing.casaHudNarrationSeed;
  if ((listing.needsReviewFields || []).length === 0) {
    return `Public listing facts imported from ${sourceLabel} and ready for shortlist review.`;
  }
  return `Public listing facts imported from ${sourceLabel}. Add the missing details before validation.`;
}

function buildFallbackDescription(sourceLabel: string, extraction: CasaHudImportedListingExtractionResult) {
  if (extraction.data.casaHudShortSummary) return extraction.data.casaHudShortSummary;
  if (extraction.data.description) return extraction.data.description;
  return `Imported from ${sourceLabel} using public page details. Add any missing facts before validation.`;
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

  return normalizeImportedListingCandidate({
    id: stableCasaHudId("listing", extraction.data.canonicalSourceUrl || extraction.data.canonicalUrl || extraction.normalizedUrl),
    provider: extraction.provider,
    sourceType: "imported_url",
    providerListingId: extraction.providerListingId,
    originalSourceUrl: extraction.data.originalSourceUrl,
    normalizedSourceUrl: extraction.data.normalizedSourceUrl || extraction.normalizedUrl,
    canonicalSourceUrl: extraction.data.canonicalSourceUrl || extraction.data.canonicalUrl,
    sourceUrl: extraction.data.sourceUrl,
    sourceHost: extraction.data.sourceHost,
    sourceLabel,
    urlClassification: extraction.urlClassification,
    importedAt,
    extractionConfidence: extraction.extractionConfidence,
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
    priceText: extraction.data.priceText,
    addressText: extraction.data.addressText,
    locationText: extraction.data.locationText || extraction.data.addressText || "Location needs review",
    country: extraction.data.country,
    region: extraction.data.region,
    city: extraction.data.city,
    province: extraction.data.province,
    price: extraction.data.price,
    currency: extraction.data.priceCurrency,
    propertyType: extraction.data.propertyType,
    contract: extraction.data.contract,
    ownership: extraction.data.ownership,
    rooms: extraction.data.rooms,
    bedrooms: extraction.data.bedrooms,
    bathrooms: extraction.data.bathrooms,
    kitchen: extraction.data.kitchen,
    sizeSqm: extraction.data.interiorSizeSqm || extraction.data.commercialSurfaceSqm,
    commercialSurfaceSqm: extraction.data.commercialSurfaceSqm,
    landSizeSqm: extraction.data.landSizeSqm,
    floorCount: extraction.data.floorCount,
    floorText: extraction.data.floorText,
    buildingFloors: extraction.data.buildingFloors,
    lift: extraction.data.lift,
    garageParking: extraction.data.garageParking,
    balcony: extraction.data.balcony,
    terrace: extraction.data.terrace,
    furnished: extraction.data.furnished,
    condition: extraction.data.condition,
    heating: extraction.data.heating,
    airConditioning: extraction.data.airConditioning,
    energyClass: extraction.data.energyClass,
    energyConsumption: extraction.data.energyConsumption,
    pricePerSquareMeter: extraction.data.pricePerSquareMeter,
    condoFees: extraction.data.condoFees,
    referenceCode: extraction.data.referenceCode,
    updatedDate: extraction.data.updatedDate,
    photoCount: extraction.data.photoCount,
    floorPlanCount: extraction.data.floorPlanCount,
    virtualTour: extraction.data.virtualTour,
    advertiser: extraction.data.advertiser,
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
    photoAvailability: normalizePhotoAvailability(imageUrls),
    coordinates: extraction.data.coordinates,
    rawProviderMetadata: {
      importMethod: "safe_public_html",
      extractionProvider: extraction.extractionProvider,
      extractionStatus: extraction.extractionStatus,
      extractionFields: extraction.extractionFields,
      urlClassification: extraction.urlClassification,
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
    preliminaryMatchNotes: extraction.data.casaHudNarrationSeed || buildImportedNarrationNote(sourceLabel, {
      id: "",
      provider: extraction.provider,
      title: extraction.data.title || `Imported listing from ${sourceLabel}`,
      locationText: extraction.data.locationText || "Location needs review",
      features: [],
      imageUrls,
      imageCount: imageUrls.length,
      photoAvailability: normalizePhotoAvailability(imageUrls),
      discoveredAt: importedAt,
      preliminaryMatchNotes: "",
      sourceType: "imported_url",
      needsReviewFields: extraction.needsReviewFields,
      casaHudNarrationSeed: extraction.data.casaHudNarrationSeed,
    }),
  });
}

function allNeedsReviewFields(): CasaHudListingCandidate["needsReviewFields"] {
  return ["price", "location", "property_type", "bedrooms_bathrooms", "size", "rooms", "land_size", "floor", "parking", "condition", "energy", "images", "summary"];
}

function buildManualDraftCandidate(params: {
  extraction: CasaHudImportedListingExtractionResult;
  importedAt: string;
}): CasaHudListingCandidate {
  const { extraction, importedAt } = params;
  const sourceLabel = extraction.providerName;

  return normalizeImportedListingCandidate({
    id: stableCasaHudId("listing", extraction.data.canonicalSourceUrl || extraction.data.canonicalUrl || extraction.normalizedUrl),
    provider: extraction.provider,
    sourceType: "imported_url",
    providerListingId: extraction.providerListingId,
    originalSourceUrl: extraction.data.originalSourceUrl,
    normalizedSourceUrl: extraction.data.normalizedSourceUrl || extraction.normalizedUrl,
    canonicalSourceUrl: extraction.data.canonicalSourceUrl || extraction.data.canonicalUrl || extraction.normalizedUrl,
    sourceUrl: extraction.data.sourceUrl || extraction.normalizedUrl,
    sourceHost: extraction.data.sourceHost || new URL(extraction.normalizedUrl).hostname.replace(/^www\./, ""),
    sourceLabel,
    urlClassification: extraction.urlClassification === "blocked_or_unavailable" ? "listing" : extraction.urlClassification,
    importedAt,
    extractionConfidence: extraction.extractionConfidence,
    featuredImageUrl: extraction.data.featuredImageUrl,
    thumbnailUrl: extraction.data.featuredImageUrl,
    sourceThumbnailUrl: extraction.data.featuredImageUrl,
    metadataTitle: extraction.data.metadataTitle,
    metadataDescription: extraction.data.metadataDescription,
    metadataImageUrl: extraction.data.featuredImageUrl,
    canonicalUrl: extraction.data.canonicalUrl || extraction.normalizedUrl,
    extractionStatus: extraction.extractionStatus,
    extractionProvider: extraction.extractionProvider,
    extractionFields: extraction.extractionFields,
    extractionWarnings: extraction.warnings,
    needsReviewFields: allNeedsReviewFields(),
    manualCompletionStatus: "incomplete",
    title: extraction.data.metadataTitle || extraction.data.title || `Imported ${sourceLabel} listing`,
    priceText: extraction.data.priceText,
    addressText: extraction.data.addressText,
    locationText: extraction.data.locationText || extraction.data.addressText || "Location needs review",
    country: extraction.data.country,
    region: extraction.data.region,
    city: extraction.data.city,
    province: extraction.data.province,
    price: extraction.data.price,
    currency: extraction.data.priceCurrency || "EUR",
    propertyType: extraction.data.propertyType,
    contract: extraction.data.contract,
    ownership: extraction.data.ownership,
    rooms: extraction.data.rooms,
    bedrooms: extraction.data.bedrooms,
    bathrooms: extraction.data.bathrooms,
    kitchen: extraction.data.kitchen,
    sizeSqm: extraction.data.interiorSizeSqm || extraction.data.commercialSurfaceSqm,
    commercialSurfaceSqm: extraction.data.commercialSurfaceSqm,
    landSizeSqm: extraction.data.landSizeSqm,
    floorCount: extraction.data.floorCount,
    floorText: extraction.data.floorText,
    buildingFloors: extraction.data.buildingFloors,
    lift: extraction.data.lift,
    garageParking: extraction.data.garageParking,
    balcony: extraction.data.balcony,
    terrace: extraction.data.terrace,
    furnished: extraction.data.furnished,
    condition: extraction.data.condition,
    heating: extraction.data.heating,
    airConditioning: extraction.data.airConditioning,
    energyClass: extraction.data.energyClass,
    energyConsumption: extraction.data.energyConsumption,
    pricePerSquareMeter: extraction.data.pricePerSquareMeter,
    condoFees: extraction.data.condoFees,
    referenceCode: extraction.data.referenceCode,
    updatedDate: extraction.data.updatedDate,
    photoCount: extraction.data.photoCount,
    floorPlanCount: extraction.data.floorPlanCount,
    virtualTour: extraction.data.virtualTour,
    advertiser: extraction.data.advertiser,
    descriptionSnippet: extraction.data.description,
    summary: extraction.data.summary,
    keyFeatures: extraction.data.keyFeatures,
    lifestyleHighlights: extraction.data.lifestyleHighlights,
    imageStatus: extraction.data.imageStatus,
    casaHudDisplayTitle: extraction.data.casaHudDisplayTitle,
    casaHudShortSummary: extraction.data.casaHudShortSummary,
    casaHudNarrationSeed: extraction.data.casaHudNarrationSeed,
    features: Array.from(new Set([...extraction.data.keyFeatures, ...extraction.data.lifestyleHighlights])).slice(0, 10),
    imageUrls: extraction.data.imageUrls,
    imageCount: extraction.data.imageUrls.length,
    photoAvailability: normalizePhotoAvailability(extraction.data.imageUrls),
    coordinates: extraction.data.coordinates,
    rawProviderMetadata: {
      importMethod: "safe_public_html",
      extractionProvider: extraction.extractionProvider,
      extractionStatus: extraction.extractionStatus,
      extractionFields: extraction.extractionFields,
      urlClassification: extraction.urlClassification,
      sourceHost: extraction.data.sourceHost,
      sourceLabel,
      providerName: extraction.providerName,
      providerListingId: extraction.providerListingId || null,
      canonicalUrl: extraction.data.canonicalUrl || extraction.normalizedUrl,
      manualDraft: true,
      notOfficialApi: true,
    },
    discoveredAt: importedAt,
    preliminaryMatchNotes:
      extraction.data.casaHudNarrationSeed ||
      `Imported URL saved from ${sourceLabel}. Complete the missing listing details so CasaHUD can use it in validation, Video Builder, and publish planning.`,
  });
}

function parseStatusFromExtraction(extraction: CasaHudImportedListingExtractionResult) {
  return extraction.extractionStatus === "partial" ? "partial" : "imported";
}

function shouldCreateManualDraft(extraction: CasaHudImportedListingExtractionResult) {
  return extraction.urlClassification === "listing" || extraction.urlClassification === "blocked_or_unavailable";
}

function buildCandidateKeys(candidate: CasaHudListingCandidate): string[] {
  return [
    candidate.originalSourceUrl,
    candidate.normalizedSourceUrl,
    candidate.canonicalSourceUrl,
    candidate.sourceUrl,
    candidate.canonicalUrl,
  ]
    .filter(Boolean)
    .map((value) => dedupeKey(value!));
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

  async function processUrl(inputUrl: string, allowSearchExpansion = true) {
    let normalizedUrl: string | undefined;
    let provider: CasaHudListingProvider | undefined;
    let providerName: string | undefined;
    let classification: CasaHudListingUrlClassification | undefined;

    try {
      const classificationInfo = classifyListingImportUrl(inputUrl);
      normalizedUrl = classificationInfo.normalizedUrl;
      provider = classificationInfo.provider;
      providerName = classificationInfo.providerName;
      classification = classificationInfo.classification;
    } catch (error) {
      results.push({
        inputUrl,
        status: "invalid",
        warnings: [],
        urlClassification: "invalid_or_unsafe",
        reason: error instanceof Error ? error.message : "Invalid URL.",
        nextAction: "Paste a safe public http/https listing URL.",
      });
      return;
    }

    const requestKey = dedupeKey(normalizedUrl);
    if (existingKeys.has(requestKey) || seenInRequest.has(requestKey)) {
      results.push({
        inputUrl,
        normalizedUrl,
        provider,
        providerName,
        urlClassification: classification,
        status: "duplicate",
        warnings: [],
        reason: "Duplicate URL skipped.",
        nextAction: "Review the existing imported listing on this campaign.",
      });
      return;
    }

    const extraction = await extractListingUrlMetadata({
      url: normalizedUrl,
      fetchImpl: fetchFn,
    });

    const extractionClassification = extraction.urlClassification || classification;
    if (extractionClassification === "search_results") {
      seenInRequest.add(requestKey);
      const discoveredListingUrls = extraction.discoveredListingUrls.slice(0, MAX_SEARCH_PAGE_DISCOVERIES);
      results.push({
        inputUrl,
        normalizedUrl,
        provider: extraction.provider,
        providerName: extraction.providerName,
        urlClassification: "search_results",
        extractionStatus: extraction.extractionStatus,
        status: "search_results",
        warnings: extraction.warnings,
        discoveredListingUrls,
        reason:
          discoveredListingUrls.length > 0
            ? `Search results page detected. CasaHUD imported up to ${discoveredListingUrls.length} listing URL${discoveredListingUrls.length === 1 ? "" : "s"} from the public page.`
            : "This looks like a search results page. Paste individual listing URLs or choose listings to import.",
        nextAction:
          discoveredListingUrls.length > 0
            ? "Review the imported listings added from the public search page."
            : "Paste one or more individual listing URLs instead of the search page.",
      });

      if (allowSearchExpansion) {
        for (const discoveredUrl of discoveredListingUrls) {
          await processUrl(discoveredUrl, false);
        }
      }
      return;
    }

    if (shouldImportExtraction(extraction)) {
      const candidate = buildImportedCandidate({
        extraction,
        importedAt,
      });
      const candidateKeys = buildCandidateKeys(candidate);
      if (candidateKeys.some((key) => existingKeys.has(key) || seenInRequest.has(key))) {
        results.push({
          inputUrl,
          normalizedUrl,
          provider: extraction.provider,
          providerName: extraction.providerName,
          urlClassification: extractionClassification,
          extractionStatus: extraction.extractionStatus,
          status: "duplicate",
          warnings: extraction.warnings,
          reason: "Duplicate URL skipped.",
          nextAction: "Review the existing imported listing on this campaign.",
        });
        return;
      }

      seenInRequest.add(requestKey);
      candidateKeys.forEach((key) => seenInRequest.add(key));
      results.push({
        inputUrl,
        normalizedUrl,
        provider: extraction.provider,
        providerName: extraction.providerName,
        urlClassification: extractionClassification,
        extractionStatus: extraction.extractionStatus,
        status: parseStatusFromExtraction(extraction),
        candidate,
        warnings: extraction.warnings,
        reason:
          extraction.extractionStatus === "partial"
            ? "Imported with missing details. Complete the missing fields before validation."
            : "Public listing details extracted successfully.",
        nextAction:
          extraction.extractionStatus === "partial"
            ? "Open Complete Listing Details to fill the missing facts."
            : "Review the imported property and move it into validation when ready.",
      });
      importedCandidates.push(candidate);
      return;
    }

    if (shouldCreateManualDraft(extraction)) {
      const candidate = buildManualDraftCandidate({
        extraction,
        importedAt,
      });
      const candidateKeys = buildCandidateKeys(candidate);
      if (candidateKeys.some((key) => existingKeys.has(key) || seenInRequest.has(key))) {
        results.push({
          inputUrl,
          normalizedUrl,
          provider: extraction.provider,
          providerName: extraction.providerName,
          urlClassification: extractionClassification,
          extractionStatus: extraction.extractionStatus,
          status: "duplicate",
          warnings: extraction.warnings,
          reason: "Duplicate URL skipped.",
          nextAction: "Review the existing imported listing on this campaign.",
        });
        return;
      }

      seenInRequest.add(requestKey);
      candidateKeys.forEach((key) => seenInRequest.add(key));
      results.push({
        inputUrl,
        normalizedUrl,
        provider: extraction.provider,
        providerName: extraction.providerName,
        urlClassification: extractionClassification,
        extractionStatus: extraction.extractionStatus,
        status: "manual_draft",
        candidate,
        warnings: extraction.warnings,
        reason:
          extraction.extractionStatus === "blocked_or_unavailable"
            ? "Source page was blocked for safe extraction, so CasaHUD created a manual draft."
            : "CasaHUD created a manual draft because the public page did not expose enough listing detail.",
        nextAction: "Open Complete Listing Details to finish the imported property.",
      });
      importedCandidates.push(candidate);
      return;
    }

    results.push({
      inputUrl,
      normalizedUrl,
      provider: extraction.provider,
      providerName: extraction.providerName,
      urlClassification: extractionClassification,
      extractionStatus: extraction.extractionStatus,
      status: "failed",
      warnings: extraction.warnings,
      reason:
        extraction.extractionStatus === "blocked_or_unavailable"
          ? "Source page blocked or unavailable for safe extraction."
          : "CasaHUD could not use this URL as a property listing.",
      nextAction:
        extractionClassification === "unsupported_provider_path"
          ? "Paste an individual listing URL instead of a provider navigation page."
          : "Paste a readable public listing URL or complete a manual draft.",
    });
  }

  for (const inputUrl of urls) {
    await processUrl(inputUrl);
  }

  const importedCount = results.filter((result) => result.status === "imported").length;
  const partialCount = results.filter((result) => result.status === "partial").length;
  const manualDraftCount = results.filter((result) => result.status === "manual_draft").length;
  const duplicateCount = results.filter((result) => result.status === "duplicate").length;
  const searchPageCount = results.filter((result) => result.status === "search_results").length;
  const invalidCount = results.filter((result) => result.status === "invalid").length;
  const failedCount = results.filter((result) => result.status === "failed").length;

  return {
    results,
    importedCandidates,
    importedCount,
    partialCount,
    manualDraftCount,
    duplicateCount,
    searchPageCount,
    invalidCount,
    failedCount,
    skippedCount: duplicateCount + invalidCount + failedCount,
    warnings: Array.from(new Set(results.flatMap((result) => result.warnings))),
    importedAt,
  };
}

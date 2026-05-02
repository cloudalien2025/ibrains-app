import type {
  CasaHudCampaign,
  CasaHudListingCandidate,
  CasaHudListingValidationScoreBreakdown,
  CasaHudValidatedListing,
} from "@/lib/studio/domara/campaigns";

function hasMeaningfulText(value: string | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return false;
  return !normalized.includes("needs review");
}

function hasUsableImage(listing: CasaHudListingCandidate | CasaHudValidatedListing): boolean {
  if (hasMeaningfulText(listing.manualFeaturedImageUrl)) return true;
  if (hasMeaningfulText(listing.featuredImageUrl)) return true;
  if (Array.isArray(listing.imageUrls) && listing.imageUrls.length > 0) return true;
  if (typeof listing.imageCount === "number" && listing.imageCount > 0) return true;
  return listing.photoAvailability === "available" || listing.photoAvailability === "limited";
}

function hasCoreFacts(listing: CasaHudListingCandidate | CasaHudValidatedListing): boolean {
  if (typeof listing.rooms === "number" && listing.rooms > 0) return true;
  if (typeof listing.bedrooms === "number" && listing.bedrooms > 0) return true;
  if (typeof listing.bathrooms === "number" && listing.bathrooms > 0) return true;
  if (typeof listing.sizeSqm === "number" && listing.sizeSqm > 0) return true;
  if (typeof listing.commercialSurfaceSqm === "number" && listing.commercialSurfaceSqm > 0) return true;
  if (typeof listing.landSizeSqm === "number" && listing.landSizeSqm > 0) return true;
  return Array.isArray(listing.features) && listing.features.length > 0;
}

function isDemoListing(listing: CasaHudListingCandidate | CasaHudValidatedListing): boolean {
  return listing.sourceType === "sample_pattern" || listing.provider === "casahud_sample";
}

function isUserImportedListing(listing: CasaHudListingCandidate | CasaHudValidatedListing): boolean {
  return listing.sourceType === "imported_url" || listing.sourceType === "browser_assisted_import";
}

export function isCompleteUserImportedListing(listing: CasaHudListingCandidate | CasaHudValidatedListing): boolean {
  if (!isUserImportedListing(listing)) return false;

  const hasTitle = hasMeaningfulText(listing.title);
  const hasLocation = hasMeaningfulText(listing.locationText);
  const hasPrice = typeof listing.price === "number" && Number.isFinite(listing.price) && listing.price > 0;
  const hasPropertyType = hasMeaningfulText(listing.propertyType);
  const hasDescription = hasMeaningfulText(
    listing.descriptionSnippet || listing.summary || listing.manualLifestyleAngle || listing.casaHudShortSummary,
  );
  const completionMarked = listing.manualCompletionStatus === "completed";

  return (
    hasTitle &&
    hasLocation &&
    hasPrice &&
    hasPropertyType &&
    hasCoreFacts(listing) &&
    hasDescription &&
    hasUsableImage(listing) &&
    completionMarked
  );
}

function defaultScoreBreakdown(listing: CasaHudListingCandidate | CasaHudValidatedListing): CasaHudListingValidationScoreBreakdown {
  const mediaAvailabilityScore = hasUsableImage(listing) ? 64 : 24;
  const listingCompletenessScore = isCompleteUserImportedListing(listing) ? 80 : 50;
  const titleMatchScore =
    "overallScore" in listing && typeof listing.overallScore === "number"
      ? Math.max(48, Math.round(listing.overallScore))
      : 69;

  const baseline = {
    titleMatchScore,
    geographyScore: 70,
    priceFitScore: 74,
    propertyTypeScore: 72,
    featureClaimScore: 66,
    mediaAvailabilityScore,
    listingCompletenessScore,
    providerQualityScore: 76,
    uniquenessScore: 96,
  };

  const overallScore = Math.round(
    baseline.titleMatchScore * 0.2 +
      baseline.geographyScore * 0.15 +
      baseline.priceFitScore * 0.12 +
      baseline.propertyTypeScore * 0.12 +
      baseline.featureClaimScore * 0.12 +
      baseline.mediaAvailabilityScore * 0.1 +
      baseline.listingCompletenessScore * 0.09 +
      baseline.providerQualityScore * 0.05 +
      baseline.uniquenessScore * 0.05,
  );

  return {
    ...baseline,
    overallScore,
  };
}

function toScriptReadyValidatedListing(listing: CasaHudListingCandidate | CasaHudValidatedListing): CasaHudValidatedListing {
  const existingBreakdown = (listing as CasaHudValidatedListing).scoreBreakdown;
  const scoreBreakdown = existingBreakdown || defaultScoreBreakdown(listing);
  const existingWarnings = "warnings" in listing && Array.isArray(listing.warnings) ? listing.warnings : [];
  const existingReasons =
    "validationReasons" in listing && Array.isArray(listing.validationReasons) ? listing.validationReasons : [];

  return {
    ...(listing as CasaHudValidatedListing),
    validationStatus: "approved",
    overallScore:
      typeof (listing as CasaHudValidatedListing).overallScore === "number"
        ? Math.round((listing as CasaHudValidatedListing).overallScore)
        : scoreBreakdown.overallScore,
    scoreBreakdown,
    validationReasons: Array.from(
      new Set([
        ...existingReasons,
        "User-imported listing has complete core facts and is script-ready for current workflow generation.",
      ]),
    ),
    warnings: Array.from(
      new Set([
        ...existingWarnings,
        ...(listing.needsReviewFields?.length
          ? ["Some optional imported fields still need review, but core listing details are complete."]
          : []),
      ]),
    ),
    duplicateGroupKey:
      (listing as CasaHudValidatedListing).duplicateGroupKey ||
      listing.sourceUrl ||
      listing.normalizedSourceUrl ||
      `script-ready:${listing.id}`,
  };
}

function sortByRank(campaign: CasaHudCampaign, listings: CasaHudValidatedListing[]): CasaHudValidatedListing[] {
  const rankOrder = Array.isArray(campaign.listingRankOrder) ? campaign.listingRankOrder : [];
  const rankMap = new Map(rankOrder.map((id, index) => [id, index]));
  return [...listings]
    .sort((left, right) => {
      const leftRank = rankMap.get(left.id) ?? left.rank ?? Number.MAX_SAFE_INTEGER;
      const rightRank = rankMap.get(right.id) ?? right.rank ?? Number.MAX_SAFE_INTEGER;
      if (leftRank !== rightRank) return leftRank - rightRank;
      return (right.overallScore || 0) - (left.overallScore || 0);
    })
    .map((listing, index) => ({
      ...listing,
      rank: index + 1,
      validationStatus: "approved",
    }));
}

export function deriveCasaHudWorkingListings(campaign: CasaHudCampaign): CasaHudValidatedListing[] {
  const approvedListings = Array.isArray(campaign.approvedListings) ? campaign.approvedListings : [];
  const listingCandidates = Array.isArray(campaign.listingCandidates) ? campaign.listingCandidates : [];
  const rejectedListings = Array.isArray(campaign.rejectedListings) ? campaign.rejectedListings : [];
  const approvedReal = approvedListings.filter((listing) => !isDemoListing(listing));
  const approvedDemo = approvedListings.filter((listing) => isDemoListing(listing));
  const promotedPool = [
    ...listingCandidates,
    ...rejectedListings.filter((listing) => listing.validationStatus === "needs_attention"),
  ];
  const scriptReadyReal = promotedPool.filter((listing) => !isDemoListing(listing) && isCompleteUserImportedListing(listing));
  const hasRealListings = approvedReal.length > 0 || scriptReadyReal.length > 0;
  const seedListings = hasRealListings ? approvedReal : approvedDemo;

  const byId = new Map<string, CasaHudValidatedListing>();
  for (const listing of seedListings) {
    byId.set(listing.id, {
      ...listing,
      validationStatus: "approved",
    });
  }
  for (const listing of scriptReadyReal) {
    if (!byId.has(listing.id)) {
      byId.set(listing.id, toScriptReadyValidatedListing(listing));
    }
  }

  return sortByRank(campaign, Array.from(byId.values()));
}

export function hasCasaHudWorkingListings(campaign: CasaHudCampaign): boolean {
  return deriveCasaHudWorkingListings(campaign).length > 0;
}

export function isCasaHudScriptPackageStale(campaign: CasaHudCampaign): boolean {
  const staleWarning = (campaign.scriptWarnings || []).some((warning) =>
    /Regenerate Script from Current Listings/i.test(warning),
  );
  const hasGeneratedScript = campaign.scriptGenerationStatus === "script_generated";
  const workingIds = deriveCasaHudWorkingListings(campaign).map((listing) => listing.id);
  const scriptListingIds = Array.from(new Set((campaign.propertySegments || []).map((segment) => segment.listingId)));

  if (!hasGeneratedScript) return staleWarning;
  if (workingIds.length === 0) return true;
  if (scriptListingIds.length === 0) return true;
  if (workingIds.length !== scriptListingIds.length) return true;
  if (workingIds.some((id) => !scriptListingIds.includes(id))) return true;
  return staleWarning;
}

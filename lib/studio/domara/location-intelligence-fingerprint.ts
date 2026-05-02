import { stableCasaHudHash } from "@/lib/studio/domara/ai-channel-engine/ids";
import type { CasaHudCampaign, CasaHudValidatedListing } from "@/lib/studio/domara/campaigns";
import { deriveCasaHudWorkingListings } from "@/lib/studio/domara/listing-working-set";

function normalizeText(value: string | undefined): string {
  return (value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function uniqueStrings(values: Array<string | undefined>): string[] {
  return Array.from(
    new Set(
      values
        .flatMap((value) => (typeof value === "string" ? [value.trim()] : []))
        .filter((value) => value.length > 0),
    ),
  );
}

function listingLocationParts(locationText: string | undefined): string[] {
  if (!locationText) return [];
  return locationText
    .split(/[,\-–|]/)
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, 4);
}

function listingLocationSignature(listing: CasaHudValidatedListing): string {
  const coordinates = listing.coordinates
    ? `${listing.coordinates.latitude.toFixed(5)},${listing.coordinates.longitude.toFixed(5)}`
    : "no_coordinates";
  const sourceUrl = listing.sourceUrl || listing.normalizedSourceUrl || listing.canonicalSourceUrl || "";

  return [
    listing.id,
    normalizeText(listing.locationText),
    normalizeText(listing.city),
    normalizeText(listing.region),
    normalizeText(listing.country),
    normalizeText(sourceUrl),
    coordinates,
  ].join("|");
}

export function deriveApprovedListingLocationLabels(approvedListings: CasaHudValidatedListing[]): string[] {
  return uniqueStrings(
    approvedListings.flatMap((listing) => [
      listing.city,
      listing.region,
      ...listingLocationParts(listing.locationText),
    ]),
  ).slice(0, 6);
}

export function computeApprovedListingsLocationFingerprint(approvedListings: CasaHudValidatedListing[]): string {
  if (approvedListings.length === 0) return "approved:none";
  const signatures = approvedListings
    .map((listing) => listingLocationSignature(listing))
    .sort((left, right) => left.localeCompare(right));
  return `approved:${stableCasaHudHash(signatures.join("||"))}`;
}

function locationIntelligenceCorpus(campaign: CasaHudCampaign): string {
  return normalizeText(
    [
      campaign.locationStory?.headline,
      campaign.locationStory?.summary,
      ...(campaign.locationStory?.regionHighlights || []),
      ...(campaign.localHighlights || []).map((item) => item.locationText),
      ...(campaign.poiBundle?.cards || []).map((item) => item.locationText),
      ...(campaign.mapSceneIdeas || []).map((item) => item.locationText),
      ...(campaign.listingLocationInsights || []).map((item) => item.summary),
      ...(campaign.listingLocationInsights || []).flatMap((item) => item.highlights),
    ].join(" "),
  );
}

const NON_DISTINCTIVE_LOCATION_LABELS = new Set([
  "italy",
  "south",
  "southern",
  "north",
  "europe",
  "coast",
  "coastal",
  "center",
  "centre",
  "region",
]);

function hasLegacyLocationMatch(listings: CasaHudValidatedListing[], campaign: CasaHudCampaign): boolean {
  const anchors = deriveApprovedListingLocationLabels(listings)
    .map((value) => normalizeText(value))
    .filter((value) => value.length >= 4 && !NON_DISTINCTIVE_LOCATION_LABELS.has(value));

  if (anchors.length === 0) return false;
  const corpus = locationIntelligenceCorpus(campaign);
  return anchors.some((anchor) => corpus.includes(anchor));
}

export function isCasaHudLocationIntelligenceStale(campaign: CasaHudCampaign): boolean {
  if (campaign.locationIntelligenceStatus !== "location_intelligence_completed") return false;
  const workingListings = deriveCasaHudWorkingListings(campaign);
  if (workingListings.length === 0) return true;

  const expectedFingerprint = computeApprovedListingsLocationFingerprint(workingListings);
  const storedFingerprint = campaign.locationIntelligenceSummary?.listingFingerprint?.trim();
  if (storedFingerprint) {
    return storedFingerprint !== expectedFingerprint;
  }

  // Backward-compatible fallback for legacy location records that predate fingerprinting.
  return !hasLegacyLocationMatch(workingListings, campaign);
}

export function resolveLocationSourceLabels(campaign: CasaHudCampaign): string[] {
  const fromSummary = campaign.locationIntelligenceSummary?.sourceLocations || [];
  if (fromSummary.length > 0) return fromSummary;
  return deriveApprovedListingLocationLabels(deriveCasaHudWorkingListings(campaign));
}

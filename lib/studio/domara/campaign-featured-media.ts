import type {
  CasaHudCampaign,
  CasaHudListingCandidate,
  CasaHudValidatedListing,
} from "@/lib/studio/domara/campaigns";
import type { CasaHudVisualAsset } from "@/lib/studio/domara/campaign-media-planning";

export type CasaHudFeaturedPropertyMediaKind = "real_image" | "thumbnail" | "media_asset" | "fallback";

export type CasaHudFeaturedPropertyMedia = {
  kind: CasaHudFeaturedPropertyMediaKind;
  url: string | null;
  label: string;
  alt: string;
  warning?: string;
  source?: string;
  sourceLabel: string;
  stateLabel: string;
  fallbackLabel: string;
  fallbackDetail: string;
  hasRealImage: boolean;
};

const SOURCE_LABEL_OVERRIDES: Record<string, string> = {
  idealista: "Idealista",
  immobiliare: "Immobiliare",
  casahud_sample: "CasaHUD listing patterns",
  listing_source_media: "Listing source media",
  location_visual_plan: "Location visual plan",
  casahud_visual_placeholders: "CasaHUD media planning",
  mapbox_static_images: "Mapbox",
  google_places: "Google Places",
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function humanizeLabel(value: string | null | undefined, fallback: string) {
  if (!value) return fallback;
  return SOURCE_LABEL_OVERRIDES[value] || value.replace(/[_-]+/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function readImageCandidateFromUnknown(value: unknown): string | null {
  if (typeof value === "string") return value.trim() || null;
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const record = value as Record<string, unknown>;
  return (
    asNonEmptyString(record.url) ||
    asNonEmptyString(record.src) ||
    asNonEmptyString(record.href) ||
    asNonEmptyString(record.mediaUrl) ||
    asNonEmptyString(record.media_url) ||
    asNonEmptyString(record.imageUrl) ||
    asNonEmptyString(record.image_url) ||
    null
  );
}

function readFirstImageFromArray(value: unknown): string | null {
  if (!Array.isArray(value)) return null;
  for (const item of value) {
    const candidate = readImageCandidateFromUnknown(item);
    if (candidate) return candidate;
  }
  return null;
}

function firstImageUrl(value: unknown): string | null {
  return Array.isArray(value) ? asNonEmptyString(value[0]) : null;
}

function collectListingSegmentIds(campaign: CasaHudCampaign | null, listingId: string) {
  if (!campaign) return new Set<string>();
  return new Set(
    campaign.scriptSegments
      .filter((segment) => segment.associatedListingId === listingId)
      .map((segment) => segment.id),
  );
}

function collectRelatedAssets(campaign: CasaHudCampaign | null, listingId: string) {
  if (!campaign) return [];

  const segmentIds = collectListingSegmentIds(campaign, listingId);
  const mappedAssetIds = campaign.sceneAssetMapping
    .filter((mapping) => segmentIds.has(mapping.segmentId))
    .flatMap((mapping) => mapping.assignedAssetIds);
  const thumbnailAssetIds = campaign.thumbnailCandidateInputs
    .filter((candidate) => candidate.listingId === listingId)
    .flatMap((candidate) => candidate.associatedAssetIds);
  const relatedIds = new Set([...mappedAssetIds, ...thumbnailAssetIds]);
  const orderedAssets = campaign.visualAssets.filter(
    (asset) => asset.listingId === listingId || relatedIds.has(asset.id),
  );
  const dedupedAssets: CasaHudVisualAsset[] = [];
  const seen = new Set<string>();

  for (const asset of orderedAssets) {
    if (seen.has(asset.id)) continue;
    seen.add(asset.id);
    dedupedAssets.push(asset);
  }

  return dedupedAssets.sort((left, right) => {
    const leftRank =
      left.type === "listing_image"
        ? 0
        : left.availabilityStatus === "available"
          ? 1
          : left.availabilityStatus === "planned"
            ? 2
            : 3;
    const rightRank =
      right.type === "listing_image"
        ? 0
        : right.availabilityStatus === "available"
          ? 1
          : right.availabilityStatus === "planned"
            ? 2
            : 3;

    return leftRank - rightRank;
  });
}

function buildMedia(params: {
  kind: CasaHudFeaturedPropertyMediaKind;
  url: string | null;
  stateLabel: string;
  source: string;
  alt: string;
  warning?: string;
  fallbackLabel?: string;
  fallbackDetail?: string;
  hasRealImage?: boolean;
}) {
  const hasRealImage = params.hasRealImage ?? params.kind !== "fallback";
  const fallbackLabel = params.fallbackLabel || (hasRealImage ? "Image needed" : params.stateLabel);
  const fallbackDetail =
    params.fallbackDetail || (hasRealImage ? "Listing image unavailable." : params.warning || "Listing image unavailable.");

  return {
    kind: params.kind,
    url: hasRealImage ? params.url : null,
    label: params.stateLabel,
    alt: params.alt,
    warning: params.warning,
    source: params.source,
    sourceLabel: params.source,
    stateLabel: params.stateLabel,
    fallbackLabel,
    fallbackDetail,
    hasRealImage,
  } satisfies CasaHudFeaturedPropertyMedia;
}

function placeholderMedia(listing: CasaHudListingCandidate | CasaHudValidatedListing, asset?: CasaHudVisualAsset | null) {
  const warning = asset?.warning || "Listing image is still being prepared.";
  const label = asset ? "Media placeholder" : "Image needed";
  const detail = asset?.warning || "Listing image unavailable.";

  return buildMedia({
    kind: "fallback",
    url: null,
    stateLabel: label,
    source: humanizeLabel(asset?.sourceProvider || listing.provider, "CasaHUD fallback"),
    alt: `${listing.title} ${label.toLowerCase()}`,
    warning,
    fallbackLabel: label,
    fallbackDetail: detail,
    hasRealImage: false,
  });
}

function imageFromAsset(listing: CasaHudListingCandidate | CasaHudValidatedListing, asset: CasaHudVisualAsset) {
  const kind: CasaHudFeaturedPropertyMediaKind = asset.type === "listing_image" ? "real_image" : "media_asset";
  return buildMedia({
    kind,
    url: asset.sourceUrl || null,
    stateLabel: asset.type === "listing_image" ? "Listing image" : "Source thumbnail",
    source: humanizeLabel(asset.sourceProvider, humanizeLabel(listing.provider, "Listing source")),
    alt: `${listing.title} ${asset.type === "listing_image" ? "listing image" : "source thumbnail"}`,
    warning: asset.warning,
  });
}

export function deriveCasaHudFeaturedPropertyMedia(
  listing: CasaHudListingCandidate | CasaHudValidatedListing,
  campaign: CasaHudCampaign | null,
): CasaHudFeaturedPropertyMedia {
  const listingRecord = asRecord(listing);
  const metadataRecord = asRecord(listing.rawProviderMetadata);
  const sourceLabel = humanizeLabel(listing.provider, "Listing source");

  const explicitFeaturedImage =
    asNonEmptyString(listingRecord.featuredImageUrl) ||
    asNonEmptyString(listingRecord.featured_image_url) ||
    asNonEmptyString(listingRecord.mainImageUrl) ||
    asNonEmptyString(listingRecord.main_image_url) ||
    asNonEmptyString(listingRecord.heroImage) ||
    asNonEmptyString(listingRecord.hero_image) ||
    asNonEmptyString(listingRecord.primaryImage) ||
    asNonEmptyString(listingRecord.primary_image) ||
    asNonEmptyString(listingRecord.mediaUrl) ||
    asNonEmptyString(listingRecord.media_url) ||
    asNonEmptyString(metadataRecord.featuredImageUrl) ||
    asNonEmptyString(metadataRecord.featured_image_url) ||
    asNonEmptyString(metadataRecord.mainImageUrl) ||
    asNonEmptyString(metadataRecord.main_image_url) ||
    asNonEmptyString(metadataRecord.heroImage) ||
    asNonEmptyString(metadataRecord.hero_image) ||
    asNonEmptyString(metadataRecord.primaryImage) ||
    asNonEmptyString(metadataRecord.primary_image) ||
    asNonEmptyString(metadataRecord.mediaUrl) ||
    asNonEmptyString(metadataRecord.media_url);

  if (explicitFeaturedImage) {
    return buildMedia({
      kind: "real_image",
      url: explicitFeaturedImage,
      stateLabel: "Listing image",
      source: sourceLabel,
      alt: `${listing.title} listing image`,
    });
  }

  const imageUrl =
    firstImageUrl(listingRecord.imageUrls) ||
    firstImageUrl(metadataRecord.imageUrls) ||
    firstImageUrl(metadataRecord.image_urls);
  if (imageUrl) {
    return buildMedia({
      kind: "real_image",
      url: imageUrl,
      stateLabel: "Listing image",
      source: sourceLabel,
      alt: `${listing.title} listing image`,
    });
  }

  const structuredImage =
    readFirstImageFromArray(listingRecord.images) ||
    readFirstImageFromArray(listingRecord.photos) ||
    readFirstImageFromArray(listingRecord.gallery) ||
    readFirstImageFromArray(listingRecord.photoUrls) ||
    readFirstImageFromArray(listingRecord.photo_urls) ||
    readFirstImageFromArray(metadataRecord.images) ||
    readFirstImageFromArray(metadataRecord.photos) ||
    readFirstImageFromArray(metadataRecord.gallery) ||
    readFirstImageFromArray(metadataRecord.photoUrls) ||
    readFirstImageFromArray(metadataRecord.photo_urls);
  if (structuredImage) {
    return buildMedia({
      kind: "real_image",
      url: structuredImage,
      stateLabel: "Listing image",
      source: sourceLabel,
      alt: `${listing.title} listing image`,
    });
  }

  const sourceThumbnail =
    asNonEmptyString(listingRecord.thumbnailUrl) ||
    asNonEmptyString(listingRecord.thumbnail_url) ||
    asNonEmptyString(listingRecord.sourceThumbnailUrl) ||
    asNonEmptyString(listingRecord.source_thumbnail_url) ||
    asNonEmptyString(listingRecord.imageUrl) ||
    asNonEmptyString(listingRecord.image_url) ||
    asNonEmptyString(listingRecord.photoUrl) ||
    asNonEmptyString(listingRecord.photo_url) ||
    asNonEmptyString(metadataRecord.thumbnailUrl) ||
    asNonEmptyString(metadataRecord.thumbnail_url) ||
    asNonEmptyString(metadataRecord.sourceThumbnailUrl) ||
    asNonEmptyString(metadataRecord.source_thumbnail_url) ||
    asNonEmptyString(metadataRecord.imageUrl) ||
    asNonEmptyString(metadataRecord.image_url) ||
    asNonEmptyString(metadataRecord.photoUrl) ||
    asNonEmptyString(metadataRecord.photo_url);

  if (sourceThumbnail) {
    return buildMedia({
      kind: "thumbnail",
      url: sourceThumbnail,
      stateLabel: "Source thumbnail",
      source: sourceLabel,
      alt: `${listing.title} source thumbnail`,
    });
  }

  const relatedAssets = collectRelatedAssets(campaign, listing.id);
  const realAsset = relatedAssets.find(
    (asset) =>
      Boolean(asset.sourceUrl) &&
      asset.type !== "fallback_placeholder" &&
      asset.availabilityStatus !== "placeholder" &&
      asset.availabilityStatus !== "missing",
  );
  if (realAsset) return imageFromAsset(listing, realAsset);

  const placeholderAsset = relatedAssets.find(
    (asset) =>
      asset.type === "fallback_placeholder" ||
      asset.availabilityStatus === "placeholder" ||
      asset.availabilityStatus === "planned" ||
      asset.availabilityStatus === "missing",
  );
  if (placeholderAsset) return placeholderMedia(listing, placeholderAsset);

  return placeholderMedia(listing);
}

export const getCasaHudPropertyFeaturedMedia = deriveCasaHudFeaturedPropertyMedia;

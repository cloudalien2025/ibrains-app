import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { ensureUser, resolveUserId } from "@/app/api/ecomviper/_utils/user";
import {
  getCasaHudCampaign,
  isCasaHudCampaignStoreAvailable,
  isCasaHudCampaignStoreUnavailable,
  saveCasaHudCampaign,
} from "@/lib/studio/domara/campaign-repository";
import {
  createPropertyDiscoveryNextPhase,
  toCasaHudCampaignSummary,
  type CasaHudCampaign,
  type CasaHudListingCandidate,
} from "@/lib/studio/domara/campaigns";
import { nowIso } from "@/lib/studio/domara/ai-channel-engine/ids";
import { normalizeImportedListingCandidate } from "@/lib/studio/domara/imported-listing-candidate";
import { validateDomaraImageUrls } from "@/lib/studio/domara/image-handling";
import { normalizeListingImportUrl } from "@/lib/studio/domara/listing-url-importer";
import { createEmptyCasaHudLocationData } from "@/lib/studio/domara/campaign-location-intelligence";
import { createEmptyCasaHudScriptData } from "@/lib/studio/domara/campaign-script-narrative";
import { createEmptyCasaHudMediaPlanData } from "@/lib/studio/domara/campaign-media-planning";
import { createEmptyCasaHudYouTubePackageData } from "@/lib/studio/domara/campaign-youtube-package";
import { createEmptyCasaHudExecutionData } from "@/lib/studio/domara/campaign-execution";

export const runtime = "nodejs";

function errorResponse(status: number, message: string, code: string, reqId = crypto.randomUUID()) {
  return NextResponse.json({ ok: false, error: { message, code, reqId } }, { status });
}

function optionalString(value: unknown, field: string) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") throw new Error(`${field} must be a string.`);
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function optionalNumber(value: unknown, field: string) {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const normalized = Number(value.replace(/,/g, ".").replace(/[^\d.+-]/g, ""));
    if (Number.isFinite(normalized)) return normalized;
  }
  throw new Error(`${field} must be a number.`);
}

function optionalBoolean(value: unknown, field: string) {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value === "boolean") return value;
  throw new Error(`${field} must be true or false.`);
}

function optionalStringArray(value: unknown, field: string) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (Array.isArray(value)) {
    return Array.from(new Set(value.map((item) => optionalString(item, field)).filter((item): item is string => Boolean(item))));
  }
  if (typeof value === "string") {
    const values = value
      .split(/\r?\n|,/)
      .map((item) => item.trim())
      .filter(Boolean);
    return Array.from(new Set(values));
  }
  throw new Error(`${field} must be a list of strings.`);
}

function resolveManualImage(value: string | null | undefined) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const validated = validateDomaraImageUrls([value]);
  const accepted = validated.acceptedUrls[0];
  if (!accepted) {
    throw new Error(validated.warnings[0] || "Manual featured image URL is invalid.");
  }
  return accepted;
}

function mergeImportedListing(
  campaign: CasaHudCampaign,
  listingId: string,
  nextListing: CasaHudListingCandidate,
): CasaHudCampaign {
  return {
    ...campaign,
    listingCandidates: campaign.listingCandidates.map((listing) => (listing.id === listingId ? nextListing : listing)),
    approvedListings: campaign.approvedListings.map((listing) => (listing.id === listingId ? { ...listing, ...nextListing } : listing)),
    rejectedListings: campaign.rejectedListings.map((listing) => (listing.id === listingId ? { ...listing, ...nextListing } : listing)),
    updatedAt: nextListing.manualUpdatedAt || nowIso(),
  };
}

function removeListingFromCampaign(campaign: CasaHudCampaign, listingId: string): CasaHudCampaign {
  const listingCandidates = campaign.listingCandidates.filter((listing) => listing.id !== listingId);
  const approvedListings = campaign.approvedListings.filter((listing) => listing.id !== listingId);
  const rejectedListings = campaign.rejectedListings.filter((listing) => listing.id !== listingId);
  const listingRankOrder = campaign.listingRankOrder.filter((id) => id !== listingId);

  const removedAssetIds = new Set(
    campaign.visualAssets.filter((asset) => asset.listingId === listingId).map((asset) => asset.id),
  );
  const visualAssets = campaign.visualAssets.filter((asset) => asset.listingId !== listingId);
  const sceneAssetMapping = campaign.sceneAssetMapping.map((mapping) => ({
    ...mapping,
    assignedAssetIds: mapping.assignedAssetIds.filter((assetId) => !removedAssetIds.has(assetId)),
  }));
  const shotList = campaign.shotList
    .filter((item) => item.associatedListingId !== listingId)
    .map((item) => ({
      ...item,
      assetIds: item.assetIds.filter((assetId) => !removedAssetIds.has(assetId)),
    }));
  const listingImageCoverage = campaign.listingImageCoverage.filter((coverage) => coverage.listingId !== listingId);
  const mapLocationVisualPlan = campaign.mapLocationVisualPlan.filter((item) => item.associatedListingId !== listingId);
  const thumbnailCandidateInputs = campaign.thumbnailCandidateInputs
    .filter((candidate) => candidate.listingId !== listingId)
    .map((candidate) => ({
      ...candidate,
      associatedAssetIds: candidate.associatedAssetIds.filter((assetId) => !removedAssetIds.has(assetId)),
    }));

  const localHighlights = campaign.localHighlights.filter((highlight) => highlight.associatedListingId !== listingId);
  const poiCards = (campaign.poiBundle?.cards || []).filter((poi) => poi.associatedListingId !== listingId);
  const poiBundle = campaign.poiBundle
    ? {
        ...campaign.poiBundle,
        cards: poiCards,
      }
    : null;
  const mapSceneIdeas = campaign.mapSceneIdeas.filter((scene) => scene.associatedListingId !== listingId);
  const listingLocationInsights = campaign.listingLocationInsights
    .filter((insight) => insight.listingId !== listingId)
    .map((insight) => ({
      ...insight,
      nearbyPois: insight.nearbyPois.filter((poi) => poi.associatedListingId !== listingId),
    }));

  const scriptSegments = campaign.scriptSegments.filter((segment) => segment.associatedListingId !== listingId);
  const propertySegments = campaign.propertySegments.filter((segment) => segment.listingId !== listingId);
  const timestamp = nowIso();
  const remainingCount = listingCandidates.length + approvedListings.length + rejectedListings.length;

  if (remainingCount === 0) {
    const emptyLocationData = createEmptyCasaHudLocationData();
    const emptyScriptData = createEmptyCasaHudScriptData();
    const emptyMediaPlanData = createEmptyCasaHudMediaPlanData();
    const emptyYouTubePackageData = createEmptyCasaHudYouTubePackageData();
    const emptyExecutionData = createEmptyCasaHudExecutionData();

    return {
      ...campaign,
      status: "ready_for_property_discovery",
      listingCandidates: [],
      approvedListings: [],
      rejectedListings: [],
      listingRankOrder: [],
      listingDiscoveryStatus: "not_started",
      discoverySummary: {
        headline: "No real property listings added yet.",
        criteriaSummary: "Import listing URLs, use CasaFlix Importer, or connect a provider.",
        providerSummary: "No real property listings are currently attached to this campaign.",
        candidateCount: 0,
        liveCandidateCount: 0,
        fallbackCandidateCount: 0,
        fallbackUsed: false,
        warnings: campaign.discoverySummary?.warnings || [],
        discoveredAt: timestamp,
      },
      listingValidationStatus: "not_started",
      listingValidationSummary: null,
      titleSupportConfidence: null,
      validationWarnings: [],
      ...emptyLocationData,
      ...emptyScriptData,
      ...emptyMediaPlanData,
      ...emptyYouTubePackageData,
      ...emptyExecutionData,
      nextPhase: createPropertyDiscoveryNextPhase(),
      updatedAt: timestamp,
      futureState: {
        ...campaign.futureState,
        listingCandidates: [],
        approvedListings: [],
        rejectedListings: [],
        listingRankOrder: [],
        locationIntelligence: null,
        mapPoiBundle: null,
        script: null,
        storyboard: null,
        mediaPlan: null,
        packaging: null,
        renderStatus: null,
        reviewStatus: null,
        approvalStatus: null,
        publishStatus: null,
        scheduleStatus: null,
      },
    };
  }

  return {
    ...campaign,
    listingCandidates,
    approvedListings,
    rejectedListings,
    listingRankOrder,
    scriptSegments,
    propertySegments,
    localHighlights,
    poiBundle,
    mapSceneIdeas,
    listingLocationInsights,
    visualAssets,
    sceneAssetMapping,
    shotList,
    listingImageCoverage,
    mapLocationVisualPlan,
    thumbnailCandidateInputs,
    discoverySummary: campaign.discoverySummary
      ? {
          ...campaign.discoverySummary,
          candidateCount: listingCandidates.length,
          discoveredAt: timestamp,
        }
      : null,
    listingValidationSummary: campaign.listingValidationSummary
      ? {
          ...campaign.listingValidationSummary,
          discoveredCount: approvedListings.length + rejectedListings.length,
          approvedCount: approvedListings.length,
          rejectedCount: rejectedListings.length,
          needsAttentionCount: rejectedListings.filter((listing) => listing.validationStatus === "needs_attention").length,
          completedAt: timestamp,
        }
      : null,
    updatedAt: timestamp,
    futureState: {
      ...campaign.futureState,
      listingCandidates,
      approvedListings,
      rejectedListings,
      listingRankOrder,
    },
  };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; listingId: string }> | { id: string; listingId: string } },
) {
  const reqId = crypto.randomUUID();

  try {
    const userId = resolveUserId(request);
    await ensureUser(userId);

    const resolvedParams = await Promise.resolve(params);
    const campaignId = resolvedParams.id?.trim();
    const listingId = resolvedParams.listingId?.trim();
    if (!campaignId || !listingId) {
      return errorResponse(400, "CasaFlix needs a valid campaign id and listing id before it can save listing details.", "INVALID_INPUT", reqId);
    }

    const storeAvailable = await isCasaHudCampaignStoreAvailable();
    if (!storeAvailable) {
      return errorResponse(503, "CasaFlix storage is not ready yet.", "CASAHUD_STORE_UNAVAILABLE", reqId);
    }

    const campaign = await getCasaHudCampaign(userId, campaignId);
    if (!campaign) {
      return errorResponse(404, "CasaFlix could not find that campaign.", "NOT_FOUND", reqId);
    }

    const existing =
      campaign.listingCandidates.find((listing) => listing.id === listingId) ||
      campaign.approvedListings.find((listing) => listing.id === listingId) ||
      campaign.rejectedListings.find((listing) => listing.id === listingId);
    if (!existing) {
      return errorResponse(404, "CasaFlix could not find that imported listing.", "LISTING_NOT_FOUND", reqId);
    }
    if (existing.sourceType !== "imported_url" && existing.sourceType !== "browser_assisted_import") {
      return errorResponse(409, "Only user-imported listings can be edited here.", "LISTING_NOT_EDITABLE", reqId);
    }

    const payload = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!payload || typeof payload !== "object") {
      return errorResponse(400, "CasaFlix needs listing details to save.", "INVALID_INPUT", reqId);
    }

    const title = optionalString(payload.title, "title");
    const price = optionalNumber(payload.price, "price");
    const currency = optionalString(payload.currency, "currency");
    const locationText = optionalString(payload.locationText, "locationText");
    const propertyType = optionalString(payload.propertyType, "propertyType");
    const bedrooms = optionalNumber(payload.bedrooms, "bedrooms");
    const bathrooms = optionalNumber(payload.bathrooms, "bathrooms");
    const rooms = optionalNumber(payload.rooms, "rooms");
    const sizeSqm = optionalNumber(payload.sizeSqm, "sizeSqm");
    const commercialSurfaceSqm = optionalNumber(payload.commercialSurfaceSqm, "commercialSurfaceSqm");
    const landSizeSqm = optionalNumber(payload.landSizeSqm, "landSizeSqm");
    const garageParking = optionalString(payload.garageParking, "garageParking");
    const balcony = optionalBoolean(payload.balcony, "balcony");
    const terrace = optionalBoolean(payload.terrace, "terrace");
    const condition = optionalString(payload.condition, "condition");
    const energyClass = optionalString(payload.energyClass, "energyClass");
    const descriptionSnippet = optionalString(payload.descriptionSnippet, "descriptionSnippet");
    const keyFeatures = optionalStringArray(payload.keyFeatures, "keyFeatures");
    const manualFeaturedImageUrl = resolveManualImage(optionalString(payload.manualFeaturedImageUrl, "manualFeaturedImageUrl"));
    const sourceUrl = optionalString(payload.sourceUrl, "sourceUrl");
    const manualLifestyleAngle = optionalString(payload.manualLifestyleAngle, "manualLifestyleAngle");

    const manuallyCompletedFields = Object.entries({
      title,
      price,
      currency,
      locationText,
      propertyType,
      bedrooms,
      bathrooms,
      rooms,
      sizeSqm,
      commercialSurfaceSqm,
      landSizeSqm,
      garageParking,
      balcony,
      terrace,
      condition,
      energyClass,
      descriptionSnippet,
      keyFeatures,
      manualFeaturedImageUrl,
      sourceUrl,
      manualLifestyleAngle,
    })
      .filter(([, value]) => value !== undefined && value !== null)
      .map(([field]) => field);

    if (manuallyCompletedFields.length === 0) {
      return errorResponse(400, "Add at least one listing detail before saving.", "INVALID_INPUT", reqId);
    }

    const timestamp = nowIso();
    const normalizedSourceUrl = sourceUrl ? normalizeListingImportUrl(sourceUrl).toString() : undefined;
    const nextListing = normalizeImportedListingCandidate(
      {
        ...existing,
        title: title ?? existing.title,
        casaHudDisplayTitle: title ?? existing.casaHudDisplayTitle,
        price: price === undefined ? existing.price : price ?? undefined,
        currency: currency === undefined ? existing.currency : currency ?? undefined,
        locationText: locationText ?? existing.locationText,
        propertyType: propertyType === undefined ? existing.propertyType : propertyType ?? undefined,
        bedrooms: bedrooms === undefined ? existing.bedrooms : bedrooms ?? undefined,
        bathrooms: bathrooms === undefined ? existing.bathrooms : bathrooms ?? undefined,
        rooms: rooms === undefined ? existing.rooms : rooms ?? undefined,
        sizeSqm: sizeSqm === undefined ? existing.sizeSqm : sizeSqm ?? undefined,
        commercialSurfaceSqm: commercialSurfaceSqm === undefined ? existing.commercialSurfaceSqm : commercialSurfaceSqm ?? undefined,
        landSizeSqm: landSizeSqm === undefined ? existing.landSizeSqm : landSizeSqm ?? undefined,
        garageParking: garageParking === undefined ? existing.garageParking : garageParking ?? undefined,
        balcony: balcony === undefined ? existing.balcony : balcony ?? undefined,
        terrace: terrace === undefined ? existing.terrace : terrace ?? undefined,
        condition: condition === undefined ? existing.condition : condition ?? undefined,
        energyClass: energyClass === undefined ? existing.energyClass : energyClass ?? undefined,
        descriptionSnippet: descriptionSnippet === undefined ? existing.descriptionSnippet : descriptionSnippet ?? undefined,
        keyFeatures: keyFeatures === undefined ? existing.keyFeatures : keyFeatures ?? undefined,
        manualFeaturedImageUrl: manualFeaturedImageUrl === undefined ? existing.manualFeaturedImageUrl : manualFeaturedImageUrl ?? undefined,
        featuredImageUrl: manualFeaturedImageUrl === undefined ? existing.featuredImageUrl : manualFeaturedImageUrl ?? existing.featuredImageUrl,
        sourceUrl: normalizedSourceUrl ?? existing.sourceUrl,
        originalSourceUrl: sourceUrl === undefined ? existing.originalSourceUrl : sourceUrl ?? existing.originalSourceUrl,
        normalizedSourceUrl: normalizedSourceUrl ?? existing.normalizedSourceUrl,
        sourceHost: normalizedSourceUrl ? new URL(normalizedSourceUrl).hostname.replace(/^www\./, "") : existing.sourceHost,
        manualLifestyleAngle: manualLifestyleAngle === undefined ? existing.manualLifestyleAngle : manualLifestyleAngle ?? undefined,
        rawProviderMetadata:
          manualFeaturedImageUrl === undefined
            ? existing.rawProviderMetadata
            : {
                ...(existing.rawProviderMetadata || {}),
                browserCaptureSelectedImageUrl: manualFeaturedImageUrl ?? null,
              },
        manualUpdatedAt: timestamp,
      },
      {
        manuallyCompletedFields,
        manualUpdatedAt: timestamp,
      },
    );

    const updatedCampaign = mergeImportedListing(campaign, listingId, nextListing);
    await saveCasaHudCampaign(userId, updatedCampaign);

    return NextResponse.json({
      ok: true,
      reqId,
      campaign: updatedCampaign,
      summary: toCasaHudCampaignSummary(updatedCampaign),
      listing: nextListing,
      message: `Saved listing details for "${nextListing.title}".`,
    });
  } catch (error) {
    if (isCasaHudCampaignStoreUnavailable(error)) {
      return errorResponse(503, "CasaFlix storage is not ready yet.", "CASAHUD_STORE_UNAVAILABLE", reqId);
    }

    const message = error instanceof Error ? error.message : "CasaFlix could not save listing details right now.";
    if (/must be|Add at least one listing detail|Only http\/https|invalid/.test(message)) {
      return errorResponse(400, message, "INVALID_INPUT", reqId);
    }

    console.error("CasaFlix imported listing update failed", { reqId, error });
    return errorResponse(
      500,
      "CasaFlix could not save those listing details right now. Try again in a moment.",
      "LISTING_UPDATE_FAILED",
      reqId,
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; listingId: string }> | { id: string; listingId: string } },
) {
  const reqId = crypto.randomUUID();

  try {
    const userId = resolveUserId(request);
    await ensureUser(userId);

    const resolvedParams = await Promise.resolve(params);
    const campaignId = resolvedParams.id?.trim();
    const listingId = resolvedParams.listingId?.trim();
    if (!campaignId || !listingId) {
      return errorResponse(400, "CasaFlix needs a valid campaign id and listing id.", "INVALID_INPUT", reqId);
    }

    const storeAvailable = await isCasaHudCampaignStoreAvailable();
    if (!storeAvailable) {
      return errorResponse(503, "CasaFlix storage is not ready yet.", "CASAHUD_STORE_UNAVAILABLE", reqId);
    }

    const campaign = await getCasaHudCampaign(userId, campaignId);
    if (!campaign) {
      return errorResponse(404, "CasaFlix could not find that campaign.", "NOT_FOUND", reqId);
    }

    const listing =
      campaign.listingCandidates.find((item) => item.id === listingId) ||
      campaign.approvedListings.find((item) => item.id === listingId) ||
      campaign.rejectedListings.find((item) => item.id === listingId);
    if (!listing) {
      return errorResponse(404, "CasaFlix could not find that listing on this campaign.", "LISTING_NOT_FOUND", reqId);
    }

    const updatedCampaign = removeListingFromCampaign(campaign, listingId);
    await saveCasaHudCampaign(userId, updatedCampaign);

    return NextResponse.json({
      ok: true,
      reqId,
      campaign: updatedCampaign,
      summary: toCasaHudCampaignSummary(updatedCampaign),
      deletedListingId: listingId,
      message: `Removed "${listing.title}" from this shortlist.`,
    });
  } catch (error) {
    if (isCasaHudCampaignStoreUnavailable(error)) {
      return errorResponse(503, "CasaFlix storage is not ready yet.", "CASAHUD_STORE_UNAVAILABLE", reqId);
    }

    console.error("CasaFlix imported listing delete failed", { reqId, error });
    return errorResponse(
      500,
      "CasaFlix could not remove that listing right now. Try again in a moment.",
      "LISTING_DELETE_FAILED",
      reqId,
    );
  }
}

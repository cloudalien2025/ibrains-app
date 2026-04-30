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
  applyCasaHudImportedListingCandidates,
  toCasaHudCampaignSummary,
  type CasaHudCampaign,
  type CasaHudListingCandidate,
} from "@/lib/studio/domara/campaigns";
import { nowIso } from "@/lib/studio/domara/ai-channel-engine/ids";
import {
  parseCasaHudBrowserListingCapture,
  type CasaHudBrowserListingCapturePayload,
} from "@/lib/studio/domara/browser-listing-capture-parser";
import { normalizeImportedListingCandidate } from "@/lib/studio/domara/imported-listing-candidate";
import { validateDomaraImageUrls } from "@/lib/studio/domara/image-handling";
import { normalizeListingImportUrl } from "@/lib/studio/domara/listing-url-importer";

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
    return Array.from(
      new Set(
        value
          .map((item) => optionalString(item, field))
          .filter((item): item is string => Boolean(item)),
      ),
    );
  }
  if (typeof value === "string") {
    return Array.from(
      new Set(
        value
          .split(/\r?\n|,/)
          .map((item) => item.trim())
          .filter(Boolean),
      ),
    );
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

function buildListingUrlKeys(listing: CasaHudListingCandidate) {
  return [
    listing.originalSourceUrl,
    listing.normalizedSourceUrl,
    listing.canonicalSourceUrl,
    listing.sourceUrl,
    listing.canonicalUrl,
  ]
    .filter(Boolean)
    .map((value) => normalizeListingImportUrl(value!).toString());
}

function findExistingListing(campaign: CasaHudCampaign, candidate: CasaHudListingCandidate) {
  const candidateKeys = new Set(buildListingUrlKeys(candidate));
  return (
    [...campaign.listingCandidates, ...campaign.approvedListings, ...campaign.rejectedListings].find((listing) =>
      buildListingUrlKeys(listing).some((value) => candidateKeys.has(value)),
    ) || null
  );
}

function replaceListing(campaign: CasaHudCampaign, listingId: string, nextListing: CasaHudListingCandidate): CasaHudCampaign {
  return {
    ...campaign,
    listingCandidates: campaign.listingCandidates.map((listing) => (listing.id === listingId ? nextListing : listing)),
    approvedListings: campaign.approvedListings.map((listing) => (listing.id === listingId ? { ...listing, ...nextListing } : listing)),
    rejectedListings: campaign.rejectedListings.map((listing) => (listing.id === listingId ? { ...listing, ...nextListing } : listing)),
    updatedAt: nowIso(),
  };
}

function applyManualDetails(
  listing: CasaHudListingCandidate,
  payload: Record<string, unknown> | null | undefined,
  timestamp: string,
) {
  if (!payload || typeof payload !== "object") {
    return {
      listing,
      manuallyCompletedFields: [] as string[],
    };
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
    return {
      listing,
      manuallyCompletedFields,
    };
  }

  const normalizedSourceUrl = sourceUrl ? normalizeListingImportUrl(sourceUrl).toString() : undefined;
  return {
    manuallyCompletedFields,
    listing: normalizeImportedListingCandidate(
      {
        ...listing,
        title: title ?? listing.title,
        casaHudDisplayTitle: title ?? listing.casaHudDisplayTitle,
        price: price === undefined ? listing.price : price ?? undefined,
        currency: currency === undefined ? listing.currency : currency ?? undefined,
        locationText: locationText ?? listing.locationText,
        propertyType: propertyType === undefined ? listing.propertyType : propertyType ?? undefined,
        bedrooms: bedrooms === undefined ? listing.bedrooms : bedrooms ?? undefined,
        bathrooms: bathrooms === undefined ? listing.bathrooms : bathrooms ?? undefined,
        rooms: rooms === undefined ? listing.rooms : rooms ?? undefined,
        sizeSqm: sizeSqm === undefined ? listing.sizeSqm : sizeSqm ?? undefined,
        commercialSurfaceSqm: commercialSurfaceSqm === undefined ? listing.commercialSurfaceSqm : commercialSurfaceSqm ?? undefined,
        landSizeSqm: landSizeSqm === undefined ? listing.landSizeSqm : landSizeSqm ?? undefined,
        garageParking: garageParking === undefined ? listing.garageParking : garageParking ?? undefined,
        balcony: balcony === undefined ? listing.balcony : balcony ?? undefined,
        terrace: terrace === undefined ? listing.terrace : terrace ?? undefined,
        condition: condition === undefined ? listing.condition : condition ?? undefined,
        energyClass: energyClass === undefined ? listing.energyClass : energyClass ?? undefined,
        descriptionSnippet: descriptionSnippet === undefined ? listing.descriptionSnippet : descriptionSnippet ?? undefined,
        keyFeatures: keyFeatures === undefined ? listing.keyFeatures : keyFeatures ?? undefined,
        manualFeaturedImageUrl: manualFeaturedImageUrl === undefined ? listing.manualFeaturedImageUrl : manualFeaturedImageUrl ?? undefined,
        featuredImageUrl: manualFeaturedImageUrl === undefined ? listing.featuredImageUrl : manualFeaturedImageUrl ?? listing.featuredImageUrl,
        sourceUrl: normalizedSourceUrl ?? listing.sourceUrl,
        originalSourceUrl: sourceUrl === undefined ? listing.originalSourceUrl : sourceUrl ?? listing.originalSourceUrl,
        normalizedSourceUrl: normalizedSourceUrl ?? listing.normalizedSourceUrl,
        sourceHost: normalizedSourceUrl ? new URL(normalizedSourceUrl).hostname.replace(/^www\./, "") : listing.sourceHost,
        manualLifestyleAngle: manualLifestyleAngle === undefined ? listing.manualLifestyleAngle : manualLifestyleAngle ?? undefined,
        manualUpdatedAt: timestamp,
      },
      {
        manuallyCompletedFields,
        manualUpdatedAt: timestamp,
      },
    ),
  };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } },
) {
  const reqId = crypto.randomUUID();

  try {
    const userId = resolveUserId(request);
    await ensureUser(userId);

    const resolvedParams = await Promise.resolve(params);
    const campaignId = resolvedParams.id?.trim();
    if (!campaignId) {
      return errorResponse(400, "CasaHUD needs a valid campaign id before it can save a browser import.", "INVALID_INPUT", reqId);
    }

    const storeAvailable = await isCasaHudCampaignStoreAvailable();
    if (!storeAvailable) {
      return errorResponse(503, "CasaHUD storage is not ready yet.", "CASAHUD_STORE_UNAVAILABLE", reqId);
    }

    const campaign = await getCasaHudCampaign(userId, campaignId);
    if (!campaign) {
      return errorResponse(404, "CasaHUD could not find that campaign.", "NOT_FOUND", reqId);
    }

    const body = (await request.json().catch(() => null)) as {
      payload?: CasaHudBrowserListingCapturePayload;
      manualDetails?: Record<string, unknown> | null;
    } | null;

    if (!body?.payload) {
      return errorResponse(400, "CasaHUD needs captured browser listing data before it can import anything.", "INVALID_INPUT", reqId);
    }

    const importedAt = nowIso();
    const preview = parseCasaHudBrowserListingCapture(body.payload, { importedAt });
    const withManualDetails = applyManualDetails(preview.candidate, body.manualDetails, importedAt);
    const nextListing = withManualDetails.listing;
    const existing = findExistingListing(campaign, nextListing);

    if (existing && existing.sourceType !== "imported_url" && existing.sourceType !== "browser_assisted_import") {
      return errorResponse(409, "A listing with that source URL already exists on this campaign.", "DUPLICATE_LISTING", reqId);
    }

    let updatedCampaign: CasaHudCampaign;
    let duplicate = false;
    if (existing) {
      duplicate = true;
      const merged = normalizeImportedListingCandidate({
        ...existing,
        ...nextListing,
        id: existing.id,
        title: existing.title || nextListing.title,
        manualFeaturedImageUrl: existing.manualFeaturedImageUrl || nextListing.manualFeaturedImageUrl,
        featuredImageUrl: existing.manualFeaturedImageUrl || nextListing.manualFeaturedImageUrl || nextListing.featuredImageUrl || existing.featuredImageUrl,
        manuallyCompletedFields: Array.from(
          new Set([...(existing.manuallyCompletedFields || []), ...(nextListing.manuallyCompletedFields || [])]),
        ),
        extractionWarnings: Array.from(new Set([...(existing.extractionWarnings || []), ...(nextListing.extractionWarnings || [])])),
        rawProviderMetadata: {
          ...(existing.rawProviderMetadata || {}),
          ...(nextListing.rawProviderMetadata || {}),
        },
      });
      updatedCampaign = replaceListing(campaign, existing.id, merged);
    } else {
      updatedCampaign = applyCasaHudImportedListingCandidates(campaign, {
        listingCandidates: [...campaign.listingCandidates, nextListing],
        discoveredAt: importedAt,
        warnings: preview.warnings,
      });
    }

    await saveCasaHudCampaign(userId, updatedCampaign);

    return NextResponse.json({
      ok: true,
      reqId,
      duplicate,
      campaign: updatedCampaign,
      summary: toCasaHudCampaignSummary(updatedCampaign),
      listing: duplicate ? findExistingListing(updatedCampaign, nextListing) : nextListing,
      extractionStatus: preview.extractionStatus,
      extractionFields: preview.extractionFields,
      warnings: preview.warnings,
      message: duplicate
        ? `Updated the existing browser import for "${nextListing.title}".`
        : `Saved browser-assisted import for "${nextListing.title}".`,
    });
  } catch (error) {
    if (isCasaHudCampaignStoreUnavailable(error)) {
      return errorResponse(503, "CasaHUD storage is not ready yet.", "CASAHUD_STORE_UNAVAILABLE", reqId);
    }

    const message = error instanceof Error ? error.message : "CasaHUD could not save that browser import right now.";
    if (/needs|must be|Only http\/https|invalid|payload|visible page text|Private or local network hosts|not allowed/i.test(message)) {
      return errorResponse(400, message, "INVALID_INPUT", reqId);
    }

    console.error("CasaHUD browser import failed", { reqId, error });
    return errorResponse(
      500,
      "CasaHUD could not save that browser import right now. Try again in a moment.",
      "BROWSER_IMPORT_FAILED",
      reqId,
    );
  }
}

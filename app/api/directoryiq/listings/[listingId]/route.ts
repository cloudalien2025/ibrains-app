export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { ensureUser, resolveUserId } from "@/app/api/ecomviper/_utils/user";
import { findListingCandidates, getListingEvaluation } from "@/app/api/directoryiq/_utils/selectionData";
import { getBdSite } from "@/app/api/directoryiq/_utils/bdSites";
import { normalizeListingImageUrl } from "@/src/lib/images/normalizeListingImageUrl";

function readFirstString(values: Array<unknown>): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
}

function extractMainImageUrl(
  raw: Record<string, unknown> | null | undefined,
  listingUrl: string | null,
  bdBaseUrl: string | null
): { mainImageUrl: string | null; sourceField: string | null; rawValue: string | null } {
  const row = raw ?? {};
  const gallery = Array.isArray(row.gallery) ? row.gallery : [];
  const firstGallery = gallery[0];
  const portfolio = Array.isArray(row.users_portfolio) ? row.users_portfolio : [];
  const firstPortfolio = portfolio[0];
  const firstGalleryUrl =
    typeof firstGallery === "string"
      ? firstGallery
      : firstGallery && typeof firstGallery === "object"
        ? readFirstString([
            (firstGallery as Record<string, unknown>).url,
            (firstGallery as Record<string, unknown>).src,
            (firstGallery as Record<string, unknown>).image,
            (firstGallery as Record<string, unknown>).image_url,
          ])
        : null;
  const firstPortfolioUrl =
    typeof firstPortfolio === "string"
      ? firstPortfolio
      : firstPortfolio && typeof firstPortfolio === "object"
        ? readFirstString([
            (firstPortfolio as Record<string, unknown>).file_main_full_url,
            (firstPortfolio as Record<string, unknown>).file_thumbnail_full_url,
            (firstPortfolio as Record<string, unknown>).original_image_url,
            (firstPortfolio as Record<string, unknown>).url,
            (firstPortfolio as Record<string, unknown>).src,
            (firstPortfolio as Record<string, unknown>).image,
            (firstPortfolio as Record<string, unknown>).image_url,
            (firstPortfolio as Record<string, unknown>).file,
          ])
        : null;

  const candidates: Array<{ field: string; value: unknown }> = [
    { field: "users_portfolio[0]", value: firstPortfolioUrl },
    { field: "primary_image", value: row.primary_image },
    { field: "featured_image", value: row.featured_image },
    { field: "image_url", value: row.image_url },
    { field: "photo", value: row.photo },
    { field: "logo", value: row.logo },
    { field: "thumbnail", value: row.thumbnail },
    { field: "image", value: row.image },
    { field: "cover_image", value: row.cover_image },
    { field: "imageUrl", value: (row as { imageUrl?: unknown }).imageUrl },
    { field: "gallery[0]", value: firstGalleryUrl },
  ];

  for (const candidate of candidates) {
    const rawValue = readFirstString([candidate.value]);
    if (!rawValue) continue;
    const mainImageUrl = normalizeListingImageUrl({
      rawUrl: rawValue,
      listingUrl,
      bdBaseUrl,
    });
    if (mainImageUrl) {
      return {
        mainImageUrl,
        sourceField: candidate.field,
        rawValue,
      };
    }
  }

  return {
    mainImageUrl: null,
    sourceField: null,
    rawValue: readFirstString([
      row.primary_image,
      row.featured_image,
      row.image_url,
      row.photo,
      row.logo,
      row.thumbnail,
      row.image,
      row.cover_image,
      (row as { imageUrl?: unknown }).imageUrl,
      firstPortfolioUrl,
      firstGalleryUrl,
    ]),
  };
}

function normalizeListingId(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.toLowerCase() === "undefined" || trimmed.toLowerCase() === "null") return null;
  return trimmed;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ listingId: string }> | { listingId: string } }
) {
  const { listingId: listingIdParam } = await Promise.resolve(params);
  const listingIdRaw = normalizeListingId(listingIdParam);
  if (!listingIdRaw) {
    return NextResponse.json({ error: "invalid_listing_id" }, { status: 400 });
  }

  let decodedListingId: string;
  try {
    decodedListingId = decodeURIComponent(listingIdRaw);
  } catch {
    return NextResponse.json({ error: "invalid_listing_id" }, { status: 400 });
  }

  try {
    if (process.env.E2E_MOCK_GRAPH === "1") {
      return NextResponse.json({
        listing: {
          listing_id: decodedListingId,
          listing_name: `Mock Listing ${decodedListingId}`,
          listing_url: null,
          mainImageUrl: null,
        },
      });
    }

    const userId = resolveUserId(req);
    await ensureUser(userId);

    const siteIdParam = req.nextUrl.searchParams.get("site_id");
    let siteId = siteIdParam?.trim() || null;
    if (!siteId) {
      const rows = await findListingCandidates(userId, decodedListingId);
      const uniqueSites = new Map<string, string | null>();
      for (const row of rows) {
        if (row.siteId) uniqueSites.set(row.siteId, row.siteLabel ?? null);
      }
      if (uniqueSites.size > 1) {
        return NextResponse.json(
          {
            error: "site_required",
            candidates: Array.from(uniqueSites.entries()).map(([site_id, site_label]) => ({
              site_id,
              site_label,
            })),
          },
          { status: 409 }
        );
      }
      siteId = rows[0]?.siteId ?? null;
    }

    const listingEval = await getListingEvaluation(userId, decodedListingId, siteId ?? undefined);
    const bdSite = siteId ? await getBdSite(userId, siteId) : null;
    const bdBaseUrl = bdSite ? bdSite.base_url : null;

    if (!listingEval.listing || !listingEval.evaluation) {
      return NextResponse.json({ error: "Listing not found", listingId: decodedListingId }, { status: 404 });
    }

    const raw = (listingEval.listing.raw_json ?? {}) as Record<string, unknown>;
    const listingIdValue = asString(raw.listing_id) || decodedListingId;
    const listingName =
      asString(raw.name) ||
      asString(raw.group_name) ||
      asString(listingEval.listing.title) ||
      listingIdValue;
    const siteLabel = asString(raw.site_label) || bdSite?.label || null;

    const mainImage = extractMainImageUrl(raw, listingEval.listing.url, bdBaseUrl);
    if (process.env.NODE_ENV !== "production") {
      // Dev-only trace for image resolution diagnostics.
      console.info(
        `[directoryiq-image] listing=${listingEval.listing.source_id} source=${mainImage.sourceField ?? "none"} raw=${mainImage.rawValue ?? "null"} normalized=${mainImage.mainImageUrl ?? "null"}`
      );
    }

    return NextResponse.json({
      listing: {
        listing_id: listingIdValue,
        listing_name: listingName,
        listing_url: listingEval.listing.url,
        mainImageUrl: mainImage.mainImageUrl,
        site_id: siteId,
        site_label: siteLabel,
      },
      evaluation: listingEval.evaluation,
    });
  } catch (error) {
    console.error("Listing route failure", error);
    return NextResponse.json({ error: "Internal error loading listing" }, { status: 500 });
  }
}

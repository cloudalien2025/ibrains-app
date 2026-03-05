export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { ensureUser, resolveUserId } from "@/app/api/ecomviper/_utils/user";
import { isEntitled, resolveUserFromHeaders } from "@/lib/auth/entitlements";
import { getListingEvaluation } from "@/app/api/directoryiq/_utils/selectionData";
import { getDirectoryIqIntegration } from "@/app/api/directoryiq/_utils/credentials";
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

function readBaseUrl(meta: Record<string, unknown>): string | null {
  return readFirstString([
    meta.baseUrl,
    meta.base_url,
    process.env.DIRECTORYIQ_BD_BASE_URL,
  ]);
}

function normalizeListingId(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.toLowerCase() === "undefined" || trimmed.toLowerCase() === "null") return null;
  return trimmed;
}

function hasHeaderIdentity(req: NextRequest): boolean {
  return Boolean(
    req.headers.get("x-user-id") ||
      req.headers.get("x-user-email") ||
      req.headers.get("x-forwarded-email") ||
      req.headers.get("cf-access-authenticated-user-email")
  );
}

function hasQueryIdentity(req: NextRequest): boolean {
  return Boolean(req.nextUrl.searchParams.get("user_id"));
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ listingId: string }> | { listingId: string } }
) {
  const { listingId: listingIdParam } = await Promise.resolve(params);
  const listingIdRaw = normalizeListingId(listingIdParam);
  if (!listingIdRaw || Number.isNaN(Number(listingIdRaw))) {
    return NextResponse.json({ error: "invalid_listing_id" }, { status: 400 });
  }

  let decodedListingId: string;
  try {
    decodedListingId = decodeURIComponent(listingIdRaw);
  } catch {
    return NextResponse.json({ error: "invalid_listing_id" }, { status: 400 });
  }

  try {
    const user = resolveUserFromHeaders(req.headers);
    const entitled = isEntitled(user, "directoryiq");
    const headerIdentity = hasHeaderIdentity(req);
    const allowQueryIdentity = process.env.NODE_ENV !== "production" && hasQueryIdentity(req);

    if (!entitled && !headerIdentity && !allowQueryIdentity) {
      console.warn("Listing auth denied", {
        route: "/api/directoryiq/listings/[listingId]",
        listingId: decodedListingId,
        has_session_cookie: Boolean(req.headers.get("cookie")),
        has_x_user_id: Boolean(req.headers.get("x-user-id")),
        has_cf_access_email: Boolean(req.headers.get("cf-access-authenticated-user-email")),
        has_x_forwarded_email: Boolean(req.headers.get("x-forwarded-email")),
      });
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

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

    const listingEval = await getListingEvaluation(userId, decodedListingId);
    const bdIntegration = await getDirectoryIqIntegration(userId, "brilliant_directories");
    const bdBaseUrl = readBaseUrl(bdIntegration.meta);

    if (!listingEval.listing || !listingEval.evaluation) {
      return NextResponse.json({ error: "Listing not found", listingId: decodedListingId }, { status: 404 });
    }

    const mainImage = extractMainImageUrl(listingEval.listing.raw_json, listingEval.listing.url, bdBaseUrl);
    if (process.env.NODE_ENV !== "production") {
      // Dev-only trace for image resolution diagnostics.
      console.info(
        `[directoryiq-image] listing=${listingEval.listing.source_id} source=${mainImage.sourceField ?? "none"} raw=${mainImage.rawValue ?? "null"} normalized=${mainImage.mainImageUrl ?? "null"}`
      );
    }

    return NextResponse.json({
      listing: {
        listing_id: listingEval.listing.source_id,
        listing_name: listingEval.listing.title ?? listingEval.listing.source_id ?? decodedListingId,
        listing_url: listingEval.listing.url,
        mainImageUrl: mainImage.mainImageUrl,
      },
    });
  } catch (error) {
    console.error("Listing route failure", error);
    return NextResponse.json({ error: "Internal error loading listing" }, { status: 500 });
  }
}

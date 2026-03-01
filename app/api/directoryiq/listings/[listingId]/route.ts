export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { ensureUser, resolveUserId } from "@/app/api/ecomviper/_utils/user";
import { getListingEvaluation } from "@/app/api/directoryiq/_utils/selectionData";

function readFirstString(values: Array<unknown>): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
}

function resolveImageUrl(candidate: string | null, listingUrl: string | null): string | null {
  if (!candidate) return null;
  if (/^https?:\/\//i.test(candidate)) return candidate;
  if (candidate.startsWith("//")) return `https:${candidate}`;

  if (listingUrl) {
    try {
      const base = new URL(listingUrl);
      if (candidate.startsWith("/")) return new URL(candidate, base.origin).toString();
      return new URL(`/${candidate.replace(/^\/+/, "")}`, base.origin).toString();
    } catch {
      return null;
    }
  }

  return null;
}

function extractMainImageUrl(
  raw: Record<string, unknown> | null | undefined,
  listingUrl: string | null
): string | null {
  const row = raw ?? {};
  const gallery = Array.isArray(row.gallery) ? row.gallery : [];
  const firstGallery = gallery[0];
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

  const candidate = readFirstString([
    row.primary_image,
    row.featured_image,
    row.image_url,
    row.photo,
    row.logo,
    row.thumbnail,
    row.image,
    row.cover_image,
    (row as { imageUrl?: unknown }).imageUrl,
    firstGalleryUrl,
  ]);

  return resolveImageUrl(candidate, listingUrl);
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ listingId: string }> | { listingId: string } }
) {
  try {
    const userId = resolveUserId(req);
    await ensureUser(userId);

    const { listingId } = await Promise.resolve(context.params);
    const listingEval = await getListingEvaluation(userId, decodeURIComponent(listingId));

    if (!listingEval.listing || !listingEval.evaluation) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }

    return NextResponse.json({
      listing: {
        listing_id: listingEval.listing.source_id,
        listing_name: listingEval.listing.title ?? listingEval.listing.source_id,
        listing_url: listingEval.listing.url,
        mainImageUrl: extractMainImageUrl(listingEval.listing.raw_json, listingEval.listing.url),
      },
      evaluation: listingEval.evaluation,
      authority_posts: listingEval.authorityPosts.map((post) => ({
        id: post.id,
        slot: post.slot_index,
        type: post.post_type,
        title: post.title,
        focus_topic: post.focus_topic,
        status: post.status,
        blog_to_listing_status: post.blog_to_listing_link_status,
        listing_to_blog_status: post.listing_to_blog_link_status,
        featured_image_url: post.featured_image_url,
        published_url: post.published_url,
        updated_at: post.updated_at,
      })),
      settings: listingEval.settings,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown listing detail error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

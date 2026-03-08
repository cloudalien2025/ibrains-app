export const runtime = "nodejs";

import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { ensureUser, resolveUserId } from "@/app/api/ecomviper/_utils/user";
import { resolveListingEvaluation, ListingSiteRequiredError } from "@/app/api/directoryiq/_utils/listingResolve";
import { getListingCurrentSupport } from "@/src/directoryiq/services/listingSupportService";

function normalizeListingId(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.toLowerCase() === "undefined" || trimmed.toLowerCase() === "null") return null;
  return trimmed;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ listingId: string }> | { listingId: string } }
) {
  const reqId = crypto.randomUUID();
  const { listingId: listingIdParam } = await Promise.resolve(params);
  const listingIdRaw = normalizeListingId(listingIdParam);

  if (!listingIdRaw) {
    return NextResponse.json({ ok: false, error: "invalid_listing_id", reqId }, { status: 400 });
  }

  let decodedListingId: string;
  try {
    decodedListingId = decodeURIComponent(listingIdRaw);
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_listing_id", reqId }, { status: 400 });
  }

  try {
    const userId = resolveUserId(req);
    await ensureUser(userId);

    const siteIdParam = req.nextUrl.searchParams.get("site_id");
    const resolved = await resolveListingEvaluation({
      userId,
      listingId: decodedListingId,
      siteId: siteIdParam ?? undefined,
    });

    if (!resolved || !resolved.listingEval.listing) {
      return NextResponse.json(
        {
          ok: true,
          support: {
            listing: { id: decodedListingId, title: decodedListingId, canonicalUrl: null, siteId: resolved?.siteId ?? null },
            summary: {
              inboundLinkedSupportCount: 0,
              mentionWithoutLinkCount: 0,
              outboundSupportLinkCount: 0,
              connectedSupportPageCount: 0,
              lastGraphRunAt: null,
            },
            inboundLinkedSupport: [],
            mentionsWithoutLinks: [],
            outboundSupportLinks: [],
            connectedSupportPages: [],
          },
          reqId,
        },
        { status: 200 }
      );
    }

    const listing = resolved.listingEval.listing;
    const support = await getListingCurrentSupport({
      tenantId: "default",
      listingId: listing.source_id ?? decodedListingId,
      listingTitle: listing.title ?? null,
      listingUrl: listing.url ?? null,
      siteId: resolved.siteId ?? null,
    });

    return NextResponse.json({ ok: true, support, reqId }, { status: 200 });
  } catch (error) {
    if (error instanceof ListingSiteRequiredError) {
      return NextResponse.json(
        {
          ok: false,
          error: "site_required",
          message: "Multiple sites contain this listing. Provide site_id.",
          candidates: error.candidates,
          reqId,
        },
        { status: 409 }
      );
    }

    const message = error instanceof Error ? error.message : "Failed to load listing support";
    return NextResponse.json(
      {
        ok: false,
        error: {
          message,
          code: "INTERNAL_ERROR",
          reqId,
        },
      },
      { status: 500 }
    );
  }
}

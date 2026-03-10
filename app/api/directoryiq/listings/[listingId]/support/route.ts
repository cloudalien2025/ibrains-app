export const runtime = "nodejs";

import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { ensureUser, resolveUserId } from "@/app/api/ecomviper/_utils/user";
import { ListingSiteRequiredError, resolveListingEvaluation } from "@/app/api/directoryiq/_utils/listingResolve";
import { getListingCurrentSupport } from "@/src/directoryiq/services/listingSupportService";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ listingId: string }> | { listingId: string } }
) {
  const reqId = crypto.randomUUID();

  try {
    const userId = resolveUserId(req);
    await ensureUser(userId);

    const { listingId } = await Promise.resolve(params);
    const resolvedListingId = decodeURIComponent(listingId);
    const siteId = req.nextUrl.searchParams.get("site_id");

    const resolved = await resolveListingEvaluation({
      userId,
      listingId: resolvedListingId,
      siteId: siteId?.trim() || null,
    });
    if (!resolved || !resolved.listingEval.listing) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            message: "Listing not found.",
            code: "NOT_FOUND",
            reqId,
          },
        },
        { status: 404 }
      );
    }

    const listing = resolved.listingEval.listing;
    const support = await getListingCurrentSupport({
      tenantId: "default",
      listingId: listing.source_id,
      listingTitle: listing.title,
      listingUrl: listing.url,
      siteId: resolved.siteId,
    });

    const hasAnySupport =
      support.summary.inboundLinkedSupportCount > 0 ||
      support.summary.mentionWithoutLinkCount > 0 ||
      support.summary.outboundSupportLinkCount > 0 ||
      support.summary.connectedSupportPageCount > 0;

    return NextResponse.json({
      ok: true,
      support,
      meta: {
        source: "first_party_graph_v1",
        evaluatedAt: new Date().toISOString(),
        dataStatus: hasAnySupport ? "supported" : "no_support_data",
      },
      reqId,
    });
  } catch (error) {
    if (error instanceof ListingSiteRequiredError) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            message: "Multiple sites contain this listing. Provide site_id.",
            code: "SITE_REQUIRED",
            reqId,
            candidates: error.candidates.map((candidate) => ({
              site_id: candidate.siteId,
              site_label: candidate.siteLabel,
            })),
          },
        },
        { status: 409 }
      );
    }

    const message = error instanceof Error ? error.message : "Failed to compute listing support.";
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

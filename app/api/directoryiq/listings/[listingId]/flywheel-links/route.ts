export const runtime = "nodejs";

import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import type { ListingAuthorityGapsModel } from "@/src/directoryiq/services/listingGapsService";
import { buildListingFlywheelLinks } from "@/src/directoryiq/services/listingFlywheelLinksService";
import type { ListingSupportModel } from "@/src/directoryiq/services/listingSupportService";

type FlywheelLinksRequest = {
  support?: ListingSupportModel;
  gaps?: ListingAuthorityGapsModel;
};

function listingIdMatchesPath(payloadId: string, pathListingId: string): boolean {
  if (payloadId === pathListingId) return true;
  return payloadId.endsWith(`:${pathListingId}`);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ listingId: string }> | { listingId: string } }
) {
  const reqId = crypto.randomUUID();

  try {
    const { listingId } = await Promise.resolve(params);
    const resolvedListingId = decodeURIComponent(listingId);
    const body = (await req.json().catch(() => ({}))) as FlywheelLinksRequest;
    const support = body.support;
    const gaps = body.gaps;

    if (!support || !gaps) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            message: "support and gaps payloads are required",
            code: "BAD_REQUEST",
            reqId,
          },
        },
        { status: 400 }
      );
    }

    if (
      !listingIdMatchesPath(support.listing.id, resolvedListingId) ||
      !listingIdMatchesPath(gaps.listing.id, resolvedListingId)
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            message: "listing_id mismatch between request path and payload",
            code: "BAD_REQUEST",
            reqId,
          },
        },
        { status: 400 }
      );
    }

    const flywheel = buildListingFlywheelLinks({ support, gaps });
    return NextResponse.json({
      ok: true,
      flywheel,
      meta: {
        source: "first_party_flywheel_links_v1",
        evaluatedAt: flywheel.summary.evaluatedAt,
        dataStatus: flywheel.summary.dataStatus,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to evaluate flywheel links.";
    return NextResponse.json(
      {
        ok: false,
        error: {
          message,
          code: "FLYWHEEL_EVALUATION_FAILED",
          reqId,
        },
      },
      { status: 500 }
    );
  }
}

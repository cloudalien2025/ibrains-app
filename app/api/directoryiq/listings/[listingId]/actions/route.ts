export const runtime = "nodejs";

import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import type { ListingAuthorityGapsModel } from "@/src/directoryiq/services/listingGapsService";
import { buildListingRecommendedActions } from "@/src/directoryiq/services/listingRecommendedActionsService";
import type { ListingSupportModel } from "@/src/directoryiq/services/listingSupportService";

type RecommendedActionsRequest = {
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
    const body = (await req.json().catch(() => ({}))) as RecommendedActionsRequest;
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

    const actions = buildListingRecommendedActions({ support, gaps });

    return NextResponse.json({
      ok: true,
      actions,
      meta: {
        source: "first_party_recommended_actions_v1",
        evaluatedAt: actions.summary.evaluatedAt,
        dataStatus: actions.summary.dataStatus,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to evaluate recommended actions.";
    return NextResponse.json(
      {
        ok: false,
        error: {
          message,
          code: "ACTIONS_EVALUATION_FAILED",
          reqId,
        },
      },
      { status: 500 }
    );
  }
}

export const runtime = "nodejs";

import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import type { ListingFlywheelLinksModel } from "@/src/directoryiq/services/listingFlywheelLinksService";
import type { ListingAuthorityGapsModel } from "@/src/directoryiq/services/listingGapsService";
import type { ListingRecommendedActionsModel } from "@/src/directoryiq/services/listingRecommendedActionsService";
import { buildListingSelectionIntentClusters } from "@/src/directoryiq/services/listingSelectionIntentClustersService";
import type { ListingSelectionIntentContext } from "@/src/directoryiq/services/listingSelectionIntentResolverService";
import type { ListingSupportModel } from "@/src/directoryiq/services/listingSupportService";

type IntentClustersRequest = {
  support?: ListingSupportModel;
  gaps?: ListingAuthorityGapsModel;
  actions?: ListingRecommendedActionsModel;
  flywheel?: ListingFlywheelLinksModel;
  listingContext?: ListingSelectionIntentContext;
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
    const body = (await req.json().catch(() => ({}))) as IntentClustersRequest;
    const { support, gaps, actions, flywheel, listingContext } = body;

    if (!support || !gaps || !actions || !flywheel) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            message: "support, gaps, actions, and flywheel payloads are required",
            code: "BAD_REQUEST",
            reqId,
          },
        },
        { status: 400 }
      );
    }

    if (
      !listingIdMatchesPath(support.listing.id, resolvedListingId) ||
      !listingIdMatchesPath(gaps.listing.id, resolvedListingId) ||
      !listingIdMatchesPath(actions.listing.id, resolvedListingId) ||
      !listingIdMatchesPath(flywheel.listing.id, resolvedListingId)
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

    const intentClusters = buildListingSelectionIntentClusters({ support, gaps, actions, flywheel, listingContext });
    return NextResponse.json({
      ok: true,
      intentClusters,
      meta: {
        source: "first_party_selection_intent_clusters_v1",
        evaluatedAt: intentClusters.summary.evaluatedAt,
        dataStatus: intentClusters.summary.dataStatus,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to evaluate selection intent clusters.";
    return NextResponse.json(
      {
        ok: false,
        error: {
          message,
          code: "INTENT_CLUSTERS_EVALUATION_FAILED",
          reqId,
        },
      },
      { status: 500 }
    );
  }
}

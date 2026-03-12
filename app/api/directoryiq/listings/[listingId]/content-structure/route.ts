export const runtime = "nodejs";

import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { listSerpStatus } from "@/lib/directoryiq/storage/serpCacheStore";
import { buildListingSerpContentStructure } from "@/src/directoryiq/services/listingSerpContentStructureService";
import type { ListingBlogReinforcementPlanModel } from "@/src/directoryiq/services/listingBlogReinforcementPlannerService";
import type { ListingFlywheelLinksModel } from "@/src/directoryiq/services/listingFlywheelLinksService";
import type { ListingAuthorityGapsModel } from "@/src/directoryiq/services/listingGapsService";
import type { ListingRecommendedActionsModel } from "@/src/directoryiq/services/listingRecommendedActionsService";
import type { ListingSelectionIntentClustersModel } from "@/src/directoryiq/services/listingSelectionIntentClustersService";
import type { ListingSupportModel } from "@/src/directoryiq/services/listingSupportService";

type ContentStructureRequest = {
  support?: ListingSupportModel;
  gaps?: ListingAuthorityGapsModel;
  actions?: ListingRecommendedActionsModel;
  flywheel?: ListingFlywheelLinksModel;
  intentClusters?: ListingSelectionIntentClustersModel;
  reinforcementPlan?: ListingBlogReinforcementPlanModel;
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
    const body = (await req.json().catch(() => ({}))) as ContentStructureRequest;
    const { support, gaps, actions, flywheel, intentClusters, reinforcementPlan } = body;

    if (!support || !gaps || !actions || !flywheel || !intentClusters || !reinforcementPlan) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            message:
              "support, gaps, actions, flywheel, intentClusters, and reinforcementPlan payloads are required",
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
      !listingIdMatchesPath(flywheel.listing.id, resolvedListingId) ||
      !listingIdMatchesPath(intentClusters.listing.id, resolvedListingId) ||
      !listingIdMatchesPath(reinforcementPlan.listing.id, resolvedListingId)
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

    const serpCacheEntries = await listSerpStatus(resolvedListingId);
    const contentStructure = buildListingSerpContentStructure({
      support,
      gaps,
      actions,
      flywheel,
      intentClusters,
      reinforcementPlan,
      serpCacheEntries,
    });

    return NextResponse.json({
      ok: true,
      contentStructure,
      meta: {
        source: "first_party_serp_content_structure_v2",
        evaluatedAt: contentStructure.summary.evaluatedAt,
        dataStatus: contentStructure.summary.dataStatus,
        serpPatternStatus: contentStructure.summary.serpPatternStatus,
        serpPatternSource: contentStructure.summary.serpPatternSource,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to evaluate SERP-informed content structure.";
    return NextResponse.json(
      {
        ok: false,
        error: {
          message,
          code: "CONTENT_STRUCTURE_EVALUATION_FAILED",
          reqId,
        },
      },
      { status: 500 }
    );
  }
}

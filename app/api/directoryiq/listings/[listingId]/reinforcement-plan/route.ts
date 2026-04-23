export const runtime = "nodejs";

import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { buildListingBlogReinforcementPlan } from "@/src/directoryiq/services/listingBlogReinforcementPlannerService";
import type { ListingFlywheelLinksModel } from "@/src/directoryiq/services/listingFlywheelLinksService";
import type { ListingAuthorityGapsModel } from "@/src/directoryiq/services/listingGapsService";
import type { ListingRecommendedActionsModel } from "@/src/directoryiq/services/listingRecommendedActionsService";
import type { ListingSelectionIntentClustersModel } from "@/src/directoryiq/services/listingSelectionIntentClustersService";
import type { ListingSupportModel } from "@/src/directoryiq/services/listingSupportService";

type ReinforcementPlanRequest = {
  support?: ListingSupportModel;
  gaps?: ListingAuthorityGapsModel;
  actions?: ListingRecommendedActionsModel;
  flywheel?: ListingFlywheelLinksModel;
  intentClusters?: ListingSelectionIntentClustersModel;
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
    const body = (await req.json().catch(() => ({}))) as ReinforcementPlanRequest;
    const { support, gaps, actions, flywheel, intentClusters } = body;

    if (!support || !gaps || !actions || !flywheel || !intentClusters) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            message: "support, gaps, actions, flywheel, and intentClusters payloads are required",
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
      !listingIdMatchesPath(intentClusters.listing.id, resolvedListingId)
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

    const reinforcementPlan = buildListingBlogReinforcementPlan({
      support,
      gaps,
      actions,
      flywheel,
      intentClusters,
    });

    return NextResponse.json({
      ok: true,
      reinforcementPlan,
      meta: {
        source: "first_party_blog_reinforcement_planner_v1",
        evaluatedAt: reinforcementPlan.summary.evaluatedAt,
        dataStatus: reinforcementPlan.summary.dataStatus,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to evaluate blog reinforcement plan.";
    return NextResponse.json(
      {
        ok: false,
        error: {
          message,
          code: "REINFORCEMENT_PLANNING_FAILED",
          reqId,
        },
      },
      { status: 500 }
    );
  }
}

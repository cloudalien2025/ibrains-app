export const runtime = "nodejs";

import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { buildListingMultiActionUpgrade } from "@/src/directoryiq/services/listingMultiActionUpgradeService";
import type { ListingSerpContentStructureModel } from "@/src/directoryiq/services/listingSerpContentStructureService";
import type { ListingBlogReinforcementPlanModel } from "@/src/directoryiq/services/listingBlogReinforcementPlannerService";
import type { ListingFlywheelLinksModel } from "@/src/directoryiq/services/listingFlywheelLinksService";
import type { ListingAuthorityGapsModel } from "@/src/directoryiq/services/listingGapsService";
import type { ListingRecommendedActionsModel } from "@/src/directoryiq/services/listingRecommendedActionsService";
import type { ListingSelectionIntentClustersModel } from "@/src/directoryiq/services/listingSelectionIntentClustersService";
import type { ListingSupportModel } from "@/src/directoryiq/services/listingSupportService";

type MultiActionRequest = {
  support?: ListingSupportModel;
  gaps?: ListingAuthorityGapsModel;
  actions?: ListingRecommendedActionsModel;
  flywheel?: ListingFlywheelLinksModel;
  intentClusters?: ListingSelectionIntentClustersModel;
  reinforcementPlan?: ListingBlogReinforcementPlanModel;
  contentStructure?: ListingSerpContentStructureModel;
  integrations?: {
    openaiConfigured?: boolean | null;
    bdConfigured?: boolean | null;
  };
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
    const body = (await req.json().catch(() => ({}))) as MultiActionRequest;
    const { support, gaps, actions, flywheel, intentClusters, reinforcementPlan, contentStructure, integrations } = body;

    if (!support || !gaps || !actions || !flywheel || !intentClusters || !reinforcementPlan || !contentStructure || !integrations) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            message:
              "support, gaps, actions, flywheel, intentClusters, reinforcementPlan, contentStructure, and integrations payloads are required",
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
      !listingIdMatchesPath(reinforcementPlan.listing.id, resolvedListingId) ||
      !listingIdMatchesPath(contentStructure.listing.id, resolvedListingId)
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

    const multiAction = buildListingMultiActionUpgrade({
      support,
      gaps,
      actions,
      flywheel,
      intentClusters,
      reinforcementPlan,
      contentStructure,
      integrations: {
        openaiConfigured: Boolean(integrations.openaiConfigured),
        bdConfigured: Boolean(integrations.bdConfigured),
      },
    });

    return NextResponse.json({
      ok: true,
      multiAction,
      meta: {
        source: "first_party_multi_action_upgrade_v2",
        evaluatedAt: multiAction.summary.evaluatedAt,
        dataStatus: multiAction.summary.dataStatus,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to evaluate multi-action upgrade system.";
    return NextResponse.json(
      {
        ok: false,
        error: {
          message,
          code: "MULTI_ACTION_EVALUATION_FAILED",
          reqId,
        },
      },
      { status: 500 }
    );
  }
}

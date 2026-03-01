export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { ensureUser, resolveUserId } from "@/app/api/ecomviper/_utils/user";
import {
  getListingEvaluation,
  getListingUpgradeDraft,
  markListingUpgradePreviewed,
} from "@/app/api/directoryiq/_utils/selectionData";
import { errorPayload, logUpgradeError, logUpgradeInfo, upgradeReqId } from "@/app/api/directoryiq/_utils/listingUpgrade";
import { buildDescriptionDiff } from "@/src/lib/directoryiq/descriptionDiff";
import { issueApprovalToken } from "@/app/api/directoryiq/_utils/authority";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ listingId: string }> | { listingId: string } }
) {
  let resolvedListingId = "unknown";
  const reqId = upgradeReqId();

  try {
    const userId = resolveUserId(req);
    await ensureUser(userId);
    const { listingId } = await Promise.resolve(context.params);
    resolvedListingId = decodeURIComponent(listingId);

    logUpgradeInfo({ reqId, listingId: resolvedListingId, action: "preview", message: "request received" });

    const body = (await req.json().catch(() => ({}))) as { draftId?: string };
    const draftId = (body.draftId ?? "").trim();
    if (!draftId) {
      const err = errorPayload({ status: 400, reqId, code: "BAD_REQUEST", message: "draftId is required." });
      return NextResponse.json(err.body, { status: err.status });
    }

    const detail = await getListingEvaluation(userId, resolvedListingId);
    if (!detail.listing || !detail.evaluation) {
      const err = errorPayload({ status: 404, reqId, code: "NOT_FOUND", message: "Listing not found." });
      return NextResponse.json(err.body, { status: err.status });
    }

    const draft = await getListingUpgradeDraft(userId, resolvedListingId, draftId);
    if (!draft) {
      const err = errorPayload({ status: 404, reqId, code: "NOT_FOUND", message: "Upgrade draft not found." });
      return NextResponse.json(err.body, { status: err.status });
    }

    await markListingUpgradePreviewed(userId, resolvedListingId, draftId);

    const diff = buildDescriptionDiff(draft.original_description, draft.proposed_description);
    const approvalToken = issueApprovalToken({
      userId,
      listingId: resolvedListingId,
      action: "listing_push",
    });

    return NextResponse.json({
      draftId,
      original: draft.original_description,
      proposed: draft.proposed_description,
      diff,
      approvalToken,
      reqId,
    });
  } catch (error) {
    logUpgradeError({ reqId, listingId: resolvedListingId, action: "preview", error });
    const message = error instanceof Error ? error.message : "Unknown upgrade preview error";
    const err = errorPayload({ status: 500, reqId, code: "INTERNAL_ERROR", message });
    return NextResponse.json(err.body, { status: err.status });
  }
}

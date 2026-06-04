export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { fail, ok } from "@/app/api/ecomviper/walmart/_utils/response";
import { requireSignedInUser } from "@/lib/auth/requireSignedInUser";
import { getPersistedWalmartProductBySku } from "@/lib/ecomviper/walmart/walmart-product-repository";
import { getWalmartDraftByIdForUser } from "@/lib/ecomviper/walmart/walmart-drafts";
import { submitWalmartMaintenanceFeed } from "@/lib/ecomviper/walmart/walmart-feeds";
import { buildMaintenancePayload } from "@/lib/ecomviper/walmart/walmart-maintenance";
import { getProductBySku } from "@/lib/ecomviper/walmart/walmart-store";
import { readOptimizerProposalFromDraft } from "@/lib/ecomviper/walmart/walmart-optimizer-staging";

function isWalmartFeedWriteModeEnabled(): boolean {
  return process.env.WALMART_FEED_WRITE_ENABLED === "1";
}

export async function POST(req: NextRequest) {
  try {
    const { userId, unauthorizedResponse } = await requireSignedInUser();
    if (unauthorizedResponse) {
      if (unauthorizedResponse.status !== 401) return unauthorizedResponse;
      return fail(401, "Please sign in before submitting Walmart feed updates.", "UNAUTHORIZED");
    }
    if (!userId) {
      return fail(401, "Please sign in before submitting Walmart feed updates.", "UNAUTHORIZED");
    }

    const body = (await req.json().catch(() => ({}))) as {
      draftId?: string;
      approveSubmit?: boolean;
    };

    if (!body.draftId || typeof body.draftId !== "string") {
      return fail(
        400,
        "Feed submission requires draftId, explicit approval, and an approved proposal.",
        "BAD_REQUEST"
      );
    }

    const draft = await getWalmartDraftByIdForUser(userId, body.draftId);
    if (!draft) {
      return fail(404, "Draft not found.", "NOT_FOUND");
    }

    const proposal = readOptimizerProposalFromDraft(draft);
    if (!proposal) {
      return fail(
        400,
        "Feed submission requires an optimizer proposal in the draft payload.",
        "PROPOSAL_REQUIRED"
      );
    }

    if (!body.approveSubmit) {
      return fail(
        400,
        "Feed submission requires explicit user approval confirmation.",
        "APPROVAL_REQUIRED"
      );
    }

    if (proposal.status !== "approved") {
      return fail(
        409,
        "Proposal must be approved before feed submission.",
        "PROPOSAL_NOT_APPROVED"
      );
    }

    if (!isWalmartFeedWriteModeEnabled()) {
      return fail(
        403,
        "Submission disabled until approval gates pass and write mode is enabled.",
        "WRITE_MODE_DISABLED"
      );
    }

    const persistedProduct = await getPersistedWalmartProductBySku(userId, draft.sku);
    const product =
      persistedProduct ??
      (process.env.NODE_ENV === "test" ? getProductBySku(draft.sku) : null);
    if (!product) {
      return fail(404, "Product not found for draft.", "NOT_FOUND");
    }

    const payload = buildMaintenancePayload({ draft, product });
    const submission = submitWalmartMaintenanceFeed(payload);

    return ok({
      ok: true,
      submission,
      writeModeEnabled: true,
      message: "Preview/staged flow only. Human approval required before live Walmart submission.",
    });
  } catch (error) {
    return fail(500, error instanceof Error ? error.message : "Failed to submit feed.");
  }
}

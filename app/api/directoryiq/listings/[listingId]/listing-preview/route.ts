export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { ensureUser, resolveUserId } from "@/app/api/ecomviper/_utils/user";
import { getListingEvaluation } from "@/app/api/directoryiq/_utils/selectionData";
import { issueApprovalToken } from "@/app/api/directoryiq/_utils/authority";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ listingId: string }> | { listingId: string } }
) {
  try {
    const userId = resolveUserId(req);
    await ensureUser(userId);
    const { listingId } = await Promise.resolve(context.params);

    const body = (await req.json().catch(() => ({}))) as { proposed_description?: string };
    const proposedDescription = (body.proposed_description ?? "").trim();
    if (!proposedDescription) {
      return NextResponse.json({ error: "proposed_description is required" }, { status: 400 });
    }

    const detail = await getListingEvaluation(userId, decodeURIComponent(listingId));
    if (!detail.listing || !detail.evaluation) {
      return NextResponse.json({ error: "Listing not found." }, { status: 404 });
    }

    const raw = (detail.listing.raw_json ?? {}) as Record<string, unknown>;
    const beforeDescription =
      (typeof raw.description === "string" && raw.description) ||
      (typeof raw.content === "string" && raw.content) ||
      "";

    const afterScore = Math.min(100, detail.evaluation.totalScore + 6);

    return NextResponse.json({
      preview: {
        listing_changes: [
          {
            section: "Description",
            before: beforeDescription,
            after: proposedDescription,
          },
        ],
        score_delta: {
          before: detail.evaluation.totalScore,
          after: afterScore,
          cap_changes: detail.evaluation.caps,
        },
      },
      approval_token: issueApprovalToken({
        userId,
        listingId: decodeURIComponent(listingId),
        action: "listing_push",
      }),
      requires_manual_approval: true,
      auto_push: false,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown listing preview error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

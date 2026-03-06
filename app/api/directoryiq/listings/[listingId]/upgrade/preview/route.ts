export const runtime = "nodejs";

import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { ensureUser, resolveUserId } from "@/app/api/ecomviper/_utils/user";
import { DirectoryIqServiceError } from "@/src/directoryiq/services/errors";
import { previewUpgrade } from "@/src/directoryiq/services/upgradeService";
import { ListingSiteRequiredError, resolveListingEvaluation } from "@/app/api/directoryiq/_utils/listingResolve";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ listingId: string }> | { listingId: string } }
) {
  const userId = resolveUserId(req);

  try {
    await ensureUser(userId);
    const { listingId } = await Promise.resolve(params);
    const resolvedListingId = decodeURIComponent(listingId);
    const siteId = req.nextUrl.searchParams.get("site_id");

    const resolved = await resolveListingEvaluation({
      userId,
      listingId: resolvedListingId,
      siteId: siteId?.trim() || null,
    });
    if (!resolved) {
      return NextResponse.json(
        {
          error: {
            message: "Listing not found.",
            code: "NOT_FOUND",
            reqId: crypto.randomUUID(),
          },
        },
        { status: 404 }
      );
    }

    const body = (await req.json().catch(() => ({}))) as { draftId?: string };
    const draftId = (body.draftId ?? "").trim();
    if (!draftId) {
      return NextResponse.json(
        {
          error: {
            message: "draftId is required.",
            code: "BAD_REQUEST",
            reqId: crypto.randomUUID(),
          },
        },
        { status: 400 }
      );
    }

    const sourceId = resolved.listingEval.listing?.source_id ?? resolvedListingId;
    const result = await previewUpgrade(userId, sourceId, draftId);

    return NextResponse.json({
      draftId: result.draftId,
      original: result.original,
      proposed: result.proposed,
      diff: result.diff,
      approvalToken: result.approvalToken,
      reqId: result.reqId,
    });
  } catch (error) {
    if (error instanceof ListingSiteRequiredError) {
      return NextResponse.json(
        {
          error: {
            message: "Multiple sites contain this listing. Provide site_id.",
            code: "SITE_REQUIRED",
            reqId: crypto.randomUUID(),
            candidates: error.candidates.map((candidate) => ({
              site_id: candidate.siteId,
              site_label: candidate.siteLabel,
            })),
          },
        },
        { status: 409 }
      );
    }
    if (error instanceof DirectoryIqServiceError) {
      return NextResponse.json(
        {
          error: {
            message: error.message,
            code: error.code,
            reqId: error.reqId,
            details: error.details,
          },
        },
        { status: error.status }
      );
    }

    const message = error instanceof Error ? error.message : "Unknown upgrade preview error";
    return NextResponse.json(
      {
        error: {
          message,
          code: "INTERNAL_ERROR",
          reqId: crypto.randomUUID(),
        },
      },
      { status: 500 }
    );
  }
}

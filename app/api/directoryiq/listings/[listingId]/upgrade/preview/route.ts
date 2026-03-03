export const runtime = "nodejs";

import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { ensureUser, resolveUserId } from "@/app/api/ecomviper/_utils/user";
import { DirectoryIqServiceError } from "@/src/directoryiq/services/errors";
import { previewUpgrade } from "@/src/directoryiq/services/upgradeService";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ listingId: string }> | { listingId: string } }
) {
  const userId = resolveUserId(req);

  try {
    await ensureUser(userId);
    const { listingId } = await Promise.resolve(params);
    const resolvedListingId = decodeURIComponent(listingId);

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

    const result = await previewUpgrade(userId, resolvedListingId, draftId);

    return NextResponse.json({
      draftId: result.draftId,
      original: result.original,
      proposed: result.proposed,
      diff: result.diff,
      approvalToken: result.approvalToken,
      reqId: result.reqId,
    });
  } catch (error) {
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

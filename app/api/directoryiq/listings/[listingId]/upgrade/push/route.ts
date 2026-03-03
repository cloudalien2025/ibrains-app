export const runtime = "nodejs";

import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { ensureUser, resolveUserId } from "@/app/api/ecomviper/_utils/user";
import { DirectoryIqServiceError } from "@/src/directoryiq/services/errors";
import { pushUpgrade } from "@/src/directoryiq/services/upgradeService";

export async function POST(
  req: NextRequest,
  { params }: { params: { listingId: string } }
) {
  const userId = resolveUserId(req);

  try {
    await ensureUser(userId);
    const { listingId } = params;
    const resolvedListingId = decodeURIComponent(listingId);

    const body = (await req.json().catch(() => ({}))) as {
      draftId?: string;
      approved?: boolean;
      approvalToken?: string;
    };

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

    const result = await pushUpgrade(
      userId,
      resolvedListingId,
      draftId,
      body.approved === true,
      String(body.approvalToken ?? "")
    );

    return NextResponse.json({
      ok: true,
      reqId: result.reqId,
      draftId: result.draftId,
      bdResult: {
        reference: result.bdRef,
      },
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

    const message = error instanceof Error ? error.message : "Unknown upgrade push error";
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

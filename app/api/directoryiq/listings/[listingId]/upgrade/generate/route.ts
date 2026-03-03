export const runtime = "nodejs";

import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { ensureUser, resolveUserId } from "@/app/api/ecomviper/_utils/user";
import { DirectoryIqServiceError } from "@/src/directoryiq/services/errors";
import { generateUpgrade } from "@/src/directoryiq/services/upgradeService";

export async function POST(
  req: NextRequest,
  { params }: { params: { listingId: string } }
) {
  const userId = resolveUserId(req);

  try {
    await ensureUser(userId);
    const { listingId } = params;
    const resolvedListingId = decodeURIComponent(listingId);

    const result = await generateUpgrade({
      userId,
      listingId: resolvedListingId,
      mode: "default",
    });

    return NextResponse.json({
      draftId: result.draft.id,
      proposedDescription: result.draft.proposedText,
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

    const message = error instanceof Error ? error.message : "Unknown upgrade generation error";
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

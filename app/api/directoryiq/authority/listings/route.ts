import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { ensureUser, resolveUserId } from "@/app/api/ecomviper/_utils/user";
import { getAuthorityListings } from "@/src/directoryiq/graph/graphService";

export async function GET(req: NextRequest) {
  const reqId = crypto.randomUUID();

  try {
    const userId = resolveUserId(req);
    await ensureUser(userId);

    const listings = await getAuthorityListings({ tenantId: "default" });
    return NextResponse.json({ ok: true, listings, reqId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load authority listings";
    return NextResponse.json(
      {
        ok: false,
        listings: [],
        error: {
          message,
          code: "INTERNAL_ERROR",
          reqId,
        },
      },
      { status: 200 }
    );
  }
}

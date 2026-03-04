import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { ensureUser, resolveUserId } from "@/app/api/ecomviper/_utils/user";
import { getAuthorityOverview } from "@/src/directoryiq/graph/graphService";

export async function GET(req: NextRequest) {
  const reqId = crypto.randomUUID();

  try {
    const userId = resolveUserId(req);
    await ensureUser(userId);

    const overview = await getAuthorityOverview({ tenantId: "default", userId });
    return NextResponse.json({ ok: true, overview, reqId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load authority overview";
    return NextResponse.json(
      {
        ok: false,
        overview: {
          totalNodes: 0,
          totalEdges: 0,
          totalEvidence: 0,
          blogNodes: 0,
          listingNodes: 0,
          lastIngestionRunAt: null,
          lastGraphRunAt: null,
          lastGraphRunStatus: null,
        },
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

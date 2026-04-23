import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { proxyDirectoryIqRead } from "@/app/api/directoryiq/_utils/externalReadProxy";
import { ensureUser, resolveUserId } from "@/app/api/ecomviper/_utils/user";
import { getAuthorityOverview } from "@/src/directoryiq/graph/graphService";
import { shouldServeDirectoryIqLocally } from "@/app/api/directoryiq/_utils/runtimeParity";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  if (shouldServeDirectoryIqLocally(req)) {
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
          error: {
            message,
            code: "INTERNAL_ERROR",
            reqId,
          },
        },
        { status: 500 }
      );
    }
  }

  return proxyDirectoryIqRead(req, "/api/directoryiq/authority/overview");
}

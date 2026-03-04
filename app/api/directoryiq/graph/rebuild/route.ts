import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { ensureUser, resolveUserId } from "@/app/api/ecomviper/_utils/user";
import { rebuildGraph } from "@/src/directoryiq/graph/graphService";

export async function POST(req: NextRequest) {
  const reqId = crypto.randomUUID();

  try {
    const userId = resolveUserId(req);
    await ensureUser(userId);

    const body = (await req.json().catch(() => ({}))) as { mode?: "scan" };
    const mode = body.mode === "scan" ? "scan" : "scan";

    const result = await rebuildGraph({
      tenantId: "default",
      mode,
    });

    return NextResponse.json({
      ok: true,
      runId: result.runId,
      stats: result.stats,
      reqId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to rebuild authority graph";
    return NextResponse.json(
      {
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

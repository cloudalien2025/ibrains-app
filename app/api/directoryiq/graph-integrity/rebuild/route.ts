import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { ensureUser, resolveUserId } from "@/app/api/ecomviper/_utils/user";
import { resolveUserFromHeaders } from "@/lib/auth/entitlements";
import { resolveGraphIntegrityGate } from "@/src/directoryiq/services/graphIntegrity/featureFlags";
import { rebuildGraphIntegrity } from "@/src/directoryiq/services/graphIntegrity/integrityRunner";

export async function POST(req: NextRequest) {
  const reqId = crypto.randomUUID();

  try {
    const userId = resolveUserId(req);
    await ensureUser(userId);

    const body = (await req.json().catch(() => ({}))) as { tenantId?: string; mode?: "dry_run" | "apply" };
    const tenantId = body.tenantId ?? "default";
    const mode = body.mode ?? "dry_run";

    const user = resolveUserFromHeaders(req.headers);
    const gate = resolveGraphIntegrityGate({ tenantId, userFeatures: user.features as string[] | undefined });
    if (!gate.enabled) {
      return NextResponse.json(
        {
          ok: false,
          error: { message: "Graph integrity not enabled", code: gate.reason, reqId },
        },
        { status: 403 }
      );
    }

    const result = await rebuildGraphIntegrity({ tenantId, userId, mode });

    return NextResponse.json({
      ok: true,
      reqId,
      result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to rebuild integrity";
    return NextResponse.json(
      {
        ok: false,
        error: { message, code: "INTERNAL_ERROR", reqId },
      },
      { status: 500 }
    );
  }
}

import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { ensureUser, resolveUserId } from "@/app/api/ecomviper/_utils/user";
import { resolveUserFromHeaders } from "@/lib/auth/entitlements";
import { resolveGraphIntegrityGate } from "@/src/directoryiq/services/graphIntegrity/featureFlags";
import {
  computeTenantSummary,
  listAuthorityLeaks,
  listListingBacklinkCandidates,
} from "@/src/directoryiq/services/graphIntegrity/integrityMetrics";

export async function GET(req: NextRequest) {
  const reqId = crypto.randomUUID();

  try {
    const userId = resolveUserId(req);
    await ensureUser(userId);

    const tenantId = req.nextUrl.searchParams.get("tenantId") ?? "default";
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

    const summary = await computeTenantSummary({ tenantId });
    const backlinkCandidates = await listListingBacklinkCandidates({ tenantId, limit: 20 });
    const leaks = await listAuthorityLeaks({ tenantId, limit: 20 });

    return NextResponse.json({
      ok: true,
      reqId,
      summary,
      backlinkCandidates,
      leaks,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load integrity summary";
    return NextResponse.json(
      {
        ok: false,
        error: { message, code: "INTERNAL_ERROR", reqId },
      },
      { status: 500 }
    );
  }
}

import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { ensureUser, resolveUserId } from "@/app/api/ecomviper/_utils/user";
import { resolveUserFromHeaders } from "@/lib/auth/entitlements";
import { resolveGraphIntegrityGate } from "@/src/directoryiq/services/graphIntegrity/featureFlags";
import { runLeakScan } from "@/src/directoryiq/leaks/leakScanService";

const SCOPES = new Set(["all", "changed", "single_blog"]);

export async function POST(req: NextRequest) {
  const reqId = crypto.randomUUID();

  try {
    const userId = resolveUserId(req);
    await ensureUser(userId);

    const body = (await req.json().catch(() => ({}))) as {
      scope?: "all" | "changed" | "single_blog";
      blogNodeId?: string;
      tenantId?: string;
    };

    const tenantId = body.tenantId ?? "default";
    const scope = body.scope ?? "all";
    if (!SCOPES.has(scope)) {
      return NextResponse.json(
        { ok: false, error: { message: "Invalid scope", code: "BAD_REQUEST", reqId } },
        { status: 400 }
      );
    }

    if (scope === "single_blog" && !body.blogNodeId) {
      return NextResponse.json(
        { ok: false, error: { message: "blogNodeId required for single_blog", code: "BAD_REQUEST", reqId } },
        { status: 400 }
      );
    }

    const user = resolveUserFromHeaders(req.headers);
    const gate = resolveGraphIntegrityGate({ tenantId, userFeatures: user.features as string[] | undefined });
    if (!gate.enabled) {
      return NextResponse.json(
        { ok: false, error: { message: "Graph integrity not enabled", code: gate.reason, reqId } },
        { status: 403 }
      );
    }

    const result = await runLeakScan({
      tenantId,
      userId,
      scope,
      blogNodeId: body.blogNodeId ?? null,
    });

    return NextResponse.json({
      ok: true,
      reqId,
      runId: result.runId,
      status: "success",
      stats: result.stats,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Leak scan failed";
    return NextResponse.json(
      { ok: false, error: { message, code: "INTERNAL_ERROR", reqId } },
      { status: 500 }
    );
  }
}

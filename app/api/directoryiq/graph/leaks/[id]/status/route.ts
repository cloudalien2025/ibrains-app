import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { ensureUser, resolveUserId } from "@/app/api/ecomviper/_utils/user";
import { resolveUserFromHeaders } from "@/lib/auth/entitlements";
import { resolveGraphIntegrityGate } from "@/src/directoryiq/services/graphIntegrity/featureFlags";
import { queryDb } from "@/src/directoryiq/repositories/db";

const STATUSES = new Set(["open", "ignored", "resolved"]);

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  const reqId = crypto.randomUUID();

  try {
    const userId = resolveUserId(req);
    await ensureUser(userId);

    const body = (await req.json().catch(() => ({}))) as { status?: string; tenantId?: string };
    const status = body.status ?? "";
    if (!STATUSES.has(status)) {
      return NextResponse.json(
        { ok: false, error: { message: "Invalid status", code: "BAD_REQUEST", reqId } },
        { status: 400 }
      );
    }

    const tenantId = body.tenantId ?? "default";
    const user = resolveUserFromHeaders(req.headers);
    const gate = resolveGraphIntegrityGate({ tenantId, userFeatures: user.features as string[] | undefined });
    if (!gate.enabled) {
      return NextResponse.json(
        { ok: false, error: { message: "Graph integrity not enabled", code: gate.reason, reqId } },
        { status: 403 }
      );
    }

    const { id: leakId } = await Promise.resolve(context.params);
    const rows = await queryDb<{ id: string }>(
      `
      UPDATE directoryiq_authority_leaks
      SET status = $3, updated_at = now()
      WHERE tenant_id = $1 AND id = $2
      RETURNING id
      `,
      [tenantId, leakId, status]
    );

    if (rows.length === 0) {
      return NextResponse.json(
        { ok: false, error: { message: "Leak not found", code: "NOT_FOUND", reqId } },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, reqId, id: rows[0].id, status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update leak";
    return NextResponse.json(
      { ok: false, error: { message, code: "INTERNAL_ERROR", reqId } },
      { status: 500 }
    );
  }
}

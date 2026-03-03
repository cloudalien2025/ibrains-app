import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { ensureUser, resolveUserId } from "@/app/api/ecomviper/_utils/user";
import { getIssues } from "@/src/directoryiq/graph/graphService";

export async function GET(req: NextRequest) {
  const reqId = crypto.randomUUID();

  try {
    const userId = resolveUserId(req);
    await ensureUser(userId);

    const issues = await getIssues({ tenantId: "default" });
    return NextResponse.json({ ok: true, issues, reqId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load authority graph issues";
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

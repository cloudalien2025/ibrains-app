export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { ensureUser, resolveUserId } from "@/app/api/ecomviper/_utils/user";
import { getAuthorityNetworkSummary } from "@/app/api/directoryiq/_utils/authorityGraph";

export async function GET(req: NextRequest) {
  try {
    const tenantId = resolveUserId(req);
    await ensureUser(tenantId);
    const summary = await getAuthorityNetworkSummary(tenantId);
    return NextResponse.json(summary);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load authority network summary" },
      { status: 500 }
    );
  }
}

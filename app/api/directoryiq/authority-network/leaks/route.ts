export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { ensureUser, resolveUserId } from "@/app/api/ecomviper/_utils/user";
import { getLeakList } from "@/app/api/directoryiq/_utils/authorityGraph";

export async function GET(req: NextRequest) {
  try {
    const tenantId = resolveUserId(req);
    await ensureUser(tenantId);
    const leaks = await getLeakList(tenantId);
    return NextResponse.json({ leaks });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load leaks" },
      { status: 500 }
    );
  }
}

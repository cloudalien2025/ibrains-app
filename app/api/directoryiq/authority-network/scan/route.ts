export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { ensureUser, resolveUserId } from "@/app/api/ecomviper/_utils/user";
import { runEntityResolution, runLeakScanner } from "@/app/api/directoryiq/_utils/authorityGraph";

export async function POST(req: NextRequest) {
  try {
    const tenantId = resolveUserId(req);
    await ensureUser(tenantId);

    const resolution = await runEntityResolution(tenantId);
    const scan = await runLeakScanner(tenantId);

    return NextResponse.json({
      ok: true,
      resolution,
      leakCount: scan.leaks.length,
      weakAnchorCount: scan.weakAnchors.length,
      orphanListingCount: scan.orphanListings.length,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to scan authority network" },
      { status: 500 }
    );
  }
}

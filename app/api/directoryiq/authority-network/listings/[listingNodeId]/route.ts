export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { ensureUser, resolveUserId } from "@/app/api/ecomviper/_utils/user";
import { getListingAuthorityDetail } from "@/app/api/directoryiq/_utils/authorityGraph";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ listingNodeId: string }> | { listingNodeId: string } }
) {
  try {
    const tenantId = resolveUserId(req);
    await ensureUser(tenantId);
    const { listingNodeId } = await Promise.resolve(context.params);
    const detail = await getListingAuthorityDetail(tenantId, listingNodeId);
    return NextResponse.json(detail);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load listing authority detail" },
      { status: 500 }
    );
  }
}

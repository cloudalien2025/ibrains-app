export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { ensureUser, resolveUserId } from "@/app/api/ecomviper/_utils/user";
import { query } from "@/app/api/ecomviper/_utils/db";
import { getListingAuthorityDetail } from "@/app/api/directoryiq/_utils/authorityGraph";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ listingSourceId: string }> | { listingSourceId: string } }
) {
  try {
    const tenantId = resolveUserId(req);
    await ensureUser(tenantId);
    const { listingSourceId } = await Promise.resolve(context.params);

    const rows = await query<{ id: string }>(
      `
      SELECT id
      FROM content_nodes
      WHERE tenant_id = $1
        AND node_type = 'listing'
        AND external_id = $2
      LIMIT 1
      `,
      [tenantId, decodeURIComponent(listingSourceId)]
    );

    if (!rows[0]) {
      return NextResponse.json({ mentions: 0, linked: 0, leaks: 0, listingNodeId: null });
    }

    const detail = await getListingAuthorityDetail(tenantId, rows[0].id);
    return NextResponse.json({ ...detail, listingNodeId: rows[0].id });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load listing authority detail" },
      { status: 500 }
    );
  }
}

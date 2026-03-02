export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { ensureUser, resolveUserId } from "@/app/api/ecomviper/_utils/user";
import { getBlogAuthorityDetail } from "@/app/api/directoryiq/_utils/authorityGraph";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ blogNodeId: string }> | { blogNodeId: string } }
) {
  try {
    const tenantId = resolveUserId(req);
    await ensureUser(tenantId);
    const { blogNodeId } = await Promise.resolve(context.params);
    const detail = await getBlogAuthorityDetail(tenantId, blogNodeId);
    return NextResponse.json(detail);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load blog authority detail" },
      { status: 500 }
    );
  }
}

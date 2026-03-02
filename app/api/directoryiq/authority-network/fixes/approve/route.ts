export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { ensureUser, resolveUserId } from "@/app/api/ecomviper/_utils/user";
import { approveLeakFix } from "@/app/api/directoryiq/_utils/authorityGraph";

export async function POST(req: NextRequest) {
  try {
    const tenantId = resolveUserId(req);
    await ensureUser(tenantId);

    const body = (await req.json().catch(() => ({}))) as {
      blogNodeId?: string;
      listingNodeId?: string;
      approved?: boolean;
    };

    if (!body.blogNodeId || !body.listingNodeId) {
      return NextResponse.json({ error: "blogNodeId and listingNodeId are required" }, { status: 400 });
    }

    if (body.approved !== true) {
      return NextResponse.json({ error: "approved=true is required" }, { status: 400 });
    }

    const result = await approveLeakFix({
      tenantId,
      blogNodeId: body.blogNodeId,
      listingNodeId: body.listingNodeId,
      approved: true,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to approve fix" },
      { status: 500 }
    );
  }
}

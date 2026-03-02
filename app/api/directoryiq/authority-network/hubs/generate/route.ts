export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { ensureUser, resolveUserId } from "@/app/api/ecomviper/_utils/user";
import { generateAuthorityHub } from "@/app/api/directoryiq/_utils/authorityGraph";

export async function POST(req: NextRequest) {
  try {
    const tenantId = resolveUserId(req);
    await ensureUser(tenantId);

    const body = (await req.json().catch(() => ({}))) as {
      query?: string;
      listingNodeIds?: string[];
    };

    const queryText = (body.query ?? "").trim();
    if (!queryText) {
      return NextResponse.json({ error: "query is required" }, { status: 400 });
    }

    const listingNodeIds = Array.isArray(body.listingNodeIds)
      ? body.listingNodeIds.filter((entry): entry is string => typeof entry === "string" && entry.length > 0)
      : [];

    const hub = await generateAuthorityHub({ tenantId, queryText, listingNodeIds });
    return NextResponse.json({ ok: true, ...hub });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate hub" },
      { status: 500 }
    );
  }
}

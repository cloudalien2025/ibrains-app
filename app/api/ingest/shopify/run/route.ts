export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { runFullShopifyIngest } from "@/app/api/ecomviper/_utils/ingest";
import { ensureUser, resolveUserId } from "@/app/api/ecomviper/_utils/user";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { integration_id?: string; mode?: string };
    if (!body.integration_id) {
      return NextResponse.json({ error: "integration_id is required" }, { status: 400 });
    }

    if (body.mode && body.mode !== "full") {
      return NextResponse.json({ error: "Only mode='full' is supported in MVP" }, { status: 400 });
    }

    const userId = resolveUserId(req);
    await ensureUser(userId);

    const result = await runFullShopifyIngest({
      userId,
      integrationId: body.integration_id,
    });

    return NextResponse.json({
      run_id: result.runId,
      status: result.status,
      counts: result.counts,
      error_message: result.errorMessage ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown ingest error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { runDirectoryIqFullIngest } from "@/app/api/directoryiq/_utils/ingest";
import { ensureUser, resolveUserId } from "@/app/api/ecomviper/_utils/user";

export async function POST(req: NextRequest) {
  try {
    const userId = resolveUserId(req);
    await ensureUser(userId);

    const result = await runDirectoryIqFullIngest(userId);

    return NextResponse.json({
      run_id: result.runId,
      status: result.status,
      counts: result.counts,
      error_message: result.errorMessage ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown DirectoryIQ ingest error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

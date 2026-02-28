export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getSnapshot, hasDirectoryIqConnection } from "@/app/api/_utils/snapshots";
import { ensureUser, resolveUserId } from "@/app/api/ecomviper/_utils/user";
import { metricTemplate } from "@/lib/snapshots/types";

export async function GET(req: NextRequest) {
  try {
    const userId = resolveUserId(req);
    await ensureUser(userId);

    const connected = await hasDirectoryIqConnection(userId);
    if (!connected) {
      return NextResponse.json({
        brain_id: "directoryiq",
        status: "needs_connection",
        updated_at: null,
        metrics: metricTemplate("directoryiq", "loading"),
        hints: ["Connect your Brilliant Directories Website to start analysis."],
        last_error: null,
      });
    }

    const snapshot = await getSnapshot(userId, "directoryiq");
    if (snapshot.status === "needs_connection") {
      return NextResponse.json({
        ...snapshot,
        status: "updating",
      });
    }

    return NextResponse.json(snapshot);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown snapshot error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

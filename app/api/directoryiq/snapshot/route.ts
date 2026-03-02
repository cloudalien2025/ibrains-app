export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getLatestConnectedSite, getSnapshot, hasDirectoryIqConnection } from "@/app/api/_utils/snapshots";
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
        connection_type: null,
        hints: ["Connect your Brilliant Directories Website or connect a website via sitemap to start analysis."],
        last_error: null,
      });
    }

    const snapshot = await getSnapshot(userId, "directoryiq");
    const latestSite = await getLatestConnectedSite(userId, "directoryiq");
    if (snapshot.status === "needs_connection") {
      return NextResponse.json({
        ...snapshot,
        status: "updating",
        connection_type: latestSite?.connection_type ?? null,
      });
    }

    return NextResponse.json({
      ...snapshot,
      connection_type: snapshot.connection_type ?? latestSite?.connection_type ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown snapshot error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

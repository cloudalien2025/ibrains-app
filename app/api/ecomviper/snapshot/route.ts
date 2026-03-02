export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getLatestConnectedSite, getLatestShopifyIntegration, getSnapshot } from "@/app/api/_utils/snapshots";
import { ensureUser, resolveUserId } from "@/app/api/ecomviper/_utils/user";
import { metricTemplate } from "@/lib/snapshots/types";

export async function GET(req: NextRequest) {
  try {
    const userId = resolveUserId(req);
    await ensureUser(userId);

    const [integration, latestSite] = await Promise.all([
      getLatestShopifyIntegration(userId),
      getLatestConnectedSite(userId, "ecomviper"),
    ]);
    if (!integration && !latestSite) {
      return NextResponse.json({
        brain_id: "ecomviper",
        status: "needs_connection",
        updated_at: null,
        metrics: metricTemplate("ecomviper", "loading"),
        connection_type: null,
        hints: ["Connect your Shopify Store or connect a website via sitemap to start analysis."],
        last_error: null,
      });
    }

    const snapshot = await getSnapshot(userId, "ecomviper");
    if (snapshot.status === "needs_connection") {
      return NextResponse.json({
        ...snapshot,
        status: "updating",
        connection_type: snapshot.connection_type ?? (integration ? "shopify" : latestSite?.connection_type ?? null),
      });
    }

    return NextResponse.json({
      ...snapshot,
      connection_type: snapshot.connection_type ?? (integration ? "shopify" : latestSite?.connection_type ?? null),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown snapshot error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

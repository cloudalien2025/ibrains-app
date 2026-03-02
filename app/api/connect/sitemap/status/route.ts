export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { ensureUser, resolveUserId } from "@/app/api/ecomviper/_utils/user";
import { query } from "@/app/api/ecomviper/_utils/db";
import { countsFromConnectedSite, stageLabel } from "@/app/api/connect/_utils/sitemapConnection";
import { checkRateLimit } from "@/lib/security/rateLimit";

type StatusRow = {
  id: string;
  status: string;
  progress_stage: string;
  counts_json: Record<string, unknown> | null;
  last_error: string | null;
  updated_at: string;
};

export async function GET(req: NextRequest) {
  try {
    const userId = resolveUserId(req);
    await ensureUser(userId);
    if (!checkRateLimit(`connect:sitemap-status:${userId}`, 120, 60_000)) {
      return NextResponse.json({ error: "Too many status requests. Please wait and retry." }, { status: 429 });
    }
    const connectedSiteId = (req.nextUrl.searchParams.get("connected_site_id") ?? "").trim();

    if (!connectedSiteId) {
      return NextResponse.json({ error: "connected_site_id is required" }, { status: 400 });
    }

    const rows = await query<StatusRow>(
      `
      SELECT id, status, progress_stage, counts_json, last_error, updated_at
      FROM connected_sites
      WHERE id = $1 AND user_id = $2
      LIMIT 1
      `,
      [connectedSiteId, userId]
    );
    const row = rows[0];
    if (!row) {
      return NextResponse.json({ error: "Connected site not found" }, { status: 404 });
    }

    return NextResponse.json({
      status: row.status,
      progress_stage: row.progress_stage,
      progress_message: stageLabel(row.progress_stage),
      counts_so_far: countsFromConnectedSite(row),
      last_error: row.last_error,
      updated_at: row.updated_at,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown sitemap status error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

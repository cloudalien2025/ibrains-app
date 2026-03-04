export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/app/api/ecomviper/_utils/db";
import { ensureUser, resolveUserId } from "@/app/api/ecomviper/_utils/user";

type RunRow = {
  id: string;
  status: string;
  source_base_url: string | null;
  started_at: string;
  finished_at: string | null;
  listings_count: number;
  blog_posts_count: number;
  error_message: string | null;
};

export async function GET(req: NextRequest) {
  try {
    const userId = resolveUserId(req);
    await ensureUser(userId);

    const runs = await query<RunRow>(
      `
      SELECT id, status, source_base_url, started_at, finished_at, listings_count, blog_posts_count, error_message
      FROM directoryiq_ingest_runs
      WHERE user_id = $1
      ORDER BY started_at DESC
      LIMIT 10
      `,
      [userId]
    );

    return NextResponse.json({ runs });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown DirectoryIQ runs error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

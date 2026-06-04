export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { requireSignedInUser } from "@/lib/auth/requireSignedInUser";
import { listRecentFileIqJobs } from "@/lib/fileiq/fileiq-db";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { userId, unauthorizedResponse } = await requireSignedInUser();
  if (unauthorizedResponse) return unauthorizedResponse;
  if (!userId) {
    return NextResponse.json(
      { error: "unauthorized", message: "Sign-in required." },
      { status: 401 },
    );
  }

  const limitParam = request.nextUrl.searchParams.get("limit");
  const limit = Math.min(Number(limitParam) || 20, 100);

  try {
    const jobs = await listRecentFileIqJobs(limit, userId);
    return NextResponse.json({ jobs });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to list jobs.";
    const isTableMissing = msg.includes("relation") && msg.includes("does not exist");
    if (isTableMissing) {
      return NextResponse.json({ jobs: [] });
    }
    return NextResponse.json({ error: "db_error", message: msg }, { status: 500 });
  }
}

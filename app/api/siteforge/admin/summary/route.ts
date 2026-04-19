export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireSignedInUser } from "@/lib/auth/requireSignedInUser";
import { getSiteForgeRepository, getSiteForgeStorageStatus } from "@/lib/siteforge/repository";
import { isSiteForgePersistenceError } from "@/lib/siteforge/repository/persistence";

export async function GET() {
  const { unauthorizedResponse } = await requireSignedInUser();
  if (unauthorizedResponse) return unauthorizedResponse;

  try {
    const repo = await getSiteForgeRepository();
    const summary = await repo.getAdminSummary();
    return NextResponse.json({ summary }, { status: 200 });
  } catch (error: unknown) {
    if (isSiteForgePersistenceError(error)) {
      return NextResponse.json(
        {
          summary: {
            projects: 0,
            sessions: 0,
            activeRuns: 0,
            failedRuns: 0,
            completedRuns: 0,
            lastRunAt: null,
            ...getSiteForgeStorageStatus(),
          },
          error: {
            code: error.code,
            message: error.message,
          },
        },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to load SiteForge admin summary." } },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204 });
}

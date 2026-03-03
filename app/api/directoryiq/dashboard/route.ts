export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { ensureUser, resolveUserId } from "@/app/api/ecomviper/_utils/user";
import { query } from "@/app/api/ecomviper/_utils/db";
import { getDirectoryIqIntegration } from "@/app/api/directoryiq/_utils/credentials";
import { getAllListingsWithEvaluations, getDirectoryIqSettings } from "@/app/api/directoryiq/_utils/selectionData";
import { scheduleSnapshotRefresh } from "@/app/api/_utils/snapshots";

type DashboardListing = {
  listing_id: string;
  listing_name: string;
  score: number;
  authority_status: string;
  trust_status: string;
  last_optimized: string | null;
};

type LastRunRow = {
  finished_at: string | null;
};

async function loadDashboard(userId: string) {
  const [integration, listingEval, settings, latestRunRows] = await Promise.all([
    getDirectoryIqIntegration(userId, "brilliant_directories"),
    getAllListingsWithEvaluations(userId),
    getDirectoryIqSettings(userId),
    query<LastRunRow>(
      `
      SELECT finished_at
      FROM directoryiq_ingest_runs
      WHERE user_id = $1
      ORDER BY started_at DESC
      LIMIT 1
      `,
      [userId]
    ),
  ]);

  const listings: DashboardListing[] = listingEval.cards.map((card) => ({
    listing_id: card.listingId,
    listing_name: card.name,
    score: card.evaluation.totalScore,
    authority_status: card.authorityStatus.toLowerCase().replace(/\s+/g, "_"),
    trust_status: card.trustStatus.toLowerCase().replace(/\s+/g, "_"),
    last_optimized: card.lastOptimized,
  }));

  return {
    connected: integration.status === "connected",
    readiness: listingEval.readiness,
    pillars: listingEval.pillarAverages,
    listings,
    vertical_detected: listingEval.verticalDetected,
    vertical_override: settings.verticalOverride ?? null,
    last_analyzed_at: latestRunRows[0]?.finished_at ?? null,
    progress_messages: [
      "Evaluating selection signals...",
      "Scoring listing quality...",
      "Updating readiness overview...",
    ],
  };
}

export async function GET(req: NextRequest) {
  try {
    const userId = resolveUserId(req);
    await ensureUser(userId);
    const payload = await loadDashboard(userId);
    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown dashboard error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = resolveUserId(req);
    await ensureUser(userId);
    await scheduleSnapshotRefresh({ userId, brainId: "directoryiq", runIngest: true });
    const payload = await loadDashboard(userId);
    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown dashboard refresh error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


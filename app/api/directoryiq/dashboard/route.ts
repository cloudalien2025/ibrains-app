export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { scheduleSnapshotRefresh } from "@/app/api/_utils/snapshots";
import { ensureUser, resolveUserId } from "@/app/api/ecomviper/_utils/user";
import {
  getAllListingsWithEvaluations,
  getLastAnalyzedAt,
  getDirectoryIqSettings,
  hasDirectoryIqSiteConnected,
} from "@/app/api/directoryiq/_utils/selectionData";

const PROGRESS_MESSAGES = [
  "Scanning listings...",
  "Mapping structure...",
  "Evaluating selection signals...",
  "Identifying authority gaps...",
  "Detecting monetization/actionability opportunities...",
] as const;

export async function GET(req: NextRequest) {
  try {
    const userId = resolveUserId(req);
    await ensureUser(userId);

    const [connected, data, lastAnalyzedAt, settings] = await Promise.all([
      hasDirectoryIqSiteConnected(userId),
      getAllListingsWithEvaluations(userId),
      getLastAnalyzedAt(userId),
      getDirectoryIqSettings(userId),
    ]);

    return NextResponse.json({
      connected,
      readiness: data.readiness,
      pillars: data.pillarAverages,
      listings: data.cards.map((card) => ({
        listing_id: card.listingId,
        listing_name: card.name,
        score: card.evaluation.totalScore,
        authority_status: card.authorityStatus,
        trust_status: card.trustStatus,
        last_optimized: card.lastOptimized,
      })),
      vertical_detected: data.verticalDetected,
      vertical_override: settings.verticalOverride,
      last_analyzed_at: lastAnalyzedAt,
      progress_messages: PROGRESS_MESSAGES,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown dashboard error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = resolveUserId(req);
    await ensureUser(userId);
    const result = await scheduleSnapshotRefresh({ userId, brainId: "directoryiq", runIngest: true });

    return NextResponse.json({
      status: result.status,
      progress_messages: PROGRESS_MESSAGES,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown refresh error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

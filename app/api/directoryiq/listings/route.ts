export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { ensureUser, resolveUserId } from "@/app/api/ecomviper/_utils/user";
import { getAllListingsWithEvaluations } from "@/app/api/directoryiq/_utils/selectionData";

export async function GET(req: NextRequest) {
  try {
    const userId = resolveUserId(req);
    await ensureUser(userId);

    const result = await getAllListingsWithEvaluations(userId);
    const listings = result.cards.map((card) => ({
      listing_id: card.listingId,
      listing_name: card.name,
      url: card.url,
      score: card.evaluation.totalScore,
      pillars: card.evaluation.scores,
      authority_status: card.authorityStatus.toLowerCase().replace(/\s+/g, "_"),
      trust_status: card.trustStatus.toLowerCase().replace(/\s+/g, "_"),
      last_optimized: card.lastOptimized,
    }));

    return NextResponse.json({
      ok: true,
      listings,
      readiness: result.readiness,
      pillar_averages: result.pillarAverages,
      vertical_detected: result.verticalDetected,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load listings";
    return NextResponse.json({ ok: false, listings: [], error: message }, { status: 500 });
  }
}


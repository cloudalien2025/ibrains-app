export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { ensureUser, resolveUserId } from "@/app/api/ecomviper/_utils/user";
import { getAllListingsWithEvaluations } from "@/app/api/directoryiq/_utils/selectionData";

export async function GET(req: NextRequest) {
  try {
    const userId = resolveUserId(req);
    await ensureUser(userId);

    const data = await getAllListingsWithEvaluations(userId);
    return NextResponse.json({
      listings: data.cards.map((card) => ({
        listing_id: card.listingId,
        listing_name: card.name,
        url: card.url,
        score: card.evaluation.totalScore,
        pillars: card.evaluation.scores,
        authority_status: card.authorityStatus,
        trust_status: card.trustStatus,
        last_optimized: card.lastOptimized,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown listings error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

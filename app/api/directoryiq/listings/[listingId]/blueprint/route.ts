export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { ensureUser, resolveUserId } from "@/app/api/ecomviper/_utils/user";
import { getListingEvaluation } from "@/app/api/directoryiq/_utils/selectionData";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ listingId: string }> | { listingId: string } }
) {
  try {
    const userId = resolveUserId(req);
    await ensureUser(userId);

    const { listingId } = await Promise.resolve(context.params);
    const data = await getListingEvaluation(userId, decodeURIComponent(listingId));

    if (!data.listing || !data.evaluation) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }

    return NextResponse.json({
      listing_id: data.listing.source_id,
      blueprint: {
        structure: data.evaluation.gapsByPillar.structure,
        clarity: data.evaluation.gapsByPillar.clarity,
        trust: data.evaluation.gapsByPillar.trust,
        authority: data.evaluation.gapsByPillar.authority,
        actionability: data.evaluation.gapsByPillar.actionability,
      },
      cap_indicators: data.evaluation.flags,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown blueprint error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

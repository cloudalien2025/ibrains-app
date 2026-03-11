export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { resolveListingSupportModel } from "@/app/api/directoryiq/_utils/listingSupportRuntime";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ listingId: string }> | { listingId: string } }
) {
  const { listingId } = await Promise.resolve(params);
  const resolution = await resolveListingSupportModel(req, listingId);

  return NextResponse.json({
    ok: true,
    support: resolution.support,
    meta: {
      source: resolution.source,
      fallbackApplied: resolution.fallbackApplied,
      upstreamStatus: resolution.upstreamStatus ?? null,
    },
  });
}

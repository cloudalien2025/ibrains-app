export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { runBrainIngestOrchestration } from "@/lib/brain-learning/ingestOrchestrator";
import { requireSignedInUser } from "@/lib/auth/requireSignedInUser";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  const { unauthorizedResponse } = await requireSignedInUser();
  if (unauthorizedResponse) return unauthorizedResponse;

  try {
    const body = (await req.json().catch(() => ({}))) as {
      source_item_id?: string;
      limit?: number;
      force_reingest?: boolean;
    };
    const { id } = await Promise.resolve(params);
    const summary = await runBrainIngestOrchestration({
      brainId: id,
      sourceItemId: body.source_item_id || null,
      limit: body.limit,
      forceReingest: Boolean(body.force_reingest),
    });
    return NextResponse.json(summary, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      {
        error: {
          code: "INGEST_ORCHESTRATION_FAILED",
          message: e?.message || "Ingest orchestration failed",
        },
      },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204 });
}

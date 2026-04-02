export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { CoBrainContextPacket } from "@/lib/brain-learning/contextAssembly";
import { runCoBrainAnswerOrchestration } from "@/lib/brain-learning/answerOrchestration";

function unauthorized() {
  return NextResponse.json(
    {
      error: {
        code: "UNAUTHORIZED",
        message: "Missing or invalid x-api-key",
      },
    },
    { status: 401 }
  );
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  const expectedKey = (process.env.BRAINS_MASTER_KEY || process.env.BRAINS_X_API_KEY || "").trim();
  const providedKey = (req.headers.get("x-api-key") || "").trim();
  if (!expectedKey || providedKey !== expectedKey) {
    return unauthorized();
  }

  try {
    const body = (await req.json().catch(() => ({}))) as {
      query?: string;
      limit?: number;
      taxonomy_node_ids?: string[];
      taxonomy_node_keys?: string[];
      context_packet?: CoBrainContextPacket;
    };
    const { id } = await Promise.resolve(params);
    const query = (body.query || "").trim();
    if (!query) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_REQUEST",
            message: "Missing required field: query",
          },
        },
        { status: 400 }
      );
    }

    const result = await runCoBrainAnswerOrchestration({
      brainId: id,
      query,
      limit: body.limit,
      taxonomyNodeIds: Array.isArray(body.taxonomy_node_ids) ? body.taxonomy_node_ids : [],
      taxonomyNodeKeys: Array.isArray(body.taxonomy_node_keys) ? body.taxonomy_node_keys : [],
      contextPacket: body.context_packet || null,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      {
        error: {
          code: "ANSWER_ORCHESTRATION_FAILED",
          message: e?.message || "Co-brain answer orchestration failed",
        },
      },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204 });
}

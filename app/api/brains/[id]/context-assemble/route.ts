export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { runCoBrainContextAssembly } from "@/lib/brain-learning/contextAssembly";
import { requireSignedInUser } from "@/lib/auth/requireSignedInUser";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  const { unauthorizedResponse } = await requireSignedInUser();
  if (unauthorizedResponse) return unauthorizedResponse;

  try {
    const body = (await req.json().catch(() => ({}))) as {
      query?: string;
      limit?: number;
      taxonomy_node_ids?: string[];
      taxonomy_node_keys?: string[];
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

    const packet = await runCoBrainContextAssembly({
      brainId: id,
      query,
      limit: body.limit,
      taxonomyNodeIds: Array.isArray(body.taxonomy_node_ids) ? body.taxonomy_node_ids : [],
      taxonomyNodeKeys: Array.isArray(body.taxonomy_node_keys) ? body.taxonomy_node_keys : [],
    });

    return NextResponse.json(packet, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      {
        error: {
          code: "CONTEXT_ASSEMBLY_FAILED",
          message: e?.message || "Co-brain context assembly failed",
        },
      },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204 });
}

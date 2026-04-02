export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { runBrainTaxonomyEnrichment } from "@/lib/brain-learning/taxonomyEnrichment";

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
      source_item_id?: string;
      document_id?: string;
      chunk_id?: string;
      limit?: number;
      force_reclassify?: boolean;
      bootstrap_template_key?: string;
    };
    const { id } = await Promise.resolve(params);

    const summary = await runBrainTaxonomyEnrichment({
      brainId: id,
      sourceItemId: body.source_item_id || null,
      documentId: body.document_id || null,
      chunkId: body.chunk_id || null,
      limit: body.limit,
      forceReclassify: Boolean(body.force_reclassify),
      bootstrapTemplateKey: body.bootstrap_template_key || null,
    });

    return NextResponse.json(summary, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      {
        error: {
          code: "TAXONOMY_ENRICHMENT_FAILED",
          message: e?.message || "Taxonomy enrichment failed",
        },
      },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204 });
}

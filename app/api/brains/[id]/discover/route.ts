export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { runYoutubeWatchDiscovery } from "@/lib/brain-learning/youtubeWatchDiscovery";

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
      watch_id?: string;
      dry_run?: boolean;
    };
    const { id } = await Promise.resolve(params);
    const summary = await runYoutubeWatchDiscovery({
      brainId: id,
      watchId: body.watch_id || null,
      dryRun: Boolean(body.dry_run),
    });
    return NextResponse.json(summary, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      {
        error: {
          code: "DISCOVERY_FAILED",
          message: e?.message || "Discovery failed",
        },
      },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204 });
}

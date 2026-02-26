import { NextRequest, NextResponse } from "next/server";
import { probeBrains } from "../_utils/proxy";

export async function GET(req: NextRequest) {
  const timestamp = new Date().toISOString();
  const workerBaseUrlPresent = Boolean(process.env.BRAINS_API_BASE);

  try {
    const probe = await probeBrains(req, "/v1/health", { requireAuth: false });
    return NextResponse.json({
      ok: true,
      timestamp,
      worker_base_url_present: workerBaseUrlPresent,
      upstream_ok: probe.upstreamOk,
      upstream_error: probe.upstreamError,
      ...(probe.requestId ? { request_id: probe.requestId } : {}),
    });
  } catch {
    return NextResponse.json({
      ok: true,
      timestamp,
      worker_base_url_present: workerBaseUrlPresent,
      upstream_ok: false,
      upstream_error: "Health probe failed",
    });
  }
}

export async function OPTIONS(req: NextRequest) {
  // Let Next handle CORS; we just return 204.
  return new Response(null, { status: 204 });
}

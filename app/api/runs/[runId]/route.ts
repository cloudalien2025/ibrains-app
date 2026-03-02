export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { jsonError, proxyToBrains, unexpectedErrorResponse } from "../../_utils/proxy";

async function getRunId(
  params: { runId: string } | Promise<{ runId: string }> | undefined
): Promise<string | null> {
  const resolvedParams =
    params && typeof (params as Promise<{ runId: string }>).then === "function"
      ? await params
      : params;
  const runId = (resolvedParams as { runId?: string } | undefined)?.runId;
  if (!runId || typeof runId !== "string") return null;
  return runId;
}

export async function GET(
  req: NextRequest,
  { params }: { params: { runId: string } }
) {
  try {
    const runId = await getRunId(params);
    if (!runId) {
      return jsonError("BAD_REQUEST", "Missing run id param", 400);
    }
    return proxyToBrains(req, `/v1/runs/${runId}`, { requireAuth: true });
  } catch (e: any) {
    console.error("ROUTE_UNEXPECTED_ERROR", {
      route: "runs/[runId]",
      message: e?.message ?? String(e),
      name: e?.name,
      stack: e?.stack,
    });
    return unexpectedErrorResponse();
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204 });
}

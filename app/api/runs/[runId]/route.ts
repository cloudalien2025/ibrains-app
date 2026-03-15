export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { proxyToBrains, unexpectedErrorResponse } from "../../_utils/proxy";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ runId: string }> | { runId: string } }
) {
  try {
    const { runId } = await Promise.resolve(params);

    return proxyToBrains(req, `/v1/runs/${runId}`, { requireAuth: true });
  } catch {
    return unexpectedErrorResponse();
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204 });
}

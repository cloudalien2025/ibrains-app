export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { proxyToBrains, unexpectedErrorResponse } from "../../../_utils/proxy";

export async function GET(
  req: NextRequest,
  { params }: { params: { runId: string } }
) {
  try {
    const { runId } = params;
    return proxyToBrains(req, `/v1/runs/${runId}/diagnostics`, { requireAuth: true });
  } catch {
    return unexpectedErrorResponse();
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204 });
}

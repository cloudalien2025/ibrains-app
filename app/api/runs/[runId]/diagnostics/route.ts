import { NextRequest } from "next/server";
import { proxyToBrains } from "../../../_utils/proxy";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ runId: string }> }
) {
  const { runId } = await context.params;
  return proxyToBrains(req, `/v1/runs/${runId}/diagnostics`, { requireAuth: false });
}

export async function OPTIONS() {
  return new Response(null, { status: 204 });
}

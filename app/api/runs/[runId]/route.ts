import { NextRequest } from "next/server";
import { proxyToBrains } from "../../_utils/proxy";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ runId: string }> }
) {
  const { runId } = await context.params;

  // public-safe per backend spec
  return proxyToBrains(req, `/v1/runs/${runId}`, { requireAuth: false });
}

export async function OPTIONS() {
  return new Response(null, { status: 204 });
}

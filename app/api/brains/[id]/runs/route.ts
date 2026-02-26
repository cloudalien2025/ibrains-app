import { NextRequest } from "next/server";
import { proxyToBrains } from "../../../_utils/proxy";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  return proxyToBrains(req, `/v1/brains/${id}/runs`, { requireAuth: false });
}

export async function OPTIONS() {
  return new Response(null, { status: 204 });
}

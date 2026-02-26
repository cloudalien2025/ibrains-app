import { NextRequest } from "next/server";
import { proxyToBrains, unexpectedErrorResponse } from "../../../_utils/proxy";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    return proxyToBrains(req, `/v1/brains/${id}/runs`, { requireAuth: false });
  } catch {
    return unexpectedErrorResponse();
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204 });
}

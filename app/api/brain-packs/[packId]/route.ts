export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { proxyToBrains, unexpectedErrorResponse } from "../../_utils/proxy";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ packId: string }> | { packId: string } }
) {
  try {
    const { packId } = await Promise.resolve(params);
    return proxyToBrains(req, `/v1/brain-packs/${packId}`, { requireAuth: true });
  } catch {
    return unexpectedErrorResponse();
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204 });
}

export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { proxyToBrains, unexpectedErrorResponse } from "../../../_utils/proxy";
import { resolveBrainId } from "@/lib/brains/resolveBrainId";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const { id } = await Promise.resolve(params);
    const resolvedId = resolveBrainId(id);
    return proxyToBrains(req, `/v1/brains/${resolvedId}/stats`, { requireAuth: true });
  } catch {
    return unexpectedErrorResponse();
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204 });
}

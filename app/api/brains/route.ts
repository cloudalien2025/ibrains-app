import { NextRequest } from "next/server";
import { proxyToBrains, unexpectedErrorResponse } from "../_utils/proxy";

export async function GET(req: NextRequest) {
  try {
    // Public brain registry
    return proxyToBrains(req, "/v1/brains/public", { requireAuth: false });
  } catch {
    return unexpectedErrorResponse();
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204 });
}

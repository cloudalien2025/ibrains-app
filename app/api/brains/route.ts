export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { proxyToBrains, unexpectedErrorResponse } from "../_utils/proxy";

export async function GET(req: NextRequest) {
  try {
    // Public brain registry
    return proxyToBrains(req, "/v1/brains/public", { requireAuth: false });
  } catch (e: any) {
    console.error("ROUTE_UNEXPECTED_ERROR", {
      route: "brains",
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

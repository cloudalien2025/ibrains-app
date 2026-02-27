export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { proxyToBrains, unexpectedErrorResponse } from "../_utils/proxy";

export async function GET(req: NextRequest) {
  try {
    return proxyToBrains(req, "/v1/runs", { requireAuth: true });
  } catch (e: any) {
    console.error("ROUTE_UNEXPECTED_ERROR", {
      route: "runs",
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

export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { proxyToBrains, unexpectedErrorResponse } from "../_utils/proxy";

export async function GET(req: NextRequest) {
  try {
    return proxyToBrains(req, "/v1/brains", { requireAuth: true });
  } catch {
    return unexpectedErrorResponse();
  }
}

export async function POST(req: NextRequest) {
  try {
    return proxyToBrains(req, "/v1/brains", { requireAuth: true });
  } catch {
    return unexpectedErrorResponse();
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204 });
}

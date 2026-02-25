import { NextRequest } from "next/server";
import { proxyToBrains } from "../_utils/proxy";

export async function GET(req: NextRequest) {
  // Public brain registry
  return proxyToBrains(req, "/v1/brains/public", { requireAuth: false });
}

export async function OPTIONS() {
  return new Response(null, { status: 204 });
}
import { NextRequest } from "next/server";
import { proxyToBrains } from "../_utils/proxy";

export async function GET(req: NextRequest) {
  // public-safe
  return proxyToBrains(req, "/v1/health", { requireAuth: false });
}

export async function OPTIONS(req: NextRequest) {
  // Let Next handle CORS; we just return 204.
  return new Response(null, { status: 204 });
}
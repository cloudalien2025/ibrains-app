export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { proxyToBrains, unexpectedErrorResponse } from "../_utils/proxy";

function isMissingBrainsAuthEnv(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.message.includes(
    "Missing required env var: BRAINS_MASTER_KEY or BRAINS_X_API_KEY"
  );
}

export async function GET(req: NextRequest) {
  try {
    return await proxyToBrains(req, "/v1/brains", { requireAuth: true });
  } catch (error) {
    if (isMissingBrainsAuthEnv(error)) {
      try {
        return await proxyToBrains(req, "/v1/brains/public", { requireAuth: false });
      } catch {
        return unexpectedErrorResponse();
      }
    }
    return unexpectedErrorResponse();
  }
}

export async function POST(req: NextRequest) {
  try {
    return await proxyToBrains(req, "/v1/brains", { requireAuth: true });
  } catch {
    return unexpectedErrorResponse();
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204 });
}

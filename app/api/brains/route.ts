export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { proxyToBrains, unexpectedErrorResponse } from "../_utils/proxy";
import { requireSignedInUser } from "@/lib/auth/requireSignedInUser";

async function shouldFallbackToPublic(response: Response): Promise<boolean> {
  if (response.status !== 500) return false;

  const payload = (await response.clone().json().catch(() => null)) as
    | { error?: { message?: string } }
    | null;

  const message = payload?.error?.message ?? "";

  return (
    message.includes("Missing BRAINS_MASTER_KEY or BRAINS_X_API_KEY") ||
    message.includes("Missing required env var: BRAINS_MASTER_KEY or BRAINS_X_API_KEY")
  );
}

export async function GET(req: NextRequest) {
  try {
    const primary = await proxyToBrains(req, "/v1/brains", { requireAuth: true });

    if (await shouldFallbackToPublic(primary)) {
      return await proxyToBrains(req, "/v1/brains/public", { requireAuth: false });
    }

    return primary;
  } catch {
    return unexpectedErrorResponse();
  }
}

export async function POST(req: NextRequest) {
  try {
    const { unauthorizedResponse } = await requireSignedInUser();
    if (unauthorizedResponse) return unauthorizedResponse;

    return await proxyToBrains(req, "/v1/brains", { requireAuth: true });
  } catch {
    return unexpectedErrorResponse();
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204 });
}

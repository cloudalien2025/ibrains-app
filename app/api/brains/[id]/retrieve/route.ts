export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { proxyToBrains, unexpectedErrorResponse } from "../../../_utils/proxy";
import { requireSignedInUser } from "@/lib/auth/requireSignedInUser";
import { resolveBrainId } from "@/lib/brains/resolveBrainId";

function hasValidServiceApiKey(req: NextRequest) {
  const provided = req.headers.get("x-api-key")?.trim();
  if (!provided) return false;

  const candidates = [
    process.env.BRAINS_WORKER_API_KEY,
    process.env.BRAINS_MASTER_KEY,
    process.env.BRAINS_X_API_KEY,
  ]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));

  return candidates.some((candidate) => candidate === provided);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    if (!hasValidServiceApiKey(req)) {
      const { unauthorizedResponse } = await requireSignedInUser();
      if (unauthorizedResponse) return unauthorizedResponse;
    }

    const { id } = await Promise.resolve(params);
    const raw = id.trim().toLowerCase();
    const resolvedId =
      raw === "brilliant_directories" || raw === "brilliant-directories"
        ? "brilliant_directories"
        : resolveBrainId(id);
    return proxyToBrains(req, `/v1/brains/${resolvedId}/retrieve`, { requireAuth: true });
  } catch {
    return unexpectedErrorResponse();
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204 });
}

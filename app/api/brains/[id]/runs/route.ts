export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { proxyToBrains, unexpectedErrorResponse } from "../../../_utils/proxy";
import { requireSignedInUser } from "@/lib/auth/requireSignedInUser";

async function getId(params: Promise<{ id: string }> | { id: string }): Promise<string> {
  const resolved = await Promise.resolve(params);
  const { id } = resolved;
  if (!id || typeof id !== "string") throw new Error("Missing brain id param");
  return id;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    // Legacy compatibility shim. Canonical contract should use /api/runs*.
    return proxyToBrains(req, "/v1/runs", { requireAuth: true });
  } catch {
    return unexpectedErrorResponse();
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const { unauthorizedResponse } = await requireSignedInUser();
    if (unauthorizedResponse) return unauthorizedResponse;

    const id = await getId(params);
    // Legacy compatibility shim. Canonical contract should use /api/brains/{id}/ingest.
    return proxyToBrains(req, `/v1/brains/${id}/ingest`, { requireAuth: true });
  } catch {
    return unexpectedErrorResponse();
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204 });
}

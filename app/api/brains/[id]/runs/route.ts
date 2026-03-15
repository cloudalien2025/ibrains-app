export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { proxyToBrains, unexpectedErrorResponse } from "../../../_utils/proxy";

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
    const id = await getId(params);
    return proxyToBrains(req, `/v1/brains/${id}/runs`, { requireAuth: true });
  } catch {
    return unexpectedErrorResponse();
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const id = await getId(params);
    return proxyToBrains(req, `/v1/brains/${id}/runs`, { requireAuth: true });
  } catch {
    return unexpectedErrorResponse();
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204 });
}

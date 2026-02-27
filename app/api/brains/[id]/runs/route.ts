export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { proxyToBrains, unexpectedErrorResponse } from "../../../_utils/proxy";

function getId(params: { id: string }): string {
  const { id } = params;
  if (!id || typeof id !== "string") throw new Error("Missing brain id param");
  return id;
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = getId(params);
    return proxyToBrains(req, `/v1/brains/${id}/runs`, { requireAuth: true });
  } catch {
    return unexpectedErrorResponse();
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = getId(params);
    return proxyToBrains(req, `/v1/brains/${id}/runs`, { requireAuth: true });
  } catch {
    return unexpectedErrorResponse();
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204 });
}

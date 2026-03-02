export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { jsonError, proxyToBrains, unexpectedErrorResponse } from "../../../_utils/proxy";

async function getId(
  params: { id: string } | Promise<{ id: string }> | undefined
): Promise<string | null> {
  const resolvedParams =
    params && typeof (params as Promise<{ id: string }>).then === "function"
      ? await params
      : params;
  const id = (resolvedParams as { id?: string } | undefined)?.id;
  if (!id || typeof id !== "string") return null;
  return id;
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = await getId(params);
    if (!id) {
      return jsonError("BAD_REQUEST", "Missing brain id param", 400);
    }
    return proxyToBrains(req, `/v1/brains/${id}/runs`, { requireAuth: true });
  } catch (e: any) {
    console.error("ROUTE_UNEXPECTED_ERROR", {
      route: "brains/[id]/runs",
      message: e?.message ?? String(e),
      name: e?.name,
      stack: e?.stack,
    });
    return unexpectedErrorResponse();
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = await getId(params);
    if (!id) {
      return jsonError("BAD_REQUEST", "Missing brain id param", 400);
    }
    return proxyToBrains(req, `/v1/brains/${id}/runs`, { requireAuth: true });
  } catch (e: any) {
    console.error("ROUTE_UNEXPECTED_ERROR", {
      route: "brains/[id]/runs",
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

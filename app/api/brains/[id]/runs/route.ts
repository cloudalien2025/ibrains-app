import { NextRequest } from "next/server";
import { proxyToBrains, unexpectedErrorResponse } from "../../../_utils/proxy";

type RouteContext = { params: Promise<{ id: string }> };

async function getId(context: RouteContext): Promise<string> {
  const { id } = await context.params;
  if (!id || typeof id !== "string") throw new Error("Missing brain id param");
  return id;
}

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const id = await getId(context);
    return proxyToBrains(req, `/v1/brains/${id}/runs`, { requireAuth: true });
  } catch {
    return unexpectedErrorResponse();
  }
}

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const id = await getId(context);
    return proxyToBrains(req, `/v1/brains/${id}/runs`, { requireAuth: true });
  } catch {
    return unexpectedErrorResponse();
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204 });
}

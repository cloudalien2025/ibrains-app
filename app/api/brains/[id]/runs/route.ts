import { NextRequest } from "next/server";
import { proxyToBrains, unexpectedErrorResponse } from "../../../_utils/proxy";

type RouteContext = { params: { id: string } };

function getId(context: RouteContext): string {
  const { id } = context.params;
  if (!id || typeof id !== "string") throw new Error("Missing brain id param");
  return id;
}

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const id = getId(context);
    return proxyToBrains(req, `/v1/brains/${id}/runs`, { requireAuth: true });
  } catch {
    return unexpectedErrorResponse();
  }
}

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const id = getId(context);
    return proxyToBrains(req, `/v1/brains/${id}/runs`, { requireAuth: true });
  } catch {
    return unexpectedErrorResponse();
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204 });
}

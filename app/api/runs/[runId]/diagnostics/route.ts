import { NextRequest } from "next/server";
import { proxyToBrains } from "../../../_utils/proxy";

type Params = {
  params: {
    runId: string;
  };
};

export async function GET(req: NextRequest, { params }: Params) {
  const { runId } = params;

  // backend requires X-Api-Key + X-User-Id
  return proxyToBrains(req, `/v1/runs/${runId}/diagnostics`, { requireAuth: true });
}

export async function OPTIONS() {
  return new Response(null, { status: 204 });
}
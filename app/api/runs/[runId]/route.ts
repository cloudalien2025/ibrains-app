import { NextRequest } from "next/server";
import { proxyToBrains } from "../../_utils/proxy";

type Params = {
  params: {
    runId: string;
  };
};

export async function GET(req: NextRequest, { params }: Params) {
  const { runId } = params;

  // public-safe per backend spec
  return proxyToBrains(req, `/v1/runs/${runId}`, { requireAuth: false });
}

export async function OPTIONS() {
  return new Response(null, { status: 204 });
}
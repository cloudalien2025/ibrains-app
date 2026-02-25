import { NextRequest } from "next/server";
import { proxyToBrains } from "../../../_utils/proxy";

type Params = {
  params: {
    id: string;
  };
};

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = params;

  return proxyToBrains(req, `/v1/brains/${id}/runs`, {
    requireAuth: false,
  });
}

export async function OPTIONS() {
  return new Response(null, { status: 204 });
}
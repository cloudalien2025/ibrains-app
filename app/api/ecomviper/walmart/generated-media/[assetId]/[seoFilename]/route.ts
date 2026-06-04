export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { buildGeneratedMediaResponse } from "@/app/api/ecomviper/walmart/generated-media/_shared";

export async function GET(
  req: NextRequest,
  {
    params,
  }: {
    params:
      | Promise<{ assetId: string; seoFilename: string }>
      | { assetId: string; seoFilename: string };
  }
) {
  void req;
  const { assetId } = await Promise.resolve(params);
  return buildGeneratedMediaResponse(assetId);
}

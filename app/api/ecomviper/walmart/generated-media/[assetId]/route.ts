export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getGeneratedWalmartMediaByAssetId } from "@/lib/ecomviper/walmart/walmart-generated-media-store";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ assetId: string }> | { assetId: string } }
) {
  void req;
  const { assetId } = await Promise.resolve(params);
  const asset = await getGeneratedWalmartMediaByAssetId(assetId);

  if (!asset) {
    return NextResponse.json(
      {
        error: {
          code: "NOT_FOUND",
          message: "Generated media asset not found.",
        },
      },
      { status: 404 }
    );
  }

  return new NextResponse(Buffer.from(asset.imageBytes), {
    status: 200,
    headers: {
      "Content-Type": asset.mimeType || "image/png",
      "Cache-Control": "public, max-age=31536000, immutable",
      ETag: `${asset.assetId}-${asset.createdAt}`,
    },
  });
}

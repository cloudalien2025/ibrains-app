import { NextResponse } from "next/server";
import { getGeneratedWalmartMediaByAssetId } from "@/lib/ecomviper/walmart/walmart-generated-media-store";
import {
  extensionFromMimeType,
  sanitizeSeoFilename,
} from "@/lib/ecomviper/walmart/walmart-generated-media-seo";

function sanitizeHeaderFilename(value: string): string {
  return value.replace(/[\r\n"\\]/g, "").trim();
}

export async function buildGeneratedMediaResponse(assetId: string): Promise<NextResponse> {
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

  const fallbackFilename = `${asset.assetId}.${extensionFromMimeType(asset.mimeType || "image/png")}`;
  const seoFilename = sanitizeSeoFilename(
    asset.seoFilename || fallbackFilename,
    asset.mimeType || "image/png"
  );

  return new NextResponse(Buffer.from(asset.imageBytes), {
    status: 200,
    headers: {
      "Content-Type": asset.mimeType || "image/png",
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Disposition": `inline; filename=\"${sanitizeHeaderFilename(seoFilename)}\"`,
      ETag: `${asset.assetId}-${asset.createdAt}`,
    },
  });
}

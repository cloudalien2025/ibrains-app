import { NextResponse } from "next/server";
import type { DomaraListingUrlImportRequest } from "@/lib/studio/domara/types";
import { importListingFromUrl } from "@/lib/studio/domara/listing-url-importer";

export const runtime = "nodejs";

function badRequest(message: string, details?: string) {
  return NextResponse.json(
    {
      ok: false,
      error: {
        message,
        details,
      },
    },
    { status: 400 },
  );
}

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return badRequest("Invalid JSON payload.");
  }

  if (!payload || typeof payload !== "object") {
    return badRequest("Import payload object is required.");
  }

  const cast = payload as Partial<DomaraListingUrlImportRequest>;
  if (!cast.listingUrl?.trim()) {
    return badRequest("Listing URL is required.");
  }

  try {
    const result = await importListingFromUrl({
      listingUrl: cast.listingUrl,
      providerHint: cast.providerHint || "auto",
      countryHint: cast.countryHint,
      sourceLabel: cast.sourceLabel,
    });

    return NextResponse.json({
      ok: true,
      result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          message: "Failed to import listing URL.",
          details: error instanceof Error ? error.message : "Unknown listing import failure.",
        },
      },
      { status: 500 },
    );
  }
}

import { NextResponse } from "next/server";
import { fetchListing } from "@/lib/studio/domara/listing-provider";

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
    return badRequest("Fetch payload object is required.");
  }

  const cast = payload as {
    provider?: string;
    listingRef?: string;
    country?: string;
    fallbackToMock?: boolean;
  };

  if (!cast.provider || cast.provider === "manual") {
    return badRequest("A non-manual listing provider is required for fetch workflow.");
  }

  if (!cast.listingRef?.trim()) {
    return badRequest("Listing URL or listing ID is required.");
  }

  if (!["idealista", "immobiliare", "mock"].includes(cast.provider)) {
    return badRequest(`Unsupported listing provider: ${cast.provider}`);
  }

  try {
    const result = await fetchListing({
      provider: cast.provider as "idealista" | "immobiliare" | "mock",
      listingRef: cast.listingRef,
      country: cast.country,
      fallbackToMock: cast.fallbackToMock !== false,
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
          message: "Failed to fetch listing.",
          details: error instanceof Error ? error.message : "Unknown listing provider failure.",
        },
      },
      { status: 500 },
    );
  }
}

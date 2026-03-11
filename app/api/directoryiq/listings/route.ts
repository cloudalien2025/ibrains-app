export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { proxyDirectoryIqRead } from "@/app/api/directoryiq/_utils/externalReadProxy";

type ListingLike = Record<string, unknown> & {
  category?: unknown;
  group_category?: unknown;
  raw_json?: unknown;
};

function firstNonEmptyString(values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

function withCanonicalCategory(row: unknown): unknown {
  if (!row || typeof row !== "object" || Array.isArray(row)) return row;

  const listing = row as ListingLike;
  const raw = listing.raw_json && typeof listing.raw_json === "object" && !Array.isArray(listing.raw_json) ? listing.raw_json : null;
  const category = firstNonEmptyString([
    listing.category,
    listing.group_category,
    (raw as Record<string, unknown> | null)?.group_category,
    (raw as Record<string, unknown> | null)?.category,
  ]);

  return {
    ...listing,
    category,
  };
}

export async function GET(req: NextRequest) {
  const upstream = await proxyDirectoryIqRead(req, "/api/directoryiq/listings");
  const contentType = upstream.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) return upstream;

  try {
    const body = (await upstream.json()) as Record<string, unknown>;
    const listings = Array.isArray(body.listings) ? body.listings.map((row) => withCanonicalCategory(row)) : body.listings;
    const json = {
      ...body,
      listings,
    };
    return new NextResponse(JSON.stringify(json), {
      status: upstream.status,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  } catch {
    return upstream;
  }
}

import { NextResponse } from "next/server";
import { listSerpStatus } from "@/lib/directoryiq/storage/serpCacheStore";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const listingId = searchParams.get("listing_id");
  if (!listingId) return NextResponse.json({ error: "listing_id is required" }, { status: 400 });

  const items = (await listSerpStatus(listingId)).map((item) => ({
    slot_id: item.slot_id,
    status: item.status,
    cache_id: item.id,
    updated_at: item.updated_at,
    error_message: item.error_message,
    serp_query_used: item.serp_query_used,
    top_results: item.top_results,
    consensus_outline: item.consensus_outline,
  }));
  return NextResponse.json({ items });
}

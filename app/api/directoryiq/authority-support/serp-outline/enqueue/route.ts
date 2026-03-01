import { NextResponse } from "next/server";
import { enqueueSerpBuild } from "@/lib/directoryiq/serp/jobRunner";
import { upsertQueuedSerpCache } from "@/lib/directoryiq/storage/serpCacheStore";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    listing_id: string;
    slots: Array<{ slot_id: string; focus_keyword: string; location_modifier?: string | null }>;
  };

  const items = await Promise.all(
    body.slots.map(async (slot) => {
      const cache = await upsertQueuedSerpCache({
        listing_id: body.listing_id,
        slot_id: slot.slot_id,
        focus_keyword: slot.focus_keyword,
        location_modifier: slot.location_modifier ?? null,
      });
      if (cache.status !== "READY") {
        await enqueueSerpBuild(cache.id, {
          listing_id: body.listing_id,
          slot_id: slot.slot_id,
          focus_keyword: slot.focus_keyword,
          location_modifier: slot.location_modifier ?? null,
        });
      }
      return { slot_id: slot.slot_id, status: cache.status, cache_id: cache.id };
    }),
  );

  return NextResponse.json({ items });
}

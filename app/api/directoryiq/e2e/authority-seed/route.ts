export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { ensureUser, resolveUserId } from "@/app/api/ecomviper/_utils/user";
import { query } from "@/app/api/ecomviper/_utils/db";

type SeedBody = {
  listingId?: string;
  slot?: number;
  title?: string;
  focusTopic?: string;
};

function isSeedEnabled() {
  return process.env.E2E_TEST_MODE === "1" || process.env.NODE_ENV === "test";
}

function asSafeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(req: NextRequest) {
  if (!isSeedEnabled()) {
    return NextResponse.json(
      { error: { message: "Not found." } },
      { status: 404 }
    );
  }

  const userId = resolveUserId(req);
  await ensureUser(userId);

  const body = (await req.json().catch(() => ({}))) as SeedBody;
  const listingId = asSafeString(body.listingId);
  const slot = Number(body.slot ?? 0);
  const title = asSafeString(body.title);
  const focusTopic = asSafeString(body.focusTopic);

  if (!listingId || !Number.isInteger(slot) || slot < 1 || slot > 4) {
    return NextResponse.json(
      { error: { message: "listingId and slot(1-4) are required." } },
      { status: 400 }
    );
  }

  await query(
    `
    INSERT INTO directoryiq_authority_posts
      (user_id, listing_source_id, slot_index, post_type, focus_topic, title, status, draft_markdown, draft_html, blog_to_listing_link_status, metadata_json, updated_at)
    VALUES
      ($1, $2, $3, 'contextual_guide', $4, $5, 'not_created', null, null, 'missing', '{}'::jsonb, now())
    ON CONFLICT (user_id, listing_source_id, slot_index)
    DO UPDATE SET
      focus_topic = EXCLUDED.focus_topic,
      title = EXCLUDED.title,
      status = 'not_created',
      draft_markdown = null,
      draft_html = null,
      updated_at = now()
    `,
    [userId, listingId, slot, focusTopic, title]
  );

  return NextResponse.json({
    ok: true,
    listingId,
    slot,
    title,
    focusTopic,
  });
}

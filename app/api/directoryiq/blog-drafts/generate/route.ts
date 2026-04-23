import { NextResponse } from "next/server";
import { generateDirectoryIqDraft } from "@/lib/directoryiq/blog_writer/v2/writer";
import { saveDraft } from "@/lib/directoryiq/storage/draftStore";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    listing: {
      listing_id: string;
      slot_id: string;
      business_name: string;
      city?: string;
      state?: string;
      listing_url: string;
      service_summary?: string;
    };
    focus_keyword: string;
    serp_cache_id?: string | null;
  };

  const draft = await generateDirectoryIqDraft({
    listing: body.listing,
    focusKeyword: body.focus_keyword,
    serpCacheId: body.serp_cache_id ?? null,
  });

  const saved = await saveDraft({
    listing_id: body.listing.listing_id,
    slot_id: body.listing.slot_id,
    post_title: draft.post_title,
    focus_keyword: body.focus_keyword,
    slug: draft.slug,
    article_markdown: draft.article_markdown,
    seo_title: draft.seo_title,
    meta_description: draft.meta_description,
    serp_outline_used: draft.serp_outline_used,
    serp_cache_id: draft.serp_cache_id,
    title_alternates: draft.title_alternates,
  });

  return NextResponse.json(saved);
}

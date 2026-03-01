import { NextResponse } from "next/server";
import { getDraftById } from "@/lib/directoryiq/storage/draftStore";

export async function GET(_: Request, context: { params: Promise<{ draft_id: string }> }) {
  const { draft_id } = await context.params;
  const draft = await getDraftById(draft_id);
  if (!draft) return NextResponse.json({ error: "draft not found" }, { status: 404 });

  return NextResponse.json({
    draft_id: draft.draft_id,
    post_title: draft.post_title,
    article_markdown: draft.article_markdown,
    seo_title: draft.seo_title,
    meta_description: draft.meta_description,
    slug: draft.slug,
    serp_outline_used: draft.serp_outline_used,
    serp_cache_id: draft.serp_cache_id,
  });
}

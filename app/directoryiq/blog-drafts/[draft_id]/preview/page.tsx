import { notFound } from "next/navigation";

const loadDraft = async (draftId: string) => {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const response = await fetch(`${baseUrl}/api/directoryiq/blog-drafts/${draftId}/preview`, { cache: "no-store" });
  if (!response.ok) return null;
  return response.json();
};

export default async function DirectoryIqDraftPreviewPage({ params }: { params: Promise<{ draft_id: string }> }) {
  const { draft_id } = await params;
  const draft = await loadDraft(draft_id);
  if (!draft) notFound();

  return (
    <main style={{ padding: 24, fontFamily: "Arial" }}>
      <h1>{draft.post_title}</h1>
      <p><strong>SEO Title:</strong> {draft.seo_title}</p>
      <p><strong>Meta Description:</strong> {draft.meta_description}</p>
      <p><strong>Slug:</strong> {draft.slug}</p>
      <p><strong>SERP Outline Used:</strong> {draft.serp_outline_used ? "Yes" : "No"}</p>
      <article>
        <pre style={{ whiteSpace: "pre-wrap" }}>{draft.article_markdown}</pre>
      </article>
    </main>
  );
}

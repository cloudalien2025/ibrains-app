"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import HudCard from "@/components/ecomviper/HudCard";
import NeonButton from "@/components/ecomviper/NeonButton";
import AuthoritySectionNav from "@/app/directoryiq/authority/_components/authority-section-nav";

type BlogEntity = {
  entityText: string;
  entityType: "listing";
  evidenceSnippet: string | null;
};

type BlogSuggestion = {
  listingExternalId: string;
  listingTitle: string;
  listingUrl: string | null;
  recommendation: string;
};

type AuthorityBlog = {
  blogNodeId: string;
  blogExternalId: string;
  blogTitle: string | null;
  blogUrl: string | null;
  extractedEntitiesCount: number;
  linkedListingsCount: number;
  unlinkedMentionsCount: number;
  status: "green" | "yellow" | "red";
  entities: BlogEntity[];
  suggestedListingTargets: BlogSuggestion[];
  missingInternalLinksRecommendations: string[];
};

function statusClass(status: "green" | "yellow" | "red"): string {
  if (status === "green") return "border-emerald-300/35 bg-emerald-400/10 text-emerald-100";
  if (status === "yellow") return "border-amber-300/35 bg-amber-400/10 text-amber-100";
  return "border-rose-300/35 bg-rose-400/10 text-rose-100";
}

export default function AuthorityBlogsClient() {
  const searchParams = useSearchParams();
  const selectedFromQuery = searchParams.get("blog");

  const [rows, setRows] = useState<AuthorityBlog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AuthorityBlog | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    const response = await fetch("/api/directoryiq/authority/blogs", { cache: "no-store" });
    const json = (await response.json().catch(() => ({}))) as { blogs?: AuthorityBlog[]; error?: { message?: string } };
    if (!response.ok) {
      setError(json.error?.message ?? "Failed to load authority blogs.");
      setLoading(false);
      return;
    }

    const data = json.blogs ?? [];
    setRows(data);
    setLoading(false);

    if (selectedFromQuery) {
      const match = data.find((row) => row.blogExternalId === selectedFromQuery);
      if (match) setSelected(match);
    }
  }

  useEffect(() => {
    void load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const empty = useMemo(() => !loading && rows.length === 0, [loading, rows.length]);

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
        <h1 className="text-xl font-semibold text-slate-100">Blog Content Layer</h1>
        <p className="mt-1 text-sm text-slate-300">Blog posts with extracted entities and listing link coverage.</p>
      </section>

      <AuthoritySectionNav />

      {error ? <div className="rounded-xl border border-rose-300/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">{error}</div> : null}

      <HudCard title="Blog Posts" subtitle="Status is based on links_to and mentions coverage.">
        {loading ? <div className="text-sm text-slate-300">Loading blog layer...</div> : null}
        {empty ? <div className="text-sm text-slate-300">No blog nodes found yet. Run Blog Ingestion from Overview.</div> : null}

        {!loading && rows.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.08em] text-slate-400">
                <tr>
                  <th className="py-2 pr-3">Blog Title</th>
                  <th className="py-2 pr-3">URL</th>
                  <th className="py-2 pr-3">Extracted Entities</th>
                  <th className="py-2 pr-3">Linked Listings</th>
                  <th className="py-2 pr-3">Unlinked Mentions</th>
                  <th className="py-2 pr-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.blogNodeId} className="border-t border-white/10">
                    <td className="py-2 pr-3">
                      <button type="button" onClick={() => setSelected(row)} className="text-left text-cyan-100 underline-offset-2 hover:underline">
                        {row.blogTitle ?? row.blogExternalId}
                      </button>
                    </td>
                    <td className="py-2 pr-3 text-slate-300">{row.blogUrl ?? "-"}</td>
                    <td className="py-2 pr-3">{row.extractedEntitiesCount}</td>
                    <td className="py-2 pr-3">{row.linkedListingsCount}</td>
                    <td className="py-2 pr-3">{row.unlinkedMentionsCount}</td>
                    <td className="py-2 pr-3">
                      <span className={`rounded-full border px-2 py-0.5 text-xs ${statusClass(row.status)}`}>
                        {row.status.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </HudCard>

      {selected ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/65">
          <div className="h-full w-full max-w-[min(94vw,560px)] border-l border-white/10 bg-slate-950 p-5">
            <div className="mb-4 flex items-center justify-between gap-2">
              <h3 className="text-base font-semibold text-slate-100">{selected.blogTitle ?? selected.blogExternalId}</h3>
              <NeonButton variant="ghost" onClick={() => setSelected(null)}>Close</NeonButton>
            </div>

            <div className="space-y-4 text-sm text-slate-200">
              <div>
                <div className="text-xs uppercase tracking-[0.08em] text-slate-400">Entities ({selected.entities.length})</div>
                <div className="mt-2 space-y-2">
                  {selected.entities.length === 0 ? <div className="text-slate-400">No entities detected.</div> : null}
                  {selected.entities.map((entity, index) => (
                    <div key={`${entity.entityText}-${index}`} className="rounded-lg border border-white/10 bg-white/[0.03] p-2">
                      <div>{entity.entityText}</div>
                      <div className="mt-1 text-xs text-slate-400">{entity.evidenceSnippet ?? "No snippet"}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-xs uppercase tracking-[0.08em] text-slate-400">Suggested Listing Targets</div>
                <div className="mt-2 space-y-2">
                  {selected.suggestedListingTargets.length === 0 ? <div className="text-slate-400">No suggestions.</div> : null}
                  {selected.suggestedListingTargets.map((target) => (
                    <div key={`${target.listingExternalId}-${target.recommendation}`} className="rounded-lg border border-white/10 bg-white/[0.03] p-2">
                      <div>{target.listingTitle}</div>
                      <div className="mt-1 text-xs text-slate-400">{target.recommendation}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-xs uppercase tracking-[0.08em] text-slate-400">Missing Internal Links Recommendations</div>
                <div className="mt-2 space-y-2">
                  {selected.missingInternalLinksRecommendations.length === 0 ? <div className="text-slate-400">No missing link recommendations.</div> : null}
                  {selected.missingInternalLinksRecommendations.map((recommendation) => (
                    <div key={recommendation} className="rounded-lg border border-white/10 bg-white/[0.03] p-2">
                      {recommendation}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

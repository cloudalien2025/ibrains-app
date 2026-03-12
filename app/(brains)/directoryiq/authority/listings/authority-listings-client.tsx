"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import HudCard from "@/components/ecomviper/HudCard";
import NeonButton from "@/components/ecomviper/NeonButton";
import AuthoritySectionNav from "@/app/(brains)/directoryiq/authority/_components/authority-section-nav";

type ListingEvidence = {
  blogExternalId: string;
  blogTitle: string | null;
  blogUrl: string | null;
  edgeType: "links_to" | "mentions";
  evidenceSnippet: string | null;
  anchorText: string | null;
};

type AuthorityListing = {
  listingNodeId: string;
  listingExternalId: string;
  listingTitle: string | null;
  listingUrl: string | null;
  inboundBlogLinksCount: number;
  mentionedInCount: number;
  status: "green" | "yellow" | "red";
  inboundBlogs: ListingEvidence[];
  suggestedBlogsToLinkFrom: ListingEvidence[];
};

function statusClass(status: "green" | "yellow" | "red"): string {
  if (status === "green") return "border-emerald-300/35 bg-emerald-400/10 text-emerald-100";
  if (status === "yellow") return "border-amber-300/35 bg-amber-400/10 text-amber-100";
  return "border-rose-300/35 bg-rose-400/10 text-rose-100";
}

export default function AuthorityListingsClient() {
  const searchParams = useSearchParams();
  const selectedFromQuery = searchParams.get("listing");

  const [rows, setRows] = useState<AuthorityListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AuthorityListing | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    const response = await fetch("/api/directoryiq/authority/listings", { cache: "no-store" });
    const json = (await response.json().catch(() => ({}))) as {
      ok?: boolean;
      listings?: AuthorityListing[];
      error?: { message?: string };
    };
    if (!response.ok || json.ok === false) {
      setError(json.error?.message ?? "Failed to load authority listings.");
      setLoading(false);
      return;
    }

    const data = json.listings ?? [];
    setRows(data);
    setLoading(false);

    if (selectedFromQuery) {
      const match = data.find((row) => row.listingExternalId === selectedFromQuery);
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
        <h1 className="text-xl font-semibold text-slate-100">Listing Authority View</h1>
        <p className="mt-1 text-sm text-slate-300">Listing coverage from inbound blog links and mention evidence.</p>
      </section>

      <AuthoritySectionNav />

      {error ? <div className="rounded-xl border border-rose-300/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">{error}</div> : null}

      <HudCard title="Listings" subtitle="Inbound authority coverage by listing.">
        {loading ? <div className="text-sm text-slate-300">Loading listing authority...</div> : null}
        {empty ? <div className="text-sm text-slate-300">No listing authority rows yet. Run Blog Ingestion from Overview.</div> : null}

        {!loading && rows.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.08em] text-slate-400">
                <tr>
                  <th className="py-2 pr-3">Listing Name</th>
                  <th className="py-2 pr-3">Listing URL</th>
                  <th className="py-2 pr-3">Inbound Blog Links</th>
                  <th className="py-2 pr-3">Mentioned In</th>
                  <th className="py-2 pr-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.listingNodeId} className="border-t border-white/10">
                    <td className="py-2 pr-3">
                      <button type="button" onClick={() => setSelected(row)} className="text-left text-cyan-100 underline-offset-2 hover:underline">
                        {row.listingTitle ?? row.listingExternalId}
                      </button>
                    </td>
                    <td className="py-2 pr-3 text-slate-300">{row.listingUrl ?? "-"}</td>
                    <td className="py-2 pr-3">{row.inboundBlogLinksCount}</td>
                    <td className="py-2 pr-3">{row.mentionedInCount}</td>
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
              <h3 className="text-base font-semibold text-slate-100">{selected.listingTitle ?? selected.listingExternalId}</h3>
              <NeonButton variant="ghost" onClick={() => setSelected(null)}>Close</NeonButton>
            </div>

            <div className="space-y-4 text-sm text-slate-200">
              <div>
                <div className="text-xs uppercase tracking-[0.08em] text-slate-400">Inbound Blog Posts</div>
                <div className="mt-2 space-y-2">
                  {selected.inboundBlogs.length === 0 ? <div className="text-slate-400">No inbound blog references.</div> : null}
                  {selected.inboundBlogs.map((blog, index) => (
                    <div key={`${blog.blogExternalId}-${index}`} className="rounded-lg border border-white/10 bg-white/[0.03] p-2">
                      <div>{blog.blogTitle ?? blog.blogExternalId}</div>
                      <div className="mt-1 text-xs text-slate-400">{blog.blogUrl ?? "-"}</div>
                      <div className="mt-1 text-xs text-slate-400">{blog.edgeType === "links_to" ? "links_to" : "mentions"} · {blog.evidenceSnippet ?? "No snippet"}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-xs uppercase tracking-[0.08em] text-slate-400">Suggested Blog Posts To Link From</div>
                <div className="mt-2 space-y-2">
                  {selected.suggestedBlogsToLinkFrom.length === 0 ? <div className="text-slate-400">No mention-only blog posts.</div> : null}
                  {selected.suggestedBlogsToLinkFrom.map((blog, index) => (
                    <div key={`${blog.blogExternalId}-${index}-suggested`} className="rounded-lg border border-white/10 bg-white/[0.03] p-2">
                      <div>{blog.blogTitle ?? blog.blogExternalId}</div>
                      <div className="mt-1 text-xs text-slate-400">{blog.evidenceSnippet ?? "No snippet"}</div>
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

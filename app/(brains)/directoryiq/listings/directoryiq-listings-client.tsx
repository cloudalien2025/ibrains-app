"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import TopBar from "@/components/ecomviper/TopBar";
import HudCard from "@/components/ecomviper/HudCard";

type Listing = {
  listing_id: string;
  listing_name: string;
  url: string | null;
  score: number;
  pillars: {
    structure: number;
    clarity: number;
    trust: number;
    authority: number;
    actionability: number;
  };
  authority_status: string;
  trust_status: string;
  last_optimized: string | null;
};

function humanizeState(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function DirectoryIqListingsClient() {
  const [rows, setRows] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/directoryiq/listings", { cache: "no-store" });
        const json = (await response.json()) as { listings?: Listing[]; error?: string };
        if (!response.ok) throw new Error(json.error ?? "Failed to load listings");
        setRows(json.listings ?? []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unknown listings error");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <>
      <TopBar breadcrumbs={["Home", "DirectoryIQ", "Listings"]} searchPlaceholder="Search listings..." />

      <HudCard title="Listings" subtitle="AI Agent Selection scoring for each listing.">
        {loading ? <div className="text-sm text-slate-300">Scanning listings...</div> : null}
        {error ? <div className="text-sm text-rose-200">{error}</div> : null}

        {!loading && !error ? (
          rows.length === 0 ? (
            <div className="text-sm text-slate-300">No listings available yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-[0.08em] text-slate-400">
                  <tr>
                    <th className="py-2 pr-3">Listing</th>
                    <th className="py-2 pr-3">Score</th>
                    <th className="py-2 pr-3">Authority</th>
                    <th className="py-2 pr-3">Trust</th>
                    <th className="py-2 pr-3">Last optimized</th>
                    <th className="py-2 pr-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.listing_id} className="border-t border-white/10">
                      <td className="py-2 pr-3">
                        <div className="text-slate-100">{row.listing_name}</div>
                        {row.url ? <div className="text-xs text-slate-400">{row.url}</div> : null}
                      </td>
                      <td className="py-2 pr-3 text-slate-100">{row.score}</td>
                      <td className="py-2 pr-3">{humanizeState(row.authority_status)}</td>
                      <td className="py-2 pr-3">{humanizeState(row.trust_status)}</td>
                      <td className="py-2 pr-3">{row.last_optimized ? new Date(row.last_optimized).toLocaleString() : "-"}</td>
                      <td className="py-2 pr-3">
                        <Link
                          href={`/directoryiq/listings/${encodeURIComponent(row.listing_id)}`}
                          className="rounded-lg border border-cyan-300/30 bg-cyan-400/10 px-3 py-1.5 text-xs text-cyan-100"
                        >
                          Optimize
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : null}
      </HudCard>
    </>
  );
}

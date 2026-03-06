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
  site_id?: string | null;
  site_label?: string | null;
};

type BdSite = {
  id: string;
  label: string | null;
  baseUrl: string;
  enabled: boolean;
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
  const [sites, setSites] = useState<BdSite[]>([]);
  const [selectedSite, setSelectedSite] = useState<string>("auto");
  const [isAdmin, setIsAdmin] = useState(false);

  async function loadSites() {
    try {
      const response = await fetch("/api/directoryiq/sites", { cache: "no-store" });
      const json = (await response.json()) as {
        sites?: BdSite[];
        is_admin?: boolean;
      };
      if (response.ok) {
        setSites(json.sites ?? []);
        setIsAdmin(Boolean(json.is_admin));
      }
    } catch {
      setSites([]);
    }
  }

  async function loadListings(site: string) {
    setLoading(true);
    setError(null);
    try {
      const search = new URLSearchParams();
      if (site === "all") {
        search.set("site", "all");
      } else if (site && site !== "auto") {
        search.set("site_id", site);
      }
      const url = `/api/directoryiq/listings${search.toString() ? `?${search.toString()}` : ""}`;
      const response = await fetch(url, { cache: "no-store" });
      const json = (await response.json()) as { listings?: Listing[]; error?: string };
      if (!response.ok) throw new Error(json.error ?? "Failed to load listings");
      setRows(json.listings ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown listings error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSites();
  }, []);

  useEffect(() => {
    void loadListings(selectedSite);
  }, [selectedSite]);

  return (
    <>
      <TopBar breadcrumbs={["Home", "DirectoryIQ", "Listings"]} searchPlaceholder="Search listings..." />

      <HudCard title="Listings" subtitle="AI Agent Selection scoring for each listing.">
        <div className="mb-4 flex flex-wrap items-center gap-3 text-xs text-slate-300">
          <label className="flex items-center gap-2">
            <span>Site</span>
            <select
              value={selectedSite}
              onChange={(event) => setSelectedSite(event.target.value)}
              className="rounded-lg border border-white/10 bg-slate-900/70 px-2 py-1 text-xs text-slate-200"
            >
              <option value="auto">Default</option>
              {isAdmin ? <option value="all">All Sites</option> : null}
              {sites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.label || site.baseUrl}
                </option>
              ))}
            </select>
          </label>
        </div>

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
                    <th className="py-2 pr-3">Site</th>
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
                      <td className="py-2 pr-3 text-xs text-slate-300">{row.site_label ?? "-"}</td>
                      <td className="py-2 pr-3 text-slate-100">{row.score}</td>
                      <td className="py-2 pr-3">{humanizeState(row.authority_status)}</td>
                      <td className="py-2 pr-3">{humanizeState(row.trust_status)}</td>
                      <td className="py-2 pr-3">{row.last_optimized ? new Date(row.last_optimized).toLocaleString() : "-"}</td>
                      <td className="py-2 pr-3">
                        <Link
                          href={`/directoryiq/listings/${encodeURIComponent(row.listing_id)}${row.site_id ? `?site_id=${row.site_id}` : ""}`}
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

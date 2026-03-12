"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import NeonButton from "@/components/ecomviper/NeonButton";
import type { DirectoryIqConnector, DirectoryIqCredentialStatus } from "@/lib/directoryiq/signalSourceCredentials";
import {
  normalizeBdSiteTestVerification,
  type BdSiteVerificationSnapshot,
} from "@/src/lib/directoryiq/siteTestVerification";

const API_BASE = (process.env.NEXT_PUBLIC_DIRECTORYIQ_API_BASE ?? "").trim().replace(/\/+$/, "");
const API_BASE_READY = /^https?:\/\//i.test(API_BASE);

const connectorMeta: Record<DirectoryIqConnector, { name: string; placeholder: string }> = {
  brilliant_directories_api: {
    name: "Brilliant Directories API",
    placeholder: "Paste Brilliant Directories API key",
  },
  openai: {
    name: "OpenAI API (BYO)",
    placeholder: "Paste OpenAI API key",
  },
  serpapi: {
    name: "SerpAPI",
    placeholder: "Paste SerpAPI key",
  },
  ga4: {
    name: "GA4",
    placeholder: "Paste GA4 credential or property token",
  },
};

const idAlias: Record<string, DirectoryIqConnector> = {
  "brilliant-directories": "brilliant_directories_api",
  brilliant_directories_api: "brilliant_directories_api",
  openai: "openai",
  serpapi: "serpapi",
  ga4: "ga4",
};

type IngestRun = {
  id: string;
  status: string;
  source_base_url: string | null;
  started_at: string;
  finished_at: string | null;
  listings_count: number;
  blog_posts_count: number;
  error_message: string | null;
};

type BdSite = {
  id: string;
  label: string | null;
  baseUrl: string;
  enabled: boolean;
  listingsDataId: number | null;
  blogPostsDataId: number | null;
  listingsPath: string;
  blogPostsPath: string | null;
  maskedSecret: string;
  secretPresent: boolean;
};

type BdSiteVerificationState = {
  testedAt: string;
  verification: BdSiteVerificationSnapshot;
};

export default function DirectoryIqSignalSourcesClient() {
  const searchParams = useSearchParams();
  const selectedConnector = idAlias[(searchParams.get("connector") ?? "").toLowerCase()] ?? null;
  const [configError, setConfigError] = useState<string | null>(null);

  const apiBaseOrigin = useMemo(() => {
    if (!API_BASE_READY) return null;
    try {
      return new URL(API_BASE).origin;
    } catch {
      return null;
    }
  }, []);

  const apiConfigError = useMemo(() => {
    if (!apiBaseOrigin) {
      return "Signal Sources requires a valid external DirectoryIQ API origin. Configure NEXT_PUBLIC_DIRECTORYIQ_API_BASE to a non-Vercel origin.";
    }
    if (typeof window !== "undefined" && apiBaseOrigin === window.location.origin) {
      return "Signal Sources requires a valid external DirectoryIQ API origin. Configure NEXT_PUBLIC_DIRECTORYIQ_API_BASE to a non-Vercel origin.";
    }
    return null;
  }, [apiBaseOrigin]);

  const apiUrl = (path: string) => {
    if (apiConfigError) {
      throw new Error(apiConfigError);
    }
    return new URL(path, API_BASE).toString();
  };

  const [states, setStates] = useState<Record<DirectoryIqConnector, DirectoryIqCredentialStatus>>({
    brilliant_directories_api: {
      connector_id: "brilliant_directories_api",
      connected: false,
      label: null,
      masked_secret: "",
      updated_at: null,
      config: null,
    },
    openai: { connector_id: "openai", connected: false, label: null, masked_secret: "", updated_at: null, config: null },
    serpapi: { connector_id: "serpapi", connected: false, label: null, masked_secret: "", updated_at: null, config: null },
    ga4: { connector_id: "ga4", connected: false, label: null, masked_secret: "", updated_at: null, config: null },
  });

  const [values, setValues] = useState<Record<DirectoryIqConnector, string>>({
    brilliant_directories_api: "",
    openai: "",
    serpapi: "",
    ga4: "",
  });

  const [labels, setLabels] = useState<Record<DirectoryIqConnector, string>>({
    brilliant_directories_api: "",
    openai: "",
    serpapi: "",
    ga4: "",
  });

  const [saving, setSaving] = useState<DirectoryIqConnector | null>(null);
  const [runningIngest, setRunningIngest] = useState(false);
  const [runs, setRuns] = useState<IngestRun[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [bdSites, setBdSites] = useState<BdSite[]>([]);
  const [bdIsAdmin, setBdIsAdmin] = useState(false);
  const [bdSiteLimit, setBdSiteLimit] = useState(1);
  const [bdSiteError, setBdSiteError] = useState<string | null>(null);
  const [bdSiteNotice, setBdSiteNotice] = useState<string | null>(null);
  const [bdEditingId, setBdEditingId] = useState<string | null>(null);
  const [bdSaving, setBdSaving] = useState(false);
  const [bdTesting, setBdTesting] = useState<string | null>(null);
  const [bdSiteVerificationById, setBdSiteVerificationById] = useState<Record<string, BdSiteVerificationState>>({});
  const [bdForm, setBdForm] = useState({
    label: "",
    baseUrl: "",
    apiKey: "",
    listingsDataId: "",
    blogPostsDataId: "",
    listingsPath: "/api/v2/users_portfolio_groups/search",
    blogPostsPath: "",
    enabled: true,
  });

  const orderedConnectors = useMemo(
    () => ["openai", "serpapi", "ga4"] as DirectoryIqConnector[],
    []
  );
  const selectedSiteId = bdEditingId ?? bdSites[0]?.id ?? null;
  const selectedSite = selectedSiteId ? bdSites.find((site) => site.id === selectedSiteId) ?? null : null;
  const editingSite = bdEditingId ? bdSites.find((site) => site.id === bdEditingId) ?? null : null;
  const selectedSiteMissingSecret = Boolean(selectedSite && !selectedSite.secretPresent);

  async function load() {
    setError(null);
    try {
      const response = await fetch(apiUrl("/api/directoryiq/signal-sources"), { cache: "no-store" });
      const json = (await response.json()) as {
        connectors?: DirectoryIqCredentialStatus[];
        error?: string;
      };

      if (!response.ok) throw new Error(json.error ?? "Failed to load credentials");

      const next = { ...states };
      for (const connector of json.connectors ?? []) {
        next[connector.connector_id] = connector;
      }
      setStates(next);

      setLabels((prev) => {
        const updated = { ...prev };
        for (const connector of json.connectors ?? []) {
          if (connector.label) updated[connector.connector_id] = connector.label;
        }
        return updated;
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unknown load error";
      setError(message);
    }
  }

  async function loadSites() {
    setBdSiteError(null);
    try {
      const response = await fetch(apiUrl("/api/directoryiq/sites"), { cache: "no-store" });
      const json = (await response.json()) as {
        sites?: BdSite[];
        is_admin?: boolean;
        limit?: number;
        error?: string;
      };
      if (!response.ok) throw new Error(json.error ?? "Failed to load BD sites");
      setBdSites(json.sites ?? []);
      setBdIsAdmin(Boolean(json.is_admin));
      setBdSiteLimit(Number(json.limit ?? 1));
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unknown BD sites error";
      setBdSiteError(message);
    }
  }

  async function loadRuns() {
    try {
      const response = await fetch(apiUrl("/api/directoryiq/ingest/runs"), { cache: "no-store" });
      const json = (await response.json()) as { runs?: IngestRun[]; error?: string };
      if (!response.ok) throw new Error(json.error ?? "Failed to load ingest runs");
      setRuns(json.runs ?? []);
    } catch {
      setRuns([]);
    }
  }

  useEffect(() => {
    if (apiConfigError) {
      setConfigError(apiConfigError);
      return;
    }
    setConfigError(null);
    void load();
    void loadRuns();
    void loadSites();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiConfigError]);

  async function save(connectorId: DirectoryIqConnector) {
    const secret = values[connectorId].trim();
    if (!secret) {
      setError(`Enter a value for ${connectorMeta[connectorId].name}.`);
      return;
    }

    setSaving(connectorId);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch(apiUrl("/api/directoryiq/signal-sources"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connector_id: connectorId,
          secret,
          label: labels[connectorId] || null,
          config: null,
        }),
      });
      const json = (await response.json()) as {
        error?: string;
        preflight?: { ok?: boolean };
        search?: { ok?: boolean };
      };
      if (!response.ok) throw new Error(json.error ?? "Failed to save credential");

      setValues((prev) => ({ ...prev, [connectorId]: "" }));
      await load();
      setNotice(`${connectorMeta[connectorId].name} credential saved.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown save error");
    } finally {
      setSaving(null);
    }
  }

  async function runIngest() {
    setRunningIngest(true);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch(apiUrl("/api/ingest/directoryiq/run"), { method: "POST" });
      const json = (await response.json()) as {
        run_id?: string;
        status?: string;
        counts?: { listings: number; blogPosts: number };
        error?: string;
        error_message?: string | null;
      };

      if (!response.ok) throw new Error(json.error ?? json.error_message ?? "DirectoryIQ ingest failed");

      if (json.status === "failed") {
        throw new Error(json.error_message ?? "DirectoryIQ ingest failed");
      }

      setNotice(
        `Ingest completed. Listings: ${json.counts?.listings ?? 0}, Blog posts: ${json.counts?.blogPosts ?? 0}.`
      );
      await loadRuns();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown ingest error");
      await loadRuns();
    } finally {
      setRunningIngest(false);
    }
  }

  async function runBdIngest(input?: { siteId?: string | null; allSites?: boolean }) {
    setRunningIngest(true);
    setBdSiteNotice(null);
    setBdSiteError(null);
    try {
      const search = new URLSearchParams();
      if (input?.allSites) search.set("site", "all");
      if (input?.siteId) search.set("site_id", input.siteId);
      const url = apiUrl(`/api/ingest/directoryiq/run${search.toString() ? `?${search.toString()}` : ""}`);
      const response = await fetch(url, { method: "POST" });
      const json = (await response.json()) as {
        status?: string;
        counts?: { listings: number; blogPosts: number };
        error?: string;
        error_message?: string | null;
      };
      if (!response.ok) throw new Error(json.error ?? json.error_message ?? "DirectoryIQ ingest failed");
      if (json.status === "failed") {
        throw new Error(json.error_message ?? "DirectoryIQ ingest failed");
      }
      setBdSiteNotice(
        `Ingest completed. Listings: ${json.counts?.listings ?? 0}, Blog posts: ${json.counts?.blogPosts ?? 0}.`
      );
      await loadRuns();
    } catch (e) {
      setBdSiteError(e instanceof Error ? e.message : "Unknown ingest error");
    } finally {
      setRunningIngest(false);
    }
  }

  function resetBdForm() {
    setBdForm({
      label: "",
      baseUrl: "",
      apiKey: "",
      listingsDataId: "",
      blogPostsDataId: "",
      listingsPath: "/api/v2/users_portfolio_groups/search",
      blogPostsPath: "",
      enabled: true,
    });
    setBdEditingId(null);
  }

  function startEditSite(site: BdSite) {
    setBdForm({
      label: site.label ?? "",
      baseUrl: site.baseUrl ?? "",
      apiKey: "",
      listingsDataId: site.listingsDataId ? String(site.listingsDataId) : "",
      blogPostsDataId: site.blogPostsDataId ? String(site.blogPostsDataId) : "",
      listingsPath: site.listingsPath ?? "/api/v2/users_portfolio_groups/search",
      blogPostsPath: site.blogPostsPath ?? "",
      enabled: site.enabled,
    });
    setBdEditingId(site.id);
    setBdSiteNotice(null);
    setBdSiteError(null);
  }

  async function saveSite() {
    setBdSaving(true);
    setBdSiteError(null);
    setBdSiteNotice(null);
    try {
      const payload = {
        label: bdForm.label.trim() || null,
        base_url: bdForm.baseUrl.trim(),
        api_key: bdForm.apiKey.trim() || undefined,
        listings_data_id: bdForm.listingsDataId.trim(),
        blog_posts_data_id: bdForm.blogPostsDataId.trim() || null,
        listings_path: bdForm.listingsPath.trim() || "/api/v2/users_portfolio_groups/search",
        blog_posts_path: bdForm.blogPostsPath.trim() || null,
        enabled: bdForm.enabled,
      };
      const url = apiUrl(bdEditingId ? `/api/directoryiq/sites/${bdEditingId}` : "/api/directoryiq/sites");
      const method = bdEditingId ? "PUT" : "POST";
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(json.error ?? "Failed to save BD site");
      await loadSites();
      resetBdForm();
      setBdSiteNotice("BD site saved.");
    } catch (e) {
      setBdSiteError(e instanceof Error ? e.message : "Unknown BD site save error");
    } finally {
      setBdSaving(false);
    }
  }

  async function deleteSite(siteId: string) {
    setBdSaving(true);
    setBdSiteError(null);
    setBdSiteNotice(null);
    try {
      const response = await fetch(apiUrl(`/api/directoryiq/sites/${siteId}`), { method: "DELETE" });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(json.error ?? "Failed to delete BD site");
      await loadSites();
      if (bdEditingId === siteId) resetBdForm();
      setBdSiteNotice("BD site deleted.");
    } catch (e) {
      setBdSiteError(e instanceof Error ? e.message : "Unknown BD site delete error");
    } finally {
      setBdSaving(false);
    }
  }

  async function testSite(siteId: string) {
    setBdTesting(siteId);
    setBdSiteError(null);
    setBdSiteNotice(null);
    try {
      const response = await fetch(apiUrl(`/api/directoryiq/sites/${siteId}/test`), { method: "POST" });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(json.error ?? "Test failed");
      const verification = normalizeBdSiteTestVerification(json);
      const testedAt = new Date().toISOString();
      setBdSiteVerificationById((prev) => ({ ...prev, [siteId]: { testedAt, verification } }));
      setBdSiteNotice(
        `Tested ${siteId}: ${verification.overall === "verified" ? "verified" : "unresolved"}`
      );
    } catch (e) {
      setBdSiteError(e instanceof Error ? e.message : "Unknown test error");
    } finally {
      setBdTesting(null);
    }
  }

  async function remove(connectorId: DirectoryIqConnector) {
    setSaving(connectorId);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch(apiUrl(`/api/directoryiq/signal-sources?connector_id=${connectorId}`), {
        method: "DELETE",
      });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(json.error ?? "Failed to remove credential");

      await load();
      setNotice(`${connectorMeta[connectorId].name} credential removed.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown delete error");
    } finally {
      setSaving(null);
    }
  }

  return (
    <div id="credentials" className="space-y-4">
      {notice ? (
        <div className="rounded-xl border border-emerald-300/35 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
          {notice}
        </div>
      ) : null}
      {configError ? (
        <div className="rounded-xl border border-amber-300/40 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
          {configError}
        </div>
      ) : null}
      {bdSiteNotice ? (
        <div className="rounded-xl border border-emerald-300/35 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
          {bdSiteNotice}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-xl border border-rose-300/35 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
          {error}
        </div>
      ) : null}
      {bdSiteError ? (
        <div className="rounded-xl border border-rose-300/35 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
          {bdSiteError}
        </div>
      ) : null}

      <article className="rounded-xl border border-cyan-300/25 bg-cyan-400/8 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-white">Brilliant Directories Sites</h3>
            <p className="text-xs text-slate-300">
              Add each BD site with its own Post Type IDs. Multi-site listings can be ingested per site or across all sites.
            </p>
            {selectedSite ? (
              <div className="mt-2 text-xs text-slate-400">
                Selected: {selectedSite.label || selectedSite.baseUrl} ·{" "}
                {selectedSite.secretPresent ? `API key ${selectedSite.maskedSecret}` : "API key missing"}
              </div>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <NeonButton
              onClick={() => void runBdIngest({ siteId: selectedSiteId })}
              disabled={runningIngest || bdSites.length === 0 || selectedSiteMissingSecret}
            >
              {runningIngest ? "Ingesting..." : selectedSiteMissingSecret ? "Add API key to ingest" : "Ingest Site"}
            </NeonButton>
            {bdIsAdmin ? (
              <NeonButton variant="secondary" onClick={() => void runBdIngest({ allSites: true })} disabled={runningIngest || bdSites.length === 0}>
                Ingest All Sites
              </NeonButton>
            ) : null}
            {selectedSite && selectedSiteMissingSecret ? (
              <NeonButton variant="secondary" onClick={() => startEditSite(selectedSite)} disabled={bdSaving}>
                Add API key
              </NeonButton>
            ) : null}
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-[1.2fr_1fr_1fr]">
          <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <div className="text-xs uppercase tracking-[0.08em] text-slate-400">
              {bdEditingId ? "Edit Site" : "Add Site"} {bdIsAdmin ? "" : `(Limit ${bdSiteLimit})`}
            </div>
            {editingSite && !editingSite.secretPresent ? (
              <div className="rounded-lg border border-rose-300/35 bg-rose-400/10 px-3 py-2 text-xs text-rose-100">
                API key missing for this site. Add the key below to enable ingest.
              </div>
            ) : null}
            <input
              value={bdForm.label}
              onChange={(event) => setBdForm((prev) => ({ ...prev, label: event.target.value }))}
              placeholder="Label (e.g. VailVacay)"
              className="w-full rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2 text-sm text-slate-100 outline-none ring-cyan-300/40 focus:border-cyan-300/40 focus:ring-2"
            />
            <input
              value={bdForm.baseUrl}
              onChange={(event) => setBdForm((prev) => ({ ...prev, baseUrl: event.target.value }))}
              placeholder="Base URL (https://vailvacay.com)"
              className="w-full rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2 text-sm text-slate-100 outline-none ring-cyan-300/40 focus:border-cyan-300/40 focus:ring-2"
            />
            <input
              value={bdForm.apiKey}
              onChange={(event) => setBdForm((prev) => ({ ...prev, apiKey: event.target.value }))}
              placeholder={bdEditingId ? "API key (leave blank to keep)" : "API key"}
              className="w-full rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2 text-sm text-slate-100 outline-none ring-cyan-300/40 focus:border-cyan-300/40 focus:ring-2"
            />
            <div className="grid gap-2 md:grid-cols-2">
              <input
                value={bdForm.listingsDataId}
                onChange={(event) => setBdForm((prev) => ({ ...prev, listingsDataId: event.target.value }))}
                placeholder="Listings Post Type ID"
                className="w-full rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2 text-sm text-slate-100 outline-none ring-cyan-300/40 focus:border-cyan-300/40 focus:ring-2"
              />
              <input
                value={bdForm.blogPostsDataId}
                onChange={(event) => setBdForm((prev) => ({ ...prev, blogPostsDataId: event.target.value }))}
                placeholder="Blog Posts Post Type ID"
                className="w-full rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2 text-sm text-slate-100 outline-none ring-cyan-300/40 focus:border-cyan-300/40 focus:ring-2"
              />
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <input
                value={bdForm.listingsPath}
                onChange={(event) => setBdForm((prev) => ({ ...prev, listingsPath: event.target.value }))}
                placeholder="Listings path"
                className="w-full rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2 text-sm text-slate-100 outline-none ring-cyan-300/40 focus:border-cyan-300/40 focus:ring-2"
              />
              <input
                value={bdForm.blogPostsPath}
                onChange={(event) => setBdForm((prev) => ({ ...prev, blogPostsPath: event.target.value }))}
                placeholder="Blog posts path (optional)"
                className="w-full rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2 text-sm text-slate-100 outline-none ring-cyan-300/40 focus:border-cyan-300/40 focus:ring-2"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-200">
              <input
                type="checkbox"
                checked={bdForm.enabled}
                onChange={(event) => setBdForm((prev) => ({ ...prev, enabled: event.target.checked }))}
              />
              Enabled
            </label>
            <div className="flex flex-wrap gap-2">
              <NeonButton onClick={() => void saveSite()} disabled={bdSaving}>
                {bdSaving ? "Saving..." : bdEditingId ? "Update Site" : "Add Site"}
              </NeonButton>
              {bdEditingId ? (
                <NeonButton variant="secondary" onClick={() => resetBdForm()} disabled={bdSaving}>
                  Cancel
                </NeonButton>
              ) : null}
            </div>
          </div>

          <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-3 md:col-span-2">
            <div className="text-xs uppercase tracking-[0.08em] text-slate-400">Configured Sites</div>
            {bdSites.length === 0 ? (
              <div className="text-xs text-slate-400">No BD sites connected yet.</div>
            ) : (
              bdSites.map((site) => {
                const testState = bdSiteVerificationById[site.id];
                const verification = testState?.verification ?? null;
                const testedAtText = testState ? new Date(testState.testedAt).toLocaleTimeString() : null;
                const statusClass = verification?.overall === "verified" ? "text-emerald-200" : "text-amber-200";
                const listingsCountText =
                  verification?.listingsCount != null ? ` (${verification.listingsCount})` : "";
                const blogCountText =
                  verification?.blogPostsCount != null ? ` (${verification.blogPostsCount})` : "";

                return (
                  <div key={site.id} className="rounded-lg border border-white/10 bg-white/[0.02] p-3 text-xs text-slate-300">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="text-sm text-slate-100">{site.label || site.baseUrl}</div>
                        <div className="text-xs text-slate-400">{site.baseUrl}</div>
                        <div className={`text-xs ${site.secretPresent ? "text-slate-500" : "text-rose-200"}`}>
                          API key: {site.secretPresent ? site.maskedSecret : "missing"}
                        </div>
                        <div className="text-xs text-slate-500">
                          Listings ID: {site.listingsDataId ?? "-"} · Blog ID: {site.blogPostsDataId ?? "-"} · {site.enabled ? "Enabled" : "Disabled"}
                        </div>
                        {verification ? (
                          <div className={`mt-1 text-xs ${statusClass}`}>
                            Verification: {verification.overall === "verified" ? "Verified" : "Unresolved"} · Listings{" "}
                            {verification.listings}
                            {listingsCountText} · Blog {verification.blogPosts}
                            {blogCountText}
                            {testedAtText ? ` · Tested ${testedAtText}` : ""}
                          </div>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <NeonButton variant="secondary" onClick={() => startEditSite(site)}>
                          Edit
                        </NeonButton>
                        <NeonButton variant="secondary" onClick={() => void testSite(site.id)} disabled={bdTesting === site.id}>
                          {bdTesting === site.id ? "Testing..." : "Test"}
                        </NeonButton>
                        <NeonButton variant="secondary" onClick={() => void deleteSite(site.id)} disabled={bdSaving}>
                          Delete
                        </NeonButton>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </article>

      {orderedConnectors.map((connectorId) => {
        const state = states[connectorId];
        const isActive = selectedConnector === connectorId;

        return (
          <article
            key={connectorId}
            className={`rounded-xl border p-4 ${
              isActive
                ? "border-cyan-300/45 bg-cyan-400/10"
                : "border-white/10 bg-white/[0.03]"
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-white">{connectorMeta[connectorId].name}</h3>
                <p className="text-xs text-slate-400">
                  {state.connected
                    ? `Credential saved (${state.masked_secret})${state.updated_at ? ` · Saved ${new Date(state.updated_at).toLocaleString()}` : ""}`
                    : "Credential not configured"}
                </p>
                {state.label ? <p className="text-xs text-slate-500">Label: {state.label}</p> : null}
              </div>
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto]">
              <input
                value={values[connectorId]}
                onChange={(event) =>
                  setValues((prev) => ({ ...prev, [connectorId]: event.target.value }))
                }
                placeholder={connectorMeta[connectorId].placeholder}
                className="rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2 text-sm text-slate-100 outline-none ring-cyan-300/40 focus:border-cyan-300/40 focus:ring-2"
              />
              <input
                value={labels[connectorId]}
                onChange={(event) =>
                  setLabels((prev) => ({ ...prev, [connectorId]: event.target.value }))
                }
                placeholder="Optional label"
                className="rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2 text-sm text-slate-100 outline-none ring-cyan-300/40 focus:border-cyan-300/40 focus:ring-2"
              />
              <NeonButton onClick={() => save(connectorId)} disabled={saving === connectorId}>
                {saving === connectorId ? "Saving..." : "Save"}
              </NeonButton>
              <NeonButton
                variant="secondary"
                onClick={() => remove(connectorId)}
                disabled={saving === connectorId || !state.connected}
              >
                Delete
              </NeonButton>
            </div>
          </article>
        );
      })}

      <article className="rounded-xl border border-cyan-300/25 bg-cyan-400/8 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-white">Ingest History</h3>
            <p className="text-xs text-slate-300">
              Recent ingest runs across DirectoryIQ sites.
            </p>
          </div>
          <NeonButton onClick={runIngest} disabled={runningIngest}>
            {runningIngest ? "Ingesting..." : "Run Ingest"}
          </NeonButton>
        </div>

        <div className="mt-3 space-y-2">
          {runs.length === 0 ? (
            <div className="text-xs text-slate-400">No ingest runs recorded yet.</div>
          ) : (
            runs.slice(0, 5).map((run) => (
              <div key={run.id} className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-slate-300">
                {run.status.toUpperCase()} · Listings {run.listings_count} · Blog posts {run.blog_posts_count}
                {run.error_message ? ` · Error: ${run.error_message}` : ""}
              </div>
            ))
          )}
        </div>
      </article>
    </div>
  );
}

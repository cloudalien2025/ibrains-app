"use client";

import { useEffect, useState } from "react";
import TopBar from "@/components/ecomviper/TopBar";
import HudCard from "@/components/ecomviper/HudCard";
import NeonButton from "@/components/ecomviper/NeonButton";

type VersionRow = {
  id: string;
  listing_source_id: string;
  action_type: string;
  version_label: string;
  score_snapshot_json: Record<string, unknown>;
  content_delta_json: Record<string, unknown>;
  link_delta_json: Record<string, unknown>;
  created_at: string;
};

export default function DirectoryIqVersionsClient() {
  const [rows, setRows] = useState<VersionRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<Record<string, unknown> | null>(null);
  const [restoreToken, setRestoreToken] = useState<string>("");

  async function load() {
    setError(null);
    const response = await fetch("/api/directoryiq/versions", { cache: "no-store" });
    const json = (await response.json()) as { versions?: VersionRow[]; error?: string };
    if (!response.ok) {
      setError(json.error ?? "Failed to load versions");
      return;
    }
    setRows(json.versions ?? []);
  }

  useEffect(() => {
    void load();
  }, []);

  async function previewRestore(versionId: string) {
    const response = await fetch(`/api/directoryiq/versions/${versionId}/restore-preview`, { method: "POST" });
    const json = (await response.json()) as { preview?: Record<string, unknown>; approval_token?: string; error?: string };
    if (!response.ok) {
      setError(json.error ?? "Restore preview failed");
      return;
    }
    setPreview(json.preview ?? null);
    setRestoreToken(json.approval_token ?? "");
  }

  async function restore(versionId: string) {
    const response = await fetch(`/api/directoryiq/versions/${versionId}/restore`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approve_restore: true, approval_token: restoreToken }),
    });

    const json = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(json.error ?? "Restore failed");
      return;
    }

    setPreview(null);
    setRestoreToken("");
    await load();
  }

  return (
    <>
      <TopBar breadcrumbs={["Home", "DirectoryIQ", "Versions"]} searchPlaceholder="Search versions..." />

      {error ? <div className="rounded-xl border border-rose-300/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">{error}</div> : null}

      <HudCard title="Versions" subtitle="View history and restore with mandatory preview.">
        {rows.length === 0 ? (
          <div className="text-sm text-slate-300">No versions yet.</div>
        ) : (
          <div className="space-y-3">
            {rows.map((row) => (
              <div key={row.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-slate-100">{row.version_label}</div>
                    <div className="text-xs text-slate-400">
                      {row.action_type} · Listing {row.listing_source_id} · {new Date(row.created_at).toLocaleString()}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <NeonButton variant="secondary" onClick={() => void previewRestore(row.id)}>Preview Restore</NeonButton>
                    <NeonButton onClick={() => void restore(row.id)}>Restore</NeonButton>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </HudCard>

      {preview ? (
        <HudCard title="Restore Diff Preview" subtitle="Approval required before restore action.">
          <pre className="max-h-96 overflow-auto rounded bg-slate-900/80 p-3 text-xs text-slate-200">
            {JSON.stringify(preview, null, 2)}
          </pre>
        </HudCard>
      ) : null}
    </>
  );
}

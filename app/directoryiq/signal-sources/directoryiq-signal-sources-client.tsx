"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import NeonButton from "@/components/ecomviper/NeonButton";
import type { DirectoryIqConnector, DirectoryIqCredentialStatus } from "@/lib/directoryiq/signalSourceCredentials";

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

export default function DirectoryIqSignalSourcesClient() {
  const searchParams = useSearchParams();
  const selectedConnector = idAlias[(searchParams.get("connector") ?? "").toLowerCase()] ?? null;

  const [states, setStates] = useState<Record<DirectoryIqConnector, DirectoryIqCredentialStatus>>({
    brilliant_directories_api: {
      connector_id: "brilliant_directories_api",
      connected: false,
      label: null,
      masked_secret: "",
      updated_at: null,
    },
    openai: { connector_id: "openai", connected: false, label: null, masked_secret: "", updated_at: null },
    serpapi: { connector_id: "serpapi", connected: false, label: null, masked_secret: "", updated_at: null },
    ga4: { connector_id: "ga4", connected: false, label: null, masked_secret: "", updated_at: null },
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
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const orderedConnectors = useMemo(
    () => ["brilliant_directories_api", "openai", "serpapi", "ga4"] as DirectoryIqConnector[],
    []
  );

  async function load() {
    setError(null);
    try {
      const response = await fetch("/api/directoryiq/signal-sources", { cache: "no-store" });
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
      setError(e instanceof Error ? e.message : "Unknown load error");
    }
  }

  useEffect(() => {
    void load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      const response = await fetch("/api/directoryiq/signal-sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connector_id: connectorId,
          secret,
          label: labels[connectorId] || null,
        }),
      });
      const json = (await response.json()) as { error?: string };
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

  async function remove(connectorId: DirectoryIqConnector) {
    setSaving(connectorId);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch(`/api/directoryiq/signal-sources?connector_id=${connectorId}`, {
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
      {error ? (
        <div className="rounded-xl border border-rose-300/35 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

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
                    ? `Connected (${state.masked_secret})${state.updated_at ? ` · Saved ${new Date(state.updated_at).toLocaleString()}` : ""}`
                    : "Disconnected"}
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
    </div>
  );
}

"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Cable } from "lucide-react";
import NeonButton from "@/components/ecomviper/NeonButton";
import { studioSignalSources } from "@/lib/copy/signalSourcesCatalog";

type StudioConnector = "youtube" | "openai";

const connectorMeta: Record<StudioConnector, { name: string; placeholder: string }> = {
  youtube: {
    name: "YouTube",
    placeholder: "Channel ID, API key, or feed token",
  },
  openai: {
    name: "OpenAI API (BYO)",
    placeholder: "Paste OpenAI API key",
  },
};

type StoredStudioCredential = {
  label: string | null;
  maskedSecret: string;
  updatedAt: string;
};

const idAlias: Record<string, StudioConnector> = {
  youtube: "youtube",
  openai: "openai",
};

const reverseAlias: Record<StudioConnector, string> = {
  youtube: "youtube",
  openai: "openai",
};

function mask(secret: string) {
  const clean = secret.trim();
  if (!clean) return "";
  if (clean.length <= 4) return "*".repeat(clean.length);
  return `${"*".repeat(Math.max(0, clean.length - 4))}${clean.slice(-4)}`;
}

function storageKey(connector: StudioConnector) {
  return `studio.signal-source.${connector}`;
}

const categoryOrder = ["Core", "Recommended", "Optional"] as const;

function resolveConnector(id: string): StudioConnector | null {
  if (id === "youtube" || id === "openai") return id;
  return null;
}

export default function StudioSignalSourcesClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedConnector = idAlias[(searchParams.get("connector") ?? "").toLowerCase()] ?? null;

  const [values, setValues] = useState<Record<StudioConnector, string>>({ youtube: "", openai: "" });
  const [labels, setLabels] = useState<Record<StudioConnector, string>>(() => {
    const initial = { youtube: "", openai: "" };
    if (typeof window === "undefined") return initial;
    (["youtube", "openai"] as StudioConnector[]).forEach((connectorId) => {
      try {
        const raw = window.localStorage.getItem(storageKey(connectorId));
        if (!raw) return;
        const parsed = JSON.parse(raw) as StoredStudioCredential;
        if (parsed.label) initial[connectorId] = parsed.label;
      } catch {
        // no-op
      }
    });
    return initial;
  });
  const [saved, setSaved] = useState<Record<StudioConnector, StoredStudioCredential | null>>(() => {
    const initial = { youtube: null, openai: null } as Record<StudioConnector, StoredStudioCredential | null>;
    if (typeof window === "undefined") return initial;
    (["youtube", "openai"] as StudioConnector[]).forEach((connectorId) => {
      try {
        const raw = window.localStorage.getItem(storageKey(connectorId));
        if (!raw) return;
        initial[connectorId] = JSON.parse(raw) as StoredStudioCredential;
      } catch {
        // no-op
      }
    });
    return initial;
  });
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function setExpandedConnector(connectorId: StudioConnector | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (connectorId) {
      params.set("connector", reverseAlias[connectorId]);
    } else {
      params.delete("connector");
    }
    const nextQuery = params.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
  }

  function save(connectorId: StudioConnector) {
    const secret = values[connectorId].trim();
    if (!secret) {
      setError(`Enter a value for ${connectorMeta[connectorId].name}.`);
      return;
    }

    const updated: StoredStudioCredential = {
      label: labels[connectorId].trim() || null,
      maskedSecret: mask(secret),
      updatedAt: new Date().toISOString(),
    };

    window.localStorage.setItem(storageKey(connectorId), JSON.stringify(updated));
    setSaved((prev) => ({ ...prev, [connectorId]: updated }));
    setValues((prev) => ({ ...prev, [connectorId]: "" }));
    setError(null);
    setNotice(`${connectorMeta[connectorId].name} connected.`);
    setExpandedConnector(null);
  }

  return (
    <section className="mt-6 rounded-2xl border border-cyan-300/20 bg-slate-950/55 p-6 backdrop-blur-xl shadow-[inset_0_1px_0_rgba(148,163,184,0.14),0_24px_50px_rgba(2,6,23,0.7),0_0_36px_rgba(34,211,238,0.08)]">
      <header className="mb-4 border-b border-cyan-300/15 pb-4">
        <div className="text-xs uppercase tracking-[0.18em] text-cyan-300/80">Signal Sources</div>
        <h2 className="mt-2 text-xl font-semibold text-white">Studio Signal Sources</h2>
        <p className="mt-1 text-sm text-slate-300">Configure each source inline below its card.</p>
      </header>

      {notice ? (
        <div className="mb-4 rounded-xl border border-emerald-300/35 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
          {notice}
        </div>
      ) : null}
      {error ? (
        <div className="mb-4 rounded-xl border border-rose-300/35 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      <div className="space-y-5">
        {categoryOrder.map((category) => {
          const items = studioSignalSources.filter((connector) => connector.category === category);
          if (items.length === 0) return null;

          return (
            <div key={category}>
              <div className="mb-2 text-xs uppercase tracking-[0.16em] text-slate-400">{category}</div>
              <div className="space-y-2">
                {items.map((connector) => {
                  const connectorId = resolveConnector(connector.id);
                  const state = connectorId ? saved[connectorId] : null;
                  const connected = Boolean(state);
                  const expanded = connectorId ? selectedConnector === connectorId : false;
                  const locked = connector.status === "locked" || !connectorId;

                  return (
                    <article key={connector.id} className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-100">
                              <Cable className="h-4 w-4 text-cyan-200" />
                              {connector.name}
                            </div>
                            <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.1em] ${
                              connected
                                ? "border-emerald-300/35 bg-emerald-400/10 text-emerald-100"
                                : locked
                                  ? "border-amber-300/35 bg-amber-400/15 text-amber-100"
                                  : "border-white/20 bg-white/5 text-slate-200"
                            }`}>
                              {connected ? "Connected" : locked ? "Locked" : "Disconnected"}
                            </span>
                          </div>
                          <p className="mt-1 text-sm text-slate-300">{connector.description}</p>
                          {state ? (
                            <p className="mt-1 text-xs text-slate-400">
                              {state.maskedSecret} · Saved {new Date(state.updatedAt).toLocaleString()}
                            </p>
                          ) : null}
                          {connector.disabledReason ? (
                            <p className="mt-1 text-xs text-slate-400">{connector.disabledReason}</p>
                          ) : null}
                        </div>

                        {locked ? (
                          <button
                            type="button"
                            disabled
                            className="inline-flex cursor-not-allowed items-center rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-400"
                          >
                            {connector.actionLabel}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setExpandedConnector(expanded ? null : connectorId)}
                            className="inline-flex items-center rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-100 transition hover:bg-white/10"
                          >
                            {expanded ? "Close" : connected ? "Edit" : "Configure"}
                          </button>
                        )}
                      </div>

                      {expanded && connectorId ? (
                        <div className="mt-3 border-t border-white/10 pt-3">
                          <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
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
                            <NeonButton onClick={() => save(connectorId)}>Save</NeonButton>
                          </div>
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

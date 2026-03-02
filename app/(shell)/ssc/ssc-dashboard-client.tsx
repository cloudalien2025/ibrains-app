"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type PromptPack = {
  id: string;
  pack_name: string;
  version: string;
  sha256: string;
  active: boolean;
  active_updated_at?: string | null;
};

type PacksResponse = {
  packs: PromptPack[];
};

const PACKS = ["DB_PROMPTS", "EB_PROMPTS_EcomViper", "VISUAL_PROMPTS"] as const;

export default function SscDashboardClient() {
  const [packs, setPacks] = useState<PromptPack[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/ssc/prompt-packs")
      .then((res) => res.json())
      .then((data: PacksResponse) => {
        if (!active) return;
        setPacks(data.packs ?? []);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Failed to load packs");
      });
    return () => {
      active = false;
    };
  }, []);

  const packMap = useMemo(() => {
    const map = new Map<string, PromptPack>();
    for (const pack of packs) {
      if (pack.active) {
        map.set(pack.pack_name, pack);
      }
    }
    return map;
  }, [packs]);

  return (
    <div className="space-y-6">
      <section className="rounded-[24px] border border-white/10 bg-white/5 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-slate-300/70">
              Prompt Packs
            </div>
            <p className="mt-2 text-sm text-slate-300">
              Active hash-locked packs loaded by the SSC service.
            </p>
          </div>
          <Link
            href="/ssc/entities/shopify_product/123"
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white transition hover:bg-white/10"
          >
            Open sample entity hub
          </Link>
        </div>

        {error ? (
          <p className="mt-4 text-sm text-rose-300">{error}</p>
        ) : (
          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            {PACKS.map((packName) => {
              const pack = packMap.get(packName);
              return (
                <div
                  key={packName}
                  className="rounded-[20px] border border-white/10 bg-white/4 p-4"
                >
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-400">
                    {packName}
                  </div>
                  {pack ? (
                    <div className="mt-3 space-y-2 text-sm text-slate-200">
                      <div>Version {pack.version}</div>
                      <div className="break-all font-mono text-xs text-slate-400">
                        {pack.sha256}
                      </div>
                      <div className="text-xs text-emerald-300">Active</div>
                    </div>
                  ) : (
                    <div className="mt-3 text-sm text-slate-400">
                      Not loaded yet.
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="rounded-[24px] border border-white/10 bg-white/5 p-6">
        <div className="text-xs uppercase tracking-[0.2em] text-slate-300/70">
          Entity Reasoning Hub
        </div>
        <p className="mt-2 text-sm text-slate-300">
          Use the storyboard tab to generate visual scores for specific entities.
        </p>
        <div className="mt-4 text-sm text-slate-300">
          Route format: <span className="font-mono">/ssc/entities/&lt;entity_type&gt;/&lt;entity_id&gt;</span>
        </div>
      </section>
    </div>
  );
}

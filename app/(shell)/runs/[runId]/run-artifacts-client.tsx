"use client";

import { useState } from "react";

type RunArtifactsClientProps = {
  runId: string;
};

export default function RunArtifactsClient({ runId }: RunArtifactsClientProps) {
  const [brainPackId, setBrainPackId] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isBuilding, setIsBuilding] = useState(false);

  async function buildBrainPack() {
    setIsBuilding(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/runs/${runId}/brain-pack`, {
        method: "POST",
        headers: { Accept: "application/json" },
      });
      const text = await res.text();
      let payload: any = null;
      try {
        payload = text ? JSON.parse(text) : null;
      } catch {
        payload = null;
      }

      if (!res.ok) {
        const details =
          payload?.error?.message ||
          payload?.detail ||
          payload?.message ||
          `HTTP ${res.status}`;
        setMessage(`Brain-pack build failed: ${details}`);
        return;
      }

      const created = payload?.brain_pack_id || payload?.id || "";
      if (created) {
        setBrainPackId(created);
      }
      setMessage(created ? `Brain-pack ready: ${created}` : "Brain-pack build requested.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Brain-pack build failed");
    } finally {
      setIsBuilding(false);
    }
  }

  return (
    <div className="rounded-[24px] border border-white/10 bg-white/5 p-5">
      <div className="text-xs uppercase tracking-[0.2em] text-slate-300/70">Run artifacts</div>
      <div className="mt-3 flex flex-wrap gap-2">
        <a
          href={`/api/runs/${runId}/report`}
          target="_blank"
          rel="noreferrer"
          className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-white transition hover:bg-white/10"
        >
          Open report JSON
        </a>
        <a
          href={`/api/runs/${runId}/files`}
          target="_blank"
          rel="noreferrer"
          className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-white transition hover:bg-white/10"
        >
          Open files JSON
        </a>
        <button
          type="button"
          onClick={buildBrainPack}
          disabled={isBuilding}
          className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-100 transition hover:bg-emerald-400/20 disabled:opacity-60"
        >
          {isBuilding ? "Building..." : "Build brain-pack"}
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          value={brainPackId}
          onChange={(event) => setBrainPackId(event.target.value)}
          placeholder="brain_pack_id"
          className="w-72 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs text-white"
        />
        <a
          href={brainPackId ? `/api/brain-packs/${brainPackId}` : "#"}
          target="_blank"
          rel="noreferrer"
          className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
            brainPackId
              ? "border-white/10 bg-white/5 text-white hover:bg-white/10"
              : "pointer-events-none border-white/10 bg-white/5 text-slate-500"
          }`}
        >
          Open pack JSON
        </a>
        <a
          href={brainPackId ? `/api/brain-packs/${brainPackId}/download` : "#"}
          target="_blank"
          rel="noreferrer"
          className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
            brainPackId
              ? "border-white/10 bg-white/5 text-white hover:bg-white/10"
              : "pointer-events-none border-white/10 bg-white/5 text-slate-500"
          }`}
        >
          Download pack
        </a>
      </div>

      {message ? <p className="mt-3 text-xs text-slate-300">{message}</p> : null}
    </div>
  );
}

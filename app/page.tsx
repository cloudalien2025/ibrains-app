"use client";

import { useEffect, useMemo, useState } from "react";

type HealthPayload = {
  ok: boolean;
  timestamp: string;
  worker_base_url_present: boolean;
  upstream_ok: boolean;
  upstream_error?: string;
  request_id?: string;
};

type StatusState =
  | { phase: "idle" | "loading" }
  | { phase: "ok"; ms: number; data: HealthPayload }
  | {
      phase: "error";
      ms: number;
      message: string;
      raw?: string;
      requestId?: string;
    };

const DEFAULT_WORKER_URL = "https://api.ibrains.ai";

function safeJsonStringify(obj: unknown, spaces = 2): string {
  try {
    return JSON.stringify(obj, null, spaces);
  } catch {
    return String(obj);
  }
}

export default function Home() {
  const workerUrl =
    (process.env.NEXT_PUBLIC_WORKER_URL || "").trim() || DEFAULT_WORKER_URL;

  const healthUrl = useMemo(() => "/api/health", []);

  const [state, setState] = useState<StatusState>({ phase: "idle" });

  async function checkHealth() {
    const started = performance.now();
    setState({ phase: "loading" });

    try {
      const res = await fetch(healthUrl, {
        method: "GET",
        cache: "no-store",
        headers: { Accept: "application/json" },
      });

      const ms = Math.round(performance.now() - started);

      const text = await res.text();
      let json: HealthPayload | null = null;
      try {
        json = text ? (JSON.parse(text) as HealthPayload) : null;
      } catch {
        json = null;
      }

      if (!res.ok) {
        setState({
          phase: "error",
          ms,
          message: `HTTP ${res.status} from /api/health`,
          raw: text?.slice(0, 4000),
        });
        return;
      }

      if (!json || typeof json !== "object" || !("upstream_ok" in json)) {
        setState({
          phase: "error",
          ms,
          message: "Worker returned non-JSON response",
          raw: text?.slice(0, 4000),
        });
        return;
      }

      if (!json.upstream_ok) {
        setState({
          phase: "error",
          ms,
          message: json.upstream_error || "Upstream health check failed",
          raw: text?.slice(0, 4000),
          requestId: json.request_id,
        });
        return;
      }

      setState({ phase: "ok", ms, data: json });
    } catch (e: unknown) {
      const ms = Math.round(performance.now() - started);
      const msg =
        e instanceof Error ? e.message : "Unknown error while calling worker";
      setState({ phase: "error", ms, message: msg });
    }
  }

  useEffect(() => {
    // initial check
    void checkHealth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [healthUrl]);

  const badge = (() => {
    if (state.phase === "loading" || state.phase === "idle") {
      return (
        <span className="inline-flex items-center rounded-full bg-zinc-800 px-3 py-1 text-xs font-medium text-zinc-200 ring-1 ring-inset ring-zinc-700">
          Checking worker…
        </span>
      );
    }
    if (state.phase === "ok") {
      return (
        <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-200 ring-1 ring-inset ring-emerald-500/25">
          ✅ Worker online · {state.ms}ms
        </span>
      );
    }
    return (
      <span className="inline-flex items-center rounded-full bg-rose-500/10 px-3 py-1 text-xs font-medium text-rose-200 ring-1 ring-inset ring-rose-500/25">
        ❌ Worker error
      </span>
    );
  })();

  const jsonBlock = (() => {
    if (state.phase === "ok") return safeJsonStringify(state.data, 2);
    if (state.phase === "error") {
      return safeJsonStringify(
        {
          error: state.message,
          ...(state.raw ? { raw: state.raw } : {}),
          url: healthUrl,
          ...(state.requestId ? { request_id: state.requestId } : {}),
        },
        2
      );
    }
    return safeJsonStringify({ status: "loading", url: healthUrl }, 2);
  })();

  return (
    <div className="min-h-screen bg-[#070a12] text-zinc-100">
      <div className="mx-auto max-w-5xl px-6 py-16">
        <div className="mb-10 inline-flex items-center gap-3">
          <span className="inline-flex items-center rounded-full bg-indigo-500/10 px-3 py-1 text-xs font-medium text-indigo-200 ring-1 ring-inset ring-indigo-500/25">
            Platform Intelligence Engine
          </span>
          {badge}
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-10 shadow-2xl shadow-black/40">
          <h1 className="text-4xl font-semibold tracking-tight">iBrains</h1>

          <p className="mt-4 max-w-2xl text-base leading-relaxed text-zinc-300">
            iBrains is building the intelligence layer for complex platforms.
            First specialization: <span className="font-semibold text-zinc-100">Brilliant Directories Brain</span>.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
              <div className="text-xs text-zinc-400">API</div>
              <div className="mt-1 text-sm font-medium">{workerUrl}</div>
              <div className="mt-2 text-xs text-zinc-400">Health</div>
              <div className="mt-1 text-sm font-medium">{healthUrl}</div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
              <div className="text-xs text-zinc-400">Actions</div>
              <div className="mt-3 flex flex-wrap gap-3">
                <button
                  onClick={() => void checkHealth()}
                  disabled={state.phase === "loading"}
                  className="rounded-xl bg-white/10 px-4 py-2 text-sm font-medium text-zinc-100 ring-1 ring-inset ring-white/10 hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Refresh status
                </button>

                <a
                  href={healthUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl bg-white/10 px-4 py-2 text-sm font-medium text-zinc-100 ring-1 ring-inset ring-white/10 hover:bg-white/15"
                >
                  Open /api/health
                </a>
              </div>
              <p className="mt-3 text-xs text-zinc-400">
                Tip: set <span className="font-mono">NEXT_PUBLIC_WORKER_URL</span> in Vercel env vars if you ever change the API host.
              </p>
              {state.phase === "error" ? (
                <div className="mt-4 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-100">
                  <div className="text-[11px] uppercase tracking-wide text-rose-200/80">
                    Health Error
                  </div>
                  <div className="mt-1 text-sm text-rose-50">{state.message}</div>
                  {state.requestId ? (
                    <div className="mt-1 text-[11px] text-rose-200/80">
                      Request ID: <span className="font-mono">{state.requestId}</span>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>

          <details className="mt-8 rounded-2xl border border-white/10 bg-black/20 p-5">
            <summary className="cursor-pointer select-none text-sm font-medium text-zinc-100">
              Raw Health JSON
            </summary>
            <pre className="mt-4 overflow-x-auto rounded-xl bg-black/40 p-4 text-xs leading-relaxed text-zinc-200 ring-1 ring-inset ring-white/10">
              {jsonBlock}
            </pre>
          </details>

          <div className="mt-10 text-xs text-zinc-500">© iBrains</div>
        </div>
      </div>
    </div>
  );
}

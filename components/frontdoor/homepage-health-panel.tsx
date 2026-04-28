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

type HomepageHealthPanelProps = {
  workerUrl: string;
};

function safeJsonStringify(obj: unknown, spaces = 2): string {
  try {
    return JSON.stringify(obj, null, spaces);
  } catch {
    return String(obj);
  }
}

export default function HomepageHealthPanel({ workerUrl }: HomepageHealthPanelProps) {
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
    } catch (error: unknown) {
      const ms = Math.round(performance.now() - started);
      const message =
        error instanceof Error ? error.message : "Unknown error while calling worker";
      setState({ phase: "error", ms, message });
    }
  }

  useEffect(() => {
    void checkHealth();
  }, [healthUrl]);

  const badge = (() => {
    if (state.phase === "loading" || state.phase === "idle") {
      return (
        <span className="inline-flex items-center rounded-full border border-[#D9E4F0] bg-[#EAF1F8] px-3 py-1 text-xs font-medium text-[#334155]">
          Checking worker…
        </span>
      );
    }

    if (state.phase === "ok") {
      return (
        <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
          ✅ Worker online · {state.ms}ms
        </span>
      );
    }

    return (
      <span className="inline-flex items-center rounded-full border border-rose-200 bg-rose-100 px-3 py-1 text-xs font-medium text-rose-700">
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
    <>
      <div className="mt-8">{badge}</div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-2xl border border-[#D9E4F0] bg-[#EAF1F8]/75 p-5">
          <div className="text-xs text-[#64748B]">API</div>
          <div className="mt-1 text-sm font-medium text-[#0F172A]">{workerUrl}</div>
          <div className="mt-2 text-xs text-[#64748B]">Health</div>
          <div className="mt-1 text-sm font-medium text-[#0F172A]">{healthUrl}</div>
        </div>

        <div className="rounded-2xl border border-[#D9E4F0] bg-[#EAF1F8]/75 p-5 sm:col-span-2">
          <div className="text-xs text-[#64748B]">Actions</div>
          <div className="mt-3 flex flex-wrap gap-3">
            <button
              onClick={() => void checkHealth()}
              disabled={state.phase === "loading"}
              className="rounded-xl border border-[#2563EB] bg-[#2563EB] px-4 py-2 text-sm font-medium text-white transition hover:border-[#1D4ED8] hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-60"
            >
              Refresh status
            </button>
            <a
              href={healthUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-xl border border-[#D9E4F0] bg-white px-4 py-2 text-sm font-medium text-[#0F172A] transition hover:bg-[#F8FBFF]"
            >
              Open /api/health
            </a>
          </div>
          <p className="mt-3 text-xs text-[#64748B]">
            Tip: set <span className="font-mono">NEXT_PUBLIC_WORKER_URL</span> in the app environment if you ever change the API host.
          </p>
          {state.phase === "error" ? (
            <div className="mt-4 rounded-xl border border-rose-200 bg-rose-100 p-3 text-xs text-rose-700">
              <div className="text-[11px] uppercase tracking-wide text-rose-500/90">Health Error</div>
              <div className="mt-1 text-sm text-rose-700">{state.message}</div>
              {state.requestId ? (
                <div className="mt-1 text-[11px] text-rose-600">
                  Request ID: <span className="font-mono">{state.requestId}</span>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <details className="mt-8 rounded-2xl border border-[#D9E4F0] bg-[#F8FBFF] p-5">
        <summary className="cursor-pointer select-none text-sm font-medium text-[#0F172A]">Raw Health JSON</summary>
        <pre className="mt-4 overflow-x-auto rounded-xl bg-white p-4 text-xs leading-relaxed text-[#334155] ring-1 ring-inset ring-[#D9E4F0]">
          {jsonBlock}
        </pre>
      </details>
    </>
  );
}

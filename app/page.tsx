"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

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
    <div className="ibrains-shell min-h-screen text-[#0F172A]">
      <div className="mx-auto max-w-5xl px-6 py-16">
        <div className="mb-10 flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex items-center gap-3">
            <span className="inline-flex items-center rounded-full border border-[#D9E4F0] bg-white px-3 py-1 text-xs font-medium text-[#2563EB]">
              Platform Intelligence Engine
            </span>
            {badge}
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/apps"
              className="rounded-full border border-[#2563EB] bg-[#2563EB] px-4 py-2 text-sm text-white transition hover:border-[#1D4ED8] hover:bg-[#1D4ED8]"
            >
              Open Apps
            </Link>
            <Link
              href="/brains"
              className="rounded-full border border-[#D9E4F0] bg-white px-4 py-2 text-sm text-[#0F172A] transition hover:bg-[#F8FBFF]"
            >
              Open Console
            </Link>
            <Link
              href="/sign-in"
              className="rounded-full border border-[#D9E4F0] bg-white px-4 py-2 text-sm text-[#0F172A] transition hover:bg-[#F8FBFF]"
            >
              Sign in
            </Link>
            <Link
              href="/sign-up"
              className="rounded-full border border-[#D9E4F0] bg-white px-4 py-2 text-sm text-[#0F172A] transition hover:bg-[#F8FBFF]"
            >
              Create account
            </Link>
          </div>
        </div>

        <div className="rounded-3xl border border-[#D9E4F0] bg-white/95 p-10 shadow-[0_24px_56px_rgba(15,23,42,0.09)]">
          <div className="rounded-2xl bg-[linear-gradient(135deg,rgba(37,99,235,0.10)_0%,rgba(34,211,238,0.08)_45%,rgba(255,255,255,0)_100%)] p-6">
            <h1 className="text-4xl font-semibold tracking-tight text-[#0F172A]">iBrains</h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-[#334155]">
              iBrains is building the intelligence layer for complex platforms.
              First specialization: <span className="font-semibold text-[#0F172A]">Brilliant Directories Brain</span>.
            </p>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-2xl border border-[#D9E4F0] bg-[#EAF1F8]/75 p-5">
              <div className="text-xs text-[#64748B]">Apps</div>
              <div className="mt-1 text-sm font-medium text-[#0F172A]">DirectoryIQ + SiteForge</div>
              <div className="mt-2 text-xs text-[#64748B]">Integrated under the iBrains app launcher.</div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  href="/apps/directoryiq"
                  className="rounded-full border border-[#D9E4F0] bg-white px-3 py-1.5 text-xs text-[#334155] transition hover:bg-[#F8FBFF]"
                >
                  Open DirectoryIQ
                </Link>
                <Link
                  href="/apps/siteforge"
                  className="rounded-full border border-[#D9E4F0] bg-white px-3 py-1.5 text-xs text-[#334155] transition hover:bg-[#F8FBFF]"
                >
                  Open SiteForge
                </Link>
              </div>
            </div>

            <div className="rounded-2xl border border-[#D9E4F0] bg-[#EAF1F8]/75 p-5">
              <div className="text-xs text-[#64748B]">API</div>
              <div className="mt-1 text-sm font-medium text-[#0F172A]">{workerUrl}</div>
              <div className="mt-2 text-xs text-[#64748B]">Health</div>
              <div className="mt-1 text-sm font-medium text-[#0F172A]">{healthUrl}</div>
            </div>

            <div className="rounded-2xl border border-[#D9E4F0] bg-[#EAF1F8]/75 p-5">
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

          <div className="mt-10 text-xs text-[#64748B]">© iBrains</div>
        </div>
      </div>
    </div>
  );
}

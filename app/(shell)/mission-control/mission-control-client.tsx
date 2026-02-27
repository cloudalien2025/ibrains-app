"use client";

import { useMemo, useState } from "react";

type CheckStatus = "idle" | "running" | "ok" | "fail";

type CheckResult = {
  status: CheckStatus;
  message?: string;
  lastRun?: string;
};

type CheckItem = {
  key: string;
  title: string;
  description: string;
};

const CHECKS: CheckItem[] = [
  {
    key: "health",
    title: "Health ok",
    description: "Confirms /api/health is reachable and upstream ok.",
  },
  {
    key: "proxy",
    title: "Proxy deterministic ok",
    description: "Validates POST /api/brains/.../runs returns 202 + run_id.",
  },
  {
    key: "start-run",
    title: "Start run ok",
    description: "Ensures run creation works via the proxy.",
  },
  {
    key: "run-detail",
    title: "Run detail ok",
    description: "Polls /api/runs/{run_id} until a status field appears.",
  },
  {
    key: "diagnostics",
    title: "Diagnostics ok",
    description: "Polls /api/runs/{run_id}/diagnostics until 200.",
  },
];

function statusTone(status: CheckStatus) {
  switch (status) {
    case "ok":
      return "bg-emerald-400/15 text-emerald-200";
    case "fail":
      return "bg-rose-500/15 text-rose-200";
    case "running":
      return "bg-amber-400/15 text-amber-200";
    default:
      return "bg-white/10 text-slate-200";
  }
}

export default function MissionControlClient() {
  const initialState = useMemo(() => {
    return CHECKS.reduce<Record<string, CheckResult>>((acc, check) => {
      acc[check.key] = { status: "idle" };
      return acc;
    }, {});
  }, []);

  const [results, setResults] = useState<Record<string, CheckResult>>(initialState);

  async function runCheck(key: string) {
    setResults((prev) => ({
      ...prev,
      [key]: { status: "running", lastRun: new Date().toLocaleTimeString() },
    }));

    try {
      const res = await fetch(`/api/mission-control/${key}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const text = await res.text();
      let payload: any = {};
      try {
        payload = text ? JSON.parse(text) : {};
      } catch {
        payload = {};
      }
      const ok = res.ok && payload?.ok;
      setResults((prev) => ({
        ...prev,
        [key]: {
          status: ok ? "ok" : "fail",
          message: payload?.message || (ok ? "Check passed." : "Check failed."),
          lastRun: new Date().toLocaleTimeString(),
        },
      }));
    } catch (e) {
      const message = e instanceof Error ? e.message : "Request failed";
      setResults((prev) => ({
        ...prev,
        [key]: {
          status: "fail",
          message,
          lastRun: new Date().toLocaleTimeString(),
        },
      }));
    }
  }

  async function runAll() {
    for (const check of CHECKS) {
      await runCheck(check.key);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-[24px] border border-white/10 bg-white/5 p-5">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-slate-300/70">
            Checklist
          </div>
          <p className="mt-2 text-sm text-slate-300">
            Run checks to validate live production readiness.
          </p>
        </div>
        <button
          type="button"
          onClick={runAll}
          className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10"
        >
          Run all checks
        </button>
      </div>

      <div className="space-y-4">
        {CHECKS.map((check) => {
          const result = results[check.key];
          return (
            <div
              key={check.key}
              className="rounded-[24px] border border-white/10 bg-white/5 p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <span
                      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${statusTone(result.status)}`}
                    >
                      {result.status === "idle"
                        ? "Not run"
                        : result.status === "running"
                        ? "Running"
                        : result.status === "ok"
                        ? "Passed"
                        : "Failed"}
                    </span>
                    <h3 className="text-lg font-semibold text-white">
                      {check.title}
                    </h3>
                  </div>
                  <p className="mt-2 text-sm text-slate-300">
                    {check.description}
                  </p>
                  {result.message ? (
                    <p className="mt-2 text-xs text-slate-400">
                      {result.message}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <button
                    type="button"
                    onClick={() => runCheck(check.key)}
                    className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white transition hover:bg-white/10"
                  >
                    Run check
                  </button>
                  {result.lastRun ? (
                    <div className="text-xs text-slate-400">
                      Last run {result.lastRun}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

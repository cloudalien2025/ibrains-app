"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

type RunState = {
  status?: string | null;
  stage?: string | null;
  step?: string | null;
  counters: {
    ingested?: number | null;
    transcriptsOk?: number | null;
    transcriptsFailed?: number | null;
  };
  lastUpdated: string;
};

type RunDetailClientProps = {
  runId: string;
  fallback: ReactNode;
  children: (state: RunState) => ReactNode;
};

function formatTimestamp() {
  return new Date().toLocaleTimeString();
}

function toNumber(value: unknown) {
  if (value === null || value === undefined) return null;
  const num = Number(value);
  return Number.isNaN(num) ? null : num;
}

function parseRunPayload(payload: any): RunState {
  const status = payload?.status ?? payload?.state ?? payload?.phase ?? null;
  const stage = payload?.stage ?? payload?.current_stage ?? null;
  const step = payload?.step ?? payload?.current_step ?? null;
  const counters = payload?.counters ?? payload?.metrics ?? payload ?? {};

  return {
    status,
    stage,
    step,
    counters: {
      ingested:
        toNumber(counters.ingested) ??
        toNumber(counters.ingested_count) ??
        toNumber(counters.total_ingested) ??
        null,
      transcriptsOk:
        toNumber(counters.transcripts_ok) ??
        toNumber(counters.transcripts_success) ??
        toNumber(counters.transcripts_completed) ??
        null,
      transcriptsFailed:
        toNumber(counters.transcripts_failed) ??
        toNumber(counters.transcripts_error) ??
        toNumber(counters.transcripts_errors) ??
        null,
    },
    lastUpdated: formatTimestamp(),
  };
}

export default function RunDetailClient({
  runId,
  fallback,
  children,
}: RunDetailClientProps) {
  const [state, setState] = useState<RunState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runUrl = useMemo(() => `/api/runs/${runId}`, [runId]);

  useEffect(() => {
    let active = true;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    let shouldPoll = true;
    const poll = async () => {
      if (!shouldPoll) return;
      try {
        const res = await fetch(runUrl, { cache: "no-store" });
        const text = await res.text();
        if (!active) return;

        if (!res.ok) {
          setError(`HTTP ${res.status} while loading run`);
        } else {
          let payload: any = {};
          try {
            payload = text ? JSON.parse(text) : {};
          } catch {
            payload = {};
          }
          setState(parseRunPayload(payload));
          setError(null);

          const status =
            payload?.status ?? payload?.state ?? payload?.phase ?? null;
          const done =
            typeof status === "string" &&
            ["completed", "failed", "cancelled", "canceled", "succeeded", "success"].includes(
              status.toLowerCase()
            );
          if (done) {
            shouldPoll = false;
            return;
          }
        }
      } catch (e) {
        if (!active) return;
        const message = e instanceof Error ? e.message : "Failed to load run";
        setError(message);
      } finally {
        if (!active) return;
        if (shouldPoll) {
          timeoutId = setTimeout(poll, 2000);
        }
      }
    };

    void poll();

    return () => {
      active = false;
      shouldPoll = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [runUrl]);

  if (error) {
    return (
      <div className="rounded-[24px] border border-rose-500/30 bg-rose-500/10 p-5 text-sm text-rose-100">
        {error}
      </div>
    );
  }

  if (!state) return <>{fallback}</>;

  return <>{children(state)}</>;
}

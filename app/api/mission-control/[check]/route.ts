export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

type CheckResult = {
  ok: boolean;
  message: string;
  data?: Record<string, unknown>;
};

const RUN_TIMEOUT_MS = 24000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function startRun(origin: string): Promise<{ runId: string; raw: string }> {
  const res = await fetch(`${origin}/api/brains/brilliant_directories/ingest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      keyword: "brilliant directories",
      selected_new: 1,
      n_new_videos: 1,
      max_candidates: 50,
      mode: "audio_first",
    }),
    cache: "no-store",
  });
  const raw = await res.text();
  if (res.status !== 202) {
    throw new Error(`Start run failed with HTTP ${res.status}`);
  }
  let payload: any = {};
  try {
    payload = raw ? JSON.parse(raw) : {};
  } catch {
    payload = {};
  }
  const runId = payload?.run_id || payload?.id;
  if (!runId) {
    throw new Error("Start run response missing run_id");
  }
  return { runId, raw };
}

async function pollRun(origin: string, runId: string): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < RUN_TIMEOUT_MS) {
    const res = await fetch(`${origin}/api/runs/${runId}`, {
      cache: "no-store",
    });
    const text = await res.text();
    if (res.ok) {
      try {
        const payload = text ? JSON.parse(text) : {};
        if (payload?.status || payload?.state || payload?.phase) {
          return true;
        }
      } catch {
        // ignore parse errors
      }
    }
    await sleep(2000);
  }
  return false;
}

async function pollDiagnostics(origin: string, runId: string): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < RUN_TIMEOUT_MS) {
    const res = await fetch(`${origin}/api/runs/${runId}/diagnostics`, {
      cache: "no-store",
    });
    if (res.ok) return true;
    await sleep(2000);
  }
  return false;
}

async function handleCheck(origin: string, check: string): Promise<CheckResult> {
  if (check === "health") {
    const res = await fetch(`${origin}/api/health`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    const text = await res.text();
    if (!res.ok) {
      return { ok: false, message: `Health endpoint returned ${res.status}` };
    }
    let payload: any = {};
    try {
      payload = text ? JSON.parse(text) : {};
    } catch {
      payload = {};
    }
    if (payload?.upstream_ok) {
      return { ok: true, message: "Health check passed." };
    }
    return { ok: false, message: payload?.upstream_error || "Upstream not ok" };
  }

  if (check === "proxy") {
    await startRun(origin);
    return { ok: true, message: "Proxy accepted run creation." };
  }

  if (check === "start-run") {
    await startRun(origin);
    return { ok: true, message: "Run created successfully." };
  }

  if (check === "run-detail") {
    const { runId } = await startRun(origin);
    const ok = await pollRun(origin, runId);
    return ok
      ? { ok: true, message: "Run detail returned status." }
      : { ok: false, message: "Run detail did not return status in time." };
  }

  if (check === "diagnostics") {
    const { runId } = await startRun(origin);
    const ok = await pollDiagnostics(origin, runId);
    return ok
      ? { ok: true, message: "Diagnostics returned 200." }
      : { ok: false, message: "Diagnostics did not return 200 in time." };
  }

  return { ok: false, message: "Unknown check." };
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ check: string }> | { check: string } }
) {
  try {
    const origin = new URL(req.url).origin;
    const { check } = await Promise.resolve(params);
    const result = await handleCheck(origin, check);
    return NextResponse.json(result, { status: result.ok ? 200 : 500 });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, message: e?.message ?? "Check failed" },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204 });
}

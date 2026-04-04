export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { proxyToBrains, unexpectedErrorResponse } from "../_utils/proxy";
import { brainIds } from "@/lib/brains/brainCatalog";
import { resolveBrainId } from "@/lib/brains/resolveBrainId";

type AnyRecord = Record<string, unknown>;

function asRecord(value: unknown): AnyRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as AnyRecord;
}

function readRunIdFromStats(payload: unknown): string | null {
  const stats = asRecord(payload);
  if (!stats) return null;
  const value =
    stats.last_run_id ??
    stats.lastRunId ??
    stats.run_id ??
    stats.runId ??
    null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function toTimestamp(run: AnyRecord): number {
  const candidate =
    run.started_at ??
    run.created_at ??
    run.updated_at ??
    run.startedAt ??
    run.createdAt ??
    run.updatedAt;
  if (typeof candidate !== "string") return 0;
  const parsed = Date.parse(candidate);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isBrainNotFoundListError(response: NextResponse, payload: unknown): boolean {
  if (response.status !== 404) return false;
  const body = asRecord(payload);
  const error = asRecord(body?.error);
  return error?.code === "BRAIN_NOT_FOUND";
}

async function fallbackRunsFromStats(req: NextRequest): Promise<NextResponse> {
  const runIds = new Set<string>();

  for (const brainId of brainIds) {
    const resolvedBrainId = resolveBrainId(brainId);
    const statsRes = await proxyToBrains(req, `/v1/brains/${resolvedBrainId}/stats`, { requireAuth: true });
    if (!statsRes.ok) continue;
    const statsPayload = await statsRes.json().catch(() => null);
    const runId = readRunIdFromStats(statsPayload);
    if (runId) runIds.add(runId);
  }

  const runs: AnyRecord[] = [];
  for (const runId of runIds) {
    const runRes = await proxyToBrains(req, `/v1/runs/${runId}`, { requireAuth: true });
    if (!runRes.ok) continue;
    const runPayload = await runRes.json().catch(() => null);
    const runRecord = asRecord(runPayload);
    if (runRecord) runs.push(runRecord);
  }

  runs.sort((a, b) => toTimestamp(b) - toTimestamp(a));
  return NextResponse.json({ runs }, { status: 200 });
}

export async function GET(req: NextRequest) {
  try {
    const primary = await proxyToBrains(req, "/v1/runs", { requireAuth: true });
    if (primary.ok) return primary;

    const payload = await primary.clone().json().catch(() => null);
    if (!isBrainNotFoundListError(primary, payload)) return primary;

    return fallbackRunsFromStats(req);
  } catch (e: unknown) {
    console.error("ROUTE_UNEXPECTED_ERROR", {
      route: "runs",
      message: e instanceof Error ? e.message : String(e),
      name: e instanceof Error ? e.name : undefined,
      stack: e instanceof Error ? e.stack : undefined,
    });
    return unexpectedErrorResponse();
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204 });
}

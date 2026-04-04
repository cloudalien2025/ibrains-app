import { resolveBrainId } from "@/lib/brains/resolveBrainId";

export type MissionControlRunView = {
  id: string;
  brainId?: string | null;
  status?: string | null;
  startedAt?: string | null;
};

export function resolveRuns(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload as Record<string, unknown>[];
  if (payload && typeof payload === "object") {
    const candidate = payload as Record<string, unknown>;
    const list =
      (candidate.runs as unknown[]) ||
      (candidate.items as unknown[]) ||
      (candidate.data as unknown[]) ||
      [];
    if (Array.isArray(list)) return list as Record<string, unknown>[];
  }
  return [];
}

export function normalizeRun(run: Record<string, unknown>): MissionControlRunView {
  const id =
    String(
      run.run_id ?? run.id ?? run.runId ?? run.job_id ?? run.jobId ?? "unknown_run"
    ) || "unknown_run";
  const brainId =
    (run.brain_id as string | undefined) ??
    (run.brainId as string | undefined) ??
    (run.brain as string | undefined) ??
    (run.brain_slug as string | undefined) ??
    (run.brainSlug as string | undefined) ??
    null;
  const status =
    (run.status as string | undefined) ??
    (run.state as string | undefined) ??
    (run.phase as string | undefined) ??
    null;
  const startedAt =
    (run.started_at as string | undefined) ??
    (run.created_at as string | undefined) ??
    (run.updated_at as string | undefined) ??
    (run.startedAt as string | undefined) ??
    (run.createdAt as string | undefined) ??
    (run.updatedAt as string | undefined) ??
    null;
  return { id, brainId, status, startedAt };
}

export function isRunForBrain(run: MissionControlRunView, appBrainId: string): boolean {
  const runBrainId = run.brainId?.trim();
  if (!runBrainId) return false;
  if (runBrainId === appBrainId) return true;
  return runBrainId === resolveBrainId(appBrainId);
}

export function selectRunsForBrain(
  payload: unknown,
  appBrainId: string,
  limit = 6
): MissionControlRunView[] {
  return resolveRuns(payload)
    .map(normalizeRun)
    .filter((run) => isRunForBrain(run, appBrainId))
    .slice(0, limit);
}

import { query } from "@/app/api/ecomviper/_utils/db";

export type DirectoryIqJobKind =
  | "step2.research"
  | "step2.draft"
  | "step2.image"
  | "step3.generate"
  | "step3.preview"
  | "step3.push";

export type DirectoryIqJobStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled";

export type DirectoryIqJobError = {
  code: string;
  codeFamily: string;
  message: string;
  details?: string;
};

export type DirectoryIqJobRecord = {
  id: string;
  reqId: string;
  userId: string;
  kind: DirectoryIqJobKind;
  status: DirectoryIqJobStatus;
  stage: string;
  listingId: string;
  siteId: string | null;
  slot: number | null;
  acceptedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  result: Record<string, unknown> | null;
  error: DirectoryIqJobError | null;
};

type DirectoryIqJobRow = {
  id: string;
  req_id: string;
  user_id: string;
  kind: DirectoryIqJobKind;
  status: DirectoryIqJobStatus;
  stage: string;
  listing_id: string;
  site_id: string | null;
  slot: number | null;
  accepted_at: string;
  started_at: string | null;
  finished_at: string | null;
  result_json: Record<string, unknown> | null;
  error_json: DirectoryIqJobError | null;
};

type CreateDirectoryIqJobInput = {
  reqId: string;
  userId: string;
  kind: DirectoryIqJobKind;
  listingId: string;
  siteId?: string | null;
  slot?: number | null;
};

type UpdateDirectoryIqJobInput = {
  status?: DirectoryIqJobStatus;
  stage?: string;
  startedAt?: string | null;
  finishedAt?: string | null;
  result?: Record<string, unknown> | null;
  error?: DirectoryIqJobError | null;
};

type RunDirectoryIqJobInput<T> = {
  routeOrigin: string;
  runtimeOwner: "directoryiq-api.ibrains.ai";
  startedStage: string;
  processor: (helpers: { setStage: (stage: string) => Promise<void> }) => Promise<T>;
};

const inMemoryJobs = new Map<string, DirectoryIqJobRecord>();
let jobsTableReady = false;
let jobsTablePromise: Promise<void> | null = null;

function canUseDb(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

function mapRow(row: DirectoryIqJobRow): DirectoryIqJobRecord {
  return {
    id: row.id,
    reqId: row.req_id,
    userId: row.user_id,
    kind: row.kind,
    status: row.status,
    stage: row.stage,
    listingId: row.listing_id,
    siteId: row.site_id,
    slot: row.slot,
    acceptedAt: row.accepted_at,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    result: row.result_json,
    error: row.error_json,
  };
}

function buildJobId(reqId: string): string {
  return `djq_${reqId.toLowerCase().replace(/[^a-z0-9]/g, "")}`;
}

function codeFamilyFromCode(code: string): string {
  const upper = code.toUpperCase();
  if (upper.startsWith("OPENAI_")) return "openai";
  if (upper.startsWith("DB_")) return "db";
  if (upper.startsWith("BD_")) return "bd";
  if (upper.includes("AUTH") || upper.includes("TOKEN")) return "auth";
  if (upper === "BAD_REQUEST" || upper === "NOT_FOUND" || upper.endsWith("_REQUIRED")) return "validation";
  return "internal";
}

function normalizeError(error: unknown): DirectoryIqJobError {
  if (error && typeof error === "object") {
    const maybeCode = (error as { code?: unknown }).code;
    const maybeMessage = (error as { message?: unknown }).message;
    const maybeDetails = (error as { details?: unknown }).details;
    if (typeof maybeCode === "string") {
      return {
        code: maybeCode,
        codeFamily: codeFamilyFromCode(maybeCode),
        message: typeof maybeMessage === "string" && maybeMessage.trim() ? maybeMessage : "Job failed.",
        details: typeof maybeDetails === "string" ? maybeDetails : undefined,
      };
    }
  }

  if (error instanceof Error) {
    return {
      code: "INTERNAL_ERROR",
      codeFamily: "internal",
      message: error.message || "Job failed.",
    };
  }

  return {
    code: "INTERNAL_ERROR",
    codeFamily: "internal",
    message: "Job failed.",
  };
}

async function ensureJobsTable(): Promise<void> {
  if (!canUseDb() || jobsTableReady) return;
  if (!jobsTablePromise) {
    jobsTablePromise = (async () => {
      await query(`
        CREATE TABLE IF NOT EXISTS directoryiq_jobs (
          id TEXT PRIMARY KEY,
          req_id TEXT NOT NULL,
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          kind TEXT NOT NULL,
          status TEXT NOT NULL,
          stage TEXT NOT NULL,
          listing_id TEXT NOT NULL,
          site_id TEXT,
          slot INTEGER,
          accepted_at TIMESTAMPTZ NOT NULL,
          started_at TIMESTAMPTZ,
          finished_at TIMESTAMPTZ,
          result_json JSONB,
          error_json JSONB
        );

        CREATE INDEX IF NOT EXISTS idx_directoryiq_jobs_user_accepted
          ON directoryiq_jobs(user_id, accepted_at DESC);
      `);
      jobsTableReady = true;
    })().catch((error) => {
      jobsTablePromise = null;
      throw error;
    });
  }
  await jobsTablePromise;
}

function logJobEvent(input: {
  routeOrigin: string;
  reqId: string;
  jobId: string;
  listingId: string;
  siteId: string | null;
  slot: number | null;
  phase: "submission" | "stage_transition" | "final_success" | "final_failure";
  stage: string;
  runtimeOwner: "directoryiq-api.ibrains.ai";
  elapsedMs: number;
  code?: string;
  codeFamily?: string;
}): void {
  console.info("[directoryiq-job]", {
    routeOrigin: input.routeOrigin,
    reqId: input.reqId,
    jobId: input.jobId,
    listingId: input.listingId,
    site_id: input.siteId,
    slot: input.slot ?? undefined,
    phase: input.phase,
    stage: input.stage,
    code: input.code,
    codeFamily: input.codeFamily,
    runtimeOwner: input.runtimeOwner,
    elapsedMs: input.elapsedMs,
  });
}

export async function createDirectoryIqJob(input: CreateDirectoryIqJobInput): Promise<DirectoryIqJobRecord> {
  const acceptedAt = new Date().toISOString();
  const job: DirectoryIqJobRecord = {
    id: buildJobId(input.reqId),
    reqId: input.reqId,
    userId: input.userId,
    kind: input.kind,
    status: "queued",
    stage: "queued",
    listingId: input.listingId,
    siteId: input.siteId ?? null,
    slot: input.slot ?? null,
    acceptedAt,
    startedAt: null,
    finishedAt: null,
    result: null,
    error: null,
  };

  inMemoryJobs.set(job.id, job);

  if (canUseDb()) {
    await ensureJobsTable();
    await query(
      `
      INSERT INTO directoryiq_jobs
        (id, req_id, user_id, kind, status, stage, listing_id, site_id, slot, accepted_at, started_at, finished_at, result_json, error_json)
      VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::timestamptz, $11::timestamptz, $12::timestamptz, $13::jsonb, $14::jsonb)
      ON CONFLICT (id) DO UPDATE SET
        req_id = EXCLUDED.req_id,
        user_id = EXCLUDED.user_id,
        kind = EXCLUDED.kind,
        status = EXCLUDED.status,
        stage = EXCLUDED.stage,
        listing_id = EXCLUDED.listing_id,
        site_id = EXCLUDED.site_id,
        slot = EXCLUDED.slot,
        accepted_at = EXCLUDED.accepted_at,
        started_at = EXCLUDED.started_at,
        finished_at = EXCLUDED.finished_at,
        result_json = EXCLUDED.result_json,
        error_json = EXCLUDED.error_json
      `,
      [
        job.id,
        job.reqId,
        job.userId,
        job.kind,
        job.status,
        job.stage,
        job.listingId,
        job.siteId,
        job.slot,
        job.acceptedAt,
        job.startedAt,
        job.finishedAt,
        job.result ? JSON.stringify(job.result) : null,
        job.error ? JSON.stringify(job.error) : null,
      ]
    );
  }

  return job;
}

export async function updateDirectoryIqJob(jobId: string, patch: UpdateDirectoryIqJobInput): Promise<DirectoryIqJobRecord | null> {
  const current = inMemoryJobs.get(jobId);
  if (!current) return null;

  const next: DirectoryIqJobRecord = {
    ...current,
    status: patch.status ?? current.status,
    stage: patch.stage ?? current.stage,
    startedAt: patch.startedAt === undefined ? current.startedAt : patch.startedAt,
    finishedAt: patch.finishedAt === undefined ? current.finishedAt : patch.finishedAt,
    result: patch.result === undefined ? current.result : patch.result,
    error: patch.error === undefined ? current.error : patch.error,
  };

  inMemoryJobs.set(jobId, next);

  if (canUseDb()) {
    await ensureJobsTable();
    await query(
      `
      UPDATE directoryiq_jobs
      SET status = $2,
          stage = $3,
          started_at = $4::timestamptz,
          finished_at = $5::timestamptz,
          result_json = $6::jsonb,
          error_json = $7::jsonb
      WHERE id = $1
      `,
      [
        jobId,
        next.status,
        next.stage,
        next.startedAt,
        next.finishedAt,
        next.result ? JSON.stringify(next.result) : null,
        next.error ? JSON.stringify(next.error) : null,
      ]
    );
  }

  return next;
}

export async function getDirectoryIqJobForUser(jobId: string, userId: string): Promise<DirectoryIqJobRecord | null> {
  const memory = inMemoryJobs.get(jobId);
  if (memory && memory.userId === userId) return memory;

  if (!canUseDb()) return null;
  await ensureJobsTable();
  const rows = await query<DirectoryIqJobRow>(
    `
    SELECT id, req_id, user_id, kind, status, stage, listing_id, site_id, slot, accepted_at, started_at, finished_at, result_json, error_json
    FROM directoryiq_jobs
    WHERE id = $1 AND user_id = $2
    LIMIT 1
    `,
    [jobId, userId]
  );

  if (!rows[0]) return null;
  const mapped = mapRow(rows[0]);
  inMemoryJobs.set(jobId, mapped);
  return mapped;
}

export function runDirectoryIqJob<T>(job: DirectoryIqJobRecord, input: RunDirectoryIqJobInput<T>): void {
  const startMs = Date.now();
  logJobEvent({
    routeOrigin: input.routeOrigin,
    reqId: job.reqId,
    jobId: job.id,
    listingId: job.listingId,
    siteId: job.siteId,
    slot: job.slot,
    phase: "submission",
    stage: "queued",
    runtimeOwner: input.runtimeOwner,
    elapsedMs: 0,
  });

  void (async () => {
    await updateDirectoryIqJob(job.id, {
      status: "running",
      stage: input.startedStage,
      startedAt: new Date().toISOString(),
    });

    logJobEvent({
      routeOrigin: input.routeOrigin,
      reqId: job.reqId,
      jobId: job.id,
      listingId: job.listingId,
      siteId: job.siteId,
      slot: job.slot,
      phase: "stage_transition",
      stage: input.startedStage,
      runtimeOwner: input.runtimeOwner,
      elapsedMs: Date.now() - startMs,
    });

    try {
      const result = await input.processor({
        setStage: async (stage: string) => {
          await updateDirectoryIqJob(job.id, { stage });
          logJobEvent({
            routeOrigin: input.routeOrigin,
            reqId: job.reqId,
            jobId: job.id,
            listingId: job.listingId,
            siteId: job.siteId,
            slot: job.slot,
            phase: "stage_transition",
            stage,
            runtimeOwner: input.runtimeOwner,
            elapsedMs: Date.now() - startMs,
          });
        },
      });

      await updateDirectoryIqJob(job.id, {
        status: "succeeded",
        stage: "ready",
        finishedAt: new Date().toISOString(),
        result: result as Record<string, unknown>,
      });

      logJobEvent({
        routeOrigin: input.routeOrigin,
        reqId: job.reqId,
        jobId: job.id,
        listingId: job.listingId,
        siteId: job.siteId,
        slot: job.slot,
        phase: "final_success",
        stage: "ready",
        runtimeOwner: input.runtimeOwner,
        elapsedMs: Date.now() - startMs,
      });
    } catch (error) {
      const normalizedError = normalizeError(error);
      await updateDirectoryIqJob(job.id, {
        status: "failed",
        stage: "failed",
        finishedAt: new Date().toISOString(),
        error: normalizedError,
      });
      logJobEvent({
        routeOrigin: input.routeOrigin,
        reqId: job.reqId,
        jobId: job.id,
        listingId: job.listingId,
        siteId: job.siteId,
        slot: job.slot,
        phase: "final_failure",
        stage: "failed",
        code: normalizedError.code,
        codeFamily: normalizedError.codeFamily,
        runtimeOwner: input.runtimeOwner,
        elapsedMs: Date.now() - startMs,
      });
    }
  })();
}

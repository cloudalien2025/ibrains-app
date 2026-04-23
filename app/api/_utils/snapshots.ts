import { runDirectoryIqFullIngest } from "@/app/api/directoryiq/_utils/ingest";
import { listBdSites } from "@/app/api/directoryiq/_utils/bdSites";
import { hasCanonicalDirectoryIqConnection } from "@/app/api/directoryiq/_utils/connectedState";
import { query } from "@/app/api/ecomviper/_utils/db";
import {
  type SnapshotBrainId,
  type SnapshotMetric,
  type SnapshotResponse,
  type SnapshotStatus,
  SNAPSHOT_LOCK_TTL_MS,
  metricTemplate,
  withMetricState,
} from "@/lib/snapshots/types";

type SnapshotRow = {
  brain_id: SnapshotBrainId;
  snapshot_json: SnapshotResponse["metrics"] | null;
  snapshot_status: SnapshotStatus;
  snapshot_updated_at: string | null;
  hints_json: string[] | null;
  last_error: string | null;
};

type CountRow = {
  listings: number;
  blog_posts: number;
};

function cleanError(message: unknown): string | null {
  if (!message || typeof message !== "string") return null;
  return message.slice(0, 240);
}

export async function hasDirectoryIqConnection(userId: string): Promise<boolean> {
  const sites = await listBdSites(userId);
  return hasCanonicalDirectoryIqConnection(sites);
}

export async function getSnapshot(userId: string, brainId: SnapshotBrainId): Promise<SnapshotResponse> {
  const rows = await query<SnapshotRow>(
    `
    SELECT brain_id, snapshot_json, snapshot_status, snapshot_updated_at, hints_json, last_error
    FROM brain_snapshots
    WHERE user_id = $1 AND brain_id = $2
    LIMIT 1
    `,
    [userId, brainId]
  );

  const row = rows[0];
  if (!row) {
    return {
      brain_id: brainId,
      status: "needs_connection",
      updated_at: null,
      metrics: metricTemplate(brainId, "loading"),
      hints: [],
      last_error: null,
    };
  }

  return {
    brain_id: brainId,
    status: row.snapshot_status,
    updated_at: row.snapshot_updated_at,
    metrics:
      row.snapshot_json && Array.isArray(row.snapshot_json)
        ? withMetricState(row.snapshot_json, row.snapshot_status === "updating" ? "stale" : "ready")
        : metricTemplate(brainId, row.snapshot_status === "updating" ? "stale" : "loading"),
    hints: row.hints_json ?? [],
    last_error: row.last_error,
  };
}

async function upsertSnapshot(userId: string, payload: SnapshotResponse): Promise<void> {
  await query(
    `
    INSERT INTO brain_snapshots (
      user_id, brain_id, snapshot_json, snapshot_status, snapshot_updated_at, hints_json, last_error, updated_at
    ) VALUES ($1, $2, $3::jsonb, $4, $5, $6::jsonb, $7, now())
    ON CONFLICT (user_id, brain_id)
    DO UPDATE SET
      snapshot_json = EXCLUDED.snapshot_json,
      snapshot_status = EXCLUDED.snapshot_status,
      snapshot_updated_at = EXCLUDED.snapshot_updated_at,
      hints_json = EXCLUDED.hints_json,
      last_error = EXCLUDED.last_error,
      updated_at = now()
    `,
    [
      userId,
      payload.brain_id,
      JSON.stringify(payload.metrics),
      payload.status,
      payload.updated_at,
      JSON.stringify(payload.hints ?? []),
      payload.last_error ?? null,
    ]
  );
}

async function setSnapshotStatus(
  userId: string,
  brainId: SnapshotBrainId,
  status: SnapshotStatus,
  lastError: string | null
): Promise<void> {
  const existing = await getSnapshot(userId, brainId);
  const metrics = existing.metrics.length > 0 ? existing.metrics : metricTemplate(brainId, "loading");
  await upsertSnapshot(userId, {
    brain_id: brainId,
    status,
    updated_at: existing.updated_at,
    metrics: status === "updating" ? withMetricState(metrics, "stale") : metrics,
    hints: existing.hints ?? [],
    last_error: lastError,
  });
}

async function acquireRefreshLock(userId: string, brainId: SnapshotBrainId): Promise<boolean> {
  const rows = await query<{ user_id: string }>(
    `
    INSERT INTO snapshot_refresh_locks (user_id, brain_id, locked_until, updated_at)
    VALUES ($1, $2, now() + ($3 || ' milliseconds')::interval, now())
    ON CONFLICT (user_id, brain_id)
    DO UPDATE SET
      locked_until = EXCLUDED.locked_until,
      updated_at = now()
    WHERE snapshot_refresh_locks.locked_until < now()
    RETURNING user_id
    `,
    [userId, brainId, String(SNAPSHOT_LOCK_TTL_MS)]
  );

  return rows.length > 0;
}

async function releaseRefreshLock(userId: string, brainId: SnapshotBrainId): Promise<void> {
  await query(`DELETE FROM snapshot_refresh_locks WHERE user_id = $1 AND brain_id = $2`, [userId, brainId]);
}

async function computeDirectoryIqSnapshot(userId: string, runIngest: boolean): Promise<SnapshotResponse> {
  const connected = await hasDirectoryIqConnection(userId);
  if (!connected) {
    return {
      brain_id: "directoryiq",
      status: "needs_connection",
      updated_at: null,
      metrics: metricTemplate("directoryiq", "loading"),
      hints: ["Connect your Brilliant Directories Website to start analysis."],
      last_error: null,
    };
  }

  let runError: string | null = null;
  if (runIngest) {
    const runResult = await runDirectoryIqFullIngest(userId);
    if (runResult.status === "failed") {
      runError = cleanError(runResult.errorMessage ?? "DirectoryIQ analysis failed.");
    }
  }

  const countRows = await query<CountRow>(
    `
    SELECT
      COUNT(*) FILTER (WHERE source_type = 'listing')::int AS listings,
      COUNT(*) FILTER (WHERE source_type = 'blog_post')::int AS blog_posts
    FROM directoryiq_nodes
    WHERE user_id = $1
    `,
    [userId]
  );

  const counts = countRows[0] ?? { listings: 0, blog_posts: 0 };
  const latestRun = await query<{ status: string; error_message: string | null }>(
    `
    SELECT status, error_message
    FROM directoryiq_ingest_runs
    WHERE user_id = $1
    ORDER BY started_at DESC
    LIMIT 1
    `,
    [userId]
  );

  const latestStatus = latestRun[0]?.status ?? "pending";
  const latestError = cleanError(latestRun[0]?.error_message ?? runError);

  const metrics: SnapshotMetric[] = [
    {
      key: "travel_selection_readiness",
      label: "Travel Selection Readiness",
      value: counts.listings > 0 ? "Connected" : "Awaiting listing data",
      state: "ready",
    },
    {
      key: "listings_optimized_total",
      label: "Listings Optimized / Total",
      value: `${counts.listings}/${counts.listings}`,
      state: "ready",
    },
    {
      key: "authority_gaps",
      label: "Authority Gaps",
      value: Math.max(0, counts.listings - counts.blog_posts),
      state: "ready",
    },
    {
      key: "monetization_opportunities",
      label: "Monetization Opportunities",
      value: counts.listings,
      state: "ready",
    },
    {
      key: "lead_capture_opportunities",
      label: "Lead Capture Opportunities",
      value: counts.listings,
      state: "ready",
    },
    {
      key: "schema_integrity",
      label: "Schema Integrity",
      value: latestStatus === "succeeded" ? "Synced" : "Pending",
      state: "ready",
    },
  ];

  return {
    brain_id: "directoryiq",
    status: latestError ? "error" : "up_to_date",
    updated_at: new Date().toISOString(),
    metrics,
    hints: [
      "Snapshot updates in the background while you continue working.",
      "Select a listing to continue optimization planning.",
    ],
    last_error: latestError,
  };
}

export async function scheduleSnapshotRefresh(params: {
  userId: string;
  brainId: SnapshotBrainId;
  runIngest?: boolean;
}): Promise<{ status: "updating" | "locked" | "needs_connection" }> {
  const { userId, brainId, runIngest = true } = params;

  const connected = await hasDirectoryIqConnection(userId);

  if (!connected) {
    await upsertSnapshot(userId, {
      brain_id: brainId,
      status: "needs_connection",
      updated_at: null,
      metrics: metricTemplate(brainId, "loading"),
      hints: ["Connect your Brilliant Directories Website to start analysis."],
      last_error: null,
    });
    return { status: "needs_connection" };
  }

  const acquired = await acquireRefreshLock(userId, brainId);
  if (!acquired) return { status: "locked" };

  await setSnapshotStatus(userId, brainId, "updating", null);

  setImmediate(async () => {
    try {
      const snapshot = await computeDirectoryIqSnapshot(userId, runIngest);
      await upsertSnapshot(userId, snapshot);
    } catch (error) {
      const message = cleanError(error instanceof Error ? error.message : "Unknown snapshot refresh error");
      await setSnapshotStatus(userId, brainId, "error", message);
    } finally {
      await releaseRefreshLock(userId, brainId);
    }
  });

  return { status: "updating" };
}

import { runDirectoryIqFullIngest } from "@/app/api/directoryiq/_utils/ingest";
import { runFullShopifyIngest } from "@/app/api/ecomviper/_utils/ingest";
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

type DirectoryCredentialRow = {
  connector_id: string;
  config_json: { base_url?: string } | null;
};

type IntegrationRow = {
  id: string;
  shop_domain: string;
};

type CountRow = {
  listings: number;
  blog_posts: number;
};

type EcomCounts = {
  products: number;
  articles: number;
  pages: number;
  collections: number;
};

function cleanError(message: unknown): string | null {
  if (!message || typeof message !== "string") return null;
  return message.slice(0, 240);
}

export async function hasDirectoryIqConnection(userId: string): Promise<boolean> {
  const rows = await query<DirectoryCredentialRow>(
    `
    SELECT connector_id, config_json
    FROM directoryiq_signal_source_credentials
    WHERE user_id = $1 AND connector_id = 'brilliant_directories_api'
    LIMIT 1
    `,
    [userId]
  );

  const row = rows[0];
  if (!row) return false;
  const baseUrl = row.config_json?.base_url;
  return typeof baseUrl === "string" && baseUrl.trim().length > 0;
}

export async function getLatestShopifyIntegration(userId: string): Promise<IntegrationRow | null> {
  const rows = await query<IntegrationRow>(
    `
    SELECT id, shop_domain
    FROM integrations
    WHERE user_id = $1 AND provider = 'shopify' AND status = 'connected'
    ORDER BY updated_at DESC
    LIMIT 1
    `,
    [userId]
  );
  return rows[0] ?? null;
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
        ? withMetricState(
            row.snapshot_json,
            row.snapshot_status === "updating" ? "stale" : "ready"
          )
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
  const ttlMs = SNAPSHOT_LOCK_TTL_MS;
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
    [userId, brainId, String(ttlMs)]
  );

  return rows.length > 0;
}

async function releaseRefreshLock(userId: string, brainId: SnapshotBrainId): Promise<void> {
  await query(
    `DELETE FROM snapshot_refresh_locks WHERE user_id = $1 AND brain_id = $2`,
    [userId, brainId]
  );
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

async function computeEcomViperSnapshot(userId: string, runIngest: boolean): Promise<SnapshotResponse> {
  const integration = await getLatestShopifyIntegration(userId);
  if (!integration) {
    return {
      brain_id: "ecomviper",
      status: "needs_connection",
      updated_at: null,
      metrics: metricTemplate("ecomviper", "loading"),
      hints: ["Connect your Shopify Store to start analysis."],
      last_error: null,
    };
  }

  let runError: string | null = null;
  if (runIngest) {
    const runResult = await runFullShopifyIngest({ userId, integrationId: integration.id });
    if (runResult.status === "failed") {
      runError = cleanError(runResult.errorMessage ?? "Shopify analysis failed.");
    }
  }

  const countsRows = await query<EcomCounts>(
    `
    SELECT
      COUNT(*) FILTER (WHERE node_type = 'product')::int AS products,
      COUNT(*) FILTER (WHERE node_type = 'article')::int AS articles,
      COUNT(*) FILTER (WHERE node_type = 'page')::int AS pages,
      COUNT(*) FILTER (WHERE node_type = 'collection')::int AS collections
    FROM site_nodes
    WHERE user_id = $1 AND integration_id = $2
    `,
    [userId, integration.id]
  );

  const counts = countsRows[0] ?? { products: 0, articles: 0, pages: 0, collections: 0 };
  const latestRun = await query<{ status: string; error_message: string | null }>(
    `
    SELECT status, error_message
    FROM ingest_runs
    WHERE user_id = $1 AND integration_id = $2
    ORDER BY started_at DESC
    LIMIT 1
    `,
    [userId, integration.id]
  );
  const latestStatus = latestRun[0]?.status ?? "pending";
  const latestError = cleanError(latestRun[0]?.error_message ?? runError);

  const metrics: SnapshotMetric[] = [
    {
      key: "product_selection_readiness",
      label: "Product Selection Readiness",
      value: counts.products > 0 ? "Connected" : "Awaiting product data",
      state: "ready",
    },
    {
      key: "products_optimized_total",
      label: "Products Optimized / Total",
      value: `${counts.products}/${counts.products}`,
      state: "ready",
    },
    {
      key: "differentiation_gaps",
      label: "Differentiation Gaps",
      value: Math.max(0, counts.products - counts.articles),
      state: "ready",
    },
    {
      key: "trust_infrastructure_gaps",
      label: "Trust Infrastructure Gaps",
      value: Math.max(0, counts.products - counts.pages),
      state: "ready",
    },
    {
      key: "evidence_social_proof_gaps",
      label: "Evidence/Social Proof Gaps",
      value: Math.max(0, counts.products - counts.articles),
      state: "ready",
    },
    {
      key: "compliance_risk_flags_count",
      label: "Compliance/Risk Flags Count (aggregate)",
      value: latestError ? 1 : 0,
      state: "ready",
    },
  ];

  return {
    brain_id: "ecomviper",
    status: latestError || latestStatus === "failed" ? "error" : "up_to_date",
    updated_at: new Date().toISOString(),
    metrics,
    hints: [
      "Snapshot refreshes in the background while you review products.",
      "Select a product to continue optimization planning.",
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

  const connected =
    brainId === "directoryiq"
      ? await hasDirectoryIqConnection(userId)
      : Boolean(await getLatestShopifyIntegration(userId));

  if (!connected) {
    await upsertSnapshot(userId, {
      brain_id: brainId,
      status: "needs_connection",
      updated_at: null,
      metrics: metricTemplate(brainId, "loading"),
      hints:
        brainId === "directoryiq"
          ? ["Connect your Brilliant Directories Website to start analysis."]
          : ["Connect your Shopify Store to start analysis."],
      last_error: null,
    });
    return { status: "needs_connection" };
  }

  const acquired = await acquireRefreshLock(userId, brainId);
  if (!acquired) {
    return { status: "locked" };
  }

  await setSnapshotStatus(userId, brainId, "updating", null);

  setImmediate(async () => {
    try {
      const snapshot =
        brainId === "directoryiq"
          ? await computeDirectoryIqSnapshot(userId, runIngest)
          : await computeEcomViperSnapshot(userId, runIngest);
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

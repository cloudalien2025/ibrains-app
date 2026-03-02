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

type ConnectedSiteRow = {
  id: string;
  connection_type: "bd" | "shopify" | "sitemap";
  base_url: string;
  status: string;
  last_error: string | null;
  last_analyzed_at: string | null;
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

type SurfaceCounts = {
  total_surfaces: number;
  blog_surfaces: number;
  product_surfaces: number;
  listing_like_surfaces: number;
  schema_surfaces: number;
  trust_surfaces: number;
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
  const hasBd = Boolean(row && typeof row.config_json?.base_url === "string" && row.config_json?.base_url.trim().length > 0);
  if (hasBd) return true;
  const sitemapRows = await query<{ id: string }>(
    `
    SELECT id
    FROM connected_sites
    WHERE user_id = $1
      AND brain_id = 'directoryiq'
      AND connection_type = 'sitemap'
      AND status = 'connected'
    ORDER BY updated_at DESC
    LIMIT 1
    `,
    [userId]
  );
  return sitemapRows.length > 0;
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

export async function getLatestConnectedSite(userId: string, brainId: SnapshotBrainId): Promise<ConnectedSiteRow | null> {
  const rows = await query<ConnectedSiteRow>(
    `
    SELECT id, connection_type, base_url, status, last_error, last_analyzed_at
    FROM connected_sites
    WHERE user_id = $1 AND brain_id = $2 AND status IN ('connected', 'updating', 'error')
    ORDER BY updated_at DESC
    LIMIT 1
    `,
    [userId, brainId]
  );
  return rows[0] ?? null;
}

async function hasEcomViperConnection(userId: string): Promise<boolean> {
  const shopify = await getLatestShopifyIntegration(userId);
  if (shopify) return true;
  const site = await getLatestConnectedSite(userId, "ecomviper");
  return Boolean(site && site.connection_type === "sitemap" && site.status !== "error");
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
  const latestSite = await getLatestConnectedSite(userId, "directoryiq");
  const connected = await hasDirectoryIqConnection(userId);
  if (!connected) {
    return {
      brain_id: "directoryiq",
      status: "needs_connection",
      updated_at: null,
      metrics: metricTemplate("directoryiq", "loading"),
      connection_type: null,
      hints: ["Connect your Brilliant Directories Website or connect a website via sitemap to start analysis."],
      last_error: null,
    };
  }

  if (latestSite?.connection_type === "sitemap") {
    const rows = await query<SurfaceCounts>(
      `
      SELECT
        COUNT(*)::int AS total_surfaces,
        COUNT(*) FILTER (WHERE type = 'blog')::int AS blog_surfaces,
        COUNT(*) FILTER (WHERE type = 'product')::int AS product_surfaces,
        COUNT(*) FILTER (WHERE type = 'listing_like')::int AS listing_like_surfaces,
        COUNT(*) FILTER (WHERE jsonld_blobs IS NOT NULL AND jsonb_array_length(jsonld_blobs) > 0)::int AS schema_surfaces,
        COUNT(*) FILTER (
          WHERE url ~* '/contact|/about|/returns|/refund|/shipping|/privacy|/terms|/policy'
        )::int AS trust_surfaces
      FROM surfaces
      WHERE user_id = $1 AND brain_id = 'directoryiq' AND connected_site_id = $2
      `,
      [userId, latestSite.id]
    );

    const counts = rows[0] ?? {
      total_surfaces: 0,
      blog_surfaces: 0,
      product_surfaces: 0,
      listing_like_surfaces: 0,
      schema_surfaces: 0,
      trust_surfaces: 0,
    };
    const schemaPercent =
      counts.total_surfaces > 0
        ? Math.round((counts.schema_surfaces / counts.total_surfaces) * 100)
        : 0;
    const lastAnalyzed = latestSite.last_analyzed_at ?? new Date().toISOString();

    return {
      brain_id: "directoryiq",
      status: latestSite.status === "error" ? "error" : latestSite.status === "updating" ? "updating" : "up_to_date",
      updated_at: lastAnalyzed,
      connection_type: "sitemap",
      metrics: [
        { key: "total_surfaces_count", label: "Total Surfaces", value: counts.total_surfaces, state: "ready" },
        { key: "blog_surfaces_count", label: "Blog Surfaces", value: counts.blog_surfaces, state: "ready" },
        { key: "listing_like_count", label: "Listing-like Surfaces", value: counts.listing_like_surfaces, state: "ready" },
        { key: "schema_coverage_percent", label: "Schema Coverage %", value: schemaPercent, unit: "%", state: "ready" },
        { key: "last_analyzed", label: "Last Analyzed", value: new Date(lastAnalyzed).toLocaleString(), state: "ready" },
        { key: "connection_type", label: "Connection Type", value: "Connected via Sitemap", state: "ready" },
      ],
      hints: [
        "Sitemap-derived surfaces power this snapshot.",
        "Open listings to run deeper optimization workflows.",
      ],
      last_error: latestSite.last_error ?? null,
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
      key: "total_surfaces_count",
      label: "Total Surfaces",
      value: counts.listings + counts.blog_posts,
      state: "ready",
    },
    {
      key: "blog_surfaces_count",
      label: "Blog Surfaces",
      value: counts.blog_posts,
      state: "ready",
    },
    {
      key: "listing_like_count",
      label: "Listing-like Surfaces",
      value: counts.listings,
      state: "ready",
    },
    {
      key: "schema_coverage_percent",
      label: "Schema Coverage %",
      value: latestStatus === "succeeded" && counts.listings > 0 ? 100 : 0,
      unit: "%",
      state: "ready",
    },
    {
      key: "last_analyzed",
      label: "Last Analyzed",
      value: new Date().toLocaleString(),
      state: "ready",
    },
    {
      key: "connection_type",
      label: "Connection Type",
      value: "Connected via Brilliant Directories",
      state: "ready",
    },
  ];

  return {
    brain_id: "directoryiq",
    status: latestError ? "error" : "up_to_date",
    updated_at: new Date().toISOString(),
    connection_type: "bd",
    metrics,
    hints: [
      "Snapshot updates in the background while you continue working.",
      "Select a listing to continue optimization planning.",
    ],
    last_error: latestError,
  };
}

async function computeEcomViperSnapshot(userId: string, runIngest: boolean): Promise<SnapshotResponse> {
  const latestSite = await getLatestConnectedSite(userId, "ecomviper");
  const integration = await getLatestShopifyIntegration(userId);
  if (!integration && !latestSite) {
    return {
      brain_id: "ecomviper",
      status: "needs_connection",
      updated_at: null,
      metrics: metricTemplate("ecomviper", "loading"),
      connection_type: null,
      hints: ["Connect your Shopify Store or connect a website via sitemap to start analysis."],
      last_error: null,
    };
  }

  if (!integration && latestSite?.connection_type === "sitemap") {
    const rows = await query<SurfaceCounts>(
      `
      SELECT
        COUNT(*)::int AS total_surfaces,
        COUNT(*) FILTER (WHERE type = 'blog')::int AS blog_surfaces,
        COUNT(*) FILTER (WHERE type = 'product')::int AS product_surfaces,
        COUNT(*) FILTER (WHERE type = 'listing_like')::int AS listing_like_surfaces,
        COUNT(*) FILTER (WHERE jsonld_blobs IS NOT NULL AND jsonb_array_length(jsonld_blobs) > 0)::int AS schema_surfaces,
        COUNT(*) FILTER (
          WHERE url ~* '/contact|/about|/returns|/refund|/shipping|/privacy|/terms|/policy'
        )::int AS trust_surfaces
      FROM surfaces
      WHERE user_id = $1 AND brain_id = 'ecomviper' AND connected_site_id = $2
      `,
      [userId, latestSite.id]
    );

    const counts = rows[0] ?? {
      total_surfaces: 0,
      blog_surfaces: 0,
      product_surfaces: 0,
      listing_like_surfaces: 0,
      schema_surfaces: 0,
      trust_surfaces: 0,
    };
    const schemaPercent =
      counts.total_surfaces > 0
        ? Math.round((counts.schema_surfaces / counts.total_surfaces) * 100)
        : 0;
    const lastAnalyzed = latestSite.last_analyzed_at ?? new Date().toISOString();
    return {
      brain_id: "ecomviper",
      status: latestSite.status === "error" ? "error" : latestSite.status === "updating" ? "updating" : "up_to_date",
      updated_at: lastAnalyzed,
      connection_type: "sitemap",
      metrics: [
        { key: "total_surfaces_count", label: "Total Surfaces", value: counts.total_surfaces, state: "ready" },
        { key: "product_surfaces_count", label: "Product Surfaces", value: counts.product_surfaces, state: "ready" },
        { key: "blog_surfaces_count", label: "Blog Surfaces", value: counts.blog_surfaces, state: "ready" },
        { key: "trust_surfaces_present", label: "Trust Surfaces Present", value: counts.trust_surfaces > 0 ? "Yes" : "No", state: "ready" },
        { key: "schema_coverage_percent", label: "Schema Coverage %", value: schemaPercent, unit: "%", state: "ready" },
        { key: "last_analyzed", label: "Last Analyzed", value: new Date(lastAnalyzed).toLocaleString(), state: "ready" },
      ],
      hints: [
        "Sitemap-derived inventory powers product discovery signals.",
        "Connect Shopify anytime for full catalog ingest as primary.",
      ],
      last_error: latestSite.last_error ?? null,
    };
  }

  if (!integration) {
    throw new Error("No connected Shopify integration");
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
      key: "total_surfaces_count",
      label: "Total Surfaces",
      value: counts.products + counts.articles + counts.pages + counts.collections,
      state: "ready",
    },
    {
      key: "product_surfaces_count",
      label: "Product Surfaces",
      value: counts.products,
      state: "ready",
    },
    {
      key: "blog_surfaces_count",
      label: "Blog Surfaces",
      value: counts.articles,
      state: "ready",
    },
    {
      key: "trust_surfaces_present",
      label: "Trust Surfaces Present",
      value: counts.pages > 0 ? "Yes" : "No",
      state: "ready",
    },
    {
      key: "schema_coverage_percent",
      label: "Schema Coverage %",
      value: latestStatus === "succeeded" && counts.products > 0 ? 100 : 0,
      unit: "%",
      state: "ready",
    },
    {
      key: "last_analyzed",
      label: "Last Analyzed",
      value: new Date().toLocaleString(),
      state: "ready",
    },
  ];

  return {
    brain_id: "ecomviper",
    status: latestError || latestStatus === "failed" ? "error" : "up_to_date",
    updated_at: new Date().toISOString(),
    connection_type: "shopify",
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
      : await hasEcomViperConnection(userId);

  if (!connected) {
    await upsertSnapshot(userId, {
      brain_id: brainId,
      status: "needs_connection",
      updated_at: null,
      metrics: metricTemplate(brainId, "loading"),
      hints:
        brainId === "directoryiq"
          ? ["Connect your Brilliant Directories Website or connect a website via sitemap to start analysis."]
          : ["Connect your Shopify Store or connect a website via sitemap to start analysis."],
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

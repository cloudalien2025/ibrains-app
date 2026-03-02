import { query } from "@/app/api/ecomviper/_utils/db";
import { decryptSecret } from "@/app/api/ecomviper/_utils/crypto";
import { getDirectoryIqIntegrationSecret } from "@/app/api/directoryiq/_utils/credentials";
import { resolveSitemaps } from "@/lib/ingest/sitemap/resolveSitemaps";
import { crawlSurfaces } from "@/lib/ingest/sitemap/crawlSurfaces";
import { runSerpApiDiscovery } from "@/lib/ingest/sitemap/serpDiscovery";
import { normalizeAbsoluteUrl, normalizeBaseUrl, urlHash } from "@/lib/ingest/sitemap/urlUtils";
import type { BrainId, CrawlStage, SurfaceType } from "@/lib/ingest/sitemap/types";
import { scheduleSnapshotRefresh } from "@/app/api/_utils/snapshots";

type ConnectionType = "bd" | "shopify" | "sitemap";

type ConnectedSiteRow = {
  id: string;
  connection_type: ConnectionType;
  base_url: string;
  sitemap_url_used: string | null;
  robots_txt_url: string | null;
  status: string;
  use_decodo: boolean;
  respect_robots: boolean;
  progress_stage: string;
  counts_json: Record<string, unknown> | null;
  last_error: string | null;
  last_analyzed_at: string | null;
  updated_at: string;
};

function safeJson(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function boundedText(value: string | null, max = 12_000): string | null {
  if (!value) return null;
  return value.slice(0, max);
}

function normalizeLastmod(value: string | null): string | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).toISOString();
}

export async function getLatestConnectedSite(userId: string, brainId: BrainId): Promise<ConnectedSiteRow | null> {
  const rows = await query<ConnectedSiteRow>(
    `
    SELECT
      id,
      connection_type,
      base_url,
      sitemap_url_used,
      robots_txt_url,
      status,
      use_decodo,
      respect_robots,
      progress_stage,
      counts_json,
      last_error,
      last_analyzed_at,
      updated_at
    FROM connected_sites
    WHERE user_id = $1 AND brain_id = $2 AND status IN ('connected', 'updating', 'error')
    ORDER BY updated_at DESC
    LIMIT 1
    `,
    [userId, brainId]
  );
  return rows[0] ?? null;
}

export async function createConnectedSite(params: {
  userId: string;
  brainId: BrainId;
  connectionType: ConnectionType;
  baseUrl: string;
  sitemapUrlUsed?: string | null;
  robotsTxtUrl?: string | null;
  useDecodo: boolean;
  respectRobots: boolean;
}): Promise<string> {
  const rows = await query<{ id: string }>(
    `
    INSERT INTO connected_sites
    (
      user_id, brain_id, connection_type, base_url, sitemap_url_used, robots_txt_url, status,
      use_decodo, respect_robots, progress_stage, counts_json, updated_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, 'updating', $7, $8, 'discovering_sitemap', '{}'::jsonb, now())
    RETURNING id
    `,
    [
      params.userId,
      params.brainId,
      params.connectionType,
      normalizeBaseUrl(params.baseUrl),
      params.sitemapUrlUsed ?? null,
      params.robotsTxtUrl ?? null,
      params.useDecodo,
      params.respectRobots,
    ]
  );
  return rows[0].id;
}

async function updateSiteProgress(params: {
  connectedSiteId: string;
  stage: CrawlStage;
  status?: "connected" | "updating" | "error";
  counts?: Record<string, unknown>;
  lastError?: string | null;
}): Promise<void> {
  await query(
    `
    UPDATE connected_sites
    SET
      progress_stage = $2,
      status = COALESCE($3, status),
      counts_json = COALESCE($4::jsonb, counts_json),
      last_error = $5,
      last_analyzed_at = CASE WHEN $3 = 'connected' THEN now() ELSE last_analyzed_at END,
      updated_at = now()
    WHERE id = $1
    `,
    [
      params.connectedSiteId,
      params.stage,
      params.status ?? null,
      params.counts ? JSON.stringify(params.counts) : null,
      params.lastError ?? null,
    ]
  );
}

async function getSerpApiKey(userId: string, brainId: BrainId): Promise<string | null> {
  if (brainId === "directoryiq") {
    const row = await getDirectoryIqIntegrationSecret(userId, "serpapi");
    return row?.secret?.trim() || null;
  }
  const rows = await query<{ key_ciphertext: string }>(
    `
    SELECT key_ciphertext
    FROM byo_api_keys
    WHERE user_id = $1 AND provider = 'serpapi'
    LIMIT 1
    `,
    [userId]
  );
  const ciphertext = rows[0]?.key_ciphertext;
  if (!ciphertext) return null;
  try {
    return decryptSecret(ciphertext, `${userId}:byo:serpapi`);
  } catch {
    return null;
  }
}

function parseTrustSignals(url: string): boolean {
  const path = new URL(url).pathname.toLowerCase();
  return ["/contact", "/about", "/returns", "/refund", "/shipping", "/privacy", "/terms", "/policy"].some((token) =>
    path.includes(token)
  );
}

function toSurfaceTypeCount(rows: Array<{ type: SurfaceType }>): Record<string, number> {
  return rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.type] = (acc[row.type] ?? 0) + 1;
    return acc;
  }, {});
}

async function persistSurfaces(params: {
  userId: string;
  brainId: BrainId;
  connectedSiteId: string;
  rows: Array<{
    url: string;
    lastmod: string | null;
    type: SurfaceType;
    httpStatus: number | null;
    title: string | null;
    metaDescription: string | null;
    h1: string | null;
    extractedText: string | null;
    jsonld: Array<Record<string, unknown>>;
    links: string[];
    canonicalUrl: string | null;
  }>;
}): Promise<void> {
  for (const row of params.rows) {
    await query(
      `
      INSERT INTO surfaces
      (
        user_id, brain_id, connected_site_id, url, url_hash, canonical_url, type, lastmod,
        http_status, title, meta_description, h1, extracted_text, jsonld_blobs,
        outbound_internal_links, fetched_at, updated_at
      )
      VALUES
      ($1, $2, $3, $4, $5, $6, $7, $8::timestamptz, $9, $10, $11, $12, $13, $14::jsonb, $15::jsonb, now(), now())
      ON CONFLICT (user_id, brain_id, url_hash)
      DO UPDATE SET
        connected_site_id = EXCLUDED.connected_site_id,
        canonical_url = EXCLUDED.canonical_url,
        type = EXCLUDED.type,
        lastmod = EXCLUDED.lastmod,
        http_status = EXCLUDED.http_status,
        title = EXCLUDED.title,
        meta_description = EXCLUDED.meta_description,
        h1 = EXCLUDED.h1,
        extracted_text = EXCLUDED.extracted_text,
        jsonld_blobs = EXCLUDED.jsonld_blobs,
        outbound_internal_links = EXCLUDED.outbound_internal_links,
        fetched_at = now(),
        updated_at = now()
      `,
      [
        params.userId,
        params.brainId,
        params.connectedSiteId,
        row.url,
        urlHash(row.url),
        row.canonicalUrl,
        row.type,
        normalizeLastmod(row.lastmod),
        row.httpStatus,
        row.title,
        row.metaDescription,
        row.h1,
        boundedText(row.extractedText),
        JSON.stringify(row.jsonld.slice(0, 15)),
        JSON.stringify(row.links.slice(0, 120)),
      ]
    );
  }
}

async function persistSerpRows(params: {
  userId: string;
  brainId: BrainId;
  connectedSiteId: string;
  rows: Array<{ query: string; results: Array<Record<string, unknown>> }>;
}): Promise<void> {
  if (!params.rows.length) return;
  await query(`DELETE FROM serp_competitors WHERE connected_site_id = $1`, [params.connectedSiteId]);
  for (const row of params.rows) {
    await query(
      `
      INSERT INTO serp_competitors (user_id, brain_id, connected_site_id, query, results_json)
      VALUES ($1, $2, $3, $4, $5::jsonb)
      `,
      [params.userId, params.brainId, params.connectedSiteId, row.query.slice(0, 180), JSON.stringify(row.results.slice(0, 10))]
    );
  }
}

export async function runSitemapConnectionJob(params: {
  userId: string;
  brainId: BrainId;
  connectedSiteId: string;
  baseUrl: string;
  sitemapOverride?: string | null;
  useDecodo: boolean;
  respectRobots: boolean;
}): Promise<void> {
  try {
    await updateSiteProgress({
      connectedSiteId: params.connectedSiteId,
      stage: "discovering_sitemap",
      status: "updating",
      counts: { discovered_urls: 0, fetched_surfaces: 0 },
    });

    const resolved = await resolveSitemaps({
      baseUrl: params.baseUrl,
      sitemapOverride: params.sitemapOverride ?? null,
      useDecodo: params.useDecodo,
      maxUrls: 5000,
      maxSitemaps: 25,
    });

    await query(
      `
      UPDATE connected_sites
      SET sitemap_url_used = $2, robots_txt_url = $3, updated_at = now()
      WHERE id = $1
      `,
      [params.connectedSiteId, resolved.sitemapUrlsUsed[0] ?? null, resolved.robotsTxtUrl]
    );

    await updateSiteProgress({
      connectedSiteId: params.connectedSiteId,
      stage: "parsing_sitemaps",
      status: "updating",
      counts: {
        discovered_urls: resolved.urls.length,
        fetched_surfaces: 0,
        sitemap_count: resolved.sitemapUrlsUsed.length,
      },
    });

    const crawled = await crawlSurfaces({
      baseUrl: resolved.baseUrl,
      urls: resolved.urls,
      respectRobots: params.respectRobots,
      useDecodo: params.useDecodo,
      maxPages: 180,
      concurrency: 4,
      delayMs: 250,
      onProgress: async (done, total) => {
        if (done % 10 !== 0 && done !== total) return;
        await updateSiteProgress({
          connectedSiteId: params.connectedSiteId,
          stage: "fetching_pages",
          status: "updating",
          counts: {
            discovered_urls: resolved.urls.length,
            fetched_surfaces: done,
            total_to_fetch: total,
          },
        });
      },
    });

    await updateSiteProgress({
      connectedSiteId: params.connectedSiteId,
      stage: "extracting_signals",
      status: "updating",
      counts: {
        discovered_urls: resolved.urls.length,
        fetched_surfaces: crawled.length,
      },
    });

    const normalizedRows = crawled.map((row) => ({
      url: row.url,
      lastmod: row.lastmod,
      type: row.type,
      httpStatus: row.signals?.httpStatus ?? null,
      title: row.signals?.title ?? null,
      metaDescription: row.signals?.metaDescription ?? null,
      h1: row.signals?.h1 ?? null,
      extractedText: row.signals?.extractedText ?? null,
      jsonld: row.signals?.jsonldBlobs ?? [],
      links: row.signals?.outboundInternalLinks ?? [],
      canonicalUrl: normalizeAbsoluteUrl(row.signals?.canonicalUrl ?? "") ?? null,
    }));

    await persistSurfaces({
      userId: params.userId,
      brainId: params.brainId,
      connectedSiteId: params.connectedSiteId,
      rows: normalizedRows,
    });

    const serpApiKey = await getSerpApiKey(params.userId, params.brainId);
    const serpRows = await runSerpApiDiscovery({
      baseUrl: resolved.baseUrl,
      serpApiKey,
      maxResultsPerQuery: 10,
    });
    await persistSerpRows({
      userId: params.userId,
      brainId: params.brainId,
      connectedSiteId: params.connectedSiteId,
      rows: serpRows.map((row) => ({
        query: row.query,
        results: row.results as Array<Record<string, unknown>>,
      })),
    });

    const byType = toSurfaceTypeCount(normalizedRows.map((row) => ({ type: row.type })));
    const schemaCount = normalizedRows.filter((row) => row.jsonld.length > 0).length;
    const trustSignals = normalizedRows.filter((row) => parseTrustSignals(row.url)).length;

    await updateSiteProgress({
      connectedSiteId: params.connectedSiteId,
      stage: "building_snapshot",
      status: "updating",
      counts: {
        discovered_urls: resolved.urls.length,
        fetched_surfaces: normalizedRows.length,
        schema_pages: schemaCount,
        serp_queries: serpRows.length,
      },
    });

    await updateSiteProgress({
      connectedSiteId: params.connectedSiteId,
      stage: "completed",
      status: "connected",
      counts: {
        discovered_urls: resolved.urls.length,
        fetched_surfaces: normalizedRows.length,
        schema_pages: schemaCount,
        trust_surfaces: trustSignals,
        by_type: byType,
        serp_queries: serpRows.length,
      },
      lastError: null,
    });

    await scheduleSnapshotRefresh({
      userId: params.userId,
      brainId: params.brainId,
      runIngest: false,
    });
  } catch (error) {
    await updateSiteProgress({
      connectedSiteId: params.connectedSiteId,
      stage: "error",
      status: "error",
      lastError: error instanceof Error ? error.message.slice(0, 240) : "Sitemap connection failed",
    });
    await scheduleSnapshotRefresh({
      userId: params.userId,
      brainId: params.brainId,
      runIngest: false,
    });
  }
}

export async function markPrimaryConnection(params: {
  userId: string;
  brainId: BrainId;
  connectionType: ConnectionType;
  baseUrl: string;
}): Promise<void> {
  await query(
    `
    INSERT INTO connected_sites
    (
      user_id, brain_id, connection_type, base_url, status, progress_stage, counts_json,
      use_decodo, respect_robots, last_analyzed_at, updated_at
    )
    VALUES ($1, $2, $3, $4, 'connected', 'completed', '{}'::jsonb, false, true, now(), now())
    `,
    [params.userId, params.brainId, params.connectionType, normalizeBaseUrl(params.baseUrl)]
  );
}

export function stageLabel(stage: string): string {
  const map: Record<string, string> = {
    discovering_sitemap: "Discovering sitemap...",
    parsing_sitemaps: "Parsing URLs...",
    fetching_pages: "Fetching key pages...",
    extracting_signals: "Extracting structured signals...",
    building_snapshot: "Building AI discovery snapshot...",
    completed: "Completed",
    error: "Error",
  };
  return map[stage] ?? "Analyzing...";
}

export function countsFromConnectedSite(
  row: { counts_json?: Record<string, unknown> | null } | null
): Record<string, unknown> {
  return safeJson(row?.counts_json ?? null);
}

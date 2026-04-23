import { queryDb } from "@/src/directoryiq/repositories/db";
import { scanLeakCandidates, type BlogScanInput, type ListingScanInput } from "@/src/directoryiq/leaks/leakScanner";
import { normalizePathForMatch, stripHtml } from "@/src/directoryiq/leaks/leakRules";
import { type LeakCandidate } from "@/src/directoryiq/leaks/leakTypes";

const LEAK_SCAN_RUN_TYPE = "leak_scan";

type DirectoryNodeRow = {
  source_id: string;
  title: string | null;
  url: string | null;
  raw_json: Record<string, unknown> | null;
  updated_at?: string | null;
};

type GraphNodeRow = {
  id: string;
  external_id: string;
  node_type: "listing" | "blog_post";
  canonical_url: string | null;
  title: string | null;
};

type EdgeRow = {
  from_node_id: string;
  to_node_id: string;
};

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function extractHtml(raw: Record<string, unknown>): string {
  const content = raw.content;
  if (typeof content === "string" && content.trim()) return content;
  if (content && typeof content === "object") {
    const rendered = asString((content as Record<string, unknown>).rendered);
    if (rendered.trim()) return rendered;
  }

  const candidates = [raw.body_html, raw.html, raw.post_content, raw.description, raw.excerpt];
  for (const candidate of candidates) {
    const value = asString(candidate);
    if (value.trim()) return value;
  }

  return "";
}

function extractPlainText(raw: Record<string, unknown>): string {
  const candidates = [
    raw.clean_text,
    raw.body,
    raw.post_content,
    raw.raw_html,
    raw.body_html,
    raw.content_html,
    raw.excerpt,
    raw.description,
    raw.summary,
    raw.title,
    raw.post_title,
    raw.content,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return stripHtml(candidate);
    }
  }

  const content = raw.content;
  if (content && typeof content === "object") {
    const rendered = asString((content as Record<string, unknown>).rendered);
    if (rendered.trim()) return stripHtml(rendered);
  }

  return "";
}

function extractListingPaths(raw: Record<string, unknown>): string[] {
  const slug = asString(
    raw.listing_slug ?? raw.group_filename ?? raw.slug ?? raw.path ?? raw.url_path ?? raw.permalink ?? ""
  );
  const normalized = normalizePathForMatch(slug);
  return normalized ? [normalized] : [];
}

async function loadListings(): Promise<DirectoryNodeRow[]> {
  return queryDb<DirectoryNodeRow>(
    `
    SELECT source_id, title, url, raw_json, updated_at
    FROM directoryiq_nodes
    WHERE source_type = 'listing'
    ORDER BY updated_at DESC
    `
  );
}

async function loadBlogPosts(params: { since?: string | null; sourceId?: string | null }): Promise<DirectoryNodeRow[]> {
  if (params.sourceId) {
    return queryDb<DirectoryNodeRow>(
      `
      SELECT source_id, title, url, raw_json, updated_at
      FROM directoryiq_nodes
      WHERE source_type = 'blog_post' AND source_id = $1
      ORDER BY updated_at DESC
      `,
      [params.sourceId]
    );
  }

  if (params.since) {
    return queryDb<DirectoryNodeRow>(
      `
      SELECT source_id, title, url, raw_json, updated_at
      FROM directoryiq_nodes
      WHERE source_type = 'blog_post' AND updated_at >= $1
      ORDER BY updated_at DESC
      `,
      [params.since]
    );
  }

  return queryDb<DirectoryNodeRow>(
    `
    SELECT source_id, title, url, raw_json, updated_at
    FROM directoryiq_nodes
    WHERE source_type = 'blog_post'
    ORDER BY updated_at DESC
    `
  );
}

async function loadGraphNodes(tenantId: string): Promise<GraphNodeRow[]> {
  return queryDb<GraphNodeRow>(
    `
    SELECT id, external_id, node_type, canonical_url, title
    FROM authority_graph_nodes
    WHERE tenant_id = $1 AND node_type = ANY($2)
    `,
    [tenantId, ["listing", "blog_post"]]
  );
}

async function resolveBlogExternalId(tenantId: string, blogNodeId: string): Promise<string | null> {
  const rows = await queryDb<{ external_id: string }>(
    `
    SELECT external_id
    FROM authority_graph_nodes
    WHERE tenant_id = $1 AND node_type = 'blog_post' AND id = $2
    LIMIT 1
    `,
    [tenantId, blogNodeId]
  );
  return rows[0]?.external_id ?? null;
}

async function loadExistingLinks(tenantId: string, blogNodeIds: string[]): Promise<EdgeRow[]> {
  if (blogNodeIds.length === 0) return [];
  return queryDb<EdgeRow>(
    `
    SELECT from_node_id, to_node_id
    FROM authority_graph_edges
    WHERE tenant_id = $1
      AND edge_type = 'internal_link'
      AND status = 'active'
      AND from_node_id = ANY($2::uuid[])
    `,
    [tenantId, blogNodeIds]
  );
}

async function createRun(tenantId: string): Promise<{ id: string }> {
  const rows = await queryDb<{ id: string }>(
    `
    INSERT INTO authority_graph_runs (tenant_id, run_type, status)
    VALUES ($1, $2, 'running')
    RETURNING id
    `,
    [tenantId, LEAK_SCAN_RUN_TYPE]
  );
  return rows[0];
}

async function finishRun(input: { runId: string; status: "success" | "error"; stats: Record<string, unknown>; error?: string }) {
  await queryDb(
    `
    UPDATE authority_graph_runs
    SET status = $2, stats = $3::jsonb, error = $4, completed_at = now()
    WHERE id = $1
    `,
    [input.runId, input.status, JSON.stringify(input.stats), input.error ?? null]
  );
}

async function getLastSuccessfulRun(tenantId: string): Promise<string | null> {
  const rows = await queryDb<{ completed_at: string | null }>(
    `
    SELECT completed_at
    FROM authority_graph_runs
    WHERE tenant_id = $1 AND run_type = $2 AND status = 'success'
    ORDER BY completed_at DESC
    LIMIT 1
    `,
    [tenantId, LEAK_SCAN_RUN_TYPE]
  );
  return rows[0]?.completed_at ?? null;
}

async function upsertLeaks(tenantId: string, leaks: LeakCandidate[]): Promise<{ inserted: number; updated: number }> {
  if (leaks.length === 0) return { inserted: 0, updated: 0 };

  const values: unknown[] = [];
  const placeholders: string[] = [];
  let idx = 1;

  for (const leak of leaks) {
    placeholders.push(
      `($${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}::jsonb, $${idx++}, now(), now())`
    );
    values.push(
      tenantId,
      leak.blogNodeId,
      leak.listingNodeId,
      leak.leakType,
      leak.severity,
      "open",
      JSON.stringify(leak.evidence ?? {}),
      leak.dedupeKey
    );
  }

  const rows = await queryDb<{ inserted: boolean }>(
    `
    INSERT INTO directoryiq_authority_leaks
      (tenant_id, blog_node_id, listing_node_id, leak_type, severity, status, evidence_json, dedupe_key, first_detected_at, last_detected_at)
    VALUES
      ${placeholders.join(",\n")}
    ON CONFLICT (tenant_id, dedupe_key)
    DO UPDATE SET
      blog_node_id = EXCLUDED.blog_node_id,
      listing_node_id = EXCLUDED.listing_node_id,
      leak_type = EXCLUDED.leak_type,
      severity = EXCLUDED.severity,
      evidence_json = EXCLUDED.evidence_json,
      last_detected_at = now(),
      status = CASE WHEN directoryiq_authority_leaks.status = 'ignored' THEN 'ignored' ELSE 'open' END,
      updated_at = now()
    RETURNING (xmax = 0) AS inserted
    `,
    values
  );

  const inserted = rows.filter((row) => row.inserted).length;
  return { inserted, updated: rows.length - inserted };
}

async function resolveLeaks(params: {
  tenantId: string;
  leakTypes: string[];
  dedupeKeys: string[];
  blogNodeIds: string[];
  resolveAll: boolean;
}): Promise<number> {
  if (params.leakTypes.length === 0) return 0;

  if (params.resolveAll) {
    const rows = await queryDb<{ id: string }>(
      `
      UPDATE directoryiq_authority_leaks
      SET status = 'resolved', updated_at = now()
      WHERE tenant_id = $1
        AND status = 'open'
        AND leak_type = ANY($2::text[])
        AND NOT (dedupe_key = ANY($3::text[]))
      RETURNING id
      `,
      [params.tenantId, params.leakTypes, params.dedupeKeys]
    );
    return rows.length;
  }

  if (params.blogNodeIds.length === 0) return 0;

  const rows = await queryDb<{ id: string }>(
    `
    UPDATE directoryiq_authority_leaks
    SET status = 'resolved', updated_at = now()
    WHERE tenant_id = $1
      AND status = 'open'
      AND leak_type = ANY($2::text[])
      AND blog_node_id = ANY($3::uuid[])
      AND NOT (dedupe_key = ANY($4::text[]))
    RETURNING id
    `,
    [params.tenantId, params.leakTypes, params.blogNodeIds, params.dedupeKeys]
  );
  return rows.length;
}

export async function runLeakScan(params: {
  tenantId: string;
  userId: string;
  scope: "all" | "changed" | "single_blog";
  blogNodeId?: string | null;
}): Promise<{
  runId: string;
  stats: {
    blogsScanned: number;
    leaksInserted: number;
    leaksUpdated: number;
    leaksResolved: number;
    durationMs: number;
  };
}> {
  const startedAt = Date.now();
  const run = await createRun(params.tenantId);

  try {
    const graphNodes = await loadGraphNodes(params.tenantId);
    const listingNodeByExternalId = new Map<string, GraphNodeRow>();
    const blogNodeByExternalId = new Map<string, GraphNodeRow>();
    const blogExternalByNodeId = new Map<string, string>();

    for (const node of graphNodes) {
      if (node.node_type === "listing") {
        listingNodeByExternalId.set(node.external_id, node);
      } else if (node.node_type === "blog_post") {
        blogNodeByExternalId.set(node.external_id, node);
        blogExternalByNodeId.set(node.id, node.external_id);
      }
    }

    let blogSourceId: string | null = null;
    if (params.scope === "single_blog") {
      const targetId = params.blogNodeId ?? "";
      blogSourceId = blogExternalByNodeId.get(targetId) ?? (await resolveBlogExternalId(params.tenantId, targetId));
      if (!blogSourceId) {
        throw new Error("Unable to resolve blog node for scan scope.");
      }
    }

    let since: string | null = null;
    if (params.scope === "changed") {
      since = await getLastSuccessfulRun(params.tenantId);
    }

    const listings = await loadListings();
    const blogs = await loadBlogPosts({ since, sourceId: blogSourceId });

    const listingInputs: ListingScanInput[] = listings
      .map((row) => {
        const graphNode = listingNodeByExternalId.get(row.source_id);
        if (!graphNode) return null;
        const raw = row.raw_json ?? {};
        const urlPaths = extractListingPaths(raw);
        return {
          nodeId: graphNode.id,
          externalId: row.source_id,
          title: row.title ?? graphNode.title,
          canonicalUrl: graphNode.canonical_url ?? row.url,
          urlPaths,
        } as ListingScanInput;
      })
      .filter((row): row is ListingScanInput => !!row);

    const blogInputs: BlogScanInput[] = blogs
      .map((row) => {
        const graphNode = blogNodeByExternalId.get(row.source_id);
        if (!graphNode) return null;
        const raw = row.raw_json ?? {};
        return {
          nodeId: graphNode.id,
          externalId: row.source_id,
          title: row.title ?? graphNode.title,
          canonicalUrl: graphNode.canonical_url ?? row.url,
          html: extractHtml(raw),
          text: extractPlainText(raw),
        } as BlogScanInput;
      })
      .filter((row): row is BlogScanInput => !!row);

    const blogNodeIds = blogInputs.map((blog) => blog.nodeId);
    const existingLinks = await loadExistingLinks(params.tenantId, blogNodeIds);

    const linkedByBlog = new Map<string, string[]>();
    for (const edge of existingLinks) {
      const list = linkedByBlog.get(edge.from_node_id) ?? [];
      list.push(edge.to_node_id);
      linkedByBlog.set(edge.from_node_id, list);
    }

    const scopedBlogs = blogInputs.map((blog) => ({
      ...blog,
      linkedListingIds: linkedByBlog.get(blog.nodeId) ?? [],
    }));

    const includeOrphans = params.scope === "all";
    const { leaks } = scanLeakCandidates({
      blogs: scopedBlogs,
      listings: listingInputs,
      includeOrphans,
    });

    const dedupeKeys = leaks.map((leak) => leak.dedupeKey);
    const upsertStats = await upsertLeaks(params.tenantId, leaks);

    const leakTypes = includeOrphans
      ? ["mention_without_link", "weak_anchor_text", "orphan_listing"]
      : ["mention_without_link", "weak_anchor_text"];

    const leaksResolved = await resolveLeaks({
      tenantId: params.tenantId,
      leakTypes,
      dedupeKeys,
      blogNodeIds,
      resolveAll: includeOrphans,
    });

    const stats = {
      blogsScanned: scopedBlogs.length,
      leaksInserted: upsertStats.inserted,
      leaksUpdated: upsertStats.updated,
      leaksResolved,
      durationMs: Date.now() - startedAt,
    };

    await finishRun({ runId: run.id, status: "success", stats });

    return { runId: run.id, stats };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Leak scan failed";
    await finishRun({
      runId: run.id,
      status: "error",
      stats: { blogsScanned: 0, leaksInserted: 0, leaksUpdated: 0, leaksResolved: 0, durationMs: Date.now() - startedAt },
      error: message,
    });
    throw error;
  }
}

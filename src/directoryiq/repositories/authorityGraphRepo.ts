import { queryDb } from "@/src/directoryiq/repositories/db";
import { EdgeType, NodeType } from "@/src/directoryiq/domain/authorityGraph";

type NodeRow = {
  id: string;
  tenant_id: string;
  node_type: NodeType;
  external_id: string;
  canonical_url: string | null;
  title: string | null;
};

type EdgeRow = {
  id: string;
};

type EvidenceRow = {
  source_url: string;
  target_url: string | null;
  anchor_text: string | null;
  context_snippet: string | null;
  dom_path: string | null;
  location_hint: string | null;
};

type IssueRow = {
  edge_id?: string;
  from_node_id?: string;
  from_external_id?: string;
  from_title?: string | null;
  from_canonical_url?: string | null;
  to_node_id: string;
  to_external_id: string;
  to_title: string | null;
  to_canonical_url: string | null;
  evidence_source_url?: string;
  evidence_target_url?: string | null;
  evidence_anchor_text?: string | null;
  evidence_context_snippet?: string | null;
  evidence_dom_path?: string | null;
  evidence_location_hint?: string | null;
};

type RunRow = {
  id: string;
  started_at: string;
};

export async function upsertNode(input: {
  tenantId: string;
  nodeType: NodeType;
  externalId: string;
  canonicalUrl?: string | null;
  title?: string | null;
  meta?: Record<string, unknown>;
}): Promise<NodeRow> {
  const rows = await queryDb<NodeRow>(
    `
    INSERT INTO authority_graph_nodes (tenant_id, node_type, external_id, canonical_url, title, meta)
    VALUES ($1, $2, $3, $4, $5, $6::jsonb)
    ON CONFLICT (tenant_id, node_type, external_id)
    DO UPDATE SET
      canonical_url = EXCLUDED.canonical_url,
      title = EXCLUDED.title,
      meta = EXCLUDED.meta,
      status = 'active',
      updated_at = now()
    RETURNING id, tenant_id, node_type, external_id, canonical_url, title
    `,
    [
      input.tenantId,
      input.nodeType,
      input.externalId,
      input.canonicalUrl ?? null,
      input.title ?? null,
      JSON.stringify(input.meta ?? {}),
    ]
  );

  return rows[0];
}

export async function upsertEdge(input: {
  tenantId: string;
  fromNodeId: string;
  toNodeId: string;
  edgeType: EdgeType;
  strength?: number;
  confidence?: number;
  status?: "active" | "resolved" | "ignored";
  firstSeenAt?: string;
  lastSeenAt?: string;
}): Promise<EdgeRow> {
  const rows = await queryDb<EdgeRow>(
    `
    INSERT INTO authority_graph_edges
      (tenant_id, from_node_id, to_node_id, edge_type, strength, confidence, status, first_seen_at, last_seen_at)
    VALUES
      ($1, $2, $3, $4, $5, $6, $7, $8::timestamptz, $9::timestamptz)
    ON CONFLICT (tenant_id, from_node_id, to_node_id, edge_type)
    DO UPDATE SET
      strength = EXCLUDED.strength,
      confidence = EXCLUDED.confidence,
      status = EXCLUDED.status,
      first_seen_at = LEAST(authority_graph_edges.first_seen_at, EXCLUDED.first_seen_at),
      last_seen_at = GREATEST(authority_graph_edges.last_seen_at, EXCLUDED.last_seen_at),
      updated_at = now()
    RETURNING id
    `,
    [
      input.tenantId,
      input.fromNodeId,
      input.toNodeId,
      input.edgeType,
      input.strength ?? 50,
      input.confidence ?? 80,
      input.status ?? "active",
      input.firstSeenAt ?? new Date().toISOString(),
      input.lastSeenAt ?? new Date().toISOString(),
    ]
  );

  return rows[0];
}

export async function addEvidence(input: {
  tenantId: string;
  edgeId: string;
  sourceUrl: string;
  targetUrl?: string | null;
  anchorText?: string | null;
  contextSnippet?: string | null;
  domPath?: string | null;
  locationHint?: "body" | "sidebar" | "footer" | "unknown";
  detectedAt?: string;
}): Promise<void> {
  await queryDb(
    `
    INSERT INTO authority_graph_evidence
      (tenant_id, edge_id, source_url, target_url, anchor_text, context_snippet, dom_path, location_hint, detected_at)
    VALUES
      ($1, $2, $3, $4, $5, $6, $7, $8, $9::timestamptz)
    `,
    [
      input.tenantId,
      input.edgeId,
      input.sourceUrl,
      input.targetUrl ?? null,
      input.anchorText ?? null,
      input.contextSnippet ?? null,
      input.domPath ?? null,
      input.locationHint ?? "unknown",
      input.detectedAt ?? new Date().toISOString(),
    ]
  );
}

export async function createRun(input: {
  tenantId: string;
  runType: "scan";
}): Promise<RunRow> {
  const rows = await queryDb<RunRow>(
    `
    INSERT INTO authority_graph_runs (tenant_id, run_type, status)
    VALUES ($1, $2, 'started')
    RETURNING id, started_at
    `,
    [input.tenantId, input.runType]
  );

  return rows[0];
}

export async function finishRun(input: {
  runId: string;
  status: "completed" | "failed";
  stats: Record<string, unknown>;
  error?: string;
}): Promise<void> {
  await queryDb(
    `
    UPDATE authority_graph_runs
    SET
      status = $2,
      stats = $3::jsonb,
      error = $4,
      completed_at = now()
    WHERE id = $1
    `,
    [input.runId, input.status, JSON.stringify(input.stats), input.error ?? null]
  );
}

export async function listOrphanListings(tenantId: string): Promise<IssueRow[]> {
  return queryDb<IssueRow>(
    `
    SELECT
      l.id AS to_node_id,
      l.external_id AS to_external_id,
      l.title AS to_title,
      l.canonical_url AS to_canonical_url
    FROM authority_graph_nodes l
    LEFT JOIN authority_graph_edges e
      ON e.tenant_id = l.tenant_id
     AND e.to_node_id = l.id
     AND e.edge_type = 'internal_link'
     AND e.status = 'active'
    LEFT JOIN authority_graph_nodes b
      ON b.id = e.from_node_id
     AND b.node_type = 'blog_post'
    WHERE l.tenant_id = $1
      AND l.node_type = 'listing'
      AND l.status = 'active'
    GROUP BY l.id, l.external_id, l.title, l.canonical_url
    HAVING COUNT(b.id) = 0
    ORDER BY l.title NULLS LAST, l.external_id
    `,
    [tenantId]
  );
}

export async function listMentionsWithoutLinks(tenantId: string): Promise<IssueRow[]> {
  return queryDb<IssueRow>(
    `
    SELECT
      e.id AS edge_id,
      b.id AS from_node_id,
      b.external_id AS from_external_id,
      b.title AS from_title,
      b.canonical_url AS from_canonical_url,
      l.id AS to_node_id,
      l.external_id AS to_external_id,
      l.title AS to_title,
      l.canonical_url AS to_canonical_url,
      ev.source_url AS evidence_source_url,
      ev.target_url AS evidence_target_url,
      ev.anchor_text AS evidence_anchor_text,
      ev.context_snippet AS evidence_context_snippet,
      ev.dom_path AS evidence_dom_path,
      ev.location_hint AS evidence_location_hint
    FROM authority_graph_edges e
    INNER JOIN authority_graph_nodes b
      ON b.id = e.from_node_id
    INNER JOIN authority_graph_nodes l
      ON l.id = e.to_node_id
    LEFT JOIN LATERAL (
      SELECT source_url, target_url, anchor_text, context_snippet, dom_path, location_hint
      FROM authority_graph_evidence ev
      WHERE ev.edge_id = e.id
      ORDER BY detected_at DESC
      LIMIT 1
    ) ev ON true
    WHERE e.tenant_id = $1
      AND e.edge_type = 'mention_without_link'
      AND e.status = 'active'
    ORDER BY e.last_seen_at DESC
    `,
    [tenantId]
  );
}

export async function listWeakAnchors(tenantId: string): Promise<IssueRow[]> {
  return queryDb<IssueRow>(
    `
    SELECT
      e.id AS edge_id,
      b.id AS from_node_id,
      b.external_id AS from_external_id,
      b.title AS from_title,
      b.canonical_url AS from_canonical_url,
      l.id AS to_node_id,
      l.external_id AS to_external_id,
      l.title AS to_title,
      l.canonical_url AS to_canonical_url,
      ev.source_url AS evidence_source_url,
      ev.target_url AS evidence_target_url,
      ev.anchor_text AS evidence_anchor_text,
      ev.context_snippet AS evidence_context_snippet,
      ev.dom_path AS evidence_dom_path,
      ev.location_hint AS evidence_location_hint
    FROM authority_graph_edges e
    INNER JOIN authority_graph_nodes b
      ON b.id = e.from_node_id
    INNER JOIN authority_graph_nodes l
      ON l.id = e.to_node_id
    LEFT JOIN LATERAL (
      SELECT source_url, target_url, anchor_text, context_snippet, dom_path, location_hint
      FROM authority_graph_evidence ev
      WHERE ev.edge_id = e.id
      ORDER BY detected_at DESC
      LIMIT 1
    ) ev ON true
    WHERE e.tenant_id = $1
      AND e.edge_type = 'weak_anchor'
      AND e.status = 'active'
    ORDER BY e.last_seen_at DESC
    `,
    [tenantId]
  );
}

export async function getLatestRun(tenantId: string): Promise<{
  id: string;
  status: string;
  stats: Record<string, unknown>;
  startedAt: string;
  completedAt: string | null;
} | null> {
  const rows = await queryDb<{
    id: string;
    status: string;
    stats: Record<string, unknown> | null;
    started_at: string;
    completed_at: string | null;
  }>(
    `
    SELECT id, status, stats, started_at, completed_at
    FROM authority_graph_runs
    WHERE tenant_id = $1
    ORDER BY started_at DESC
    LIMIT 1
    `,
    [tenantId]
  );

  const row = rows[0];
  if (!row) return null;

  return {
    id: row.id,
    status: row.status,
    stats: row.stats ?? {},
    startedAt: row.started_at,
    completedAt: row.completed_at,
  };
}

export type AuthorityGraphIssueRow = IssueRow;
export type AuthorityGraphEvidenceRow = EvidenceRow;

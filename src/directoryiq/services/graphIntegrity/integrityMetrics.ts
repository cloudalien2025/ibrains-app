import crypto from "crypto";
import { queryDb } from "@/src/directoryiq/repositories/db";
import { getLinkPolicy } from "@/src/directoryiq/services/graphIntegrity/linkPolicyEngine";
import {
  classifyAnchorType,
  loadUsedAnchorHashes,
  recordAnchorUsage,
  type AnchorType,
} from "@/src/directoryiq/services/graphIntegrity/anchorDiversity";
import { canonicalizeUrl } from "@/src/directoryiq/utils/canonicalizeUrl";

const LINK_EDGE_TYPES = ["internal_link", "weak_anchor"] as const;
const MENTION_EDGE_TYPE = "mention_without_link";

export type ListingMetrics = {
  inbound_links_to_count: number;
  inbound_mentions_count: number;
  unique_referring_blogs: number;
  anchor_diversity_score: number;
  backlink_compliance_rate: number;
  orphan_status: boolean;
};

export type BlogMetrics = {
  extracted_entities: number;
  linked_listings: number;
  unlinked_mentions: number;
  link_policy_compliance: {
    ok: boolean;
    reasons: string[];
  };
};

type ListingNodeRow = {
  id: string;
  external_id: string;
  canonical_url: string | null;
  title: string | null;
};

type BlogNodeRow = {
  id: string;
  external_id: string;
  canonical_url: string | null;
  title: string | null;
};

export async function upsertIntegrityMetrics(params: {
  tenantId: string;
  subjectType: "listing" | "blog" | "hub";
  subjectId: string;
  metrics: Record<string, unknown>;
}): Promise<void> {
  await queryDb(
    `
    INSERT INTO directoryiq_integrity_metrics
      (tenant_id, subject_type, subject_id, metrics_json, computed_at)
    VALUES ($1, $2, $3, $4::jsonb, now())
    ON CONFLICT (tenant_id, subject_type, subject_id)
    DO UPDATE SET metrics_json = EXCLUDED.metrics_json, computed_at = now()
    `,
    [params.tenantId, params.subjectType, params.subjectId, JSON.stringify(params.metrics)]
  );
}

async function resolveListingNode(tenantId: string, listingId: string): Promise<ListingNodeRow | null> {
  const rows = await queryDb<ListingNodeRow>(
    `
    SELECT id, external_id, canonical_url, title
    FROM authority_graph_nodes
    WHERE tenant_id = $1 AND node_type = 'listing' AND external_id = $2
    LIMIT 1
    `,
    [tenantId, listingId]
  );
  return rows[0] ?? null;
}

async function resolveBlogNode(tenantId: string, idOrSlug: string): Promise<BlogNodeRow | null> {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);
  const rows = await queryDb<BlogNodeRow>(
    `
    SELECT id, external_id, canonical_url, title
    FROM authority_graph_nodes
    WHERE tenant_id = $1 AND node_type = 'blog_post'
      AND (${isUuid ? "id = $2" : "external_id = $2 OR canonical_url = $2"})
    LIMIT 1
    `,
    [tenantId, idOrSlug]
  );
  return rows[0] ?? null;
}

async function syncAnchorLedgerFromEvidence(params: {
  tenantId: string;
  listingNodeId: string;
  listingId: string;
}): Promise<{ uniqueCount: number; totalCount: number }> {
  const rows = await queryDb<{
    blog_url: string | null;
    anchor_text: string | null;
  }>(
    `
    SELECT ev.source_url AS blog_url, ev.anchor_text
    FROM authority_graph_edges e
    JOIN authority_graph_evidence ev ON ev.edge_id = e.id AND ev.tenant_id = e.tenant_id
    WHERE e.tenant_id = $1
      AND e.to_node_id = $2
      AND e.edge_type = ANY($3)
      AND ev.anchor_text IS NOT NULL
    `,
    [params.tenantId, params.listingNodeId, LINK_EDGE_TYPES]
  );

  const unique = new Set<string>();
  let total = 0;
  for (const row of rows) {
    const anchorText = row.anchor_text ?? "";
    const blogUrl = canonicalizeUrl(row.blog_url ?? "");
    if (!anchorText || !blogUrl) continue;
    const anchorType = classifyAnchorType(anchorText, {
      listingId: params.listingId,
      title: params.listingId,
    });
    total += 1;
    await recordAnchorUsage({
      tenantId: params.tenantId,
      listingId: params.listingId,
      blogUrl,
      anchorText,
      anchorType,
    });
    unique.add(anchorText.toLowerCase());
  }

  const ledgerRows = await queryDb<{ anchor_hash: string }>(
    `
    SELECT anchor_hash
    FROM directoryiq_anchor_ledger
    WHERE tenant_id = $1 AND listing_id = $2
    `,
    [params.tenantId, params.listingId]
  );

  return { uniqueCount: new Set(ledgerRows.map((row) => row.anchor_hash)).size, totalCount: total };
}

export async function computeListingMetrics(params: {
  tenantId: string;
  listingId: string;
}): Promise<ListingMetrics | null> {
  const listingNode = await resolveListingNode(params.tenantId, params.listingId);
  if (!listingNode) return null;

  const counts = await queryDb<{
    inbound_links_to_count: number;
    inbound_mentions_count: number;
    unique_referring_blogs: number;
  }>(
    `
    SELECT
      COUNT(*) FILTER (WHERE e.edge_type = ANY($3)) AS inbound_links_to_count,
      COUNT(*) FILTER (WHERE e.edge_type = $4) AS inbound_mentions_count,
      COUNT(DISTINCT e.from_node_id) FILTER (WHERE e.edge_type = ANY($5)) AS unique_referring_blogs
    FROM authority_graph_edges e
    WHERE e.tenant_id = $1 AND e.to_node_id = $2
    `,
    [params.tenantId, listingNode.id, LINK_EDGE_TYPES, MENTION_EDGE_TYPE, [...LINK_EDGE_TYPES, MENTION_EDGE_TYPE]]
  );

  const { uniqueCount, totalCount } = await syncAnchorLedgerFromEvidence({
    tenantId: params.tenantId,
    listingNodeId: listingNode.id,
    listingId: params.listingId,
  });

  const backlinks = await queryDb<{ present_count: number; total_count: number }>(
    `
    SELECT
      COUNT(*) FILTER (WHERE status = 'present') AS present_count,
      COUNT(*) AS total_count
    FROM directoryiq_listing_backlinks
    WHERE tenant_id = $1 AND listing_id = $2
    `,
    [params.tenantId, params.listingId]
  );

  const inboundLinks = counts[0]?.inbound_links_to_count ?? 0;
  const inboundMentions = counts[0]?.inbound_mentions_count ?? 0;
  const uniqueBlogs = counts[0]?.unique_referring_blogs ?? 0;
  const totalBacklinks = backlinks[0]?.total_count ?? 0;
  const presentBacklinks = backlinks[0]?.present_count ?? 0;

  const anchorScore = totalCount > 0 ? Math.round((uniqueCount / totalCount) * 100) : 0;
  const compliance = totalBacklinks > 0
    ? Math.round((presentBacklinks / totalBacklinks) * 100)
    : inboundLinks === 0
      ? 100
      : 0;

  const metrics: ListingMetrics = {
    inbound_links_to_count: inboundLinks,
    inbound_mentions_count: inboundMentions,
    unique_referring_blogs: uniqueBlogs,
    anchor_diversity_score: anchorScore,
    backlink_compliance_rate: compliance,
    orphan_status: inboundLinks === 0 && inboundMentions === 0,
  };

  await upsertIntegrityMetrics({
    tenantId: params.tenantId,
    subjectType: "listing",
    subjectId: params.listingId,
    metrics,
  });

  return metrics;
}

export async function computeBlogMetrics(params: {
  tenantId: string;
  blogIdOrSlug: string;
}): Promise<BlogMetrics | null> {
  const blogNode = await resolveBlogNode(params.tenantId, params.blogIdOrSlug);
  if (!blogNode) return null;

  const counts = await queryDb<{
    linked_listings: number;
    unlinked_mentions: number;
    extracted_entities: number;
  }>(
    `
    SELECT
      COUNT(*) FILTER (WHERE e.edge_type = ANY($3)) AS linked_listings,
      COUNT(*) FILTER (WHERE e.edge_type = $4) AS unlinked_mentions,
      COUNT(*) FILTER (WHERE e.edge_type = ANY($5)) AS extracted_entities
    FROM authority_graph_edges e
    WHERE e.tenant_id = $1 AND e.from_node_id = $2
    `,
    [params.tenantId, blogNode.id, LINK_EDGE_TYPES, MENTION_EDGE_TYPE, [...LINK_EDGE_TYPES, MENTION_EDGE_TYPE]]
  );

  const policy = getLinkPolicy(params.tenantId, null);

  const evidenceRows = await queryDb<{ anchor_text: string | null }>(
    `
    SELECT ev.anchor_text
    FROM authority_graph_edges e
    JOIN authority_graph_evidence ev ON ev.edge_id = e.id AND ev.tenant_id = e.tenant_id
    WHERE e.tenant_id = $1 AND e.from_node_id = $2 AND e.edge_type = ANY($3)
    `,
    [params.tenantId, blogNode.id, LINK_EDGE_TYPES]
  );

  const bannedHits: string[] = [];
  for (const row of evidenceRows) {
    const text = (row.anchor_text ?? "").toLowerCase().trim();
    if (!text) continue;
    if (policy.bannedAnchors.includes(text)) {
      bannedHits.push(text);
    }
  }

  const linked = counts[0]?.linked_listings ?? 0;
  const mentions = counts[0]?.unlinked_mentions ?? 0;
  const extracted = counts[0]?.extracted_entities ?? 0;

  const reasons: string[] = [];
  if (extracted >= 3 && linked < policy.minLinksPerBlogToListings) {
    reasons.push("below_min_links");
  }
  if (linked > policy.maxLinksPerBlogToListings) {
    reasons.push("above_max_links");
  }
  if (bannedHits.length > 0) {
    reasons.push("banned_anchor");
  }

  const metrics: BlogMetrics = {
    extracted_entities: extracted,
    linked_listings: linked,
    unlinked_mentions: mentions,
    link_policy_compliance: {
      ok: reasons.length === 0,
      reasons,
    },
  };

  await upsertIntegrityMetrics({
    tenantId: params.tenantId,
    subjectType: "blog",
    subjectId: blogNode.id,
    metrics,
  });

  return metrics;
}

export async function computeTenantSummary(params: { tenantId: string }): Promise<{
  orphan_listings_count: number;
  leaks_count: number;
  missing_backlinks_count: number;
  avg_anchor_diversity: number;
  last_computed_at: string | null;
}> {
  const orphans = await queryDb<{ count: number }>(
    `
    SELECT COUNT(*)::int AS count
    FROM authority_graph_nodes n
    LEFT JOIN authority_graph_edges e
      ON e.tenant_id = n.tenant_id AND e.to_node_id = n.id
    WHERE n.tenant_id = $1
      AND n.node_type = 'listing'
      AND e.id IS NULL
    `,
    [params.tenantId]
  );

  const leaks = await queryDb<{ count: number }>(
    `
    SELECT COUNT(*)::int AS count
    FROM authority_graph_edges e
    WHERE e.tenant_id = $1 AND e.edge_type = $2
    `,
    [params.tenantId, MENTION_EDGE_TYPE]
  );

  const missingBacklinks = await queryDb<{ count: number }>(
    `
    SELECT COUNT(*)::int AS count
    FROM directoryiq_listing_backlinks
    WHERE tenant_id = $1 AND status = 'missing'
    `,
    [params.tenantId]
  );

  const avgAnchor = await queryDb<{ avg_score: number | null; last_computed: string | null }>(
    `
    SELECT
      AVG((metrics_json->>'anchor_diversity_score')::int) AS avg_score,
      MAX(computed_at) AS last_computed
    FROM directoryiq_integrity_metrics
    WHERE tenant_id = $1 AND subject_type = 'listing'
    `,
    [params.tenantId]
  );

  return {
    orphan_listings_count: orphans[0]?.count ?? 0,
    leaks_count: leaks[0]?.count ?? 0,
    missing_backlinks_count: missingBacklinks[0]?.count ?? 0,
    avg_anchor_diversity: Math.round(avgAnchor[0]?.avg_score ?? 0),
    last_computed_at: avgAnchor[0]?.last_computed ?? null,
  };
}

export async function listListingBacklinkCandidates(params: {
  tenantId: string;
  limit: number;
}): Promise<Array<{ listing_id: string; blog_url: string; status: string }>> {
  const rows = await queryDb<{ listing_id: string; blog_url: string; status: string }>(
    `
    SELECT listing_id, blog_url, status
    FROM directoryiq_listing_backlinks
    WHERE tenant_id = $1 AND status = 'missing'
    ORDER BY updated_at DESC
    LIMIT $2
    `,
    [params.tenantId, params.limit]
  );
  return rows;
}

export async function listAuthorityLeaks(params: {
  tenantId: string;
  limit: number;
}): Promise<Array<{ blog_url: string | null; listing_url: string | null; listing_id: string }>> {
  const rows = await queryDb<{ blog_url: string | null; listing_url: string | null; listing_id: string }>(
    `
    SELECT b.canonical_url AS blog_url, l.canonical_url AS listing_url, l.external_id AS listing_id
    FROM authority_graph_edges e
    JOIN authority_graph_nodes b ON b.id = e.from_node_id
    JOIN authority_graph_nodes l ON l.id = e.to_node_id
    WHERE e.tenant_id = $1 AND e.edge_type = $2
    ORDER BY e.last_seen_at DESC
    LIMIT $3
    `,
    [params.tenantId, MENTION_EDGE_TYPE, params.limit]
  );
  return rows;
}

export async function listListingReferrers(params: {
  tenantId: string;
  listingId: string;
  limit: number;
}): Promise<Array<{ blog_url: string | null; blog_title: string | null; edge_type: string }>> {
  const listingNode = await resolveListingNode(params.tenantId, params.listingId);
  if (!listingNode) return [];

  const rows = await queryDb<{ blog_url: string | null; blog_title: string | null; edge_type: string }>(
    `
    SELECT b.canonical_url AS blog_url, b.title AS blog_title, e.edge_type
    FROM authority_graph_edges e
    JOIN authority_graph_nodes b ON b.id = e.from_node_id
    WHERE e.tenant_id = $1 AND e.to_node_id = $2
    ORDER BY e.last_seen_at DESC
    LIMIT $3
    `,
    [params.tenantId, listingNode.id, params.limit]
  );
  return rows;
}

export async function loadAnchorDiversityBreakdown(params: {
  tenantId: string;
  listingId: string;
}): Promise<Array<{ anchor_type: AnchorType; count: number }>> {
  const rows = await queryDb<{ anchor_type: AnchorType; count: number }>(
    `
    SELECT anchor_type, COUNT(*)::int AS count
    FROM directoryiq_anchor_ledger
    WHERE tenant_id = $1 AND listing_id = $2
    GROUP BY anchor_type
    ORDER BY count DESC
    `,
    [params.tenantId, params.listingId]
  );
  return rows;
}

export async function recommendAnchorsForListing(params: {
  tenantId: string;
  listingId: string;
  listingTitle: string;
  blogUrl: string;
  candidates: string[];
}): Promise<{ anchor: string; anchorType: AnchorType }> {
  const used = await loadUsedAnchorHashes({ tenantId: params.tenantId, listingId: params.listingId });
  for (const candidate of params.candidates) {
    const normalized = candidate.toLowerCase();
    const hash = crypto.createHash("sha256").update(normalized).digest("hex");
    if (!used.has(hash)) {
      return {
        anchor: candidate,
        anchorType: classifyAnchorType(candidate, {
          listingId: params.listingId,
          title: params.listingTitle,
        }),
      };
    }
  }
  const fallback = params.candidates[0] ?? params.listingTitle;
  return {
    anchor: fallback,
    anchorType: classifyAnchorType(fallback, {
      listingId: params.listingId,
      title: params.listingTitle,
    }),
  };
}

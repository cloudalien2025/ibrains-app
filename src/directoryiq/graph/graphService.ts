import { queryDb } from "@/src/directoryiq/repositories/db";
import {
  addEvidence,
  createRun,
  finishRun,
  getGraphSummaryCounts,
  getLatestRun,
  listBlogLayerRows,
  listListingLayerRows,
  listMentionsWithoutLinks,
  listOrphanListings,
  listWeakAnchors,
  upsertEdge,
  upsertNode,
  type AuthorityGraphBlogLayerRow,
  type AuthorityGraphIssueRow,
  type AuthorityGraphListingLayerRow,
} from "@/src/directoryiq/repositories/authorityGraphRepo";
import {
  type GraphIssue,
  type GraphEvidence,
  type EdgeType,
  weakAnchorDetector,
} from "@/src/directoryiq/domain/authorityGraph";

type ListingNodeRow = {
  source_id: string;
  title: string | null;
  url: string | null;
  raw_json: Record<string, unknown> | null;
};

type BlogNodeRow = {
  source_id: string;
  title: string | null;
  url: string | null;
  raw_json: Record<string, unknown> | null;
};

type RebuildStats = {
  nodesCreated: number;
  edgesUpserted: number;
  evidenceCount: number;
  issuesCounts: {
    orphans: number;
    mentions_without_links: number;
    weak_anchors: number;
  };
  limitedScanner?: {
    enabled: boolean;
    reason: string;
  };
};

type RebuildResult = {
  runId: string;
  stats: RebuildStats;
};

type IssuesResult = {
  orphans: GraphIssue[];
  mentions_without_links: GraphIssue[];
  weak_anchors: GraphIssue[];
  lastRun: {
    id: string;
    status: string;
    startedAt: string;
    completedAt: string | null;
    stats: Record<string, unknown>;
  } | null;
};

type AuthorityOverviewResult = {
  totalNodes: number;
  totalEdges: number;
  totalEvidence: number;
  blogNodes: number;
  listingNodes: number;
  lastIngestionRunAt: string | null;
  lastGraphRunAt: string | null;
  lastGraphRunStatus: string | null;
};

type BlogEntity = {
  entityText: string;
  entityType: "listing";
  evidenceSnippet: string | null;
};

type BlogSuggestion = {
  listingExternalId: string;
  listingTitle: string;
  listingUrl: string | null;
  recommendation: string;
};

type AuthorityBlogRow = {
  blogNodeId: string;
  blogExternalId: string;
  blogTitle: string | null;
  blogUrl: string | null;
  extractedEntitiesCount: number;
  linkedListingsCount: number;
  unlinkedMentionsCount: number;
  status: "green" | "yellow" | "red";
  entities: BlogEntity[];
  suggestedListingTargets: BlogSuggestion[];
  missingInternalLinksRecommendations: string[];
};

type ListingEvidence = {
  blogExternalId: string;
  blogTitle: string | null;
  blogUrl: string | null;
  edgeType: "links_to" | "mentions";
  evidenceSnippet: string | null;
  anchorText: string | null;
};

type AuthorityListingRow = {
  listingNodeId: string;
  listingExternalId: string;
  listingTitle: string | null;
  listingUrl: string | null;
  inboundBlogLinksCount: number;
  mentionedInCount: number;
  status: "green" | "yellow" | "red";
  inboundBlogs: ListingEvidence[];
  suggestedBlogsToLinkFrom: ListingEvidence[];
};

type Anchor = {
  href: string;
  text: string;
};

const MOCK_SOURCE_URL = "https://example.com/blog/authority-tips";
const MOCK_TARGET_URL = "https://example.com/listings/acme-plumbing";

const mockIssues: IssuesResult = {
  orphans: [
    {
      type: "orphan_listing",
      severity: "high",
      to: {
        nodeType: "listing",
        externalId: "listing-001",
        title: "Acme Plumbing",
        canonicalUrl: MOCK_TARGET_URL,
      },
      evidence: null,
      details: {
        summary: "Listing has no internal blog links pointing to it.",
        suggestedFix: "Add at least one contextual internal link from a relevant blog post to the listing page.",
      },
    },
  ],
  mentions_without_links: [
    {
      type: "mention_without_link",
      severity: "medium",
      from: {
        nodeType: "blog_post",
        externalId: "blog-001",
        title: "How to Pick a Reliable Plumber",
        canonicalUrl: MOCK_SOURCE_URL,
      },
      to: {
        nodeType: "listing",
        externalId: "listing-001",
        title: "Acme Plumbing",
        canonicalUrl: MOCK_TARGET_URL,
      },
      evidence: {
        sourceUrl: MOCK_SOURCE_URL,
        targetUrl: MOCK_TARGET_URL,
        anchorText: null,
        contextSnippet: "Acme Plumbing serves the local area with emergency response.",
        locationHint: "body",
      },
      details: {
        summary: "Blog post mentions the listing by name but does not link to the listing URL.",
        suggestedFix: "Add a contextual internal link on the mention to strengthen authority flow.",
      },
    },
  ],
  weak_anchors: [
    {
      type: "weak_anchor",
      severity: "low",
      from: {
        nodeType: "blog_post",
        externalId: "blog-001",
        title: "How to Pick a Reliable Plumber",
        canonicalUrl: MOCK_SOURCE_URL,
      },
      to: {
        nodeType: "listing",
        externalId: "listing-001",
        title: "Acme Plumbing",
        canonicalUrl: MOCK_TARGET_URL,
      },
      evidence: {
        sourceUrl: MOCK_SOURCE_URL,
        targetUrl: MOCK_TARGET_URL,
        anchorText: "click here",
        contextSnippet: "For details, click here.",
        locationHint: "body",
      },
      details: {
        summary: "Internal listing link uses a weak anchor text.",
        suggestedFix: "Replace generic anchor text with a descriptive phrase that names the listing or service intent.",
      },
    },
  ],
  lastRun: null,
};

function normalizeUrl(value: string | null | undefined): string {
  if (!value) return "";
  return value.trim().toLowerCase().replace(/\/$/, "");
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function extractHtml(raw: Record<string, unknown>): string {
  const content = raw.content;
  if (typeof content === "string" && content.trim()) return content;
  if (content && typeof content === "object") {
    const rendered = asString((content as Record<string, unknown>).rendered);
    if (rendered.trim()) return rendered;
  }

  const candidates = [
    raw.body_html,
    raw.html,
    raw.post_content,
    raw.description,
    raw.excerpt,
  ];

  for (const candidate of candidates) {
    const value = asString(candidate);
    if (value.trim()) return value;
  }

  return "";
}

function extractPlainText(raw: Record<string, unknown>): string {
  const candidates = [
    raw.title,
    raw.post_title,
    raw.excerpt,
    raw.description,
    raw.summary,
    raw.body,
    raw.post_content,
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

function extractAnchors(html: string): Anchor[] {
  const results: Anchor[] = [];
  const regex = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match = regex.exec(html);

  while (match) {
    const href = (match[1] ?? "").trim();
    const text = stripHtml(match[2] ?? "");
    if (href) {
      results.push({ href, text });
    }
    match = regex.exec(html);
  }

  return results;
}

function makeSnippet(text: string, needle: string): string {
  const haystack = text.toLowerCase();
  const query = needle.toLowerCase();
  const index = haystack.indexOf(query);
  if (index < 0) {
    return text.slice(0, 180);
  }

  const start = Math.max(0, index - 80);
  const end = Math.min(text.length, index + query.length + 80);
  return text.slice(start, end).trim();
}

function toEvidence(row: AuthorityGraphIssueRow): GraphEvidence | null {
  const sourceUrl = row.evidence_source_url;
  if (!sourceUrl) return null;
  return {
    sourceUrl,
    targetUrl: row.evidence_target_url ?? null,
    anchorText: row.evidence_anchor_text ?? null,
    contextSnippet: row.evidence_context_snippet ?? null,
    domPath: row.evidence_dom_path ?? null,
    locationHint: (row.evidence_location_hint as GraphEvidence["locationHint"]) ?? "unknown",
  };
}

function mapMentionIssue(row: AuthorityGraphIssueRow): GraphIssue {
  return {
    type: "mention_without_link",
    severity: "medium",
    from: {
      nodeId: row.from_node_id,
      nodeType: "blog_post",
      externalId: row.from_external_id,
      title: row.from_title ?? null,
      canonicalUrl: row.from_canonical_url ?? null,
    },
    to: {
      nodeId: row.to_node_id,
      nodeType: "listing",
      externalId: row.to_external_id,
      title: row.to_title ?? null,
      canonicalUrl: row.to_canonical_url ?? null,
    },
    evidence: toEvidence(row),
    details: {
      summary: "Blog mentions listing without an internal link.",
      suggestedFix: "Convert the mention into a contextual internal link to the listing URL.",
    },
  };
}

function mapWeakAnchorIssue(row: AuthorityGraphIssueRow): GraphIssue {
  return {
    type: "weak_anchor",
    severity: "low",
    from: {
      nodeId: row.from_node_id,
      nodeType: "blog_post",
      externalId: row.from_external_id,
      title: row.from_title ?? null,
      canonicalUrl: row.from_canonical_url ?? null,
    },
    to: {
      nodeId: row.to_node_id,
      nodeType: "listing",
      externalId: row.to_external_id,
      title: row.to_title ?? null,
      canonicalUrl: row.to_canonical_url ?? null,
    },
    evidence: toEvidence(row),
    details: {
      summary: "Internal link uses weak anchor text.",
      suggestedFix: "Replace generic anchor text with descriptive anchor language tied to listing intent.",
    },
  };
}

function mapOrphanIssue(row: AuthorityGraphIssueRow): GraphIssue {
  return {
    type: "orphan_listing",
    severity: "high",
    to: {
      nodeId: row.to_node_id,
      nodeType: "listing",
      externalId: row.to_external_id,
      title: row.to_title ?? null,
      canonicalUrl: row.to_canonical_url ?? null,
    },
    evidence: null,
    details: {
      summary: "No blog post currently links to this listing.",
      suggestedFix: "Add at least one relevant blog post link pointing to this listing page.",
    },
  };
}

function mapBlogStatus(linkedListingsCount: number, unlinkedMentionsCount: number): "green" | "yellow" | "red" {
  if (linkedListingsCount > 0) return "green";
  if (unlinkedMentionsCount > 0) return "yellow";
  return "red";
}

function mapListingStatus(inboundBlogLinksCount: number, mentionedInCount: number): "green" | "yellow" | "red" {
  if (inboundBlogLinksCount > 0) return "green";
  if (mentionedInCount > 0) return "yellow";
  return "red";
}

async function loadListings(): Promise<ListingNodeRow[]> {
  return queryDb<ListingNodeRow>(
    `
    SELECT source_id, title, url, raw_json
    FROM directoryiq_nodes
    WHERE source_type = 'listing'
    ORDER BY updated_at DESC
    `
  );
}

async function loadBlogPosts(): Promise<BlogNodeRow[]> {
  return queryDb<BlogNodeRow>(
    `
    SELECT source_id, title, url, raw_json
    FROM directoryiq_nodes
    WHERE source_type = 'blog_post'
    ORDER BY updated_at DESC
    `
  );
}

async function persistMockGraph(tenantId: string): Promise<{ runId: string }> {
  const run = await createRun({ tenantId, runType: "scan" });

  const listingNode = await upsertNode({
    tenantId,
    nodeType: "listing",
    externalId: "listing-001",
    canonicalUrl: MOCK_TARGET_URL,
    title: "Acme Plumbing",
    meta: { mock: true },
  });

  const blogNode = await upsertNode({
    tenantId,
    nodeType: "blog_post",
    externalId: "blog-001",
    canonicalUrl: MOCK_SOURCE_URL,
    title: "How to Pick a Reliable Plumber",
    meta: { mock: true },
  });

  const mentionEdge = await upsertEdge({
    tenantId,
    fromNodeId: blogNode.id,
    toNodeId: listingNode.id,
    edgeType: "mention_without_link",
    strength: 45,
    confidence: 90,
  });

  await addEvidence({
    tenantId,
    edgeId: mentionEdge.id,
    sourceUrl: MOCK_SOURCE_URL,
    targetUrl: MOCK_TARGET_URL,
    contextSnippet: "Acme Plumbing serves the local area with emergency response.",
    locationHint: "body",
  });

  const weakEdge = await upsertEdge({
    tenantId,
    fromNodeId: blogNode.id,
    toNodeId: listingNode.id,
    edgeType: "weak_anchor",
    strength: 40,
    confidence: 88,
  });

  await addEvidence({
    tenantId,
    edgeId: weakEdge.id,
    sourceUrl: MOCK_SOURCE_URL,
    targetUrl: MOCK_TARGET_URL,
    anchorText: "click here",
    contextSnippet: "For details, click here.",
    locationHint: "body",
  });

  await finishRun({
    runId: run.id,
    status: "completed",
    stats: {
      nodesCreated: 2,
      edgesUpserted: 2,
      evidenceCount: 2,
      issuesCounts: {
        orphans: 1,
        mentions_without_links: 1,
        weak_anchors: 1,
      },
    },
  });

  return { runId: run.id };
}

export async function rebuildGraph(input: {
  tenantId: string;
  mode: "scan";
}): Promise<RebuildResult> {
  if (process.env.E2E_MOCK_GRAPH === "1") {
    if (process.env.DATABASE_URL) {
      const run = await persistMockGraph(input.tenantId);
      return {
        runId: run.runId,
        stats: {
          nodesCreated: 2,
          edgesUpserted: 2,
          evidenceCount: 2,
          issuesCounts: {
            orphans: 1,
            mentions_without_links: 1,
            weak_anchors: 1,
          },
        },
      };
    }

    return {
      runId: "mock-run-001",
      stats: {
        nodesCreated: 2,
        edgesUpserted: 2,
        evidenceCount: 2,
        issuesCounts: {
          orphans: 1,
          mentions_without_links: 1,
          weak_anchors: 1,
        },
      },
    };
  }

  const run = await createRun({ tenantId: input.tenantId, runType: "scan" });

  try {
    const listings = await loadListings();
    const blogs = await loadBlogPosts();

    const listingNodeBySourceId = new Map<string, { id: string; url: string; title: string }>();
    const listingUrls = new Map<string, { id: string; sourceId: string; title: string; url: string }>();

    let nodesCreated = 0;
    let edgesUpserted = 0;
    let evidenceCount = 0;

    for (const listing of listings) {
      const node = await upsertNode({
        tenantId: input.tenantId,
        nodeType: "listing",
        externalId: listing.source_id,
        canonicalUrl: listing.url,
        title: listing.title,
        meta: { source: "directoryiq_nodes", sourceType: "listing" },
      });

      nodesCreated += 1;
      const normalized = normalizeUrl(listing.url);
      const listingTitle = (listing.title ?? listing.source_id).trim();
      listingNodeBySourceId.set(listing.source_id, { id: node.id, url: normalized, title: listingTitle });
      if (normalized) {
        listingUrls.set(normalized, {
          id: node.id,
          sourceId: listing.source_id,
          title: listingTitle,
          url: listing.url ?? "",
        });
      }
    }

    let hasAnyBlogBody = false;

    for (const blog of blogs) {
      const blogRaw = (blog.raw_json ?? {}) as Record<string, unknown>;
      const blogNode = await upsertNode({
        tenantId: input.tenantId,
        nodeType: "blog_post",
        externalId: blog.source_id,
        canonicalUrl: blog.url,
        title: blog.title,
        meta: { source: "directoryiq_nodes", sourceType: "blog_post" },
      });
      nodesCreated += 1;

      const html = extractHtml(blogRaw);
      const text = extractPlainText(blogRaw);
      if (html || text) {
        hasAnyBlogBody = true;
      }

      const anchors = extractAnchors(html);
      const linkedListingIds = new Set<string>();

      for (const anchor of anchors) {
        const href = normalizeUrl(anchor.href);
        if (!href) continue;

        for (const listing of listingUrls.values()) {
          if (!listing.url || !href.includes(listing.url)) continue;

          linkedListingIds.add(listing.id);
          const edge = await upsertEdge({
            tenantId: input.tenantId,
            fromNodeId: blogNode.id,
            toNodeId: listing.id,
            edgeType: "internal_link",
            strength: 90,
            confidence: 95,
          });
          edgesUpserted += 1;

          await addEvidence({
            tenantId: input.tenantId,
            edgeId: edge.id,
            sourceUrl: blog.url ?? `blog:${blog.source_id}`,
            targetUrl: listing.url,
            anchorText: anchor.text,
            contextSnippet: makeSnippet(stripHtml(html || text), anchor.text || listing.title),
            domPath: "a",
            locationHint: "body",
          });
          evidenceCount += 1;

          if (weakAnchorDetector(anchor.text)) {
            const weakEdge = await upsertEdge({
              tenantId: input.tenantId,
              fromNodeId: blogNode.id,
              toNodeId: listing.id,
              edgeType: "weak_anchor",
              strength: 40,
              confidence: 85,
            });
            edgesUpserted += 1;

            await addEvidence({
              tenantId: input.tenantId,
              edgeId: weakEdge.id,
              sourceUrl: blog.url ?? `blog:${blog.source_id}`,
              targetUrl: listing.url,
              anchorText: anchor.text,
              contextSnippet: makeSnippet(stripHtml(html || text), anchor.text || listing.title),
              domPath: "a",
              locationHint: "body",
            });
            evidenceCount += 1;
          }
        }
      }

      const searchable = (text || stripHtml(html)).toLowerCase();
      for (const listing of listings) {
        const listingNode = listingNodeBySourceId.get(listing.source_id);
        if (!listingNode) continue;
        if (linkedListingIds.has(listingNode.id)) continue;

        const listingName = (listing.title ?? "").trim();
        if (listingName.length < 3) continue;
        if (!searchable.includes(listingName.toLowerCase())) continue;

        const edge = await upsertEdge({
          tenantId: input.tenantId,
          fromNodeId: blogNode.id,
          toNodeId: listingNode.id,
          edgeType: "mention_without_link",
          strength: 45,
          confidence: 75,
        });
        edgesUpserted += 1;

        await addEvidence({
          tenantId: input.tenantId,
          edgeId: edge.id,
          sourceUrl: blog.url ?? `blog:${blog.source_id}`,
          targetUrl: listing.url,
          contextSnippet: makeSnippet(text || stripHtml(html), listingName),
          locationHint: "body",
        });
        evidenceCount += 1;
      }
    }

    const orphanRows = await listOrphanListings(input.tenantId);
    const mentionRows = await listMentionsWithoutLinks(input.tenantId);
    const weakRows = await listWeakAnchors(input.tenantId);

    const stats: RebuildStats = {
      nodesCreated,
      edgesUpserted,
      evidenceCount,
      issuesCounts: {
        orphans: orphanRows.length,
        mentions_without_links: mentionRows.length,
        weak_anchors: weakRows.length,
      },
    };

    if (!hasAnyBlogBody) {
      stats.limitedScanner = {
        enabled: true,
        reason: "Blog body content is unavailable; scanner used title/excerpt-level signals only.",
      };
    }

    await finishRun({
      runId: run.id,
      status: "completed",
      stats,
    });

    return {
      runId: run.id,
      stats,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown graph scan error";
    await finishRun({
      runId: run.id,
      status: "failed",
      stats: {
        nodesCreated: 0,
        edgesUpserted: 0,
        evidenceCount: 0,
        issuesCounts: {
          orphans: 0,
          mentions_without_links: 0,
          weak_anchors: 0,
        },
      },
      error: message,
    });
    throw error;
  }
}

export async function getIssues(input: { tenantId: string }): Promise<IssuesResult> {
  if (process.env.E2E_MOCK_GRAPH === "1") {
    return {
      ...mockIssues,
      lastRun: {
        id: "mock-run-001",
        status: "completed",
        startedAt: "2026-03-03T00:00:00.000Z",
        completedAt: "2026-03-03T00:00:01.000Z",
        stats: {
          nodesCreated: 2,
          edgesUpserted: 2,
          evidenceCount: 2,
          issuesCounts: {
            orphans: 1,
            mentions_without_links: 1,
            weak_anchors: 1,
          },
        },
      },
    };
  }

  const [orphans, mentions, weakAnchors, latestRun] = await Promise.all([
    listOrphanListings(input.tenantId),
    listMentionsWithoutLinks(input.tenantId),
    listWeakAnchors(input.tenantId),
    getLatestRun(input.tenantId),
  ]);

  return {
    orphans: orphans.map(mapOrphanIssue),
    mentions_without_links: mentions.map(mapMentionIssue),
    weak_anchors: weakAnchors.map(mapWeakAnchorIssue),
    lastRun: latestRun
      ? {
          id: latestRun.id,
          status: latestRun.status,
          startedAt: latestRun.startedAt,
          completedAt: latestRun.completedAt,
          stats: latestRun.stats,
        }
      : null,
  };
}

export async function getAuthorityOverview(input: { tenantId: string }): Promise<AuthorityOverviewResult> {
  const [counts, latestGraphRun, latestIngestRun] = await Promise.all([
    getGraphSummaryCounts(input.tenantId),
    getLatestRun(input.tenantId),
    queryDb<{ finished_at: string | null }>(
      `
      SELECT finished_at
      FROM directoryiq_ingest_runs
      WHERE user_id = $1
        AND status = 'succeeded'
      ORDER BY finished_at DESC NULLS LAST
      LIMIT 1
      `,
      [input.tenantId]
    ),
  ]);

  return {
    totalNodes: counts.total_nodes,
    totalEdges: counts.total_edges,
    totalEvidence: counts.total_evidence,
    blogNodes: counts.blog_nodes,
    listingNodes: counts.listing_nodes,
    lastIngestionRunAt: latestIngestRun[0]?.finished_at ?? null,
    lastGraphRunAt: latestGraphRun?.completedAt ?? latestGraphRun?.startedAt ?? null,
    lastGraphRunStatus: latestGraphRun?.status ?? null,
  };
}

export async function getAuthorityBlogs(input: { tenantId: string }): Promise<AuthorityBlogRow[]> {
  const rows = await listBlogLayerRows(input.tenantId);
  const grouped = new Map<string, { head: AuthorityGraphBlogLayerRow; rows: AuthorityGraphBlogLayerRow[] }>();

  for (const row of rows) {
    const existing = grouped.get(row.blog_node_id);
    if (!existing) {
      grouped.set(row.blog_node_id, { head: row, rows: [row] });
    } else {
      existing.rows.push(row);
    }
  }

  return Array.from(grouped.values()).map(({ head, rows }) => {
    const linkedRows = rows.filter((row) => row.edge_type === "internal_link" && row.listing_node_id);
    const mentionRows = rows.filter((row) => row.edge_type === "mention_without_link" && row.listing_node_id);
    const entityRows = rows.filter((row) => row.listing_node_id && (row.edge_type === "internal_link" || row.edge_type === "mention_without_link"));

    const linkedListingIds = new Set(linkedRows.map((row) => row.listing_node_id as string));
    const mentionListingIds = new Set(mentionRows.map((row) => row.listing_node_id as string));

    const entities: BlogEntity[] = entityRows.map((row) => ({
      entityText: row.listing_title ?? row.listing_external_id ?? "Listing",
      entityType: "listing",
      evidenceSnippet: row.evidence_snippet ?? null,
    }));

    const suggestedTargets: BlogSuggestion[] = mentionRows.map((row) => ({
      listingExternalId: row.listing_external_id ?? "",
      listingTitle: row.listing_title ?? row.listing_external_id ?? "Listing",
      listingUrl: row.listing_url ?? null,
      recommendation: `Add link to ${row.listing_title ?? row.listing_external_id ?? "listing"} using anchor "${row.listing_title ?? "Listing details"}".`,
    }));

    const missingInternalLinksRecommendations = suggestedTargets.map((target) => target.recommendation);
    const linkedCount = linkedListingIds.size;
    const mentionsCount = mentionListingIds.size;

    return {
      blogNodeId: head.blog_node_id,
      blogExternalId: head.blog_external_id,
      blogTitle: head.blog_title,
      blogUrl: head.blog_url,
      extractedEntitiesCount: new Set(entities.map((entity) => entity.entityText)).size,
      linkedListingsCount: linkedCount,
      unlinkedMentionsCount: mentionsCount,
      status: mapBlogStatus(linkedCount, mentionsCount),
      entities,
      suggestedListingTargets: suggestedTargets,
      missingInternalLinksRecommendations,
    };
  });
}

export async function getAuthorityListings(input: { tenantId: string }): Promise<AuthorityListingRow[]> {
  const rows = await listListingLayerRows(input.tenantId);
  const grouped = new Map<string, { head: AuthorityGraphListingLayerRow; rows: AuthorityGraphListingLayerRow[] }>();

  for (const row of rows) {
    const existing = grouped.get(row.listing_node_id);
    if (!existing) {
      grouped.set(row.listing_node_id, { head: row, rows: [row] });
    } else {
      existing.rows.push(row);
    }
  }

  return Array.from(grouped.values()).map(({ head, rows }) => {
    const linkRows = rows.filter((row) => row.edge_type === "internal_link" && row.blog_node_id);
    const mentionRows = rows.filter((row) => row.edge_type === "mention_without_link" && row.blog_node_id);
    const linkBlogIds = new Set(linkRows.map((row) => row.blog_node_id as string));
    const mentionBlogIds = new Set(mentionRows.map((row) => row.blog_node_id as string));

    const inboundBlogs: ListingEvidence[] = rows
      .filter((row) => row.blog_node_id && (row.edge_type === "internal_link" || row.edge_type === "mention_without_link"))
      .map((row) => ({
        blogExternalId: row.blog_external_id ?? "",
        blogTitle: row.blog_title,
        blogUrl: row.blog_url,
        edgeType: row.edge_type === "internal_link" ? "links_to" : "mentions",
        evidenceSnippet: row.evidence_snippet,
        anchorText: row.evidence_anchor_text,
      }));

    const suggestedBlogsToLinkFrom = mentionRows.map((row) => ({
      blogExternalId: row.blog_external_id ?? "",
      blogTitle: row.blog_title,
      blogUrl: row.blog_url,
      edgeType: "mentions" as const,
      evidenceSnippet: row.evidence_snippet,
      anchorText: row.evidence_anchor_text,
    }));

    const linksCount = linkBlogIds.size;
    const mentionsCount = mentionBlogIds.size;

    return {
      listingNodeId: head.listing_node_id,
      listingExternalId: head.listing_external_id,
      listingTitle: head.listing_title,
      listingUrl: head.listing_url,
      inboundBlogLinksCount: linksCount,
      mentionedInCount: mentionsCount,
      status: mapListingStatus(linksCount, mentionsCount),
      inboundBlogs,
      suggestedBlogsToLinkFrom,
    };
  });
}

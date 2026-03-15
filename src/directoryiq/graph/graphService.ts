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
  mergeNodeMeta,
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
  weakAnchorDetector,
} from "@/src/directoryiq/domain/authorityGraph";
import {
  classifyBlogPost,
  type BlogPostClassificationResult,
  type FlywheelStatusByTarget,
  type ListingRelationshipSignal,
} from "@/src/directoryiq/services/blogPostClassificationEngine";

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
  primary_type: BlogPostClassificationResult["primary_type"];
  intent_labels: BlogPostClassificationResult["intent_labels"];
  confidence: BlogPostClassificationResult["confidence"];
  parent_pillar_id: BlogPostClassificationResult["parent_pillar_id"];
  dominant_listing_id: BlogPostClassificationResult["dominant_listing_id"];
  target_entity_ids: BlogPostClassificationResult["target_entity_ids"];
  flywheel_status_by_target: FlywheelStatusByTarget[];
  selection_value: BlogPostClassificationResult["selection_value"];
  classification_reason: BlogPostClassificationResult["classification_reason"];
  review_candidate: boolean;
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

const E2E_MOCK_STATS: RebuildStats = {
  nodesCreated: 2,
  edgesUpserted: 2,
  evidenceCount: 2,
  issuesCounts: {
    orphans: 1,
    mentions_without_links: 1,
    weak_anchors: 1,
  },
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

function normalizePathForMatch(value: string): string {
  const raw = value.trim();
  if (!raw) return "";
  try {
    const url = new URL(raw, "https://directoryiq.local");
    return url.pathname.toLowerCase().replace(/\/+$/, "");
  } catch {
    return raw.split("?")[0].split("#")[0].toLowerCase().replace(/\/+$/, "");
  }
}

function normalizeForMatch(value: string): string {
  return value
    .toLowerCase()
    .replace(/&[a-z0-9#]+;/gi, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function includesAny(text: string, patterns: string[]): boolean {
  return patterns.some((pattern) => text.includes(pattern));
}

function buildDeterministicAliases(name: string): string[] {
  const base = normalizeForMatch(name);
  if (!base) return [];
  const out = new Set<string>([base]);

  if (base.startsWith("the ")) {
    out.add(base.slice(4).trim());
  }

  // deterministic stopword removal used by many title variants like "X at Vail" vs "X Vail"
  out.add(base.replace(/\bat\b/g, " ").replace(/\s+/g, " ").trim());

  // optional hospitality suffix stripping as secondary keys only
  out.add(base.replace(/\b(hotel|inn|resort)\b/g, " ").replace(/\s+/g, " ").trim());

  return Array.from(out).filter((item) => item.length >= 3);
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

function defaultClassification(reason: string): BlogPostClassificationResult {
  return {
    primary_type: "Needs Review",
    intent_labels: [],
    confidence: "Low",
    parent_pillar_id: null,
    dominant_listing_id: null,
    target_entity_ids: [],
    flywheel_status_by_target: [],
    selection_value: "Low",
    classification_reason: reason,
  };
}

function safeRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function parseH1(html: string): string {
  const match = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
  if (!match) return "";
  return stripHtml(match[1] ?? "").trim();
}

function parseIntro(text: string): string {
  const normalized = stripHtml(text);
  if (!normalized) return "";
  const sentenceBreak = normalized.search(/[.!?]\s/);
  if (sentenceBreak > 0) {
    return normalized.slice(0, sentenceBreak + 1).trim();
  }
  return normalized.slice(0, 220).trim();
}

function parsePersistedClassification(meta: Record<string, unknown>): BlogPostClassificationResult | null {
  const classification = safeRecord(meta.blog_post_classification);
  const primaryType = classification.primary_type;
  const confidence = classification.confidence;
  const selectionValue = classification.selection_value;
  const reason = classification.classification_reason;
  if (typeof primaryType !== "string" || typeof confidence !== "string" || typeof selectionValue !== "string" || typeof reason !== "string") {
    return null;
  }

  const intentLabels = Array.isArray(classification.intent_labels)
    ? classification.intent_labels.filter((value): value is BlogPostClassificationResult["intent_labels"][number] => typeof value === "string")
    : [];
  const targetEntityIds = Array.isArray(classification.target_entity_ids)
    ? classification.target_entity_ids.filter((value): value is string => typeof value === "string")
    : [];
  const flywheelByTarget = Array.isArray(classification.flywheel_status_by_target)
    ? classification.flywheel_status_by_target
        .map((entry) => safeRecord(entry))
        .filter((entry) => typeof entry.target_entity_id === "string" && typeof entry.status === "string")
        .map((entry) => ({
          target_entity_id: entry.target_entity_id as string,
          status: entry.status as FlywheelStatusByTarget["status"],
        }))
    : [];

  return {
    primary_type: primaryType as BlogPostClassificationResult["primary_type"],
    intent_labels: intentLabels,
    confidence: confidence as BlogPostClassificationResult["confidence"],
    parent_pillar_id: typeof classification.parent_pillar_id === "string" ? classification.parent_pillar_id : null,
    dominant_listing_id: typeof classification.dominant_listing_id === "string" ? classification.dominant_listing_id : null,
    target_entity_ids: targetEntityIds,
    flywheel_status_by_target: flywheelByTarget,
    selection_value: selectionValue as BlogPostClassificationResult["selection_value"],
    classification_reason: reason,
  };
}

type SourceBlogSignalRow = {
  source_id: string;
  raw_json: Record<string, unknown> | null;
};

async function loadBlogSignalMap(sourceIds: string[]): Promise<Map<string, SourceBlogSignalRow>> {
  if (!sourceIds.length) return new Map();

  try {
    const rows = await queryDb<SourceBlogSignalRow>(
      `
      SELECT source_id, raw_json
      FROM directoryiq_nodes
      WHERE source_type = 'blog_post'
        AND source_id = ANY($1::text[])
      `,
      [sourceIds]
    );

    const out = new Map<string, SourceBlogSignalRow>();
    for (const row of rows) {
      out.set(row.source_id, row);
    }
    return out;
  } catch {
    return new Map();
  }
}

type ReciprocalLinkRow = {
  blog_external_id: string;
  listing_external_id: string;
};

async function loadReciprocalLinkPairs(tenantId: string): Promise<Set<string>> {
  const rows = await queryDb<ReciprocalLinkRow>(
    `
    SELECT
      b.external_id AS blog_external_id,
      l.external_id AS listing_external_id
    FROM authority_graph_edges e
    JOIN authority_graph_nodes l
      ON l.id = e.from_node_id
     AND l.tenant_id = e.tenant_id
     AND l.node_type = 'listing'
     AND l.status = 'active'
    JOIN authority_graph_nodes b
      ON b.id = e.to_node_id
     AND b.tenant_id = e.tenant_id
     AND b.node_type = 'blog_post'
     AND b.status = 'active'
    WHERE e.tenant_id = $1
      AND e.status = 'active'
      AND e.edge_type = 'internal_link'
    `,
    [tenantId]
  );

  return new Set(rows.map((row) => `${row.blog_external_id}::${row.listing_external_id}`));
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

export async function rebuildGraph(input: {
  tenantId: string;
  mode: "scan";
}): Promise<RebuildResult> {
  if (process.env.E2E_MOCK_GRAPH === "1") {
    return {
      runId: "mock-run-001",
      stats: E2E_MOCK_STATS,
    };
  }

  const run = await createRun({ tenantId: input.tenantId, runType: "scan" });

  try {
    const listings = await loadListings();
    const blogsAll = await loadBlogPosts();
    const maxBlogsPerRun = Number.parseInt(process.env.DIRECTORYIQ_AUTHORITY_MAX_BLOGS ?? "500", 10) || 500;
    const blogs = blogsAll.slice(0, maxBlogsPerRun);

    const listingNodeBySourceId = new Map<string, { id: string; url: string; title: string }>();
    const listingUrls = new Map<string, { id: string; sourceId: string; title: string; url: string }>();
    const listingPaths = new Map<string, { id: string; sourceId: string; title: string; url: string }>();

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

      const listingRaw = (listing.raw_json ?? {}) as Record<string, unknown>;
      const slugPath = normalizePathForMatch(
        asString(listingRaw.listing_slug ?? listingRaw.group_filename ?? listingRaw.slug ?? listingRaw.path ?? "")
      );
      if (slugPath) {
        listingPaths.set(slugPath, {
          id: node.id,
          sourceId: listing.source_id,
          title: listingTitle,
          url: listing.url ?? slugPath,
        });
      }
    }

    let hasAnyBlogBody = false;
    let blogsWithRawHtml = 0;
    let totalCleanTextLength = 0;
    let totalExtractedHrefs = 0;
    let linksToEdgesUpserted = 0;
    let mentionsEdgesUpserted = 0;
    const goldenListing = listings.find((listing) => (listing.title ?? "").toLowerCase().includes("arrabelle"));

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
      if (html.trim()) blogsWithRawHtml += 1;
      totalCleanTextLength += text.length;

      const anchors = extractAnchors(html);
      totalExtractedHrefs += anchors.length;
      const linkedListingIds = new Set<string>();
      let blogLinks = 0;
      let blogMentions = 0;

      for (const anchor of anchors) {
        const href = normalizeUrl(anchor.href);
        const hrefPath = normalizePathForMatch(anchor.href);

        if (hrefPath) {
          const listing = listingPaths.get(hrefPath);
          if (listing) {
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
            linksToEdgesUpserted += 1;
            blogLinks += 1;

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
            continue;
          }
        }

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
          linksToEdgesUpserted += 1;
          blogLinks += 1;

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

      const searchable = normalizeForMatch(text || stripHtml(html));
      const searchablePadded = ` ${searchable} `;
      for (const listing of listings) {
        const listingNode = listingNodeBySourceId.get(listing.source_id);
        if (!listingNode) continue;
        if (linkedListingIds.has(listingNode.id)) continue;

        const listingName = (listing.title ?? "").trim();
        if (listingName.length < 3) continue;
        const aliases = buildDeterministicAliases(listingName);
        const matchedAlias = aliases.find((alias) => searchablePadded.includes(` ${alias} `));
        if (!matchedAlias) continue;

        const edge = await upsertEdge({
          tenantId: input.tenantId,
          fromNodeId: blogNode.id,
          toNodeId: listingNode.id,
          edgeType: "mention_without_link",
          strength: 45,
          confidence: 75,
        });
        edgesUpserted += 1;
        mentionsEdgesUpserted += 1;
        blogMentions += 1;

        await addEvidence({
          tenantId: input.tenantId,
          edgeId: edge.id,
          sourceUrl: blog.url ?? `blog:${blog.source_id}`,
          targetUrl: listing.url,
          contextSnippet: makeSnippet(text || stripHtml(html), matchedAlias),
          locationHint: "body",
        });
        evidenceCount += 1;
      }

      const goldenMatch =
        blog.source_id === "51" && !!goldenListing && searchable.includes((goldenListing.title ?? "").trim().toLowerCase());
      if (blog.source_id === "51") {
        console.info(
          `[directoryiq-authority-graph] EXPECT_MATCH listing="${goldenListing?.title ?? "none"}" blog="${blog.title ?? blog.source_id}" => ${goldenMatch}`
        );
      }
      console.info(`[directoryiq-authority-graph] blog=${blog.source_id} links=${blogLinks} mentions=${blogMentions}`);
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

    console.info(
      `[directoryiq-authority-graph] Ingestion Debug Summary blogs_fetched=${blogs.length} blogs_with_raw_html=${blogsWithRawHtml} avg_clean_text_length=${blogs.length ? Math.round(totalCleanTextLength / blogs.length) : 0} hrefs_extracted_total=${totalExtractedHrefs} links_to_edges_upserted=${linksToEdgesUpserted} mentions_edges_upserted=${mentionsEdgesUpserted}`
    );

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
        stats: E2E_MOCK_STATS,
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

export async function getAuthorityOverview(input: { tenantId: string; userId: string }): Promise<AuthorityOverviewResult> {
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
      [input.userId]
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

  const blogExternalIds = Array.from(grouped.values()).map(({ head }) => head.blog_external_id);
  const [signalMap, reciprocalPairs] = await Promise.all([
    loadBlogSignalMap(blogExternalIds),
    loadReciprocalLinkPairs(input.tenantId),
  ]);

  return Promise.all(Array.from(grouped.values()).map(async ({ head, rows }) => {
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
    const persistedClassification = parsePersistedClassification(safeRecord(head.blog_meta));

    const signalRow = signalMap.get(head.blog_external_id);
    const rawSignal = safeRecord(signalRow?.raw_json);
    const html = extractHtml(rawSignal);
    const text = extractPlainText(rawSignal);
    const h1 = parseH1(html);
    const intro = parseIntro(text || stripHtml(html));
    const bodyLower = normalizeForMatch(text || stripHtml(html));
    const conclusion = bodyLower.slice(Math.max(0, bodyLower.length - 420));

    const listingSignalsMap = new Map<string, ListingRelationshipSignal>();
    for (const row of entityRows) {
      if (!row.listing_external_id) continue;
      const listingId = row.listing_external_id;
      const listingName = row.listing_title ?? listingId;
      const searchableName = normalizeForMatch(listingName);
      const recommendationOrCtaFavoring =
        searchableName.length > 2 &&
        includesAny(
          bodyLower,
          [`book ${searchableName}`, `reserve ${searchableName}`, `choose ${searchableName}`, `recommend ${searchableName}`, `call ${searchableName}`]
        );
      const conclusionReinforces =
        searchableName.length > 2 &&
        includesAny(conclusion, [`${searchableName} is`, `recommend ${searchableName}`, `${searchableName} remains`, `choose ${searchableName}`]);

      const current = listingSignalsMap.get(listingId) ?? {
        listingId,
        listingName,
        listingUrl: row.listing_url,
        appearsInTitle: searchableName.length > 2 && normalizeForMatch(head.blog_title ?? "").includes(searchableName),
        appearsInH1OrIntro:
          searchableName.length > 2 &&
          (normalizeForMatch(h1).includes(searchableName) || normalizeForMatch(intro).includes(searchableName)),
        meaningfulBodyMentions: 0,
        hasDirectLink: false,
        recommendationOrCtaFavoring: false,
        conclusionReinforces: false,
        hasReciprocalLink: false,
        hasMention: false,
      };

      if (row.edge_type === "mention_without_link") {
        current.hasMention = true;
        current.meaningfulBodyMentions += 1;
      }
      if (row.edge_type === "internal_link") {
        current.hasMention = true;
        current.hasDirectLink = true;
        current.meaningfulBodyMentions += 1;
      }

      current.recommendationOrCtaFavoring = current.recommendationOrCtaFavoring || recommendationOrCtaFavoring;
      current.conclusionReinforces = current.conclusionReinforces || conclusionReinforces;
      current.hasReciprocalLink = reciprocalPairs.has(`${head.blog_external_id}::${listingId}`);
      listingSignalsMap.set(listingId, current);
    }

    const listingSignals = Array.from(listingSignalsMap.values());
    const computed =
      listingSignals.length || (head.blog_title ?? "").trim() || text.trim()
        ? classifyBlogPost({
            postId: head.blog_external_id,
            title: head.blog_title ?? "",
            h1,
            intro,
            bodyText: text || stripHtml(html),
            listingRelationships: listingSignals,
          }).classification
        : defaultClassification("Assigned Needs Review because no blog text or relationship signals were available.");

    const classification = computed ?? persistedClassification ?? defaultClassification("Assigned Needs Review due to unavailable signals.");
    const reviewCandidate = classification.primary_type === "Needs Review" || classification.confidence === "Low";

    const persistedComparable = JSON.stringify(persistedClassification ?? {});
    const computedComparable = JSON.stringify(classification);
    if (persistedComparable !== computedComparable) {
      await mergeNodeMeta({
        tenantId: input.tenantId,
        nodeId: head.blog_node_id,
        patch: {
          blog_post_classification: classification,
          blog_post_classification_version: "directoryiq_blog_classification_v1",
          blog_post_classified_at: new Date().toISOString(),
        },
      });
    }

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
      primary_type: classification.primary_type,
      intent_labels: classification.intent_labels,
      confidence: classification.confidence,
      parent_pillar_id: classification.parent_pillar_id,
      dominant_listing_id: classification.dominant_listing_id,
      target_entity_ids: classification.target_entity_ids,
      flywheel_status_by_target: classification.flywheel_status_by_target,
      selection_value: classification.selection_value,
      classification_reason: classification.classification_reason,
      review_candidate: reviewCandidate,
    };
  }));
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

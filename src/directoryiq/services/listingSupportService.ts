import { queryDb } from "@/src/directoryiq/repositories/db";
import { getLatestRun } from "@/src/directoryiq/repositories/authorityGraphRepo";

const LINK_EDGE_TYPES = ["internal_link", "weak_anchor"] as const;
const MENTION_EDGE_TYPE = "mention_without_link" as const;

type ListingSupportListing = {
  id: string;
  title: string;
  canonicalUrl?: string | null;
  siteId?: string | null;
};

export type ListingSupportSummary = {
  inboundLinkedSupportCount: number;
  mentionWithoutLinkCount: number;
  outboundSupportLinkCount: number;
  connectedSupportPageCount: number;
  lastGraphRunAt: string | null;
};

export type ListingSupportInbound = {
  sourceId: string;
  sourceType: "blog_post" | "page" | "support";
  title: string | null;
  url?: string | null;
  anchors: string[];
  relationshipType: "links_to_listing";
};

export type ListingSupportMention = {
  sourceId: string;
  sourceType: "blog_post" | "page" | "support";
  title: string | null;
  url?: string | null;
  mentionSnippet?: string | null;
  relationshipType: "mentions_without_link";
};

export type ListingSupportOutbound = {
  targetId?: string | null;
  targetType?: "blog_post" | "page" | "support" | null;
  title?: string | null;
  url?: string | null;
  relationshipType: "listing_links_out";
};

export type ListingSupportConnectedPage = {
  id?: string | null;
  type: "hub" | "category" | "location" | "support" | "page";
  title: string | null;
  url?: string | null;
};

export type ListingSupportModel = {
  listing: ListingSupportListing;
  summary: ListingSupportSummary;
  inboundLinkedSupport: ListingSupportInbound[];
  mentionsWithoutLinks: ListingSupportMention[];
  outboundSupportLinks: ListingSupportOutbound[];
  connectedSupportPages: ListingSupportConnectedPage[];
};

type ListingNodeRow = {
  id: string;
  external_id: string;
  canonical_url: string | null;
  title: string | null;
};

type EvidenceRow = {
  edge_id: string;
  edge_type: string;
  blog_node_id: string;
  blog_external_id: string;
  blog_title: string | null;
  blog_url: string | null;
  anchor_text: string | null;
  context_snippet: string | null;
  detected_at: string | null;
};

type OutboundRow = {
  blog_node_id: string | null;
  blog_url: string | null;
  blog_title: string | null;
  blog_canonical_url: string | null;
};

type HubRow = {
  hub_id: string;
  hub_title: string | null;
  category_slug: string | null;
  geo_slug: string | null;
  topic_slug: string | null;
};

function buildZeroSummary(lastGraphRunAt: string | null): ListingSupportSummary {
  return {
    inboundLinkedSupportCount: 0,
    mentionWithoutLinkCount: 0,
    outboundSupportLinkCount: 0,
    connectedSupportPageCount: 0,
    lastGraphRunAt,
  };
}

function normalizeTitle(value: string | null | undefined, fallback: string): string {
  const trimmed = (value ?? "").trim();
  return trimmed || fallback;
}

export async function getListingCurrentSupport(params: {
  tenantId: string;
  listingId: string;
  listingTitle?: string | null;
  listingUrl?: string | null;
  siteId?: string | null;
}): Promise<ListingSupportModel> {
  const latestRun = await getLatestRun(params.tenantId);
  const lastGraphRunAt = latestRun?.completedAt ?? latestRun?.startedAt ?? null;

  const listingNodeRows = await queryDb<ListingNodeRow>(
    `
    SELECT id, external_id, canonical_url, title
    FROM authority_graph_nodes
    WHERE tenant_id = $1 AND node_type = 'listing' AND external_id = $2
    LIMIT 1
    `,
    [params.tenantId, params.listingId]
  );

  const listingNode = listingNodeRows[0] ?? null;
  const listingTitle = normalizeTitle(params.listingTitle ?? listingNode?.title ?? null, params.listingId);
  const listingCanonicalUrl = params.listingUrl ?? listingNode?.canonical_url ?? null;

  const listing: ListingSupportListing = {
    id: params.listingId,
    title: listingTitle,
    canonicalUrl: listingCanonicalUrl,
    siteId: params.siteId ?? null,
  };

  if (!listingNode) {
    return {
      listing,
      summary: buildZeroSummary(lastGraphRunAt),
      inboundLinkedSupport: [],
      mentionsWithoutLinks: [],
      outboundSupportLinks: [],
      connectedSupportPages: [],
    };
  }

  const evidenceRows = await queryDb<EvidenceRow>(
    `
    SELECT
      e.id AS edge_id,
      e.edge_type AS edge_type,
      b.id AS blog_node_id,
      b.external_id AS blog_external_id,
      b.title AS blog_title,
      b.canonical_url AS blog_url,
      ev.anchor_text AS anchor_text,
      ev.context_snippet AS context_snippet,
      ev.detected_at AS detected_at
    FROM authority_graph_edges e
    JOIN authority_graph_nodes b
      ON b.id = e.from_node_id
     AND b.node_type = 'blog_post'
    JOIN authority_graph_nodes l
      ON l.id = e.to_node_id
     AND l.node_type = 'listing'
    LEFT JOIN authority_graph_evidence ev
      ON ev.edge_id = e.id
     AND ev.tenant_id = e.tenant_id
    WHERE e.tenant_id = $1
      AND l.external_id = $2
      AND e.status = 'active'
      AND e.edge_type = ANY($3)
    ORDER BY e.last_seen_at DESC, ev.detected_at DESC NULLS LAST
    `,
    [params.tenantId, params.listingId, [...LINK_EDGE_TYPES, MENTION_EDGE_TYPE]]
  );

  const inboundLinkedMap = new Map<
    string,
    {
      sourceId: string;
      title: string | null;
      url: string | null;
      anchors: Set<string>;
    }
  >();
  const mentionMap = new Map<
    string,
    {
      sourceId: string;
      title: string | null;
      url: string | null;
      mentionSnippet: string | null;
    }
  >();

  for (const row of evidenceRows) {
    if (row.edge_type === MENTION_EDGE_TYPE) {
      if (!mentionMap.has(row.blog_node_id)) {
        mentionMap.set(row.blog_node_id, {
          sourceId: row.blog_external_id,
          title: row.blog_title,
          url: row.blog_url,
          mentionSnippet: row.context_snippet ?? null,
        });
      }
      continue;
    }

    const existing = inboundLinkedMap.get(row.blog_node_id);
    if (!existing) {
      inboundLinkedMap.set(row.blog_node_id, {
        sourceId: row.blog_external_id,
        title: row.blog_title,
        url: row.blog_url,
        anchors: new Set<string>(),
      });
    }
    const anchorText = (row.anchor_text ?? "").trim();
    if (anchorText) {
      inboundLinkedMap.get(row.blog_node_id)?.anchors.add(anchorText);
    }
  }

  const linkedSourceIds = new Set(inboundLinkedMap.keys());

  const inboundLinkedSupport: ListingSupportInbound[] = Array.from(inboundLinkedMap.values()).map((row) => ({
    sourceId: row.sourceId,
    sourceType: "blog_post",
    title: row.title,
    url: row.url,
    anchors: Array.from(row.anchors).sort((a, b) => a.localeCompare(b)),
    relationshipType: "links_to_listing",
  }));

  const mentionsWithoutLinks: ListingSupportMention[] = Array.from(mentionMap.entries())
    .filter(([blogNodeId]) => !linkedSourceIds.has(blogNodeId))
    .map(([, row]) => ({
      sourceId: row.sourceId,
      sourceType: "blog_post",
      title: row.title,
      url: row.url,
      mentionSnippet: row.mentionSnippet,
      relationshipType: "mentions_without_link",
    }));

  const outboundRows = await queryDb<OutboundRow>(
    `
    SELECT
      lb.blog_node_id AS blog_node_id,
      lb.blog_url AS blog_url,
      b.title AS blog_title,
      b.canonical_url AS blog_canonical_url
    FROM directoryiq_listing_backlinks lb
    LEFT JOIN authority_graph_nodes b
      ON b.id = lb.blog_node_id
    WHERE lb.tenant_id = $1
      AND lb.listing_id = $2
      AND lb.status = 'present'
    ORDER BY lb.updated_at DESC
    `,
    [params.tenantId, params.listingId]
  );

  const outboundSupportLinks: ListingSupportOutbound[] = outboundRows.map((row) => ({
    targetId: row.blog_node_id,
    targetType: row.blog_node_id ? "blog_post" : "page",
    title: row.blog_title,
    url: row.blog_canonical_url ?? row.blog_url,
    relationshipType: "listing_links_out",
  }));

  const hubRows = await queryDb<HubRow>(
    `
    SELECT
      h.id AS hub_id,
      h.title AS hub_title,
      h.category_slug AS category_slug,
      h.geo_slug AS geo_slug,
      h.topic_slug AS topic_slug
    FROM directoryiq_hub_members m
    JOIN directoryiq_hubs h ON h.id = m.hub_id
    WHERE m.tenant_id = $1
      AND m.member_type = 'listing'
      AND m.member_id = $2
    ORDER BY h.updated_at DESC
    `,
    [params.tenantId, params.listingId]
  );

  const connectedSupportPages: ListingSupportConnectedPage[] = hubRows.map((row) => {
    const fallbackTitle = [row.category_slug, row.geo_slug, row.topic_slug].filter(Boolean).join(" · ");
    return {
      id: row.hub_id,
      type: "hub",
      title: row.hub_title ?? (fallbackTitle || null),
      url: null,
    };
  });

  const summary: ListingSupportSummary = {
    inboundLinkedSupportCount: inboundLinkedSupport.length,
    mentionWithoutLinkCount: mentionsWithoutLinks.length,
    outboundSupportLinkCount: outboundSupportLinks.length,
    connectedSupportPageCount: connectedSupportPages.length,
    lastGraphRunAt,
  };

  return {
    listing,
    summary,
    inboundLinkedSupport,
    mentionsWithoutLinks,
    outboundSupportLinks,
    connectedSupportPages,
  };
}

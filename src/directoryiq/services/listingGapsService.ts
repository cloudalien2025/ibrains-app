import { weakAnchorDetector } from "@/src/directoryiq/domain/authorityGraph";
import { getIssues } from "@/src/directoryiq/graph/graphService";
import { getListingCurrentSupport, type ListingSupportModel } from "@/src/directoryiq/services/listingSupportService";
import { computeListingMetrics } from "@/src/directoryiq/services/graphIntegrity/integrityMetrics";

export type AuthorityGapSeverity = "high" | "medium" | "low";

export type AuthorityGapType =
  | "no_linked_support_posts"
  | "weak_anchor_text"
  | "mentions_without_links"
  | "no_listing_to_support_links"
  | "weak_category_support"
  | "weak_local_context_support"
  | "missing_comparison_content"
  | "missing_faq_support_coverage";

export type AuthorityGapItem = {
  type: AuthorityGapType;
  severity: AuthorityGapSeverity;
  title: string;
  explanation: string;
  evidenceSummary: string;
  evidence?: {
    counts?: Record<string, number>;
    urls?: string[];
    anchors?: string[];
    entities?: string[];
  };
};

export type ListingAuthorityGapsModel = {
  listing: {
    id: string;
    title: string;
    canonicalUrl?: string | null;
    siteId?: string | null;
  };
  summary: {
    totalGaps: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
    evaluatedAt: string;
    lastGraphRunAt: string | null;
    dataStatus: "gaps_found" | "no_meaningful_gaps";
  };
  items: AuthorityGapItem[];
};

type AuthorityPostLike = {
  post_type: string;
  status: "not_created" | "draft" | "published";
  title: string | null;
  focus_topic: string;
};

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeForMatch(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function includesAnyTerm(text: string, terms: string[]): boolean {
  if (!text || terms.length === 0) return false;
  const normalized = ` ${normalizeForMatch(text)} `;
  return terms.some((term) => {
    const cleaned = normalizeForMatch(term);
    if (!cleaned) return false;
    return normalized.includes(` ${cleaned} `);
  });
}

function supportEvidenceText(support: ListingSupportModel): string[] {
  const rows: string[] = [];
  for (const item of support.inboundLinkedSupport) {
    if (item.title) rows.push(item.title);
    if (item.url) rows.push(item.url);
    rows.push(...item.anchors);
  }
  for (const item of support.mentionsWithoutLinks) {
    if (item.title) rows.push(item.title);
    if (item.url) rows.push(item.url);
    if (item.mentionSnippet) rows.push(item.mentionSnippet);
  }
  for (const item of support.outboundSupportLinks) {
    if (item.title) rows.push(item.title);
    if (item.url) rows.push(item.url);
  }
  for (const item of support.connectedSupportPages) {
    if (item.title) rows.push(item.title);
    if (item.url) rows.push(item.url);
  }
  return rows;
}

function addGap(list: AuthorityGapItem[], gap: AuthorityGapItem): void {
  list.push(gap);
}

export async function getListingAuthorityGaps(params: {
  tenantId: string;
  listingId: string;
  listingTitle?: string | null;
  listingUrl?: string | null;
  siteId?: string | null;
  listingRaw?: Record<string, unknown> | null;
  authorityPosts?: AuthorityPostLike[];
}): Promise<ListingAuthorityGapsModel> {
  const support = await getListingCurrentSupport({
    tenantId: params.tenantId,
    listingId: params.listingId,
    listingTitle: params.listingTitle ?? null,
    listingUrl: params.listingUrl ?? null,
    siteId: params.siteId ?? null,
  });
  const [metrics, issues] = await Promise.all([
    computeListingMetrics({ tenantId: params.tenantId, listingId: params.listingId }),
    getIssues({ tenantId: params.tenantId }),
  ]);

  const listingIssues = {
    mentions: issues.mentions_without_links.filter((row) => row.to?.externalId === params.listingId),
    weakAnchors: issues.weak_anchors.filter((row) => row.to?.externalId === params.listingId),
    orphans: issues.orphans.filter((row) => row.to?.externalId === params.listingId),
  };

  const gaps: AuthorityGapItem[] = [];
  const supportTexts = supportEvidenceText(support);

  if (support.summary.inboundLinkedSupportCount === 0 || listingIssues.orphans.length > 0 || metrics?.orphan_status) {
    addGap(gaps, {
      type: "no_linked_support_posts",
      severity: "high",
      title: "No support posts are linking to this listing",
      explanation: "Authority flow into this listing is missing because no support content links in.",
      evidenceSummary: `Inbound linked support count is ${support.summary.inboundLinkedSupportCount}.`,
      evidence: {
        counts: { inboundLinkedSupportCount: support.summary.inboundLinkedSupportCount },
      },
    });
  }

  const weakAnchors = new Set<string>();
  for (const row of support.inboundLinkedSupport) {
    for (const anchor of row.anchors) {
      if (weakAnchorDetector(anchor)) weakAnchors.add(anchor);
    }
  }
  for (const issue of listingIssues.weakAnchors) {
    if (issue.evidence?.anchorText) weakAnchors.add(issue.evidence.anchorText);
  }
  if (weakAnchors.size > 0) {
    addGap(gaps, {
      type: "weak_anchor_text",
      severity: "medium",
      title: "Weak or generic anchor text detected",
      explanation: "Generic anchors dilute intent and reduce authority transfer quality.",
      evidenceSummary: `${weakAnchors.size} weak anchor instance(s) detected for this listing.`,
      evidence: {
        counts: { weakAnchorCount: weakAnchors.size },
        anchors: Array.from(weakAnchors).sort((a, b) => a.localeCompare(b)),
      },
    });
  }

  if (support.summary.mentionWithoutLinkCount > 0 || listingIssues.mentions.length > 0) {
    const mentionUrls = support.mentionsWithoutLinks.map((row) => row.url).filter((row): row is string => Boolean(row));
    addGap(gaps, {
      type: "mentions_without_links",
      severity: "medium",
      title: "Mentions without links are present",
      explanation: "Support content references the listing but does not link to it.",
      evidenceSummary: `${support.summary.mentionWithoutLinkCount} unlinked mention(s) detected.`,
      evidence: {
        counts: { mentionWithoutLinkCount: support.summary.mentionWithoutLinkCount },
        urls: Array.from(new Set(mentionUrls)).sort((a, b) => a.localeCompare(b)),
      },
    });
  }

  if (support.summary.outboundSupportLinkCount === 0 || (metrics?.backlink_compliance_rate ?? 100) < 100) {
    addGap(gaps, {
      type: "no_listing_to_support_links",
      severity: "medium",
      title: "No reciprocal listing to support links",
      explanation: "The listing does not reinforce supporting content with outbound support links.",
      evidenceSummary: `Outbound support links: ${support.summary.outboundSupportLinkCount}; backlink compliance: ${metrics?.backlink_compliance_rate ?? 0}%.`,
      evidence: {
        counts: {
          outboundSupportLinkCount: support.summary.outboundSupportLinkCount,
          backlinkComplianceRate: metrics?.backlink_compliance_rate ?? 0,
        },
      },
    });
  }

  const raw = params.listingRaw ?? {};
  const category = asString(raw.group_category) || asString(raw.category) || asString(raw.category_name);
  if (category) {
    const categoryHits = supportTexts.filter((text) => includesAnyTerm(text, [category])).length;
    if (categoryHits < 2) {
      addGap(gaps, {
        type: "weak_category_support",
        severity: "low",
        title: "Weak category support coverage",
        explanation: "Support content does not strongly reinforce this listing's category intent.",
        evidenceSummary: `Category "${category}" has ${categoryHits} support mention hit(s).`,
        evidence: {
          counts: { categorySupportHits: categoryHits },
          entities: [category],
        },
      });
    }
  }

  const city = asString(raw.city) || asString(raw.post_location) || asString(raw.location_city);
  const region = asString(raw.state) || asString(raw.region) || asString(raw.location_state);
  const localTerms = [city, region].filter(Boolean);
  if (localTerms.length > 0) {
    const localHits = supportTexts.filter((text) => includesAnyTerm(text, localTerms)).length;
    if (localHits < 2) {
      addGap(gaps, {
        type: "weak_local_context_support",
        severity: "low",
        title: "Weak local/context support coverage",
        explanation: "Support content is not strongly anchored to local intent signals for this listing.",
        evidenceSummary: `Local terms "${localTerms.join(", ")}" have ${localHits} support hit(s).`,
        evidence: {
          counts: { localSupportHits: localHits },
          entities: localTerms,
        },
      });
    }
  }

  const posts = params.authorityPosts ?? [];
  const hasComparisonSupport = posts.some((row) => row.post_type === "comparison" && row.status !== "not_created");
  if (!hasComparisonSupport) {
    addGap(gaps, {
      type: "missing_comparison_content",
      severity: "medium",
      title: "Missing comparison support content",
      explanation: "No comparison-focused authority content is prepared for this listing.",
      evidenceSummary: "No draft or published comparison slot found.",
      evidence: {
        counts: {
          comparisonSlotsReady: 0,
        },
      },
    });
  }

  const hasFaqCoverage = posts.some((row) => {
    if (row.status === "not_created") return false;
    const title = `${row.title ?? ""} ${row.focus_topic ?? ""}`.toLowerCase();
    return row.post_type === "contextual_guide" || row.post_type === "persona_intent" || /faq|question|guide|support/.test(title);
  });
  if (!hasFaqCoverage) {
    addGap(gaps, {
      type: "missing_faq_support_coverage",
      severity: "medium",
      title: "Missing FAQ/support coverage",
      explanation: "There is no prepared FAQ or support-oriented authority content for this listing.",
      evidenceSummary: "No contextual guide/persona intent support slot with FAQ-like coverage was found.",
      evidence: {
        counts: {
          faqCoverageSlotsReady: 0,
        },
      },
    });
  }

  const severityOrder: Record<AuthorityGapSeverity, number> = { high: 0, medium: 1, low: 2 };
  const typeOrder: Record<AuthorityGapType, number> = {
    no_linked_support_posts: 0,
    weak_anchor_text: 1,
    mentions_without_links: 2,
    no_listing_to_support_links: 3,
    weak_category_support: 4,
    weak_local_context_support: 5,
    missing_comparison_content: 6,
    missing_faq_support_coverage: 7,
  };

  const sorted = gaps.sort((left, right) => {
    const severityDelta = severityOrder[left.severity] - severityOrder[right.severity];
    if (severityDelta !== 0) return severityDelta;
    return typeOrder[left.type] - typeOrder[right.type];
  });

  const highCount = sorted.filter((row) => row.severity === "high").length;
  const mediumCount = sorted.filter((row) => row.severity === "medium").length;
  const lowCount = sorted.filter((row) => row.severity === "low").length;

  return {
    listing: support.listing,
    summary: {
      totalGaps: sorted.length,
      highCount,
      mediumCount,
      lowCount,
      evaluatedAt: new Date().toISOString(),
      lastGraphRunAt: support.summary.lastGraphRunAt,
      dataStatus: sorted.length > 0 ? "gaps_found" : "no_meaningful_gaps",
    },
    items: sorted,
  };
}

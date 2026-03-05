import { LEAK_SEVERITY, type LeakCandidate, type LeakType } from "@/src/directoryiq/leaks/leakTypes";
import {
  buildDeterministicAliases,
  extractAnchors,
  isWeakAnchorText,
  normalizeAnchorText,
  normalizeForMatch,
  normalizeHref,
  normalizeMentionText,
  normalizePathForMatch,
  stripHtml,
} from "@/src/directoryiq/leaks/leakRules";

export type ListingScanInput = {
  nodeId: string;
  externalId: string;
  title: string | null;
  canonicalUrl: string | null;
  urlPaths?: string[];
};

export type BlogScanInput = {
  nodeId: string;
  externalId: string;
  title: string | null;
  canonicalUrl: string | null;
  html: string;
  text: string;
  linkedListingIds?: string[];
};

export type LeakScanInput = {
  blogs: BlogScanInput[];
  listings: ListingScanInput[];
  includeOrphans: boolean;
};

export type LeakScanOutput = {
  leaks: LeakCandidate[];
  linkedListingIds: Set<string>;
};

function makeSnippet(text: string, needle: string): string {
  const haystack = text.toLowerCase();
  const query = needle.toLowerCase();
  const index = haystack.indexOf(query);
  if (index < 0) {
    return text.slice(0, 180).trim();
  }
  const start = Math.max(0, index - 80);
  const end = Math.min(text.length, index + query.length + 80);
  return text.slice(start, end).trim();
}

function dedupeKey(type: LeakType, parts: string[]): string {
  return `${type}|${parts.join("|")}`;
}

function dedupeKeyForMention(blogNodeId: string, listingNodeId: string, mentionText: string): string {
  return dedupeKey("mention_without_link", [
    `blog:${blogNodeId}`,
    `listing:${listingNodeId}`,
    `mention:${normalizeMentionText(mentionText)}`,
  ]);
}

function dedupeKeyForWeakAnchor(blogNodeId: string, listingNodeId: string, href: string, anchor: string): string {
  return dedupeKey("weak_anchor_text", [
    `blog:${blogNodeId}`,
    `listing:${listingNodeId}`,
    `href:${normalizeHref(href)}`,
    `anchor:${normalizeAnchorText(anchor)}`,
  ]);
}

function dedupeKeyForOrphan(listingNodeId: string): string {
  return dedupeKey("orphan_listing", [`listing:${listingNodeId}`]);
}

export function scanLeakCandidates(input: LeakScanInput): LeakScanOutput {
  const leaks: LeakCandidate[] = [];
  const linkedListingIds = new Set<string>();

  const listingByCanonical = new Map<string, string[]>();
  const listingByPath = new Map<string, string[]>();
  const listingAliases = new Map<string, string[]>();

  for (const listing of input.listings) {
    const canonical = normalizeHref(listing.canonicalUrl ?? "");
    if (canonical) {
      const existing = listingByCanonical.get(canonical) ?? [];
      existing.push(listing.nodeId);
      listingByCanonical.set(canonical, existing);
    }

    const pathSet = new Set<string>();
    const canonicalPath = normalizePathForMatch(listing.canonicalUrl ?? "");
    if (canonicalPath) pathSet.add(canonicalPath);
    for (const path of listing.urlPaths ?? []) {
      const normalized = normalizePathForMatch(path);
      if (normalized) pathSet.add(normalized);
    }
    for (const path of pathSet) {
      const existing = listingByPath.get(path) ?? [];
      existing.push(listing.nodeId);
      listingByPath.set(path, existing);
    }

    const title = (listing.title ?? listing.externalId).trim();
    listingAliases.set(listing.nodeId, buildDeterministicAliases(title));
  }

  for (const blog of input.blogs) {
    const blogLinked = new Set<string>(blog.linkedListingIds ?? []);
    for (const id of blogLinked) linkedListingIds.add(id);

    const html = blog.html || "";
    const text = blog.text || "";
    const cleanText = text.trim() ? text : stripHtml(html);

    const anchors = extractAnchors(html);
    for (const anchor of anchors) {
      const normalizedHref = normalizeHref(anchor.href);
      const hrefPath = normalizePathForMatch(anchor.href);

      const matches = new Set<string>();
      for (const candidate of listingByCanonical.get(normalizedHref) ?? []) {
        matches.add(candidate);
      }
      for (const candidate of listingByPath.get(hrefPath) ?? []) {
        matches.add(candidate);
      }

      if (matches.size === 0) continue;

      for (const listingId of matches) {
        blogLinked.add(listingId);
        linkedListingIds.add(listingId);

        if (isWeakAnchorText(anchor.text)) {
          leaks.push({
            leakType: "weak_anchor_text",
            severity: LEAK_SEVERITY.weak_anchor_text,
            blogNodeId: blog.nodeId,
            listingNodeId: listingId,
            evidence: {
              anchorText: anchor.text,
              href: anchor.href,
              snippet: makeSnippet(cleanText, anchor.text || "link"),
            },
            dedupeKey: dedupeKeyForWeakAnchor(blog.nodeId, listingId, anchor.href, anchor.text),
          });
        }
      }
    }

    const searchable = normalizeForMatch(cleanText);
    const searchablePadded = ` ${searchable} `;
    for (const listing of input.listings) {
      if (blogLinked.has(listing.nodeId)) continue;
      const aliases = listingAliases.get(listing.nodeId) ?? [];
      const matchedAlias = aliases.find((alias) => searchablePadded.includes(` ${alias} `));
      if (!matchedAlias) continue;

      leaks.push({
        leakType: "mention_without_link",
        severity: LEAK_SEVERITY.mention_without_link,
        blogNodeId: blog.nodeId,
        listingNodeId: listing.nodeId,
        evidence: {
          mentionText: matchedAlias,
          snippet: makeSnippet(cleanText, matchedAlias),
        },
        dedupeKey: dedupeKeyForMention(blog.nodeId, listing.nodeId, matchedAlias),
      });
    }
  }

  if (input.includeOrphans) {
    for (const listing of input.listings) {
      if (linkedListingIds.has(listing.nodeId)) continue;
      leaks.push({
        leakType: "orphan_listing",
        severity: LEAK_SEVERITY.orphan_listing,
        blogNodeId: null,
        listingNodeId: listing.nodeId,
        evidence: { snippet: "No inbound blog links detected." },
        dedupeKey: dedupeKeyForOrphan(listing.nodeId),
      });
    }
  }

  return { leaks, linkedListingIds };
}

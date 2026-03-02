import crypto from "crypto";
import { query } from "@/app/api/ecomviper/_utils/db";
import { getDirectoryIqBdConnection, getDirectoryIqOpenAiKey, getSerpApiKeyForUser, pushListingUpdateToBd } from "@/app/api/directoryiq/_utils/integrations";
import { fetchTopSerpOrganicResults } from "@/app/api/directoryiq/_utils/serpapi";
import { generateAuthorityDraft } from "@/lib/openai/serverClient";

type GraphNodeType = "listing" | "blog_post" | "support_post" | "hub_post";
type GraphSource = "bd" | "site_crawl" | "generated";
type ResolutionMethod = "exact" | "alias" | "fuzzy" | "ai";
type EdgeType = "explicit_link" | "implied_mention" | "thematic_association" | "category_association";

type GraphNodeRow = {
  id: string;
  tenant_id: string;
  node_type: GraphNodeType;
  external_id: string | null;
  url: string;
  title: string;
  slug: string;
  excerpt: string | null;
  clean_text: string;
  raw_html: string | null;
  headings_json: unknown;
  images_json: unknown;
  published_at: string | null;
  author: string | null;
  source: GraphSource;
  content_hash: string;
  last_seen_at: string;
  created_at: string;
  updated_at: string;
};

type ListingCandidate = {
  id: string;
  url: string;
  title: string;
  slug: string;
  aliases: string[];
};

type Mention = {
  mentionText: string;
  mentionType: string;
  evidenceSnippet: string;
  confidence: number;
};

type IngestCounts = {
  discovered: number;
  created: number;
  updated: number;
  skipped: number;
};

type LeakRecord = {
  blogNodeId: string;
  blogTitle: string;
  blogUrl: string;
  listingNodeId: string;
  listingTitle: string;
  listingUrl: string;
  evidenceSnippet: string;
  strengthScore: number;
};

type WeakAnchorRecord = {
  blogNodeId: string;
  listingNodeId: string;
  anchorText: string;
};

type OrphanListingRecord = {
  listingNodeId: string;
  listingTitle: string;
  listingUrl: string;
};

type IngestJob = {
  jobId: string;
  tenantId: string;
  status: "queued" | "running" | "completed" | "failed";
  dryRun: boolean;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  result: {
    baseUrl: string;
    discovered: number;
    created: number;
    updated: number;
    skipped: number;
    error?: string;
  } | null;
};

const ingestJobs = new Map<string, IngestJob>();

const GENERIC_ANCHORS = new Set([
  "click here",
  "learn more",
  "read more",
  "here",
  "website",
  "link",
  "details",
  "more",
]);

function nowIso(): string {
  return new Date().toISOString();
}

function sha256(text: string): string {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function normalizeCanonicalUrl(rawUrl: string, baseUrl?: string): string {
  const raw = rawUrl.trim();
  if (!raw) return "";
  try {
    const parsed = new URL(raw, baseUrl);
    parsed.hash = "";
    if (parsed.pathname.length > 1 && parsed.pathname.endsWith("/")) {
      parsed.pathname = parsed.pathname.slice(0, -1);
    }
    return parsed.toString();
  } catch {
    return "";
  }
}

function normalizeSlug(url: string): string {
  try {
    const parsed = new URL(url);
    const raw = parsed.pathname.replace(/^\/+|\/+$/g, "");
    if (!raw) return "home";
    return raw.split("/").pop() || raw;
  } catch {
    return "unknown";
  }
}

function stripHtml(input: string): string {
  return input
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'");
}

function extractTitle(html: string): string {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch?.[1]) return decodeEntities(stripHtml(titleMatch[1]));
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1Match?.[1]) return decodeEntities(stripHtml(h1Match[1]));
  return "Untitled";
}

function extractCanonical(html: string, fallbackUrl: string): string {
  const canonicalMatch = html.match(/<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)["'][^>]*>/i);
  if (canonicalMatch?.[1]) {
    const resolved = normalizeCanonicalUrl(canonicalMatch[1], fallbackUrl);
    if (resolved) return resolved;
  }
  return normalizeCanonicalUrl(fallbackUrl);
}

function extractHeadings(html: string): string[] {
  const headings: string[] = [];
  const regex = /<h([1-3])[^>]*>([\s\S]*?)<\/h\1>/gi;
  let match: RegExpExecArray | null = regex.exec(html);
  while (match) {
    const text = decodeEntities(stripHtml(match[2] ?? ""));
    if (text) headings.push(text);
    match = regex.exec(html);
  }
  return headings.slice(0, 120);
}

function extractImageUrls(html: string, pageUrl: string): string[] {
  const urls: string[] = [];
  const regex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  let match: RegExpExecArray | null = regex.exec(html);
  while (match) {
    const resolved = normalizeCanonicalUrl(match[1] ?? "", pageUrl);
    if (resolved) urls.push(resolved);
    match = regex.exec(html);
  }
  return Array.from(new Set(urls)).slice(0, 80);
}

function extractLinks(html: string, pageUrl: string): Array<{ url: string; anchorText: string }> {
  const links: Array<{ url: string; anchorText: string }> = [];
  const regex = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null = regex.exec(html);
  while (match) {
    const resolved = normalizeCanonicalUrl(match[1] ?? "", pageUrl);
    const anchorText = decodeEntities(stripHtml(match[2] ?? ""));
    if (resolved) {
      links.push({ url: resolved, anchorText });
    }
    match = regex.exec(html);
  }
  return links;
}

function summarizeExcerpt(cleanText: string): string {
  return cleanText.slice(0, 220);
}

async function fetchWithTimeout(url: string, timeoutMs = 15_000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
      headers: {
        "user-agent": "DirectoryIQAuthorityGraphBot/2.0",
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

function parseSitemapXml(xml: string): string[] {
  const locs: string[] = [];
  const regex = /<loc>([\s\S]*?)<\/loc>/gi;
  let match: RegExpExecArray | null = regex.exec(xml);
  while (match) {
    const loc = decodeEntities(stripHtml(match[1] ?? ""));
    if (loc) locs.push(loc);
    match = regex.exec(xml);
  }
  return Array.from(new Set(locs));
}

function isWithinBase(url: string, baseUrl: string): boolean {
  try {
    const base = new URL(baseUrl);
    const target = new URL(url);
    return base.hostname === target.hostname;
  } catch {
    return false;
  }
}

function isLikelyBlogUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return lower.includes("/blog") || lower.includes("/post") || lower.includes("/article");
}

async function discoverBlogUrls(baseUrl: string): Promise<string[]> {
  const normalizedBase = normalizeCanonicalUrl(baseUrl);
  const discovered = new Set<string>();
  const sitemapCandidates = ["/sitemap.xml", "/sitemap_index.xml"];

  for (const path of sitemapCandidates) {
    try {
      const response = await fetchWithTimeout(normalizeCanonicalUrl(path, normalizedBase));
      if (!response.ok) continue;
      const xml = await response.text();
      const locs = parseSitemapXml(xml);
      for (const loc of locs) {
        const normalized = normalizeCanonicalUrl(loc, normalizedBase);
        if (!normalized || !isWithinBase(normalized, normalizedBase)) continue;
        if (normalized.endsWith(".xml")) {
          try {
            const nestedResponse = await fetchWithTimeout(normalized);
            if (!nestedResponse.ok) continue;
            const nestedXml = await nestedResponse.text();
            const nestedLocs = parseSitemapXml(nestedXml);
            for (const nested of nestedLocs) {
              const nestedNormalized = normalizeCanonicalUrl(nested, normalizedBase);
              if (!nestedNormalized || !isWithinBase(nestedNormalized, normalizedBase)) continue;
              if (isLikelyBlogUrl(nestedNormalized)) discovered.add(nestedNormalized);
            }
          } catch {
            // Ignore nested sitemap fetch errors.
          }
          continue;
        }
        if (isLikelyBlogUrl(normalized)) discovered.add(normalized);
      }
    } catch {
      // Ignore sitemap fetch errors.
    }
  }

  if (discovered.size > 0) return Array.from(discovered);

  try {
    const blogUrl = normalizeCanonicalUrl("/blog", normalizedBase);
    const response = await fetchWithTimeout(blogUrl);
    if (!response.ok) return [];
    const html = await response.text();
    const links = extractLinks(html, blogUrl);
    for (const link of links) {
      if (isWithinBase(link.url, normalizedBase) && isLikelyBlogUrl(link.url)) {
        discovered.add(link.url);
      }
    }
  } catch {
    // Ignore fallback crawl errors.
  }

  return Array.from(discovered);
}

async function upsertAuthorityAction(params: {
  tenantId: string;
  actionType: string;
  targetNodeId?: string | null;
  status: string;
  details: Record<string, unknown>;
}): Promise<void> {
  await query(
    `
    INSERT INTO authority_actions (tenant_id, action_type, target_node_id, status, details_json)
    VALUES ($1, $2, $3, $4, $5::jsonb)
    `,
    [params.tenantId, params.actionType, params.targetNodeId ?? null, params.status, JSON.stringify(params.details)]
  );
}

async function upsertContentNode(params: {
  tenantId: string;
  nodeType: GraphNodeType;
  source: GraphSource;
  url: string;
  title: string;
  slug: string;
  excerpt: string;
  cleanText: string;
  rawHtml: string | null;
  headings: string[];
  images: string[];
  externalId?: string | null;
  publishedAt?: string | null;
  author?: string | null;
  contentHash: string;
}): Promise<{ nodeId: string; changed: boolean }> {
  const existing = await query<{ id: string; content_hash: string }>(
    `
    SELECT id, content_hash
    FROM content_nodes
    WHERE tenant_id = $1 AND node_type = $2 AND url = $3
    LIMIT 1
    `,
    [params.tenantId, params.nodeType, params.url]
  );

  if (existing[0] && existing[0].content_hash === params.contentHash) {
    await query(
      `
      UPDATE content_nodes
      SET last_seen_at = now(), updated_at = now()
      WHERE id = $1
      `,
      [existing[0].id]
    );
    return { nodeId: existing[0].id, changed: false };
  }

  const rows = await query<{ id: string }>(
    `
    INSERT INTO content_nodes (
      tenant_id, node_type, external_id, url, title, slug, excerpt, clean_text,
      raw_html, headings_json, images_json, published_at, author, source,
      content_hash, last_seen_at
    )
    VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8,
      $9, $10::jsonb, $11::jsonb, $12, $13, $14,
      $15, now()
    )
    ON CONFLICT (tenant_id, node_type, url)
    DO UPDATE SET
      external_id = EXCLUDED.external_id,
      title = EXCLUDED.title,
      slug = EXCLUDED.slug,
      excerpt = EXCLUDED.excerpt,
      clean_text = EXCLUDED.clean_text,
      raw_html = EXCLUDED.raw_html,
      headings_json = EXCLUDED.headings_json,
      images_json = EXCLUDED.images_json,
      published_at = EXCLUDED.published_at,
      author = EXCLUDED.author,
      source = EXCLUDED.source,
      content_hash = EXCLUDED.content_hash,
      last_seen_at = now(),
      updated_at = now()
    RETURNING id
    `,
    [
      params.tenantId,
      params.nodeType,
      params.externalId ?? null,
      params.url,
      params.title,
      params.slug,
      params.excerpt,
      params.cleanText,
      params.rawHtml,
      JSON.stringify(params.headings),
      JSON.stringify(params.images),
      params.publishedAt ?? null,
      params.author ?? null,
      params.source,
      params.contentHash,
    ]
  );

  return { nodeId: rows[0].id, changed: true };
}

async function upsertEdge(params: {
  tenantId: string;
  fromNodeId: string;
  toNodeId: string;
  edgeType: EdgeType;
  anchorText?: string | null;
  evidenceSnippet?: string | null;
  strengthScore?: number;
}): Promise<void> {
  const score = Math.max(0, Math.min(1, params.strengthScore ?? 0.5));
  await query(
    `
    INSERT INTO content_edges (
      tenant_id, from_node_id, to_node_id, edge_type, anchor_text,
      evidence_snippet, strength_score, first_seen_at, last_seen_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, now(), now())
    ON CONFLICT (tenant_id, from_node_id, to_node_id, edge_type, COALESCE(anchor_text, ''))
    DO UPDATE SET
      evidence_snippet = EXCLUDED.evidence_snippet,
      strength_score = EXCLUDED.strength_score,
      last_seen_at = now(),
      updated_at = now()
    `,
    [
      params.tenantId,
      params.fromNodeId,
      params.toNodeId,
      params.edgeType,
      params.anchorText ?? null,
      params.evidenceSnippet ?? null,
      score,
    ]
  );
}

function extractListingUrlFromRaw(raw: Record<string, unknown>): string {
  const candidates = [
    raw.url,
    raw.link,
    raw.group_url,
    raw.post_url,
    raw.profile_url,
    raw.website,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      const normalized = normalizeCanonicalUrl(candidate);
      if (normalized) return normalized;
    }
  }
  return "";
}

async function syncListingGraphNodes(tenantId: string): Promise<ListingCandidate[]> {
  const listings = await query<{
    source_id: string;
    title: string | null;
    url: string | null;
    raw_json: Record<string, unknown>;
  }>(
    `
    SELECT source_id, title, url, raw_json
    FROM directoryiq_nodes
    WHERE user_id = $1 AND source_type = 'listing'
    ORDER BY updated_at DESC
    `,
    [tenantId]
  );

  const candidates: ListingCandidate[] = [];
  for (const listing of listings) {
    const listingUrl = normalizeCanonicalUrl(listing.url ?? "") || extractListingUrlFromRaw(listing.raw_json ?? {});
    if (!listingUrl) continue;
    const title = (listing.title ?? String(listing.raw_json?.group_name ?? listing.source_id)).trim();
    const slug = normalizeSlug(listingUrl);
    const node = await upsertContentNode({
      tenantId,
      nodeType: "listing",
      source: "bd",
      url: listingUrl,
      title,
      slug,
      excerpt: "",
      cleanText: title,
      rawHtml: null,
      headings: [],
      images: [],
      externalId: listing.source_id,
      contentHash: sha256(`${listing.source_id}|${title}|${listingUrl}`),
    });

    const aliasRows = await query<{ alias: string }>(
      `
      SELECT alias
      FROM listing_aliases
      WHERE tenant_id = $1 AND listing_node_id = $2
      `,
      [tenantId, node.nodeId]
    );

    const aliases = Array.from(new Set([slug.replace(/[-_]/g, " "), ...aliasRows.map((row) => row.alias)])).filter(Boolean);
    candidates.push({ id: node.nodeId, url: listingUrl, title, slug, aliases });
  }

  return candidates;
}

function similarity(a: string, b: string): number {
  const left = new Set(a.toLowerCase().split(/\W+/).filter(Boolean));
  const right = new Set(b.toLowerCase().split(/\W+/).filter(Boolean));
  if (left.size === 0 || right.size === 0) return 0;
  let common = 0;
  for (const token of left) {
    if (right.has(token)) common += 1;
  }
  return common / Math.max(left.size, right.size);
}

function extractDeterministicMentions(cleanText: string, listings: ListingCandidate[]): Mention[] {
  const lower = cleanText.toLowerCase();
  const mentions: Mention[] = [];

  for (const listing of listings) {
    const targets = Array.from(new Set([listing.title, ...listing.aliases]))
      .map((entry) => entry.trim())
      .filter((entry) => entry.length >= 4);

    for (const target of targets) {
      const idx = lower.indexOf(target.toLowerCase());
      if (idx < 0) continue;
      const start = Math.max(0, idx - 80);
      const end = Math.min(cleanText.length, idx + target.length + 80);
      const snippet = cleanText.slice(start, end).trim();
      mentions.push({
        mentionText: target,
        mentionType: "listing",
        evidenceSnippet: snippet,
        confidence: target.toLowerCase() === listing.title.toLowerCase() ? 0.95 : 0.78,
      });
      break;
    }
  }

  return mentions;
}

async function extractAiMentions(params: {
  tenantId: string;
  cleanText: string;
  listingTitles: string[];
}): Promise<Mention[]> {
  if (process.env.E2E_MOCK_OPENAI === "1") {
    return [];
  }

  const apiKey = await getDirectoryIqOpenAiKey(params.tenantId);
  if (!apiKey) return [];

  const textSlice = params.cleanText.slice(0, 10_000);
  const prompt = [
    "Extract listing entity mentions from the text.",
    "Return strict JSON only with this schema:",
    '{"mentions":[{"mention_text":"string","mention_type":"listing","evidence_snippet":"string","confidence":0.0}]}.',
    "Only include likely business/listing mentions.",
    `Known listing names: ${params.listingTitles.join(" | ")}`,
    `Text: ${textSlice}`,
  ].join("\n\n");

  try {
    const payload = await generateAuthorityDraft({ apiKey, prompt, model: process.env.DIRECTORYIQ_OPENAI_TEXT_MODEL || "gpt-4.1-mini" });
    const jsonStart = payload.indexOf("{");
    const jsonEnd = payload.lastIndexOf("}");
    if (jsonStart < 0 || jsonEnd <= jsonStart) return [];
    const parsed = JSON.parse(payload.slice(jsonStart, jsonEnd + 1)) as {
      mentions?: Array<{
        mention_text?: string;
        mention_type?: string;
        evidence_snippet?: string;
        confidence?: number;
      }>;
    };

    return (parsed.mentions ?? [])
      .map((entry) => ({
        mentionText: String(entry.mention_text ?? "").trim(),
        mentionType: String(entry.mention_type ?? "listing").trim() || "listing",
        evidenceSnippet: String(entry.evidence_snippet ?? "").trim(),
        confidence: Number.isFinite(entry.confidence) ? Math.max(0, Math.min(1, Number(entry.confidence))) : 0.62,
      }))
      .filter((entry) => entry.mentionText.length > 2)
      .slice(0, 40);
  } catch {
    return [];
  }
}

function resolveMention(
  mentionText: string,
  listings: ListingCandidate[]
): { listingNodeId: string | null; method: ResolutionMethod | null; confidence: number } {
  const exactTitle = listings.find((listing) => listing.title.toLowerCase() === mentionText.toLowerCase());
  if (exactTitle) return { listingNodeId: exactTitle.id, method: "exact", confidence: 0.95 };

  const aliasMatch = listings.find((listing) => listing.aliases.some((alias) => alias.toLowerCase() === mentionText.toLowerCase()));
  if (aliasMatch) return { listingNodeId: aliasMatch.id, method: "alias", confidence: 0.84 };

  let best: ListingCandidate | null = null;
  let bestScore = 0;
  for (const listing of listings) {
    const score = similarity(mentionText, listing.title);
    if (score > bestScore) {
      bestScore = score;
      best = listing;
    }
  }

  if (best && bestScore >= 0.72) {
    return { listingNodeId: best.id, method: "fuzzy", confidence: bestScore };
  }

  return { listingNodeId: null, method: null, confidence: 0 };
}

async function refreshExplicitLinkEdges(params: {
  tenantId: string;
  blogNodeId: string;
  links: Array<{ url: string; anchorText: string }>;
  listingsByUrl: Map<string, ListingCandidate>;
}): Promise<void> {
  await query(
    `
    DELETE FROM content_edges
    WHERE tenant_id = $1 AND from_node_id = $2 AND edge_type = 'explicit_link'
    `,
    [params.tenantId, params.blogNodeId]
  );

  for (const link of params.links) {
    const listing = params.listingsByUrl.get(normalizeCanonicalUrl(link.url));
    if (!listing) continue;
    await upsertEdge({
      tenantId: params.tenantId,
      fromNodeId: params.blogNodeId,
      toNodeId: listing.id,
      edgeType: "explicit_link",
      anchorText: link.anchorText || listing.title,
      evidenceSnippet: link.anchorText || listing.title,
      strengthScore: 1,
    });
  }
}

async function resolveMentionsForBlogNode(params: {
  tenantId: string;
  blogNode: GraphNodeRow;
  listings: ListingCandidate[];
}): Promise<void> {
  await query(
    `
    DELETE FROM entity_mentions
    WHERE tenant_id = $1 AND blog_node_id = $2
    `,
    [params.tenantId, params.blogNode.id]
  );

  await query(
    `
    DELETE FROM content_edges
    WHERE tenant_id = $1 AND from_node_id = $2 AND edge_type = 'implied_mention'
    `,
    [params.tenantId, params.blogNode.id]
  );

  const deterministic = extractDeterministicMentions(params.blogNode.clean_text, params.listings);
  const aiMentions = await extractAiMentions({
    tenantId: params.tenantId,
    cleanText: params.blogNode.clean_text,
    listingTitles: params.listings.map((listing) => listing.title),
  });

  const mergedByText = new Map<string, Mention>();
  for (const mention of [...deterministic, ...aiMentions]) {
    const key = mention.mentionText.toLowerCase();
    const existing = mergedByText.get(key);
    if (!existing || mention.confidence > existing.confidence) {
      mergedByText.set(key, mention);
    }
  }

  for (const mention of mergedByText.values()) {
    const resolved = resolveMention(mention.mentionText, params.listings);
    const finalConfidence = Math.max(mention.confidence, resolved.confidence);

    await query(
      `
      INSERT INTO entity_mentions (
        tenant_id, blog_node_id, mention_text, mention_type, evidence_snippet,
        confidence, resolved_listing_node_id, resolution_method
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `,
      [
        params.tenantId,
        params.blogNode.id,
        mention.mentionText,
        mention.mentionType,
        mention.evidenceSnippet,
        finalConfidence,
        resolved.listingNodeId,
        resolved.method,
      ]
    );

    if (resolved.listingNodeId) {
      await upsertEdge({
        tenantId: params.tenantId,
        fromNodeId: params.blogNode.id,
        toNodeId: resolved.listingNodeId,
        edgeType: "implied_mention",
        evidenceSnippet: mention.evidenceSnippet,
        anchorText: mention.mentionText,
        strengthScore: finalConfidence,
      });
    }
  }
}

async function listBlogNodes(tenantId: string): Promise<GraphNodeRow[]> {
  return query<GraphNodeRow>(
    `
    SELECT *
    FROM content_nodes
    WHERE tenant_id = $1 AND node_type = 'blog_post'
    ORDER BY updated_at DESC
    `,
    [tenantId]
  );
}

export async function runBlogIngestion(params: {
  tenantId: string;
  baseUrl: string;
  dryRun?: boolean;
}): Promise<IngestCounts> {
  const listings = await syncListingGraphNodes(params.tenantId);
  const listingsByUrl = new Map<string, ListingCandidate>();
  for (const listing of listings) listingsByUrl.set(normalizeCanonicalUrl(listing.url), listing);

  const urls = await discoverBlogUrls(params.baseUrl);
  const counts: IngestCounts = {
    discovered: urls.length,
    created: 0,
    updated: 0,
    skipped: 0,
  };

  if (params.dryRun) return counts;

  for (const url of urls) {
    try {
      const response = await fetchWithTimeout(url, 20_000);
      if (!response.ok) {
        counts.skipped += 1;
        continue;
      }

      const rawHtml = await response.text();
      const canonicalUrl = extractCanonical(rawHtml, url);
      const title = extractTitle(rawHtml);
      const cleanText = stripHtml(rawHtml);
      const contentHash = sha256(cleanText);
      const headings = extractHeadings(rawHtml);
      const images = extractImageUrls(rawHtml, canonicalUrl);
      const links = extractLinks(rawHtml, canonicalUrl).filter((link) => isWithinBase(link.url, params.baseUrl));

      const existing = await query<{ id: string; content_hash: string }>(
        `
        SELECT id, content_hash
        FROM content_nodes
        WHERE tenant_id = $1 AND node_type = 'blog_post' AND url = $2
        LIMIT 1
        `,
        [params.tenantId, canonicalUrl]
      );

      if (existing[0] && existing[0].content_hash === contentHash) {
        counts.skipped += 1;
        await query(`UPDATE content_nodes SET last_seen_at = now(), updated_at = now() WHERE id = $1`, [existing[0].id]);
        continue;
      }

      const upserted = await upsertContentNode({
        tenantId: params.tenantId,
        nodeType: "blog_post",
        source: "site_crawl",
        url: canonicalUrl,
        title,
        slug: normalizeSlug(canonicalUrl),
        excerpt: summarizeExcerpt(cleanText),
        cleanText,
        rawHtml,
        headings,
        images,
        contentHash,
      });

      if (existing[0]) counts.updated += 1;
      else counts.created += 1;

      await refreshExplicitLinkEdges({
        tenantId: params.tenantId,
        blogNodeId: upserted.nodeId,
        links,
        listingsByUrl,
      });
    } catch {
      counts.skipped += 1;
    }
  }

  await upsertAuthorityAction({
    tenantId: params.tenantId,
    actionType: "blog_ingestion",
    status: "completed",
    details: counts,
  });

  return counts;
}

export function startBlogIngestionJob(params: {
  tenantId: string;
  baseUrl: string;
  dryRun?: boolean;
}): IngestJob {
  const jobId = crypto.randomUUID();
  const job: IngestJob = {
    jobId,
    tenantId: params.tenantId,
    status: "queued",
    dryRun: params.dryRun === true,
    createdAt: nowIso(),
    startedAt: null,
    finishedAt: null,
    result: null,
  };
  ingestJobs.set(jobId, job);

  setTimeout(async () => {
    const current = ingestJobs.get(jobId);
    if (!current) return;
    current.status = "running";
    current.startedAt = nowIso();
    ingestJobs.set(jobId, current);

    try {
      const result = await runBlogIngestion({
        tenantId: params.tenantId,
        baseUrl: params.baseUrl,
        dryRun: params.dryRun,
      });
      current.status = "completed";
      current.finishedAt = nowIso();
      current.result = {
        baseUrl: params.baseUrl,
        discovered: result.discovered,
        created: result.created,
        updated: result.updated,
        skipped: result.skipped,
      };
      ingestJobs.set(jobId, current);
    } catch (error) {
      current.status = "failed";
      current.finishedAt = nowIso();
      current.result = {
        baseUrl: params.baseUrl,
        discovered: 0,
        created: 0,
        updated: 0,
        skipped: 0,
        error: error instanceof Error ? error.message : "Unknown ingestion error",
      };
      ingestJobs.set(jobId, current);
    }
  }, 5);

  return job;
}

export function getBlogIngestionJob(jobId: string): IngestJob | null {
  return ingestJobs.get(jobId) ?? null;
}

export async function runEntityResolution(tenantId: string): Promise<{ blogsProcessed: number; mentionsCreated: number }> {
  const listings = await syncListingGraphNodes(tenantId);
  const blogs = await listBlogNodes(tenantId);

  let mentionsCreated = 0;
  for (const blog of blogs) {
    const before = await query<{ count: string }>(
      `SELECT count(*)::text AS count FROM entity_mentions WHERE tenant_id = $1 AND blog_node_id = $2`,
      [tenantId, blog.id]
    );

    await resolveMentionsForBlogNode({ tenantId, blogNode: blog, listings });

    const after = await query<{ count: string }>(
      `SELECT count(*)::text AS count FROM entity_mentions WHERE tenant_id = $1 AND blog_node_id = $2`,
      [tenantId, blog.id]
    );

    mentionsCreated += Math.max(0, Number(after[0]?.count ?? 0) - Number(before[0]?.count ?? 0));
  }

  await upsertAuthorityAction({
    tenantId,
    actionType: "entity_resolution",
    status: "completed",
    details: {
      blogsProcessed: blogs.length,
      mentionsCreated,
    },
  });

  return { blogsProcessed: blogs.length, mentionsCreated };
}

async function queryLeaks(tenantId: string): Promise<LeakRecord[]> {
  return query<LeakRecord>(
    `
    SELECT
      implied.from_node_id AS "blogNodeId",
      blog.title AS "blogTitle",
      blog.url AS "blogUrl",
      implied.to_node_id AS "listingNodeId",
      listing.title AS "listingTitle",
      listing.url AS "listingUrl",
      COALESCE(implied.evidence_snippet, '') AS "evidenceSnippet",
      implied.strength_score::float8 AS "strengthScore"
    FROM content_edges implied
    JOIN content_nodes blog ON blog.id = implied.from_node_id
    JOIN content_nodes listing ON listing.id = implied.to_node_id
    LEFT JOIN content_edges explicit
      ON explicit.tenant_id = implied.tenant_id
     AND explicit.from_node_id = implied.from_node_id
     AND explicit.to_node_id = implied.to_node_id
     AND explicit.edge_type = 'explicit_link'
    WHERE implied.tenant_id = $1
      AND implied.edge_type = 'implied_mention'
      AND explicit.id IS NULL
    ORDER BY implied.last_seen_at DESC
    `,
    [tenantId]
  );
}

async function queryWeakAnchors(tenantId: string): Promise<WeakAnchorRecord[]> {
  const rows = await query<WeakAnchorRecord>(
    `
    SELECT
      from_node_id AS "blogNodeId",
      to_node_id AS "listingNodeId",
      COALESCE(anchor_text, '') AS "anchorText"
    FROM content_edges
    WHERE tenant_id = $1
      AND edge_type = 'explicit_link'
    `,
    [tenantId]
  );

  return rows.filter((row) => GENERIC_ANCHORS.has(row.anchorText.toLowerCase().trim()));
}

async function queryOrphans(tenantId: string): Promise<OrphanListingRecord[]> {
  return query<OrphanListingRecord>(
    `
    SELECT
      listing.id AS "listingNodeId",
      listing.title AS "listingTitle",
      listing.url AS "listingUrl"
    FROM content_nodes listing
    LEFT JOIN content_edges e
      ON e.tenant_id = listing.tenant_id
     AND e.to_node_id = listing.id
     AND e.edge_type = 'explicit_link'
    LEFT JOIN content_nodes from_node
      ON from_node.id = e.from_node_id
    WHERE listing.tenant_id = $1
      AND listing.node_type = 'listing'
    GROUP BY listing.id, listing.title, listing.url
    HAVING COUNT(CASE WHEN from_node.node_type IN ('blog_post', 'support_post', 'hub_post') THEN 1 END) = 0
    ORDER BY listing.updated_at DESC
    `,
    [tenantId]
  );
}

export async function runLeakScanner(tenantId: string): Promise<{
  leaks: LeakRecord[];
  weakAnchors: WeakAnchorRecord[];
  orphanListings: OrphanListingRecord[];
}> {
  const leaks = await queryLeaks(tenantId);
  const weakAnchors = await queryWeakAnchors(tenantId);
  const orphanListings = await queryOrphans(tenantId);

  await upsertAuthorityAction({
    tenantId,
    actionType: "scan_network",
    status: "completed",
    details: {
      leakCount: leaks.length,
      weakAnchorCount: weakAnchors.length,
      orphanListingCount: orphanListings.length,
    },
  });

  return { leaks, weakAnchors, orphanListings };
}

function buildFixPatch(params: {
  html: string;
  listingTitle: string;
  listingUrl: string;
}): { patchedHtml: string; insertions: number } {
  const alreadyLinkedPattern = new RegExp(`<a[^>]+href=["']${params.listingUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["'][^>]*>`, "i");
  if (alreadyLinkedPattern.test(params.html)) {
    return { patchedHtml: params.html, insertions: 0 };
  }

  const escapedTitle = params.listingTitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const titlePattern = new RegExp(`\\b(${escapedTitle})\\b`, "i");
  if (!titlePattern.test(params.html)) {
    return { patchedHtml: params.html, insertions: 0 };
  }

  const replacement = `<a href="${params.listingUrl}">${params.listingTitle}</a>`;
  const patched = params.html.replace(titlePattern, replacement);
  return { patchedHtml: patched, insertions: patched === params.html ? 0 : 1 };
}

export async function previewLeakFix(params: {
  tenantId: string;
  blogNodeId: string;
  listingNodeId: string;
}): Promise<{
  beforeHtml: string;
  afterHtml: string;
  diffJson: {
    insertions: number;
    changed: boolean;
  };
  renderedPreviewHtml: string;
  linkChecks: {
    blogToListing: "ok" | "missing";
    listingToBlog: "ok" | "missing";
  };
}> {
  const rows = await query<{
    blog_html: string | null;
    blog_text: string;
    blog_url: string;
    blog_title: string;
    listing_url: string;
    listing_title: string;
  }>(
    `
    SELECT
      blog.raw_html AS blog_html,
      blog.clean_text AS blog_text,
      blog.url AS blog_url,
      blog.title AS blog_title,
      listing.url AS listing_url,
      listing.title AS listing_title
    FROM content_nodes blog
    JOIN content_nodes listing ON listing.id = $3 AND listing.tenant_id = blog.tenant_id
    WHERE blog.tenant_id = $1 AND blog.id = $2
    LIMIT 1
    `,
    [params.tenantId, params.blogNodeId, params.listingNodeId]
  );

  if (!rows[0]) {
    throw new Error("Blog or listing node not found.");
  }

  const baseHtml = rows[0].blog_html ?? `<p>${rows[0].blog_text}</p>`;
  const patched = buildFixPatch({
    html: baseHtml,
    listingTitle: rows[0].listing_title,
    listingUrl: rows[0].listing_url,
  });

  const linkChecks = {
    blogToListing: patched.insertions > 0 || baseHtml.includes(rows[0].listing_url) ? ("ok" as const) : ("missing" as const),
    listingToBlog: "missing" as const,
  };

  await upsertAuthorityAction({
    tenantId: params.tenantId,
    actionType: "preview_fix",
    targetNodeId: params.blogNodeId,
    status: "ready",
    details: {
      blogNodeId: params.blogNodeId,
      listingNodeId: params.listingNodeId,
      insertions: patched.insertions,
      changed: patched.patchedHtml !== baseHtml,
    },
  });

  return {
    beforeHtml: baseHtml,
    afterHtml: patched.patchedHtml,
    diffJson: {
      insertions: patched.insertions,
      changed: patched.patchedHtml !== baseHtml,
    },
    renderedPreviewHtml: patched.patchedHtml,
    linkChecks,
  };
}

export async function approveLeakFix(params: {
  tenantId: string;
  blogNodeId: string;
  listingNodeId: string;
  approved: boolean;
}): Promise<{ status: "applied_remote" | "pending_manual_apply" | "no_change"; details: Record<string, unknown> }> {
  if (!params.approved) {
    throw new Error("Approval required. Submit approved=true after preview.");
  }

  const preview = await previewLeakFix({
    tenantId: params.tenantId,
    blogNodeId: params.blogNodeId,
    listingNodeId: params.listingNodeId,
  });

  if (!preview.diffJson.changed) {
    await upsertAuthorityAction({
      tenantId: params.tenantId,
      actionType: "approve_fix",
      targetNodeId: params.blogNodeId,
      status: "no_change",
      details: {
        blogNodeId: params.blogNodeId,
        listingNodeId: params.listingNodeId,
      },
    });

    return { status: "no_change", details: { message: "No missing link patch detected." } };
  }

  const blog = await query<{ external_id: string | null; source: GraphSource }>(
    `
    SELECT external_id, source
    FROM content_nodes
    WHERE tenant_id = $1 AND id = $2
    LIMIT 1
    `,
    [params.tenantId, params.blogNodeId]
  );

  const listing = await query<{ url: string; title: string }>(
    `
    SELECT url, title
    FROM content_nodes
    WHERE tenant_id = $1 AND id = $2
    LIMIT 1
    `,
    [params.tenantId, params.listingNodeId]
  );

  let status: "applied_remote" | "pending_manual_apply" = "pending_manual_apply";
  const details: Record<string, unknown> = {
    blogNodeId: params.blogNodeId,
    listingNodeId: params.listingNodeId,
  };

  const blogExternalId = blog[0]?.external_id ?? null;
  if (blog[0]?.source === "bd" && blogExternalId) {
    const bd = await getDirectoryIqBdConnection(params.tenantId);
    if (bd) {
      const push = await pushListingUpdateToBd({
        baseUrl: bd.baseUrl,
        apiKey: bd.apiKey,
        dataPostsUpdatePath: bd.dataPostsUpdatePath,
        postId: blogExternalId,
        changes: {
          post_body: preview.afterHtml,
        },
      });

      if (push.ok) {
        status = "applied_remote";
        details.pushStatus = "ok";
      } else {
        details.pushStatus = "failed";
        details.pushError = push.body;
      }
    }
  }

  await query(
    `
    UPDATE content_nodes
    SET raw_html = $3,
        clean_text = $4,
        content_hash = $5,
        updated_at = now(),
        last_seen_at = now()
    WHERE tenant_id = $1 AND id = $2
    `,
    [params.tenantId, params.blogNodeId, preview.afterHtml, stripHtml(preview.afterHtml), sha256(stripHtml(preview.afterHtml))]
  );

  if (listing[0]) {
    await upsertEdge({
      tenantId: params.tenantId,
      fromNodeId: params.blogNodeId,
      toNodeId: params.listingNodeId,
      edgeType: "explicit_link",
      anchorText: listing[0].title,
      evidenceSnippet: listing[0].title,
      strengthScore: 1,
    });
  }

  await upsertAuthorityAction({
    tenantId: params.tenantId,
    actionType: "approve_fix",
    targetNodeId: params.blogNodeId,
    status,
    details,
  });

  return { status, details };
}

export async function generateAuthorityHub(params: {
  tenantId: string;
  queryText: string;
  listingNodeIds: string[];
}): Promise<{
  hubNodeId: string;
  title: string;
  coveredListings: number;
}> {
  const listingRows = await query<{ id: string; title: string; url: string }>(
    `
    SELECT id, title, url
    FROM content_nodes
    WHERE tenant_id = $1
      AND node_type = 'listing'
      AND ($2::uuid[] IS NULL OR id = ANY($2::uuid[]))
    ORDER BY updated_at DESC
    LIMIT 10
    `,
    [params.tenantId, params.listingNodeIds.length > 0 ? params.listingNodeIds : null]
  );

  if (listingRows.length < 3) {
    throw new Error("At least 3 listings are required to generate an authority hub.");
  }

  const serpApiKey = await getSerpApiKeyForUser(params.tenantId);
  let serpResults: Array<{ title?: string; link?: string; snippet?: string }> = [];
  if (process.env.E2E_MOCK_FETCH === "1") {
    serpResults = listingRows.slice(0, 5).map((listing, index) => ({
      title: `${params.queryText} example ${index + 1}`,
      link: listing.url,
      snippet: `Coverage reference ${index + 1} for ${listing.title}.`,
    }));
  } else if (serpApiKey) {
    serpResults = await fetchTopSerpOrganicResults({
      apiKey: serpApiKey,
      query: params.queryText,
      num: 10,
    });
  }

  const openAiKey = await getDirectoryIqOpenAiKey(params.tenantId);
  const listingBullet = listingRows.map((listing) => `- ${listing.title}: ${listing.url}`).join("\n");
  const serpBullet = serpResults.map((row) => `- ${row.title ?? ""} :: ${row.link ?? ""} :: ${row.snippet ?? ""}`).join("\n");
  const prompt = [
    "Create an authority hub blog draft in HTML.",
    "Requirements:",
    "- Link to each listed listing URL once with strong anchor text",
    "- Use h1/h2/h3 structure",
    "- Keep objective, no fabricated claims",
    "- Include a concise intro and actionable summary",
    `Topic query: ${params.queryText}`,
    `Listings:\n${listingBullet}`,
    `Serp patterns:\n${serpBullet}`,
    "Return HTML only.",
  ].join("\n\n");

  const generatedHtml = openAiKey
    ? await generateAuthorityDraft({ apiKey: openAiKey, prompt })
    : `<article><h1>${params.queryText}</h1><p>Authority hub draft.</p>${listingRows
        .map((listing) => `<h2><a href="${listing.url}">${listing.title}</a></h2><p>Coverage summary for ${listing.title}.</p>`)
        .join("")}</article>`;

  const cleaned = stripHtml(generatedHtml);
  const hubTitle = extractTitle(generatedHtml);
  const hubUrl = `https://authority.local/hubs/${sha256(`${params.queryText}|${nowIso()}`).slice(0, 12)}`;

  const upsert = await upsertContentNode({
    tenantId: params.tenantId,
    nodeType: "hub_post",
    source: "generated",
    url: hubUrl,
    title: hubTitle,
    slug: normalizeSlug(hubUrl),
    excerpt: summarizeExcerpt(cleaned),
    cleanText: cleaned,
    rawHtml: generatedHtml,
    headings: extractHeadings(generatedHtml),
    images: extractImageUrls(generatedHtml, hubUrl),
    contentHash: sha256(cleaned),
  });

  for (const listing of listingRows) {
    await upsertEdge({
      tenantId: params.tenantId,
      fromNodeId: upsert.nodeId,
      toNodeId: listing.id,
      edgeType: "explicit_link",
      anchorText: listing.title,
      evidenceSnippet: listing.title,
      strengthScore: 1,
    });
  }

  await query(
    `
    INSERT INTO serp_snapshots (tenant_id, query, results_json, fetched_at, ttl_expires_at)
    VALUES ($1, $2, $3::jsonb, now(), now() + interval '7 days')
    ON CONFLICT (tenant_id, query)
    DO UPDATE SET
      results_json = EXCLUDED.results_json,
      fetched_at = now(),
      ttl_expires_at = now() + interval '7 days'
    `,
    [params.tenantId, params.queryText, JSON.stringify(serpResults)]
  );

  await upsertAuthorityAction({
    tenantId: params.tenantId,
    actionType: "generate_hub",
    targetNodeId: upsert.nodeId,
    status: "completed",
    details: {
      query: params.queryText,
      listingCount: listingRows.length,
    },
  });

  return {
    hubNodeId: upsert.nodeId,
    title: hubTitle,
    coveredListings: listingRows.length,
  };
}

export async function getAuthorityNetworkSummary(tenantId: string): Promise<{
  networkHealthScore: number;
  leaks: number;
  weakAnchors: number;
  orphanListings: number;
  hubCoveragePercent: number;
  coveredListings: number;
  totalListings: number;
}> {
  const leakRows = await query<{ count: string }>(
    `
    SELECT count(*)::text AS count
    FROM content_edges implied
    LEFT JOIN content_edges explicit
      ON explicit.tenant_id = implied.tenant_id
     AND explicit.from_node_id = implied.from_node_id
     AND explicit.to_node_id = implied.to_node_id
     AND explicit.edge_type = 'explicit_link'
    WHERE implied.tenant_id = $1
      AND implied.edge_type = 'implied_mention'
      AND explicit.id IS NULL
    `,
    [tenantId]
  );

  const weakAnchors = await queryWeakAnchors(tenantId);
  const orphans = await queryOrphans(tenantId);

  const coverageRows = await query<{ total_listings: string; covered_listings: string }>(
    `
    WITH listings AS (
      SELECT id
      FROM content_nodes
      WHERE tenant_id = $1 AND node_type = 'listing'
    ), covered AS (
      SELECT DISTINCT e.to_node_id AS listing_id
      FROM content_edges e
      JOIN content_nodes from_node ON from_node.id = e.from_node_id
      WHERE e.tenant_id = $1
        AND e.edge_type = 'explicit_link'
        AND from_node.node_type = 'hub_post'
    )
    SELECT
      (SELECT count(*)::text FROM listings) AS total_listings,
      (SELECT count(*)::text FROM covered) AS covered_listings
    `,
    [tenantId]
  );

  const leaks = Number(leakRows[0]?.count ?? 0);
  const totalListings = Number(coverageRows[0]?.total_listings ?? 0);
  const coveredListings = Number(coverageRows[0]?.covered_listings ?? 0);
  const hubCoveragePercent = totalListings > 0 ? Math.round((coveredListings / totalListings) * 100) : 0;

  const penalties = leaks * 6 + weakAnchors.length * 4 + orphans.length * 5 + Math.max(0, 40 - hubCoveragePercent) * 0.5;
  const networkHealthScore = Math.max(0, Math.min(100, Math.round(100 - penalties)));

  return {
    networkHealthScore,
    leaks,
    weakAnchors: weakAnchors.length,
    orphanListings: orphans.length,
    hubCoveragePercent,
    coveredListings,
    totalListings,
  };
}

export async function getLeakList(tenantId: string): Promise<LeakRecord[]> {
  return queryLeaks(tenantId);
}

export async function getListingAuthorityDetail(tenantId: string, listingNodeId: string): Promise<{
  mentions: number;
  linked: number;
  leaks: number;
}> {
  const rows = await query<{ mentions: string; linked: string; leaks: string }>(
    `
    SELECT
      (SELECT count(*)::text FROM content_edges WHERE tenant_id = $1 AND to_node_id = $2 AND edge_type = 'implied_mention') AS mentions,
      (SELECT count(*)::text FROM content_edges WHERE tenant_id = $1 AND to_node_id = $2 AND edge_type = 'explicit_link') AS linked,
      (
        SELECT count(*)::text
        FROM content_edges implied
        LEFT JOIN content_edges explicit
          ON explicit.tenant_id = implied.tenant_id
         AND explicit.from_node_id = implied.from_node_id
         AND explicit.to_node_id = implied.to_node_id
         AND explicit.edge_type = 'explicit_link'
        WHERE implied.tenant_id = $1
          AND implied.to_node_id = $2
          AND implied.edge_type = 'implied_mention'
          AND explicit.id IS NULL
      ) AS leaks
    `,
    [tenantId, listingNodeId]
  );

  return {
    mentions: Number(rows[0]?.mentions ?? 0),
    linked: Number(rows[0]?.linked ?? 0),
    leaks: Number(rows[0]?.leaks ?? 0),
  };
}

export async function getBlogAuthorityDetail(tenantId: string, blogNodeId: string): Promise<{
  entities: Array<{ mentionText: string; evidenceSnippet: string; resolvedListingNodeId: string | null }>;
  missingLinks: number;
}> {
  const mentions = await query<{ mention_text: string; evidence_snippet: string; resolved_listing_node_id: string | null }>(
    `
    SELECT mention_text, evidence_snippet, resolved_listing_node_id
    FROM entity_mentions
    WHERE tenant_id = $1 AND blog_node_id = $2
    ORDER BY created_at DESC
    `,
    [tenantId, blogNodeId]
  );

  const leaks = await query<{ count: string }>(
    `
    SELECT count(*)::text AS count
    FROM content_edges implied
    LEFT JOIN content_edges explicit
      ON explicit.tenant_id = implied.tenant_id
     AND explicit.from_node_id = implied.from_node_id
     AND explicit.to_node_id = implied.to_node_id
     AND explicit.edge_type = 'explicit_link'
    WHERE implied.tenant_id = $1
      AND implied.from_node_id = $2
      AND implied.edge_type = 'implied_mention'
      AND explicit.id IS NULL
    `,
    [tenantId, blogNodeId]
  );

  return {
    entities: mentions.map((mention) => ({
      mentionText: mention.mention_text,
      evidenceSnippet: mention.evidence_snippet,
      resolvedListingNodeId: mention.resolved_listing_node_id,
    })),
    missingLinks: Number(leaks[0]?.count ?? 0),
  };
}

import "server-only";

import { getWalmartSerpApiKeyForUser } from "@/lib/ecomviper/walmart/walmart-serpapi-connection";
import { extractSerpApiErrorDetail, sanitizeSerpApiErrorDetail } from "@/lib/ecomviper/walmart/serpapi-safety";
import type { WalmartProductRecord } from "@/lib/ecomviper/walmart/walmart-types";

const SERPAPI_ENDPOINT = "https://serpapi.com/search.json";
const DEFAULT_TIMEOUT_MS = 8_000;
const CACHE_TTL_MS = 15 * 60 * 1000;

type CompetitorStatus =
  | "available"
  | "skipped_no_credentials"
  | "timeout"
  | "provider_error"
  | "empty";

export interface WalmartCompetitorPatternSummary {
  titlePatterns: string[];
  commonAttributes: string[];
  supportPhrases: string[];
  mediaPatterns: string[];
  priceCountNotes: string[];
  gaps: string[];
}

export interface WalmartCompetitorIntelligence {
  status: CompetitorStatus;
  queries: string[];
  competitors: Array<{
    title: string;
    productId: string;
    price: string;
  }>;
  patterns: WalmartCompetitorPatternSummary;
  warnings: string[];
}

interface CachedCompetitorEntry {
  key: string;
  value: WalmartCompetitorIntelligence;
  expiresAt: number;
}

declare global {
  var __ecomviper_walmart_competitor_cache__: Map<string, CachedCompetitorEntry> | undefined;
}

function getCacheStore(): Map<string, CachedCompetitorEntry> {
  if (!globalThis.__ecomviper_walmart_competitor_cache__) {
    globalThis.__ecomviper_walmart_competitor_cache__ = new Map<string, CachedCompetitorEntry>();
  }
  return globalThis.__ecomviper_walmart_competitor_cache__;
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function asObjectArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => asObject(entry))
    .filter((entry): entry is Record<string, unknown> => entry !== null);
}

function asText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map((entry) => entry.trim()).filter(Boolean)));
}

function normalizeWords(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 2);
}

function firstNonEmpty(...values: string[]): string {
  for (const value of values) {
    const normalized = value.trim();
    if (normalized) return normalized;
  }
  return "";
}

function inferForm(value: string): string {
  const match = value.match(/\b(capsules?|softgels?|gummies?|tablets?|powder|liquid)\b/i);
  return match?.[1]?.toLowerCase() ?? "";
}

function inferCount(value: string): string {
  const match = value.match(/\b(\d{1,4})\s*(capsules?|softgels?|gummies?|tablets?|ct|count|servings?)\b/i);
  if (!match) return "";
  return `${match[1]} ${match[2].toLowerCase()}`;
}

export function buildWalmartCompetitorResearchQueries(input: {
  product: WalmartProductRecord;
  draftPayload?: Record<string, unknown> | null;
}): string[] {
  const searchBrowse = {
    ...(input.product.searchBrowseAttributes ?? {}),
    ...(input.product.attributes ?? {}),
    ...(asObject(input.draftPayload)?.searchBrowseAttributes ?? {}),
    ...(asObject(input.draftPayload)?.attributes ?? {}),
  } as Record<string, unknown>;

  const ingredient = firstNonEmpty(
    asText(searchBrowse.main_ingredients).split(/[;,]/)[0] ?? "",
    asText(searchBrowse.primary_ingredient),
    input.product.title.split(" ").slice(0, 3).join(" ")
  );

  const supportArea = firstNonEmpty(
    asText(searchBrowse.support_areas).split(/[;,]/)[0] ?? "",
    asText(searchBrowse.benefits_support_areas),
    "daily wellness"
  );

  const form = firstNonEmpty(
    asText(searchBrowse.product_form),
    asText(searchBrowse.form),
    inferForm(input.product.title),
    "supplement"
  );

  const count = firstNonEmpty(
    asText(searchBrowse.count),
    inferCount(input.product.title),
    "count"
  );

  const productType = firstNonEmpty(
    asText(searchBrowse.product_type),
    asText(searchBrowse.supplement_type),
    input.product.category,
    "supplement"
  );

  return unique([
    `${ingredient} ${productType}`,
    `${supportArea} supplement ${form}`,
    `${productType} ${count}`,
    `${ingredient} ${supportArea}`,
    input.product.title.replace(new RegExp(`^${input.product.brand}\\s+`, "i"), ""),
  ])
    .filter((entry) => entry.trim().length > 4)
    .slice(0, 5);
}

function makeEmptyPatterns(): WalmartCompetitorPatternSummary {
  return {
    titlePatterns: [],
    commonAttributes: [],
    supportPhrases: [],
    mediaPatterns: [],
    priceCountNotes: [],
    gaps: [],
  };
}

function cacheKey(input: { userId: string; sku: string; queries: string[] }): string {
  return `${input.userId}::${input.sku}::${input.queries.join("|")}`;
}

function readCache(key: string): WalmartCompetitorIntelligence | null {
  const entry = getCacheStore().get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    getCacheStore().delete(key);
    return null;
  }
  return entry.value;
}

function writeCache(key: string, value: WalmartCompetitorIntelligence): void {
  getCacheStore().set(key, {
    key,
    value,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

function parseCompetitors(payload: Record<string, unknown>): Array<{ title: string; productId: string; price: string }> {
  const organic = asObjectArray(payload.organic_results);
  const featured = asObject(payload.featured_item);

  const rows: Array<{ title: string; productId: string; price: string }> = [];

  if (featured) {
    rows.push({
      title: asText(featured.title),
      productId: firstNonEmpty(asText(featured.us_item_id), asText(featured.product_id)),
      price: firstNonEmpty(asText(featured.primary_offer), asText(featured.price), ""),
    });
  }

  for (const item of organic) {
    rows.push({
      title: asText(item.title),
      productId: firstNonEmpty(asText(item.us_item_id), asText(item.product_id)),
      price: firstNonEmpty(asText(item.primary_offer), asText(item.price), ""),
    });
  }

  return rows
    .filter((entry) => entry.title.length > 0)
    .slice(0, 12);
}

function summarizePatterns(competitors: Array<{ title: string; productId: string; price: string }>): WalmartCompetitorPatternSummary {
  if (competitors.length === 0) {
    return makeEmptyPatterns();
  }

  const titlePatterns = unique(
    competitors
      .map((entry) => {
        const form = inferForm(entry.title);
        const count = inferCount(entry.title);
        if (!form && !count) return "";
        return `Title often includes ${[form || null, count || null].filter(Boolean).join(" + ")}`;
      })
      .filter(Boolean)
  ).slice(0, 5);

  const supportPhrases = unique(
    competitors
      .flatMap((entry) => {
        const text = entry.title.toLowerCase();
        const hits = [
          /sleep/.test(text) ? "sleep support" : "",
          /relax/.test(text) ? "relaxation support" : "",
          /digest/.test(text) ? "digestive wellness" : "",
          /immune/.test(text) ? "immune wellness" : "",
          /joint/.test(text) ? "joint comfort" : "",
          /metabol/.test(text) ? "metabolism support" : "",
        ];
        return hits.filter(Boolean);
      })
  ).slice(0, 6);

  const priceCountNotes = unique(
    competitors
      .map((entry) => {
        const count = inferCount(entry.title);
        if (!entry.price && !count) return "";
        return `Observed ${count || "count not explicit"} with price ${entry.price || "not shown"}`;
      })
      .filter(Boolean)
  ).slice(0, 4);

  const tokenFrequency = new Map<string, number>();
  competitors.forEach((entry) => {
    normalizeWords(entry.title).forEach((token) => {
      tokenFrequency.set(token, (tokenFrequency.get(token) ?? 0) + 1);
    });
  });

  const commonAttributes = Array.from(tokenFrequency.entries())
    .filter(([, count]) => count >= Math.max(2, Math.floor(competitors.length / 2)))
    .sort((left, right) => right[1] - left[1])
    .slice(0, 8)
    .map(([token]) => token);

  const mediaPatterns = [
    "Front-bottle thumbnail clarity is common in top Walmart results",
    "Label-readable images are frequently present in competitive listings",
  ];

  const gaps = [
    "Differentiate with precise support-area language and label-backed specificity",
    "Ensure Search & Browse attributes align to title form/count terms",
  ];

  return {
    titlePatterns,
    commonAttributes,
    supportPhrases,
    mediaPatterns,
    priceCountNotes,
    gaps,
  };
}

async function fetchSerpApiQuery(params: {
  apiKey: string;
  query: string;
  timeoutMs: number;
}): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), params.timeoutMs);

  try {
    const url = new URL(SERPAPI_ENDPOINT);
    url.searchParams.set("engine", "walmart");
    url.searchParams.set("query", params.query);
    url.searchParams.set("api_key", params.apiKey);
    url.searchParams.set("num", "10");

    const response = await fetch(url.toString(), {
      method: "GET",
      signal: controller.signal,
      cache: "no-store",
    });

    const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;

    if (!response.ok) {
      const detail = sanitizeSerpApiErrorDetail(
        extractSerpApiErrorDetail(payload, { includeGenericMessage: true }) ?? response.statusText
      );
      throw new Error(detail || `SerpApi request failed: ${response.status}`);
    }

    return payload;
  } finally {
    clearTimeout(timeout);
  }
}

export async function getWalmartSerpApiCompetitorIntelligence(params: {
  userId: string;
  product: WalmartProductRecord;
  draftPayload?: Record<string, unknown> | null;
  timeoutMs?: number;
}): Promise<WalmartCompetitorIntelligence> {
  const queries = buildWalmartCompetitorResearchQueries({
    product: params.product,
    draftPayload: params.draftPayload ?? null,
  });

  const key = cacheKey({
    userId: params.userId,
    sku: params.product.sku,
    queries,
  });
  const cached = readCache(key);
  if (cached) {
    return cached;
  }

  const apiKey = await getWalmartSerpApiKeyForUser(params.userId);
  if (!apiKey) {
    const result: WalmartCompetitorIntelligence = {
      status: "skipped_no_credentials",
      queries,
      competitors: [],
      patterns: makeEmptyPatterns(),
      warnings: ["SerpApi credentials not connected; optimization continues with local docket facts."],
    };
    writeCache(key, result);
    return result;
  }

  const timeoutMs = Math.max(2_000, params.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  try {
    const payloads = await Promise.all(
      queries.map((query) => fetchSerpApiQuery({ apiKey, query, timeoutMs }))
    );

    const competitors = unique(
      payloads
        .flatMap((payload) => parseCompetitors(payload))
        .map((entry) => JSON.stringify(entry))
    ).map((entry) => JSON.parse(entry) as { title: string; productId: string; price: string });

    if (competitors.length === 0) {
      const result: WalmartCompetitorIntelligence = {
        status: "empty",
        queries,
        competitors: [],
        patterns: makeEmptyPatterns(),
        warnings: ["SerpApi returned no competitor candidates for this docket context."],
      };
      writeCache(key, result);
      return result;
    }

    const result: WalmartCompetitorIntelligence = {
      status: "available",
      queries,
      competitors: competitors.slice(0, 10),
      patterns: summarizePatterns(competitors),
      warnings: [],
    };
    writeCache(key, result);
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "SerpApi request failed";
    const timeout = /aborted|timeout/i.test(message);
    const result: WalmartCompetitorIntelligence = {
      status: timeout ? "timeout" : "provider_error",
      queries,
      competitors: [],
      patterns: makeEmptyPatterns(),
      warnings: [
        timeout
          ? "Competitor context timed out; optimization continued with local docket facts."
          : `Competitor context unavailable: ${sanitizeSerpApiErrorDetail(message) ?? "provider error"}`,
      ],
    };
    writeCache(key, result);
    return result;
  }
}

import {
  FILEIQ_AGENT_DEFAULT_MODEL,
  FILEIQ_AGENT_TOOLS,
  resolveFileIqAgentApiKey,
} from "@/lib/fileiq/agent/fileiq-agent-core";
import { extractJsonFromAgentResult } from "@/lib/fileiq/result-parser";
import { FirecrawlClient } from "@/lib/ecomviper/suppliers/firecrawl/firecrawl-client";
import { query } from "@anthropic-ai/claude-agent-sdk";

const LOG = "[fileiq:url-source]";
const MIN_QUALITY_CHARS = 500;
const FIRECRAWL_MISSING_KEY_MESSAGE =
  "Firecrawl fallback needed but FIRECRAWL_API_KEY not set";

export type UrlFetchMethod = "sdk" | "firecrawl";

export interface UrlSourceResult {
  markdown: string;
  title: string | null;
  sourceUrl: string;
  scrapedAt: string;
  method: UrlFetchMethod;
}

export interface UrlSourceQualityResult {
  ok: boolean;
  reason: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function htmlTagRatio(markdown: string): number {
  const tagMatches = markdown.match(/<\/?[a-z][^>]*>/gi) ?? [];
  const tagChars = tagMatches.reduce((sum, tag) => sum + tag.length, 0);
  const visibleChars = markdown.replace(/<\/?[a-z][^>]*>/gi, "").trim().length;
  if (visibleChars === 0) return tagChars > 0 ? 1 : 0;
  return tagChars / (tagChars + visibleChars);
}

function looksLikeEmptyShell(markdown: string): boolean {
  const text = normalizeWhitespace(markdown).toLowerCase();
  if (!text) return true;
  const shellSignals = [
    "enable javascript",
    "please enable javascript",
    "you need to enable javascript",
    "app-root",
    "__next",
    "root id=\"root\"",
    "loading...",
  ];
  return shellSignals.some((signal) => text.includes(signal)) && text.length < 1_500;
}

function looksPaywalled(markdown: string): boolean {
  const text = normalizeWhitespace(markdown).toLowerCase();
  return [
    "subscribe to continue",
    "sign in to continue",
    "create an account to continue",
    "already a subscriber",
    "paywall",
  ].some((signal) => text.includes(signal));
}

export function evaluateUrlSourceQuality(markdown: string): UrlSourceQualityResult {
  const trimmed = markdown.trim();
  if (trimmed.length <= MIN_QUALITY_CHARS) {
    return { ok: false, reason: `content_length_${trimmed.length}_lte_${MIN_QUALITY_CHARS}` };
  }
  if (htmlTagRatio(trimmed) > 0.35) {
    return { ok: false, reason: "mostly_html_tags" };
  }
  if (looksLikeEmptyShell(trimmed)) {
    return { ok: false, reason: "empty_shell" };
  }
  if (looksPaywalled(trimmed)) {
    return { ok: false, reason: "paywall_or_login_wall" };
  }
  return { ok: true, reason: "quality_pass" };
}

function titleFromPayload(payload: Record<string, unknown>): string | null {
  const direct = payload.title;
  if (typeof direct === "string" && direct.trim()) return direct.trim();
  const metadata = payload.metadata;
  if (isRecord(metadata) && typeof metadata.title === "string" && metadata.title.trim()) {
    return metadata.title.trim();
  }
  return null;
}

function markdownFromPayload(payload: Record<string, unknown>): string {
  const candidates = [payload.markdown, payload.content, payload.text, payload.result];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }
  return "";
}

async function fetchWithSdk(url: string): Promise<Omit<UrlSourceResult, "method">> {
  if (!resolveFileIqAgentApiKey()) {
    throw new Error("ANTHROPIC_API_KEY is not set for Claude Agent SDK web fetch.");
  }

  const prompt = [
    `Fetch this URL using the ${FILEIQ_AGENT_TOOLS.webFetch} tool: ${url}`,
    "",
    "Return ONLY valid JSON with this exact shape:",
    '{"title":string|null,"sourceUrl":string,"markdown":string}',
    "",
    "The markdown field must contain the readable page content, not a summary.",
  ].join("\n");

  const session = query({
    prompt,
    options: {
      model: FILEIQ_AGENT_DEFAULT_MODEL,
      systemPrompt:
        "You are FileIQ's URL source fetcher. Use WebFetch and return the fetched content as markdown JSON only.",
      allowedTools: [FILEIQ_AGENT_TOOLS.webFetch],
      permissionMode: "default",
      maxTurns: 4,
      settingSources: [],
    },
  });

  for await (const message of session) {
    if (message.type === "result") {
      if (message.subtype !== "success") {
        throw new Error(`Claude Agent SDK web fetch ended with ${message.subtype}.`);
      }
      const parsed = extractJsonFromAgentResult(message.result);
      const payload = parsed.payload;
      return {
        markdown: markdownFromPayload(payload),
        title: titleFromPayload(payload),
        sourceUrl:
          typeof payload.sourceUrl === "string" && payload.sourceUrl.trim()
            ? payload.sourceUrl.trim()
            : url,
        scrapedAt: new Date().toISOString(),
      };
    }
  }

  throw new Error("Claude Agent SDK web fetch stream ended without a result.");
}

function hasFirecrawlApiKey(): boolean {
  return typeof process.env.FIRECRAWL_API_KEY === "string" && process.env.FIRECRAWL_API_KEY.trim().length > 0;
}

export function warnIfFirecrawlMissing(): void {
  if (!hasFirecrawlApiKey()) {
    console.warn(`${LOG} FIRECRAWL_API_KEY is not set; URL fallback scraping will fail if needed.`);
  }
}

function normalizeFirecrawlError(error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("429")) return new Error(`Firecrawl rate limit while scraping URL: ${message}`);
  if (/401|403|unauthorized|forbidden/i.test(message)) {
    return new Error(`Firecrawl authentication failed while scraping URL: ${message}`);
  }
  return new Error(`Firecrawl scrape failed: ${message}`);
}

async function fetchWithFirecrawl(url: string): Promise<UrlSourceResult> {
  if (!hasFirecrawlApiKey()) {
    throw new Error(FIRECRAWL_MISSING_KEY_MESSAGE);
  }

  let scrape;
  try {
    const client = new FirecrawlClient({
      enabled: true,
      allowLiveRequests: true,
    });
    scrape = await client.scrape({
      url,
      formats: ["markdown", "html"],
      useCache: true,
      onlyMainContent: true,
      parsers: url.toLowerCase().includes(".pdf") ? ["pdf"] : undefined,
    });
  } catch (error) {
    throw normalizeFirecrawlError(error);
  }

  const markdown = scrape.markdown?.trim() || "";
  const quality = evaluateUrlSourceQuality(markdown);
  if (!quality.ok) {
    throw new Error(`Firecrawl scrape failed quality check: ${quality.reason}`);
  }

  return {
    markdown,
    title:
      typeof scrape.metadata.title === "string" && scrape.metadata.title.trim()
        ? scrape.metadata.title.trim()
        : null,
    sourceUrl: scrape.url || url,
    scrapedAt: scrape.fetchedAt || new Date().toISOString(),
    method: "firecrawl",
  };
}

export async function fetchUrl(url: string): Promise<UrlSourceResult> {
  let sdkFailureReason = "not_attempted";
  try {
    const sdkResult = await fetchWithSdk(url);
    const quality = evaluateUrlSourceQuality(sdkResult.markdown);
    if (quality.ok) {
      console.log(`${LOG} url=${url} method=sdk reason=${quality.reason}`);
      return { ...sdkResult, method: "sdk" };
    }
    sdkFailureReason = quality.reason;
    console.warn(`${LOG} url=${url} sdk_quality_failed reason=${sdkFailureReason}; falling back to Firecrawl`);
  } catch (error) {
    sdkFailureReason = error instanceof Error ? error.message : String(error);
    console.warn(`${LOG} url=${url} sdk_fetch_failed reason=${sdkFailureReason}; falling back to Firecrawl`);
  }

  const firecrawlResult = await fetchWithFirecrawl(url);
  console.log(`${LOG} url=${url} method=firecrawl fallbackReason=${sdkFailureReason}`);
  return firecrawlResult;
}

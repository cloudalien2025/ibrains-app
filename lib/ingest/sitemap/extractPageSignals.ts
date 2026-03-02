import { fetchTextWithRetry } from "@/lib/ingest/sitemap/http";
import type { ExtractedPageSignals } from "@/lib/ingest/sitemap/types";
import { sameHost, toAbsoluteUrl } from "@/lib/ingest/sitemap/urlUtils";

type ExtractParams = {
  url: string;
  baseUrl: string;
  useDecodo?: boolean;
};

const MAX_TEXT_LEN = 12_000;
const MAX_JSONLD_CHARS = 80_000;
const MAX_LINKS = 120;

function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function pickFirstMatch(html: string, regex: RegExp): string | null {
  const match = html.match(regex);
  if (!match?.[1]) return null;
  const value = match[1].replace(/\s+/g, " ").trim();
  return value.length ? value : null;
}

function parseJsonLd(html: string): Array<Record<string, unknown>> {
  const output: Array<Record<string, unknown>> = [];
  const matches = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) ?? [];
  for (const block of matches) {
    const inner = block.replace(/^<script[^>]*>/i, "").replace(/<\/script>$/i, "").trim();
    if (!inner) continue;
    const bounded = inner.slice(0, MAX_JSONLD_CHARS);
    try {
      const parsed = JSON.parse(bounded) as unknown;
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (item && typeof item === "object") output.push(item as Record<string, unknown>);
        }
      } else if (parsed && typeof parsed === "object") {
        output.push(parsed as Record<string, unknown>);
      }
    } catch {
      // Ignore malformed JSON-LD blocks.
    }
  }
  return output.slice(0, 30);
}

function parseInternalLinks(html: string, baseUrl: string): string[] {
  const links = new Set<string>();
  const hrefMatches = html.match(/<a[^>]*href=["']([^"']+)["'][^>]*>/gi) ?? [];
  for (const match of hrefMatches) {
    const href = match.match(/href=["']([^"']+)["']/i)?.[1];
    if (!href) continue;
    const absolute = toAbsoluteUrl(href, baseUrl);
    if (!absolute || !sameHost(absolute, baseUrl)) continue;
    links.add(absolute);
    if (links.size >= MAX_LINKS) break;
  }
  return Array.from(links);
}

export async function extractPageSignals(params: ExtractParams): Promise<ExtractedPageSignals | null> {
  const response = await fetchTextWithRetry(params.url, {
    useDecodo: params.useDecodo ?? false,
    timeoutMs: 18_000,
    retries: 2,
  });

  const html = response.body ?? "";
  const title = pickFirstMatch(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
  const metaDescription = pickFirstMatch(
    html,
    /<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["'][^>]*>/i
  );
  const h1 = pickFirstMatch(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const canonicalUrl = pickFirstMatch(
    html,
    /<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["'][^>]*>/i
  );
  const jsonldBlobs = parseJsonLd(html);
  const outboundInternalLinks = parseInternalLinks(html, params.baseUrl);
  const extractedText = stripTags(html).slice(0, MAX_TEXT_LEN) || null;

  return {
    httpStatus: response.status,
    title,
    metaDescription,
    h1,
    jsonldBlobs,
    outboundInternalLinks,
    extractedText,
    canonicalUrl,
  };
}

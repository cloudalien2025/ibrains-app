import { gunzipSync } from "zlib";
import { fetchBufferWithRetry } from "@/lib/ingest/sitemap/http";
import { normalizeAbsoluteUrl } from "@/lib/ingest/sitemap/urlUtils";
import type { SitemapUrlEntry } from "@/lib/ingest/sitemap/types";

type ParseSitemapParams = {
  sitemapUrl: string;
  useDecodo?: boolean;
  maxUrls?: number;
};

export type ParsedSitemap = {
  kind: "urlset" | "sitemapindex";
  urls: SitemapUrlEntry[];
  nestedSitemaps: string[];
};

function decodeXmlEntity(input: string): string {
  return input
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'");
}

function tagValue(block: string, tag: string): string | null {
  const match = block.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "i"));
  if (!match) return null;
  return decodeXmlEntity(match[1].trim());
}

export function parseSitemapXml(xmlRaw: string, maxUrls = 5000): ParsedSitemap {
  const xml = xmlRaw.trim();
  const urls: SitemapUrlEntry[] = [];
  const nested: string[] = [];

  if (/<sitemapindex[\s>]/i.test(xml)) {
    const blocks = xml.match(/<sitemap[\s\S]*?<\/sitemap>/gi) ?? [];
    for (const block of blocks) {
      const loc = tagValue(block, "loc");
      const normalized = loc ? normalizeAbsoluteUrl(loc) : null;
      if (normalized) nested.push(normalized);
      if (nested.length >= maxUrls) break;
    }
    return { kind: "sitemapindex", urls, nestedSitemaps: Array.from(new Set(nested)) };
  }

  const blocks = xml.match(/<url[\s\S]*?<\/url>/gi) ?? [];
  for (const block of blocks) {
    const loc = tagValue(block, "loc");
    const normalized = loc ? normalizeAbsoluteUrl(loc) : null;
    if (!normalized) continue;
    urls.push({
      url: normalized,
      lastmod: tagValue(block, "lastmod"),
    });
    if (urls.length >= maxUrls) break;
  }
  return { kind: "urlset", urls, nestedSitemaps: [] };
}

export async function parseSitemap(params: ParseSitemapParams): Promise<ParsedSitemap> {
  const maxUrls = params.maxUrls ?? 5000;
  const response = await fetchBufferWithRetry(params.sitemapUrl, {
    useDecodo: params.useDecodo ?? false,
    timeoutMs: 20_000,
    retries: 2,
  });
  if (response.status >= 400) {
    throw new Error(`Failed to fetch sitemap: ${response.status}`);
  }

  let xml = "";
  if (params.sitemapUrl.toLowerCase().endsWith(".gz")) {
    xml = gunzipSync(response.body).toString("utf8");
  } else {
    try {
      xml = response.body.toString("utf8");
      if (!/<(?:urlset|sitemapindex)[\s>]/i.test(xml) && response.body.length > 2) {
        xml = gunzipSync(response.body).toString("utf8");
      }
    } catch {
      xml = response.body.toString("utf8");
    }
  }

  return parseSitemapXml(xml, maxUrls);
}

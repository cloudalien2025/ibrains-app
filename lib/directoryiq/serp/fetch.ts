import { directoryIqConfig } from "../config";
import type { ExtractedOutlineItem, SerpTopResult } from "../types";

const withTimeout = async (url: string): Promise<string> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), directoryIqConfig.serpFetchTimeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
};

const pickTagText = (html: string, tag: string): string[] => {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "gi");
  const matches: string[] = [];
  let found: RegExpExecArray | null = regex.exec(html);
  while (found) {
    matches.push(found[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
    found = regex.exec(html);
  }
  return matches.filter(Boolean);
};

export const fetchSerpTopResults = async (query: string): Promise<SerpTopResult[]> => {
  if (!directoryIqConfig.serpApiKey) throw new Error("SERPAPI_API_KEY is missing");
  const params = new URLSearchParams({ q: query, api_key: directoryIqConfig.serpApiKey, num: "10" });
  const response = await fetch(`https://serpapi.com/search.json?${params.toString()}`);
  if (!response.ok) {
    const message = `SerpAPI error ${response.status}`;
    const error = new Error(message);
    (error as Error & { code?: number }).code = response.status;
    throw error;
  }
  const body = (await response.json()) as { organic_results?: Array<{ position: number; title: string; link: string; snippet?: string }> };
  return (body.organic_results ?? []).slice(0, 10).map((item) => ({
    position: item.position,
    title: item.title,
    link: item.link,
    snippet: item.snippet ?? "",
  }));
};

export const fetchOutlineForResult = async (result: SerpTopResult): Promise<ExtractedOutlineItem> => {
  const html = await withTimeout(result.link);
  const title = pickTagText(html, "title")[0] ?? result.title;
  const h1 = pickTagText(html, "h1")[0] ?? "";
  const h2 = pickTagText(html, "h2");
  const h3 = pickTagText(html, "h3");
  const text = html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ");
  return {
    url: result.link,
    pageTitle: title,
    h1,
    h2,
    h3,
    wordCount: text.split(/\s+/).filter(Boolean).length,
  };
};

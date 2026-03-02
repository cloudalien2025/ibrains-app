import { fetchTextWithRetry } from "@/lib/ingest/sitemap/http";

type SerpResult = {
  title?: string;
  link?: string;
  snippet?: string;
  source?: string;
};

export type SerpDiscoveryRow = {
  query: string;
  results: SerpResult[];
};

function deriveQueries(baseUrl: string, homepageTitle: string | null): string[] {
  const host = new URL(baseUrl).hostname.replace(/^www\./, "");
  const brandGuess = (homepageTitle ?? host).split("|")[0].trim();
  return Array.from(
    new Set([`"${brandGuess}"`, `${host} reviews`, `${host} alternatives`].filter(Boolean))
  ).slice(0, 3);
}

export async function runSerpApiDiscovery(params: {
  baseUrl: string;
  serpApiKey: string | null;
  maxResultsPerQuery?: number;
}): Promise<SerpDiscoveryRow[]> {
  if (!params.serpApiKey) return [];

  let homepageTitle: string | null = null;
  try {
    const home = await fetchTextWithRetry(params.baseUrl, { timeoutMs: 10_000, retries: 1 });
    const match = home.body.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    homepageTitle = match?.[1]?.replace(/\s+/g, " ").trim() ?? null;
  } catch {
    homepageTitle = null;
  }

  const queries = deriveQueries(params.baseUrl, homepageTitle);
  const limit = Math.max(1, Math.min(10, params.maxResultsPerQuery ?? 10));
  const output: SerpDiscoveryRow[] = [];

  for (const query of queries) {
    const url = new URL("https://serpapi.com/search.json");
    url.searchParams.set("q", query);
    url.searchParams.set("engine", "google");
    url.searchParams.set("num", String(limit));
    url.searchParams.set("api_key", params.serpApiKey);

    try {
      const res = await fetch(url.toString(), {
        method: "GET",
        headers: { accept: "application/json" },
      });
      if (!res.ok) continue;
      const json = (await res.json()) as { organic_results?: SerpResult[] };
      output.push({
        query,
        results: (json.organic_results ?? []).slice(0, limit),
      });
    } catch {
      // Keep sitemap pipeline resilient if SerpAPI is unavailable.
    }
  }

  return output;
}

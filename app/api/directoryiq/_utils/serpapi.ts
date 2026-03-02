export const runtime = "nodejs";

type SerpOrganicResult = {
  position?: number;
  title?: string;
  link?: string;
  snippet?: string;
  source?: string;
};

export async function fetchTopSerpOrganicResults(params: {
  apiKey: string;
  query: string;
  num?: number;
}): Promise<SerpOrganicResult[]> {
  const num = Math.max(1, Math.min(10, params.num ?? 10));
  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.set("engine", "google");
  url.searchParams.set("q", params.query);
  url.searchParams.set("num", String(num));
  url.searchParams.set("api_key", params.apiKey);

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: { accept: "application/json" },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`SerpAPI request failed (${response.status})`);
  }
  const json = (await response.json()) as {
    organic_results?: SerpOrganicResult[];
  };

  return (json.organic_results ?? []).slice(0, num).map((row, idx) => ({
    position: row.position ?? idx + 1,
    title: row.title ?? "",
    link: row.link ?? "",
    snippet: row.snippet ?? "",
    source: row.source ?? "",
  }));
}

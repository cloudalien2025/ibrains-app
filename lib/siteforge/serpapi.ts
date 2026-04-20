export type SerpApiOrganicResult = {
  title: string;
  link: string;
  snippet: string;
};

export async function searchSerpApi(params: {
  apiKey: string;
  query: string;
  location?: string | null;
  num?: number;
}): Promise<SerpApiOrganicResult[]> {
  const endpoint = new URL("https://serpapi.com/search.json");
  endpoint.searchParams.set("engine", "google");
  endpoint.searchParams.set("q", params.query);
  endpoint.searchParams.set("api_key", params.apiKey);
  endpoint.searchParams.set("num", String(params.num ?? 6));
  if (params.location) {
    endpoint.searchParams.set("location", params.location);
  }

  const res = await fetch(endpoint.toString(), {
    method: "GET",
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`SerpApi request failed (${res.status})`);
  }

  const payload = (await res.json().catch(() => null)) as
    | { organic_results?: Array<{ title?: string; link?: string; snippet?: string }> }
    | null;
  const organic = Array.isArray(payload?.organic_results) ? payload.organic_results : [];
  return organic
    .map((entry) => ({
      title: typeof entry.title === "string" ? entry.title.trim() : "",
      link: typeof entry.link === "string" ? entry.link.trim() : "",
      snippet: typeof entry.snippet === "string" ? entry.snippet.trim() : "",
    }))
    .filter((entry) => entry.title || entry.snippet)
    .slice(0, params.num ?? 6);
}

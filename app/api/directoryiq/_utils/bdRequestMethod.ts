const SEARCH_ENDPOINTS = new Set([
  "/api/v2/users_portfolio_groups/search",
  "/api/v2/data_posts/search",
  "/api/v2/data_post/search",
  "/api/v2/posts/search",
  "/api/v2/data_posts/list",
  "/api/v2/data_categories/search",
  "/api/v2/data_category/search",
  "/api/v2/data_categories/list",
  "/api/v2/data_category/list",
]);

function normalizePathOnly(rawPath: string): string {
  const trimmed = (rawPath ?? "").trim();
  if (!trimmed) return "/";
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      return parsed.pathname.toLowerCase();
    } catch {
      return trimmed.toLowerCase();
    }
  }
  const withoutQuery = trimmed.split("?")[0] ?? trimmed;
  const prefixed = withoutQuery.startsWith("/") ? withoutQuery : `/${withoutQuery}`;
  return prefixed.toLowerCase();
}

export function resolveBdRequestMethod(path: string, requestedMethod?: string): string {
  const pathOnly = normalizePathOnly(path);
  if (SEARCH_ENDPOINTS.has(pathOnly)) return "POST";
  if (pathOnly.includes("/get")) return "GET";
  if (pathOnly.endsWith("/create")) return "POST";
  if (pathOnly.endsWith("/update")) return "PUT";
  if (pathOnly.endsWith("/delete")) return "DELETE";
  const fallback = (requestedMethod ?? "POST").trim().toUpperCase();
  return fallback || "POST";
}

export async function fetchBdWithMethodPreserved(input: {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: URLSearchParams;
  maxRedirects?: number;
}): Promise<Response> {
  const maxRedirects = Math.max(0, input.maxRedirects ?? 2);
  let target = input.url;
  let redirects = 0;

  while (true) {
    const response = await fetch(target, {
      method: input.method,
      headers: input.headers,
      body: input.method === "GET" ? undefined : input.body,
      cache: "no-store",
      redirect: "manual",
    });

    if (!([301, 302, 307, 308].includes(response.status))) {
      return response;
    }
    const location = response.headers.get("location");
    if (!location || redirects >= maxRedirects) {
      return response;
    }

    target = new URL(location, target).toString();
    redirects += 1;
  }
}

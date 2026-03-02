import type { SurfaceType } from "@/lib/ingest/sitemap/types";

function hasToken(pathname: string, tokens: string[]): boolean {
  const lower = pathname.toLowerCase();
  return tokens.some((token) => lower.includes(token));
}

export function classifySurfaceType(url: string, jsonld: Array<Record<string, unknown>> = []): SurfaceType {
  let pathname = "";
  try {
    pathname = new URL(url).pathname.toLowerCase();
  } catch {
    return "unknown";
  }

  const schemaTypes = jsonld
    .flatMap((item) => {
      const t = item["@type"];
      if (typeof t === "string") return [t.toLowerCase()];
      if (Array.isArray(t)) return t.filter((v): v is string => typeof v === "string").map((v) => v.toLowerCase());
      return [];
    });

  if (
    hasToken(pathname, ["/products/", "/product/"]) ||
    schemaTypes.includes("product")
  ) {
    return "product";
  }
  if (
    hasToken(pathname, ["/blog/", "/blogs/", "/news/", "/article/"]) ||
    schemaTypes.includes("article") ||
    schemaTypes.includes("blogposting")
  ) {
    return "blog";
  }
  if (hasToken(pathname, ["/category/", "/collections/", "/topics/"])) {
    return "category";
  }
  if (
    hasToken(pathname, ["/listing/", "/directory/", "/hotel/", "/restaurant/"]) ||
    schemaTypes.includes("localbusiness") ||
    schemaTypes.includes("lodgingbusiness")
  ) {
    return "listing_like";
  }
  if (pathname === "/" || pathname.length > 1) return "page";
  return "unknown";
}

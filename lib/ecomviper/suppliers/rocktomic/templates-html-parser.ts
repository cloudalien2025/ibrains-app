export interface TemplateLink {
  sku: string | null;
  url: string;
  linkText: string;
  type: "label_ai" | "mockup_tif" | "unknown";
}

export interface TemplatesParseResult {
  status: "ok" | "no_static_links" | "empty" | "error";
  extractedLinks: TemplateLink[];
  skuLinkMap: Record<string, { labelUrl: string | null; mockupUrl: string | null }>;
  warnings: string[];
  totalLinks: number;
}

function detectSkuFromUrl(url: string): string | null {
  const match = url.match(/\/(ROC\d+)[^/]*/i);
  if (match?.[1]) return match[1].toUpperCase();
  const nameMatch = url.split("?")[0].split("/").pop();
  if (nameMatch) {
    const rocMatch = nameMatch.match(/^(ROC\d+)/i);
    if (rocMatch?.[1]) return rocMatch[1].toUpperCase();
  }
  return null;
}

function detectLinkType(url: string): TemplateLink["type"] {
  const lower = url.toLowerCase().split("?")[0];
  if (lower.endsWith(".ai")) return "label_ai";
  if (lower.endsWith(".tif") || lower.endsWith(".tiff")) return "mockup_tif";
  return "unknown";
}

function extractHref(tag: string): string | null {
  const match = tag.match(/href\s*=\s*["']([^"']+)["']/i);
  return match?.[1] ?? null;
}

function extractLinkText(tag: string): string {
  return tag.replace(/<[^>]+>/g, "").trim();
}

export function parseTemplatesHtml(html: string, sourceUrl: string): TemplatesParseResult {
  const warnings: string[] = [];

  if (!html || html.trim().length === 0) {
    return { status: "empty", extractedLinks: [], skuLinkMap: {}, warnings: ["empty_html_content"], totalLinks: 0 };
  }

  const anchorPattern = /<a\s[^>]*>.*?<\/a>/gi;
  const rawAnchors = html.match(anchorPattern) ?? [];

  const extractedLinks: TemplateLink[] = [];

  for (const anchor of rawAnchors) {
    const href = extractHref(anchor);
    if (!href) continue;
    let url: string;
    try {
      url = new URL(href, sourceUrl).toString();
    } catch {
      continue;
    }
    const type = detectLinkType(url);
    const sku = detectSkuFromUrl(url);
    const linkText = extractLinkText(anchor);
    extractedLinks.push({ sku, url, linkText, type });
  }

  if (extractedLinks.length === 0) {
    const hasJsContent = html.includes("<script") || html.includes("javascript");
    if (hasJsContent) {
      warnings.push("no_static_links_js_driven_page: use Playwright mode for dynamic extraction");
    }
    return { status: "no_static_links", extractedLinks: [], skuLinkMap: {}, warnings, totalLinks: 0 };
  }

  const skuLinkMap: Record<string, { labelUrl: string | null; mockupUrl: string | null }> = {};

  for (const link of extractedLinks) {
    if (!link.sku) continue;
    const sku = link.sku;
    if (!skuLinkMap[sku]) {
      skuLinkMap[sku] = { labelUrl: null, mockupUrl: null };
    }
    if (link.type === "label_ai" && !skuLinkMap[sku].labelUrl) {
      skuLinkMap[sku].labelUrl = link.url;
    } else if (link.type === "mockup_tif" && !skuLinkMap[sku].mockupUrl) {
      skuLinkMap[sku].mockupUrl = link.url;
    }
  }

  const unmappedLinks = extractedLinks.filter((l) => !l.sku);
  if (unmappedLinks.length > 0) {
    warnings.push(`${unmappedLinks.length}_links_without_sku_mapping`);
  }

  return { status: "ok", extractedLinks, skuLinkMap, warnings, totalLinks: extractedLinks.length };
}

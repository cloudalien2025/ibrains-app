import { normalizeRocktomicSku } from "@/lib/ecomviper/suppliers/rocktomic-offline-audit";

export type RocktomicTemplateFormat = "ai" | "tif";

export interface RocktomicTemplateAssetEvidence {
  sku: string;
  url: string | null;
  fileName: string;
  format: RocktomicTemplateFormat;
  fileType: "Label Template" | "3D Mockup Template";
  lastUpdated: string | null;
  sourcePageUrl: string;
  source: "templates_page";
}

export interface RocktomicTemplateAssetsBySku {
  sku: string;
  templateAssets: {
    labelTemplateAi: RocktomicTemplateAssetEvidence | null;
    mockupTemplateTif: RocktomicTemplateAssetEvidence | null;
  };
  assetReadiness: {
    hasLabelTemplateAi: boolean;
    hasMockupTemplateTif: boolean;
    readyForOptiPixelAssets: boolean;
  };
  defects: string[];
}

export interface RocktomicTemplateAssetExtractionResult {
  assetsBySku: RocktomicTemplateAssetsBySku[];
  evidence: RocktomicTemplateAssetEvidence[];
  counts: {
    skusDetected: number;
    labelTemplatesFound: number;
    mockupTemplatesFound: number;
    readyForOptiPixelAssets: number;
  };
}

function ensureAbsoluteUrl(value: string | null, sourcePageUrl: string): string | null {
  if (!value) return null;
  try {
    return new URL(value, sourcePageUrl).toString();
  } catch {
    return null;
  }
}

function extractLastUpdated(context: string): string | null {
  const match = context.match(
    /(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),\s+\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}\s+\d{2}:\d{2}:\d{2}\s+GMT/i
  );
  return match?.[0] || null;
}

export function extractRocktomicTemplateAssets(input: {
  html: string;
  sourcePageUrl: string;
}): RocktomicTemplateAssetExtractionResult {
  const evidence: RocktomicTemplateAssetEvidence[] = [];
  const bySku = new Map<string, RocktomicTemplateAssetsBySku>();
  const fallbackLastUpdated = extractLastUpdated(input.html);

  const urlPattern = /https?:\/\/[^\s"'<>]+\.(?:ai|tif)(?:\?[^\s"'<>]*)?/gi;
  for (const match of input.html.matchAll(urlPattern)) {
    const matched = match[0];
    const fileName = matched.split("/").pop()?.split("?")[0] || "";
    const skuMatch = fileName.match(/\bROC[\s\-]?\d{3,5}\b/i);
    if (!skuMatch?.[0]) continue;

    const sku = normalizeRocktomicSku(skuMatch[0]);
    const format = /\.ai(?:\?|$)/i.test(matched) ? "ai" : "tif";
    const fileType = format === "ai" ? "Label Template" : "3D Mockup Template";
    const near = input.html.slice(Math.max(0, match.index! - 220), Math.min(input.html.length, match.index! + 220));
    const lastUpdated = extractLastUpdated(near) || fallbackLastUpdated;

    evidence.push({
      sku,
      url: ensureAbsoluteUrl(matched, input.sourcePageUrl),
      fileName,
      format,
      fileType,
      lastUpdated,
      sourcePageUrl: input.sourcePageUrl,
      source: "templates_page",
    });
  }

  const fileNamePattern = /\b(ROC[\s\-]?\d{3,5}[^\s"'<>]*\.(?:ai|tif))\b/gi;
  for (const match of input.html.matchAll(fileNamePattern)) {
    const fileName = match[1] || "";
    const skuMatch = fileName.match(/\bROC[\s\-]?\d{3,5}\b/i);
    if (!skuMatch?.[0]) continue;

    const sku = normalizeRocktomicSku(skuMatch[0]);
    const already = evidence.some((entry) => entry.sku === sku && entry.fileName.toLowerCase() === fileName.toLowerCase());
    if (already) continue;

    const format = /\.ai$/i.test(fileName) ? "ai" : "tif";
    const fileType = format === "ai" ? "Label Template" : "3D Mockup Template";
    const near = input.html.slice(Math.max(0, match.index! - 220), Math.min(input.html.length, match.index! + 220));
    const hrefNear = near.match(/href\s*=\s*"([^"]+)"/i)?.[1] || null;

    evidence.push({
      sku,
      url: ensureAbsoluteUrl(hrefNear, input.sourcePageUrl),
      fileName,
      format,
      fileType,
      lastUpdated: extractLastUpdated(near) || fallbackLastUpdated,
      sourcePageUrl: input.sourcePageUrl,
      source: "templates_page",
    });
  }

  for (const item of evidence) {
    if (!bySku.has(item.sku)) {
      bySku.set(item.sku, {
        sku: item.sku,
        templateAssets: {
          labelTemplateAi: null,
          mockupTemplateTif: null,
        },
        assetReadiness: {
          hasLabelTemplateAi: false,
          hasMockupTemplateTif: false,
          readyForOptiPixelAssets: false,
        },
        defects: [],
      });
    }

    const row = bySku.get(item.sku)!;
    if (item.format === "ai" && !row.templateAssets.labelTemplateAi) {
      row.templateAssets.labelTemplateAi = item;
    }
    if (item.format === "tif" && !row.templateAssets.mockupTemplateTif) {
      row.templateAssets.mockupTemplateTif = item;
    }
  }

  const assetsBySku = Array.from(bySku.values())
    .map((row) => {
      const hasLabelTemplateAi = Boolean(row.templateAssets.labelTemplateAi?.url || row.templateAssets.labelTemplateAi?.fileName);
      const hasMockupTemplateTif = Boolean(row.templateAssets.mockupTemplateTif?.url || row.templateAssets.mockupTemplateTif?.fileName);

      row.assetReadiness = {
        hasLabelTemplateAi,
        hasMockupTemplateTif,
        readyForOptiPixelAssets: hasLabelTemplateAi && hasMockupTemplateTif,
      };

      row.defects = [
        hasLabelTemplateAi ? null : "missing_label_template_ai",
        hasMockupTemplateTif ? null : "missing_mockup_template_tif",
      ].filter((value): value is string => Boolean(value));

      return row;
    })
    .sort((a, b) => a.sku.localeCompare(b.sku));

  return {
    assetsBySku,
    evidence: evidence.sort((a, b) => a.sku.localeCompare(b.sku) || a.fileName.localeCompare(b.fileName)),
    counts: {
      skusDetected: assetsBySku.length,
      labelTemplatesFound: assetsBySku.filter((entry) => entry.assetReadiness.hasLabelTemplateAi).length,
      mockupTemplatesFound: assetsBySku.filter((entry) => entry.assetReadiness.hasMockupTemplateTif).length,
      readyForOptiPixelAssets: assetsBySku.filter((entry) => entry.assetReadiness.readyForOptiPixelAssets).length,
    },
  };
}

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
    containersListed?: number;
    blobAssetsScanned?: number;
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

function decodeXml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function parseBlobServiceConfig(html: string): { blobUri: string; sasToken: string } | null {
  const uriMatch = html.match(/var\s+blobUri\s*=\s*["']([^"']+)["']/i);
  const sasMatch = html.match(/var\s+sas\s*=\s*["']([^"']+)["']/i);
  const blobUri = uriMatch?.[1]?.trim() || "";
  const sasToken = sasMatch?.[1]?.trim() || "";
  if (!blobUri || !sasToken || !/^https?:\/\//i.test(blobUri) || !sasToken.startsWith("?")) return null;
  return { blobUri, sasToken };
}

function buildAzureListUrl(baseUrl: string, query: Record<string, string>): string {
  const parsed = new URL(baseUrl);
  for (const [key, value] of Object.entries(query)) {
    parsed.searchParams.set(key, value);
  }
  return parsed.toString();
}

function normalizeAzureUrl(blobUri: string, blobPath: string): string | null {
  try {
    return new URL(blobPath.replace(/^\/+/, ""), `${blobUri.replace(/\/+$/, "")}/`).toString();
  } catch {
    return null;
  }
}

function parseContainerNamesFromXml(xml: string): { names: string[]; nextMarker: string | null } {
  const names = Array.from(xml.matchAll(/<Container>\s*<Name>([^<]+)<\/Name>/gi)).map((match) => decodeXml(match[1] || "").trim());
  const nextMarker = xml.match(/<NextMarker>([^<]*)<\/NextMarker>/i)?.[1]?.trim() || null;
  return {
    names: names.filter((name) => name.length > 0),
    nextMarker,
  };
}

interface AzureBlobListItem {
  name: string;
  lastModified: string | null;
}

function parseBlobEntriesFromXml(xml: string): { blobs: AzureBlobListItem[]; nextMarker: string | null } {
  const entries: AzureBlobListItem[] = [];
  const blobPattern = /<Blob>([\s\S]*?)<\/Blob>/gi;
  let match: RegExpExecArray | null = null;
  while ((match = blobPattern.exec(xml)) !== null) {
    const section = match[1] || "";
    const name = decodeXml(section.match(/<Name>([^<]+)<\/Name>/i)?.[1] || "").trim();
    if (!name) continue;
    const lastModified = decodeXml(section.match(/<Last-Modified>([^<]+)<\/Last-Modified>/i)?.[1] || "").trim() || null;
    entries.push({
      name,
      lastModified,
    });
  }
  const nextMarker = xml.match(/<NextMarker>([^<]*)<\/NextMarker>/i)?.[1]?.trim() || null;
  return {
    blobs: entries,
    nextMarker,
  };
}

async function listAzureContainers(input: {
  blobUri: string;
  sasToken: string;
  prefix: string;
  fetchImpl?: typeof fetch;
  requestTimeoutMs?: number;
}): Promise<string[]> {
  const fetchImpl = input.fetchImpl || fetch;
  const requestTimeoutMs = Math.max(1_000, input.requestTimeoutMs ?? 30_000);
  const names: string[] = [];
  let marker = "";
  const sasParams = new URLSearchParams(input.sasToken.replace(/^\?/, ""));

  for (let guard = 0; guard < 50; guard += 1) {
    const url = buildAzureListUrl(input.blobUri, {
      comp: "list",
      prefix: input.prefix,
      maxresults: "500",
      marker,
      ...Object.fromEntries(sasParams.entries()),
    });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
    const response = await fetchImpl(url, { method: "GET", cache: "no-store", signal: controller.signal }).finally(() =>
      clearTimeout(timeout)
    );
    if (!response.ok) throw new Error(`azure_container_list_http_${response.status}`);
    const xml = await response.text();
    const parsed = parseContainerNamesFromXml(xml);
    names.push(...parsed.names);
    if (!parsed.nextMarker) break;
    marker = parsed.nextMarker;
  }

  return Array.from(new Set(names.map((name) => name.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

async function listAzureBlobsForContainer(input: {
  blobUri: string;
  sasToken: string;
  containerName: string;
  fetchImpl?: typeof fetch;
  requestTimeoutMs?: number;
}): Promise<AzureBlobListItem[]> {
  const fetchImpl = input.fetchImpl || fetch;
  const requestTimeoutMs = Math.max(1_000, input.requestTimeoutMs ?? 30_000);
  const rows: AzureBlobListItem[] = [];
  let marker = "";
  const sasParams = new URLSearchParams(input.sasToken.replace(/^\?/, ""));
  const baseUrl = `${input.blobUri.replace(/\/+$/, "")}/${encodeURIComponent(input.containerName)}`;

  for (let guard = 0; guard < 100; guard += 1) {
    const url = buildAzureListUrl(baseUrl, {
      restype: "container",
      comp: "list",
      marker,
      ...Object.fromEntries(sasParams.entries()),
    });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
    const response = await fetchImpl(url, { method: "GET", cache: "no-store", signal: controller.signal }).finally(() =>
      clearTimeout(timeout)
    );
    if (!response.ok) throw new Error(`azure_blob_list_http_${response.status}`);
    const xml = await response.text();
    const parsed = parseBlobEntriesFromXml(xml);
    rows.push(...parsed.blobs);
    if (!parsed.nextMarker) break;
    marker = parsed.nextMarker;
  }

  return rows;
}

function addTemplateEvidence(
  evidence: RocktomicTemplateAssetEvidence[],
  input: {
    sku: string;
    sourcePageUrl: string;
    fileName: string;
    url: string | null;
    lastUpdated: string | null;
  }
): void {
  const format: RocktomicTemplateFormat = /\.ai$/i.test(input.fileName) ? "ai" : "tif";
  if (format !== "ai" && format !== "tif") return;
  const dedupeKey = `${input.sku}|${input.fileName.toLowerCase()}|${input.url || ""}`;
  if (evidence.some((entry) => `${entry.sku}|${entry.fileName.toLowerCase()}|${entry.url || ""}` === dedupeKey)) return;
  evidence.push({
    sku: input.sku,
    url: input.url,
    fileName: input.fileName,
    format,
    fileType: format === "ai" ? "Label Template" : "3D Mockup Template",
    lastUpdated: input.lastUpdated,
    sourcePageUrl: input.sourcePageUrl,
    source: "templates_page",
  });
}

function buildAssetsBySku(evidence: RocktomicTemplateAssetEvidence[]): RocktomicTemplateAssetsBySku[] {
  const bySku = new Map<string, RocktomicTemplateAssetsBySku>();
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

  return Array.from(bySku.values())
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
}

export function extractRocktomicTemplateAssets(input: {
  html: string;
  sourcePageUrl: string;
}): RocktomicTemplateAssetExtractionResult {
  const evidence: RocktomicTemplateAssetEvidence[] = [];
  const fallbackLastUpdated = extractLastUpdated(input.html);

  const urlPattern = /https?:\/\/[^\s"'<>]+\.(?:ai|tif)(?:\?[^\s"'<>]*)?/gi;
  for (const match of input.html.matchAll(urlPattern)) {
    const matched = match[0];
    const fileName = matched.split("/").pop()?.split("?")[0] || "";
    const skuMatch = fileName.match(/\bROC[\s\-]?\d{3,5}\b/i);
    if (!skuMatch?.[0]) continue;

    const sku = normalizeRocktomicSku(skuMatch[0]);
    const near = input.html.slice(Math.max(0, match.index! - 220), Math.min(input.html.length, match.index! + 220));
    const lastUpdated = extractLastUpdated(near) || fallbackLastUpdated;

    addTemplateEvidence(evidence, {
      sku,
      url: ensureAbsoluteUrl(matched, input.sourcePageUrl),
      fileName,
      lastUpdated,
      sourcePageUrl: input.sourcePageUrl,
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

    const near = input.html.slice(Math.max(0, match.index! - 220), Math.min(input.html.length, match.index! + 220));
    const hrefNear = near.match(/href\s*=\s*"([^"]+)"/i)?.[1] || null;

    addTemplateEvidence(evidence, {
      sku,
      url: ensureAbsoluteUrl(hrefNear, input.sourcePageUrl),
      fileName,
      lastUpdated: extractLastUpdated(near) || fallbackLastUpdated,
      sourcePageUrl: input.sourcePageUrl,
    });
  }

  const assetsBySku = buildAssetsBySku(evidence);

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

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  mapper: (value: T) => Promise<R>
): Promise<R[]> {
  const safeConcurrency = Math.max(1, concurrency);
  const results: R[] = new Array(values.length);
  let index = 0;
  const workers = new Array(Math.min(safeConcurrency, values.length)).fill(null).map(async () => {
    while (true) {
      const current = index;
      index += 1;
      if (current >= values.length) break;
      results[current] = await mapper(values[current]);
    }
  });
  await Promise.all(workers);
  return results;
}

export async function extractRocktomicTemplateAssetsFromTemplatesPage(input: {
  html: string;
  sourcePageUrl: string;
  fetchImpl?: typeof fetch;
  azureListConcurrency?: number;
  requestTimeoutMs?: number;
  enableAzureListing?: boolean;
}): Promise<RocktomicTemplateAssetExtractionResult> {
  const staticResult = extractRocktomicTemplateAssets(input);
  if (input.enableAzureListing === false) {
    return staticResult;
  }
  const config = parseBlobServiceConfig(input.html);
  if (!config) {
    return staticResult;
  }

  const fetchImpl = input.fetchImpl || fetch;
  const evidence = [...staticResult.evidence];

  let containersListed = 0;
  let blobAssetsScanned = 0;

  try {
    const containers = await listAzureContainers({
      blobUri: config.blobUri,
      sasToken: config.sasToken,
      prefix: "roc",
      fetchImpl,
      requestTimeoutMs: input.requestTimeoutMs,
    });
    containersListed = containers.length;
    const azureListConcurrency = Math.min(10, Math.max(1, input.azureListConcurrency ?? 4));

    const rows = await mapWithConcurrency(containers, azureListConcurrency, async (containerName) => {
      try {
        const blobs = await listAzureBlobsForContainer({
          blobUri: config.blobUri,
          sasToken: config.sasToken,
          containerName,
          fetchImpl,
          requestTimeoutMs: input.requestTimeoutMs,
        });
        return { containerName, blobs };
      } catch {
        return { containerName, blobs: [] as AzureBlobListItem[] };
      }
    });

    for (const row of rows) {
      const sku = normalizeRocktomicSku(row.containerName);
      if (!sku) continue;
      for (const blob of row.blobs) {
        const fileName = blob.name.split("/").pop()?.trim() || "";
        if (!/\.ai$/i.test(fileName) && !/\.tif$/i.test(fileName)) continue;
        blobAssetsScanned += 1;
        const url = normalizeAzureUrl(config.blobUri, `${row.containerName}/${blob.name}`);
        addTemplateEvidence(evidence, {
          sku,
          fileName,
          url,
          lastUpdated: blob.lastModified || null,
          sourcePageUrl: input.sourcePageUrl,
        });
      }
    }
  } catch {
    return staticResult;
  }

  const assetsBySku = buildAssetsBySku(evidence);
  return {
    assetsBySku,
    evidence: evidence.sort((a, b) => a.sku.localeCompare(b.sku) || a.fileName.localeCompare(b.fileName)),
    counts: {
      skusDetected: assetsBySku.length,
      labelTemplatesFound: assetsBySku.filter((entry) => entry.assetReadiness.hasLabelTemplateAi).length,
      mockupTemplatesFound: assetsBySku.filter((entry) => entry.assetReadiness.hasMockupTemplateTif).length,
      readyForOptiPixelAssets: assetsBySku.filter((entry) => entry.assetReadiness.readyForOptiPixelAssets).length,
      containersListed,
      blobAssetsScanned,
    },
  };
}

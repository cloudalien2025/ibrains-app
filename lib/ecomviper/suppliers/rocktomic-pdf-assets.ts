import zlib from "node:zlib";
import { normalizeRocktomicSku } from "@/lib/ecomviper/suppliers/rocktomic-offline-audit";

export type RocktomicCatalogLinkField = "coaUrl" | "labelAnd3dMockupTemplateUrl" | "pricingSheetUrl" | "unknownLink";
export type RocktomicEvidenceConfidence = "high" | "medium" | "low";

export interface RocktomicCatalogLinkEvidence {
  sku: string | null;
  field: RocktomicCatalogLinkField;
  page: number | null;
  rect: [number, number, number, number] | null;
  url: string;
  nearText: string;
  confidence: RocktomicEvidenceConfidence;
}

export interface RocktomicCatalogSkuLinkResult {
  sku: string;
  catalogPage: number | null;
  productName: string | null;
  links: {
    coaUrl: string | null;
    labelAnd3dMockupTemplateUrl: string | null;
    pricingSheetUrl: string | null;
  };
  unknownLinks: string[];
  linkEvidence: RocktomicCatalogLinkEvidence[];
  lowConfidenceMappings: string[];
}

export interface RocktomicCatalogLinkExtractionResult {
  skusDiscovered: string[];
  evidence: RocktomicCatalogLinkEvidence[];
  skuMappings: RocktomicCatalogSkuLinkResult[];
  unmappedEvidence: RocktomicCatalogLinkEvidence[];
  counts: {
    linksDetected: number;
    coaLinksMapped: number;
    templateLinksMapped: number;
    pricingLinksMapped: number;
    unknownLinks: number;
    unmappedLinks: number;
  };
}

interface PdfObject {
  key: string;
  body: string;
  startIndex: number;
}

interface ParsedPage {
  pageNumber: number;
  pageObjectKey: string;
  contentRefs: string[];
  annotationRefs: string[];
  textLines: string[];
  linkHintLines: string[];
  skus: string[];
}

interface ParsedAnnotation {
  objectKey: string;
  page: number | null;
  rect: [number, number, number, number] | null;
  url: string;
  nearText: string;
  nearbySku: string | null;
}

function parsePdfObjects(content: string): PdfObject[] {
  const objects: PdfObject[] = [];
  const objectPattern = /(\d+)\s+(\d+)\s+obj([\s\S]*?)endobj/g;
  let match: RegExpExecArray | null = null;
  while ((match = objectPattern.exec(content)) !== null) {
    const objectId = match[1];
    const generation = match[2];
    const body = match[3] || "";
    objects.push({
      key: `${objectId} ${generation}`,
      body,
      startIndex: match.index,
    });
  }
  return objects;
}

function parseRefList(input: string): string[] {
  const refs: string[] = [];
  const refPattern = /(\d+)\s+(\d+)\s+R/g;
  let match: RegExpExecArray | null = null;
  while ((match = refPattern.exec(input)) !== null) {
    refs.push(`${match[1]} ${match[2]}`);
  }
  return refs;
}

function decodePdfString(input: string): string {
  return input
    .replace(/\\\(/g, "(")
    .replace(/\\\)/g, ")")
    .replace(/\\\\/g, "\\")
    .replace(/\r\n/g, " ")
    .replace(/\r/g, " ")
    .replace(/\n/g, " ");
}

function extractTextLinesFromStream(stream: string): string[] {
  const lines: string[] = [];

  const tjPattern = /\[((?:[^\]\\]|\\.|\\\])*)\]\s*TJ/g;
  for (const match of stream.matchAll(tjPattern)) {
    const inner = match[1] || "";
    const parts = Array.from(inner.matchAll(/\(([^\\)]*(?:\\.[^\\)]*)*)\)/g)).map((entry) =>
      decodePdfString(entry[1] || "")
    );
    if (parts.length > 0) {
      lines.push(parts.join(""));
    }
  }

  const tjSinglePattern = /\(([^\\)]*(?:\\.[^\\)]*)*)\)\s*Tj/g;
  for (const match of stream.matchAll(tjSinglePattern)) {
    lines.push(decodePdfString(match[1] || ""));
  }

  return lines;
}

function extractObjectStream(body: string): string | null {
  const streamMatch = body.match(/stream\r?\n([\s\S]*?)\r?\nendstream/);
  if (!streamMatch?.[1]) return null;

  const raw = Buffer.from(streamMatch[1], "latin1");
  if (/\/FlateDecode/.test(body)) {
    try {
      return zlib.inflateSync(raw).toString("latin1");
    } catch {
      return null;
    }
  }
  return raw.toString("latin1");
}

function normalizeLine(input: string): string {
  return input
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function collectSkusFromText(lines: string[]): string[] {
  const joined = lines.join("\n");
  const matches = joined.match(/\bROC[\s\-]?\d{3,5}\b/gi) || [];
  return Array.from(new Set(matches.map((value) => normalizeRocktomicSku(value)).filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

function classifyLink(params: { nearText: string; url: string }): { field: RocktomicCatalogLinkField; confidence: RocktomicEvidenceConfidence } {
  const near = params.nearText.toLowerCase();
  const url = params.url.toLowerCase();

  if (/templates\.html|\.ai(?:\?|$)|\.tif(?:\?|$)/.test(url)) {
    return {
      field: "labelAnd3dMockupTemplateUrl",
      confidence: "high",
    };
  }

  if (/docs\.google\.com\/spreadsheets\//.test(url)) {
    return { field: "pricingSheetUrl", confidence: "high" };
  }

  if (/\.pdf(?:\?|$)/.test(url)) {
    if (/(?:^|[^a-z])coa(?:[^a-z]|$)|cert|analysis/.test(url)) {
      return { field: "coaUrl", confidence: "high" };
    }
    if (/(pricing|msrp|profit|plds|wholesale)/i.test(near)) {
      return { field: "pricingSheetUrl", confidence: "medium" };
    }
    if (/(label\s*&\s*3d\s*mockup\s*template|3d\s*mockup\s*template|label\s*template)/i.test(near)) {
      return { field: "labelAnd3dMockupTemplateUrl", confidence: "medium" };
    }
    if (/(cert\.?\s*of\s*analysis|coa)/i.test(near)) {
      return { field: "coaUrl", confidence: "high" };
    }
    return { field: "coaUrl", confidence: "medium" };
  }

  if (/(label\s*&\s*3d\s*mockup\s*template|3d\s*mockup\s*template|label\s*template)/i.test(near)) {
    return { field: "labelAnd3dMockupTemplateUrl", confidence: "medium" };
  }

  if (/(pricing|msrp|profit|plds|wholesale)/i.test(near)) {
    return { field: "pricingSheetUrl", confidence: "medium" };
  }

  if (/(?:^|[^a-z])coa(?:[^a-z]|$)|cert|analysis/.test(url)) {
    return { field: "coaUrl", confidence: "medium" };
  }

  return { field: "unknownLink", confidence: "low" };
}

function parseRect(body: string): [number, number, number, number] | null {
  const match = body.match(/\/Rect\s*\[([^\]]+)\]/);
  if (!match?.[1]) return null;
  const numbers = match[1]
    .trim()
    .split(/\s+/g)
    .map((entry) => Number.parseFloat(entry))
    .filter((entry) => Number.isFinite(entry));
  if (numbers.length !== 4) return null;
  return [numbers[0], numbers[1], numbers[2], numbers[3]];
}

function buildNearText(content: string, annotationStart: number, hintLine: string | null): string {
  const context = content
    .slice(Math.max(0, annotationStart - 360), Math.min(content.length, annotationStart + 360))
    .replace(/\s+/g, " ")
    .trim();

  if (hintLine) {
    return `${hintLine} | ${context}`.slice(0, 500);
  }
  return context.slice(0, 500);
}

function parsePages(objects: PdfObject[]): ParsedPage[] {
  const objectsByKey = new Map(objects.map((entry) => [entry.key, entry]));
  const pages: ParsedPage[] = [];

  for (const object of objects) {
    if (!/\/Type\s*\/Page\b/.test(object.body)) continue;

    const contentsMatch = object.body.match(/\/Contents\s*\[([^\]]+)\]/) || object.body.match(/\/Contents\s*(\d+\s+\d+\s+R)/);
    const annotMatch = object.body.match(/\/Annots\s*\[([^\]]+)\]/) || object.body.match(/\/Annots\s*(\d+\s+\d+\s+R)/);

    const contentRefs = contentsMatch?.[1] ? parseRefList(contentsMatch[1]) : [];
    const annotationRefs = annotMatch?.[1] ? parseRefList(annotMatch[1]) : [];

    const textLines = contentRefs
      .map((ref) => objectsByKey.get(ref))
      .filter((entry): entry is PdfObject => Boolean(entry))
      .map((entry) => extractObjectStream(entry.body))
      .filter((entry): entry is string => Boolean(entry))
      .flatMap((stream) => extractTextLinesFromStream(stream))
      .map((line) => normalizeLine(line))
      .filter((line) => line.length > 1);

    pages.push({
      pageNumber: pages.length + 1,
      pageObjectKey: object.key,
      contentRefs,
      annotationRefs,
      textLines,
      linkHintLines: textLines.filter((line) =>
        /click\s*here|cert\.?\s*of\s*analysis|label|mockup|template|pricing|msrp|profit/i.test(line)
      ),
      skus: collectSkusFromText(textLines),
    });
  }

  return pages;
}

export function extractRocktomicCatalogLinkEvidence(input: {
  pdfBytes: ArrayBuffer;
  productNameBySku?: Record<string, string | null>;
}): RocktomicCatalogLinkExtractionResult {
  const content = Buffer.from(input.pdfBytes).toString("latin1");
  const objects = parsePdfObjects(content);
  const objectsByKey = new Map(objects.map((entry) => [entry.key, entry]));
  const pages = parsePages(objects);

  const allSkus = new Set<string>();
  for (const page of pages) {
    for (const sku of page.skus) allSkus.add(sku);
  }

  const evidence: RocktomicCatalogLinkEvidence[] = [];

  for (const page of pages) {
    for (let index = 0; index < page.annotationRefs.length; index += 1) {
      const annotationRef = page.annotationRefs[index];
      const annotationObject = objectsByKey.get(annotationRef);
      if (!annotationObject) continue;
      if (!/\/Subtype\s*\/Link/.test(annotationObject.body)) continue;

      const uriMatch = annotationObject.body.match(/\/URI\s*\((https?:\/\/[^)\r\n]+)\)/i);
      if (!uriMatch?.[1]) continue;

      const url = uriMatch[1].replace(/\\\)/g, ")").trim();
      const hintLine = page.linkHintLines[index] || page.linkHintLines[0] || null;
      const nearText = buildNearText(content, annotationObject.startIndex, hintLine);
      const classification = classifyLink({ nearText, url });

      const nearbySkuMatch = content
        .slice(Math.max(0, annotationObject.startIndex - 1200), Math.min(content.length, annotationObject.startIndex + 1200))
        .match(/\bROC[\s\-]?\d{3,5}\b/i);
      const nearbySku = nearbySkuMatch ? normalizeRocktomicSku(nearbySkuMatch[0]) : null;
      if (nearbySku) allSkus.add(nearbySku);

      const sku = nearbySku || (page.skus.length === 1 ? page.skus[0] : null);

      evidence.push({
        sku,
        field: classification.field,
        page: page.pageNumber,
        rect: parseRect(annotationObject.body),
        url,
        nearText,
        confidence: sku ? classification.confidence : "low",
      });
    }
  }

  const skuMappingsBySku = new Map<string, RocktomicCatalogSkuLinkResult>();
  const selectedFieldScore = new Map<string, number>();
  for (const sku of Array.from(allSkus).sort((a, b) => a.localeCompare(b))) {
    skuMappingsBySku.set(sku, {
      sku,
      catalogPage: null,
      productName: input.productNameBySku?.[sku] || null,
      links: {
        coaUrl: null,
        labelAnd3dMockupTemplateUrl: null,
        pricingSheetUrl: null,
      },
      unknownLinks: [],
      linkEvidence: [],
      lowConfidenceMappings: [],
    });
  }

  const unmappedEvidence: RocktomicCatalogLinkEvidence[] = [];
  const confidenceScore = (value: RocktomicEvidenceConfidence): number => {
    if (value === "high") return 3;
    if (value === "medium") return 2;
    return 1;
  };
  const urlBoost = (field: RocktomicCatalogLinkField, url: string): number => {
    if (field === "coaUrl" && /\.pdf(?:\?|$)/i.test(url)) return 1;
    if (field === "pricingSheetUrl" && /docs\.google\.com\/spreadsheets\//i.test(url)) return 1;
    if (field === "labelAnd3dMockupTemplateUrl" && /templates\.html|\.ai(?:\?|$)|\.tif(?:\?|$)/i.test(url)) return 1;
    return 0;
  };
  for (const row of evidence) {
    if (!row.sku || !skuMappingsBySku.has(row.sku)) {
      unmappedEvidence.push(row);
      continue;
    }

    const target = skuMappingsBySku.get(row.sku)!;
    if (target.catalogPage == null && row.page != null) {
      target.catalogPage = row.page;
    }
    target.linkEvidence.push(row);

    if (row.field === "unknownLink") {
      target.unknownLinks.push(row.url);
      if (row.confidence === "low") target.lowConfidenceMappings.push("unknownLink");
      continue;
    }

    const score = confidenceScore(row.confidence) + urlBoost(row.field, row.url);
    const key = `${target.sku}:${row.field}`;
    const currentScore = selectedFieldScore.get(key) ?? -1;
    if (!target.links[row.field] || score > currentScore) {
      target.links[row.field] = row.url;
      selectedFieldScore.set(key, score);
    }
    if (row.confidence === "low") {
      target.lowConfidenceMappings.push(row.field);
    }
  }

  const skuMappings = Array.from(skuMappingsBySku.values()).sort((a, b) => a.sku.localeCompare(b.sku));
  const counts = {
    linksDetected: evidence.length,
    coaLinksMapped: skuMappings.filter((row) => Boolean(row.links.coaUrl)).length,
    templateLinksMapped: skuMappings.filter((row) => Boolean(row.links.labelAnd3dMockupTemplateUrl)).length,
    pricingLinksMapped: skuMappings.filter((row) => Boolean(row.links.pricingSheetUrl)).length,
    unknownLinks: evidence.filter((row) => row.field === "unknownLink").length,
    unmappedLinks: unmappedEvidence.length,
  };

  const skusDiscovered = skuMappings.map((row) => row.sku);

  return {
    skusDiscovered,
    evidence,
    skuMappings,
    unmappedEvidence,
    counts,
  };
}

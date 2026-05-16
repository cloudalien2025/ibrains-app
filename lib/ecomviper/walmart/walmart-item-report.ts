import "server-only";

import crypto from "crypto";
import { inflateRawSync, gunzipSync } from "node:zlib";
import { WALMART_PRODUCTION_BASE_URL } from "@/lib/ecomviper/walmart/walmart-client";
import type { WalmartImageMatchMethod, WalmartImageSyncStatus, WalmartProductRecord } from "@/lib/ecomviper/walmart/walmart-types";

const ITEM_REPORT_STATUS_POLL_DELAYS_MS = [700, 1200, 1800, 2600, 3500] as const;
const ITEM_REPORT_REQUEST_TIMEOUT_MS = 10_000;

type WalmartItemReportEndpointFamily = "report_requests" | "requests";

interface ItemReportRequestAttempt {
  family: WalmartItemReportEndpointFamily;
  path: string;
  body: unknown;
}

interface ParsedItemReportStatus {
  state: "complete" | "in_progress" | "failed" | "unknown";
  downloadUrl: string | null;
  reportId: string | null;
  generatedAt: string | null;
  reason: string | null;
}

export interface WalmartItemReportRow {
  sku: string;
  productId: string;
  productIdType: string;
  itemId: string;
  wpid: string;
  title: string;
  brand: string;
  shelfDescription?: string;
  longDescription?: string;
  keyFeatures?: string[];
  primaryImageUrl: string;
  galleryImageUrls: string[];
  variantImageUrls: string[];
  rowIndex: number;
}

export interface WalmartItemReportApiDiagnostic {
  endpoint: string;
  httpStatus: number | null;
  ok: boolean;
}

export interface WalmartItemReportProductDecision {
  sku: string;
  imageSyncStatus: WalmartImageSyncStatus;
  statusReason: string;
  imageSource: "walmart_item_report";
  primaryImageUrl: string;
  galleryImageUrls: string[];
  variantImageUrls: string[];
  matchedItemId: string | null;
  matchMethod: WalmartImageMatchMethod | null;
  lastImageSyncedAt: string;
  allowItemSearchFallback: boolean;
}

export interface WalmartItemReportRunResult {
  reportRequestId: string | null;
  reportGeneratedAt: string | null;
  reportDownloadedAt: string | null;
  itemReportRequested: boolean;
  itemReportDownloaded: boolean;
  itemReportRowsParsed: number;
  status: "ready" | "failed" | "timed_out" | "unavailable";
  failureCategory:
    | "none"
    | "auth_or_permission"
    | "not_found_endpoint"
    | "timeout"
    | "report_failed"
    | "download_failed"
    | "parse_failed"
    | "no_rows"
    | "no_image_columns"
    | "unavailable";
  failureReason: string | null;
  diagnostics: {
    requestAttempts: WalmartItemReportApiDiagnostic[];
    statusAttempts: WalmartItemReportApiDiagnostic[];
    downloadAttempts: WalmartItemReportApiDiagnostic[];
    requestEndpointTried: string[];
    requestEndpointUsed: string | null;
    requestStatusCode: number | null;
    statusEndpointUsed: string | null;
    downloadEndpointUsed: string | null;
  };
  rows: WalmartItemReportRow[];
}

export interface WalmartItemReportEnrichmentResult {
  run: WalmartItemReportRunResult;
  decisionsBySku: Map<string, WalmartItemReportProductDecision>;
}

interface WalmartItemReportWorkflowOptions {
  statusPollDelaysMs?: number[];
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function asObjectArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => asObject(entry))
    .filter((entry): entry is Record<string, unknown> => entry !== null);
}

function firstNonEmptyString(...values: unknown[]): string {
  for (const value of values) {
    const candidate = asString(value);
    if (candidate) return candidate;
  }
  return "";
}

function optionalHeader(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeIdentifier(value: string): string {
  return value.replace(/[^a-z0-9]/gi, "").toUpperCase();
}

function normalizeSkuKey(value: string): string {
  return value.trim().toUpperCase();
}

function normalizeHeaderName(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function normalizeImageUrl(value: unknown): string {
  const candidate = asString(value);
  if (!candidate) return "";

  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "";
    if (parsed.protocol === "http:") parsed.protocol = "https:";
    return parsed.toString();
  } catch {
    return "";
  }
}

function dedupeUrls(values: unknown[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const normalized = normalizeImageUrl(value);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

function unique(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const normalized = asString(value);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

function tokenize(value: string): string[] {
  return value
    .trim()
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 1);
}

function titleBrandSimilarity(product: WalmartProductRecord, row: WalmartItemReportRow): number {
  const productTitleTokens = new Set(tokenize(product.title));
  const rowTitleTokens = new Set(tokenize(row.title));
  const productBrandTokens = new Set(tokenize(product.brand));
  const rowBrandTokens = new Set(tokenize(row.brand));

  if (productTitleTokens.size === 0 || rowTitleTokens.size === 0) return 0;

  const titleOverlap = Array.from(productTitleTokens.values()).filter((token) => rowTitleTokens.has(token)).length;
  const titleCoverage = titleOverlap / productTitleTokens.size;
  const titleUnion = new Set([...Array.from(productTitleTokens.values()), ...Array.from(rowTitleTokens.values())]).size;
  const titleJaccard = titleUnion > 0 ? titleOverlap / titleUnion : 0;

  const brandOverlap = Array.from(productBrandTokens.values()).filter((token) => rowBrandTokens.has(token)).length;
  const brandCoverage =
    productBrandTokens.size > 0 && rowBrandTokens.size > 0
      ? brandOverlap / Math.max(productBrandTokens.size, rowBrandTokens.size)
      : 0;

  return Math.round(titleCoverage * 80 + titleJaccard * 35 + brandCoverage * 40);
}

function buildWalmartApiHeaders(accessToken: string, correlationId: string): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
    "WM_SEC.ACCESS_TOKEN": accessToken,
    "WM_QOS.CORRELATION_ID": correlationId,
    "WM_SVC.NAME": "Walmart Marketplace",
  };

  const consumerChannelType = optionalHeader(process.env.WALMART_CONSUMER_CHANNEL_TYPE);
  const partnerId = optionalHeader(process.env.WALMART_PARTNER_ID);
  if (consumerChannelType) headers["WM_CONSUMER.CHANNEL.TYPE"] = consumerChannelType;
  if (partnerId) headers["WM_PARTNER.ID"] = partnerId;

  return headers;
}

function requestAttempts(): ItemReportRequestAttempt[] {
  return [
    {
      family: "report_requests",
      path: "/v3/reports/reportRequests",
      body: {
        reportType: "ITEM",
        format: "CSV",
      },
    },
    {
      family: "requests",
      path: "/v3/reports/requests",
      body: {
        reportType: "ITEM",
        format: "CSV",
      },
    },
  ];
}

function statusPath(reportRequestId: string, family: WalmartItemReportEndpointFamily): string {
  const encoded = encodeURIComponent(reportRequestId);
  if (family === "requests") {
    return `/v3/reports/requests/${encoded}`;
  }
  return `/v3/reports/reportRequests/${encoded}`;
}

function extractReportRequestId(payload: unknown): string {
  const root = asObject(payload);
  if (!root) return "";

  return firstNonEmptyString(
    root.reportRequestId,
    root.requestId,
    root.request_id,
    root.id,
    asObject(root.reportRequest)?.reportRequestId,
    asObject(root.report)?.reportRequestId,
    asObject(root.data)?.reportRequestId,
    asObjectArray(root.requests)[0]?.reportRequestId
  );
}

function parseItemReportStatus(payload: unknown): ParsedItemReportStatus {
  const root = asObject(payload) ?? {};
  const report = asObject(root.report) ?? asObject(root.data) ?? asObject(root.reportRequest) ?? {};
  const errors = asObjectArray(root.errors);
  const firstError = asObject(errors[0]) ?? asObject(root.error) ?? asObject(report.error) ?? {};
  const reportStatusRaw = firstNonEmptyString(
    root.reportStatus,
    root.requestStatus,
    root.status,
    root.processingStatus,
    report.reportStatus,
    report.requestStatus,
    report.status,
    report.processingStatus,
    asObject(root.reportRequest)?.status
  ).toUpperCase();

  const downloadUrl = firstNonEmptyString(
    root.downloadUrl,
    root.downloadURL,
    root.url,
    root.reportUrl,
    root.reportURL,
    report.downloadUrl,
    report.downloadURL,
    report.url,
    report.reportUrl,
    asObject(root.links)?.download,
    asObject(root.links)?.downloadUrl,
    asObject(root.download)?.url
  );

  const reportId = firstNonEmptyString(root.reportId, report.reportId, root.id, report.id, root.requestId, report.requestId);
  const generatedAt = firstNonEmptyString(
    root.generatedAt,
    root.createdTime,
    root.createdAt,
    root.reportGeneratedAt,
    report.generatedAt,
    report.createdTime,
    report.createdAt,
    report.reportGeneratedAt,
    root.completedAt,
    report.completedAt
  );

  if (!reportStatusRaw && (downloadUrl || reportId)) {
    return {
      state: "complete",
      downloadUrl: downloadUrl || null,
      reportId: reportId || null,
      generatedAt: generatedAt || null,
      reason: null,
    };
  }

  if (["PROCESSED", "COMPLETED", "COMPLETE", "READY", "SUCCESS", "DONE"].includes(reportStatusRaw)) {
    return {
      state: "complete",
      downloadUrl: downloadUrl || null,
      reportId: reportId || null,
      generatedAt: generatedAt || null,
      reason: null,
    };
  }

  if (["INPROGRESS", "IN_PROGRESS", "RUNNING", "RECEIVED", "PENDING", "SUBMITTED", "PROCESSING"].includes(reportStatusRaw)) {
    return {
      state: "in_progress",
      downloadUrl: null,
      reportId: reportId || null,
      generatedAt: null,
      reason: null,
    };
  }

  if (["FAILED", "FAILURE", "ERROR", "CANCELLED", "CANCELED", "REJECTED"].includes(reportStatusRaw)) {
    return {
      state: "failed",
      downloadUrl: null,
      reportId: reportId || null,
      generatedAt: null,
      reason:
        firstNonEmptyString(
          root.message,
          report.message,
          root.error,
          report.error,
          firstError.description,
          firstError.message
        ) || "Report generation failed.",
    };
  }

  return {
    state: "unknown",
    downloadUrl: downloadUrl || null,
    reportId: reportId || null,
    generatedAt: generatedAt || null,
    reason: null,
  };
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = ITEM_REPORT_REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function requestItemReport(accessToken: string): Promise<{
  ok: boolean;
  reportRequestId: string | null;
  endpointFamily: WalmartItemReportEndpointFamily | null;
  requestEndpointTried: string[];
  requestEndpointUsed: string | null;
  requestStatusCode: number | null;
  failureCategory: WalmartItemReportRunResult["failureCategory"];
  failureReason: string | null;
  diagnostics: WalmartItemReportApiDiagnostic[];
}> {
  const diagnostics: WalmartItemReportApiDiagnostic[] = [];
  const attempts = requestAttempts();
  const requestEndpointTried: string[] = [];
  let requestStatusCode: number | null = null;
  let requestEndpointUsed: string | null = null;

  async function runAttempt(attempt: ItemReportRequestAttempt): Promise<{
    response: Response | null;
    requestId: string;
  }> {
    const correlationId = crypto.randomUUID();
    const endpoint = new URL(attempt.path, `${WALMART_PRODUCTION_BASE_URL}/`).toString();
    requestEndpointTried.push(attempt.path);

    try {
      const response = await fetchWithTimeout(endpoint, {
        method: "POST",
        headers: buildWalmartApiHeaders(accessToken, correlationId),
        body: JSON.stringify(attempt.body),
        cache: "no-store",
      });

      diagnostics.push({ endpoint: attempt.path, httpStatus: response.status, ok: response.ok });
      requestStatusCode = response.status;
      const bodyText = await response.text();
      const payload = bodyText ? (JSON.parse(bodyText) as unknown) : {};
      return {
        response,
        requestId: extractReportRequestId(payload),
      };
    } catch {
      diagnostics.push({ endpoint: attempt.path, httpStatus: null, ok: false });
      requestStatusCode = null;
      return {
        response: null,
        requestId: "",
      };
    }
  }

  const primary = attempts[0];
  if (!primary) {
    return {
      ok: false,
      reportRequestId: null,
      endpointFamily: null,
      requestEndpointTried,
      requestEndpointUsed,
      requestStatusCode,
      failureCategory: "unavailable",
      failureReason: "Walmart Item Report request failed.",
      diagnostics,
    };
  }

  const primaryResult = await runAttempt(primary);

  if (primaryResult.response?.ok && primaryResult.requestId) {
    requestEndpointUsed = primary.path;
    return {
      ok: true,
      reportRequestId: primaryResult.requestId,
      endpointFamily: primary.family,
      requestEndpointTried,
      requestEndpointUsed,
      requestStatusCode,
      failureCategory: "none",
      failureReason: null,
      diagnostics,
    };
  }

  if (primaryResult.response?.status === 401 || primaryResult.response?.status === 403) {
    return {
      ok: false,
      reportRequestId: null,
      endpointFamily: null,
      requestEndpointTried,
      requestEndpointUsed,
      requestStatusCode,
      failureCategory: "auth_or_permission",
      failureReason: "Walmart Item Report request failed.",
      diagnostics,
    };
  }

  const fallback = attempts[1];
  if (primaryResult.response?.status === 404 && fallback) {
    const fallbackResult = await runAttempt(fallback);
    if (fallbackResult.response?.ok && fallbackResult.requestId) {
      requestEndpointUsed = fallback.path;
      return {
        ok: true,
        reportRequestId: fallbackResult.requestId,
        endpointFamily: fallback.family,
        requestEndpointTried,
        requestEndpointUsed,
        requestStatusCode,
        failureCategory: "none",
        failureReason: null,
        diagnostics,
      };
    }

    if (fallbackResult.response?.status === 401 || fallbackResult.response?.status === 403) {
      return {
        ok: false,
        reportRequestId: null,
        endpointFamily: null,
        requestEndpointTried,
        requestEndpointUsed,
        requestStatusCode,
        failureCategory: "auth_or_permission",
        failureReason: "Walmart Item Report request failed.",
        diagnostics,
      };
    }

    if (fallbackResult.response?.status === 404) {
      return {
        ok: false,
        reportRequestId: null,
        endpointFamily: null,
        requestEndpointTried,
        requestEndpointUsed,
        requestStatusCode,
        failureCategory: "not_found_endpoint",
        failureReason: "Walmart Item Report request failed.",
        diagnostics,
      };
    }
  }

  return {
    ok: false,
    reportRequestId: null,
    endpointFamily: null,
    requestEndpointTried,
    requestEndpointUsed,
    requestStatusCode,
    failureCategory: primaryResult.response?.status === 404 ? "not_found_endpoint" : "unavailable",
    failureReason: "Walmart Item Report request failed.",
    diagnostics,
  };
}

async function getReportRequestStatus(params: {
  accessToken: string;
  reportRequestId: string;
  endpointFamily: WalmartItemReportEndpointFamily;
  pollDelaysMs?: number[];
}): Promise<{
  ok: boolean;
  timedOut: boolean;
  status: ParsedItemReportStatus | null;
  statusEndpointUsed: string | null;
  failureCategory: WalmartItemReportRunResult["failureCategory"];
  failureReason: string | null;
  diagnostics: WalmartItemReportApiDiagnostic[];
}> {
  const diagnostics: WalmartItemReportApiDiagnostic[] = [];
  const path = statusPath(params.reportRequestId, params.endpointFamily);
  const pollDelaysMs =
    params.pollDelaysMs && params.pollDelaysMs.length > 0
      ? params.pollDelaysMs
      : [...ITEM_REPORT_STATUS_POLL_DELAYS_MS];

  for (let pollIndex = 0; pollIndex < pollDelaysMs.length; pollIndex += 1) {
    const correlationId = crypto.randomUUID();
    const endpoint = new URL(path, `${WALMART_PRODUCTION_BASE_URL}/`).toString();

    try {
      const response = await fetchWithTimeout(endpoint, {
        method: "GET",
        headers: buildWalmartApiHeaders(params.accessToken, correlationId),
        cache: "no-store",
      });

      diagnostics.push({ endpoint: path, httpStatus: response.status, ok: response.ok });

      if (response.status === 401 || response.status === 403) {
        return {
          ok: false,
          timedOut: false,
          status: null,
          statusEndpointUsed: path,
          failureCategory: "auth_or_permission",
          failureReason: "Walmart Item Report request failed.",
          diagnostics,
        };
      }

      if (response.status === 404) {
        return {
          ok: false,
          timedOut: false,
          status: null,
          statusEndpointUsed: path,
          failureCategory: "not_found_endpoint",
          failureReason: "Walmart Item Report request failed.",
          diagnostics,
        };
      }

      if (!response.ok) {
        continue;
      }

      const bodyText = await response.text();
      const payload = bodyText ? (JSON.parse(bodyText) as unknown) : {};
      const parsedStatus = parseItemReportStatus(payload);

      if (parsedStatus.state === "complete") {
        return {
          ok: true,
          timedOut: false,
          status: parsedStatus,
          statusEndpointUsed: path,
          failureCategory: "none",
          failureReason: null,
          diagnostics,
        };
      }

      if (parsedStatus.state === "failed") {
        return {
          ok: false,
          timedOut: false,
          status: parsedStatus,
          statusEndpointUsed: path,
          failureCategory: "report_failed",
          failureReason: "Walmart Item Report request failed.",
          diagnostics,
        };
      }
    } catch {
      diagnostics.push({ endpoint: path, httpStatus: null, ok: false });
    }

    await sleep(pollDelaysMs[pollIndex] ?? 0);
  }

  return {
    ok: false,
    timedOut: true,
    status: null,
    statusEndpointUsed: path,
    failureCategory: "timeout",
    failureReason: "Walmart Item Report was unavailable or timed out.",
    diagnostics,
  };
}

function parseCsvRows(csvText: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < csvText.length; index += 1) {
    const char = csvText[index] ?? "";

    if (inQuotes) {
      if (char === '"') {
        const next = csvText[index + 1] ?? "";
        if (next === '"') {
          cell += '"';
          index += 1;
          continue;
        }
        inQuotes = false;
        continue;
      }
      cell += char;
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }

    if (char === ",") {
      row.push(cell);
      cell = "";
      continue;
    }

    if (char === "\n") {
      row.push(cell);
      rows.push(row.map((value) => value.trim()));
      row = [];
      cell = "";
      continue;
    }

    if (char === "\r") {
      continue;
    }

    cell += char;
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row.map((value) => value.trim()));
  }

  return rows.filter((entry) => entry.some((value) => value.trim().length > 0));
}

function findColumnIndex(header: string[], aliases: string[]): number {
  const normalized = header.map((value) => normalizeHeaderName(value));
  for (const alias of aliases.map((value) => normalizeHeaderName(value))) {
    const index = normalized.findIndex((entry) => entry === alias);
    if (index >= 0) return index;
  }
  return -1;
}

function parseAdditionalImageUrls(raw: string): string[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];

  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed)) {
        return dedupeUrls(parsed);
      }
    } catch {
      // fall through
    }
  }

  const explicitUrls = trimmed.match(/https?:\/\/[^\s"'<>|,;\]]+/gi) ?? [];
  if (explicitUrls.length > 0) {
    return dedupeUrls(explicitUrls);
  }

  return dedupeUrls(trimmed.split(/[|;,\n\r\t ]+/g));
}

function parseDelimitedTextList(raw: string): string[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];

  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed)) {
        return unique(
          parsed
            .flatMap((entry) => {
              if (typeof entry === "string") return [entry.trim()];
              const objectEntry = asObject(entry);
              if (!objectEntry) return [];
              const value =
                asString(objectEntry.value) ||
                asString(objectEntry.text) ||
                asString(objectEntry.description) ||
                asString(objectEntry.label) ||
                asString(objectEntry.title) ||
                asString(objectEntry.name);
              return value ? [value.trim()] : [];
            })
            .map((entry) => entry.replace(/^[-*]+\s*/, "").trim())
            .filter(Boolean)
        );
      }
    } catch {
      // fall through to delimiter parsing
    }
  }

  return unique(
    trimmed
      .split(/\r?\n|[|;]+/g)
      .map((entry) => entry.replace(/^[-*]+\s*/, "").trim())
      .filter(Boolean)
  );
}

export function parseItemReportCsv(csvText: string): WalmartItemReportRow[] {
  const rows = parseCsvRows(csvText);
  if (rows.length <= 1) return [];

  const [header, ...bodyRows] = rows;

  const skuIndex = findColumnIndex(header, ["SKU", "Seller SKU", "sellerSku", "Seller Part Number"]);
  const productIdIndex = findColumnIndex(header, ["ProductId", "Product ID", "gtin", "upc"]);
  const productIdTypeIndex = findColumnIndex(header, ["ProductIdType", "Product ID Type", "identifierType"]);
  const itemIdIndex = findColumnIndex(header, ["itemId", "Item ID", "usItemId", "id"]);
  const wpidIndex = findColumnIndex(header, ["WPID", "wpID", "Wpid"]);
  const titleIndex = findColumnIndex(header, ["ProductName", "Title", "Item Name", "name"]);
  const brandIndex = findColumnIndex(header, ["Brand", "Brand Name", "brandName"]);
  const shelfDescriptionIndex = findColumnIndex(header, [
    "ShelfDescription",
    "Shelf Description",
    "ShortDescription",
    "Short Description",
    "siteDescription",
  ]);
  const longDescriptionIndex = findColumnIndex(header, [
    "LongDescription",
    "Long Description",
    "ProductDescription",
    "Description",
    "FullDescription",
  ]);
  const keyFeaturesIndex = findColumnIndex(header, [
    "KeyFeatures",
    "Key Features",
    "BulletPoints",
    "Bullet Points",
    "Highlights",
    "AboutThisItem",
    "Features",
  ]);
  const primaryImageIndex = findColumnIndex(header, ["PrimaryImageUrl", "Primary Image URL", "primaryImageUrl", "Main Image URL"]);
  const additionalImagesIndex = findColumnIndex(header, ["AdditionalImageUrls", "Additional Image URLs", "additionalImageUrls", "GalleryImageUrls"]);
  const variantImagesIndex = findColumnIndex(header, ["VariantImageUrls", "Variant Image URLs", "variantImageUrls"]);

  const parsed: WalmartItemReportRow[] = [];

  for (let index = 0; index < bodyRows.length; index += 1) {
    const row = bodyRows[index] ?? [];
    const sku = skuIndex >= 0 ? asString(row[skuIndex]) : "";
    if (!sku) continue;

    const primaryImageUrl = normalizeImageUrl(primaryImageIndex >= 0 ? row[primaryImageIndex] : "");
    const additionalImageUrls = parseAdditionalImageUrls(additionalImagesIndex >= 0 ? asString(row[additionalImagesIndex]) : "");
    const variantImageUrls = parseAdditionalImageUrls(variantImagesIndex >= 0 ? asString(row[variantImagesIndex]) : "");

    parsed.push({
      sku,
      productId: productIdIndex >= 0 ? asString(row[productIdIndex]) : "",
      productIdType: productIdTypeIndex >= 0 ? asString(row[productIdTypeIndex]) : "",
      itemId: itemIdIndex >= 0 ? asString(row[itemIdIndex]) : "",
      wpid: wpidIndex >= 0 ? asString(row[wpidIndex]) : "",
      title: titleIndex >= 0 ? asString(row[titleIndex]) : "",
      brand: brandIndex >= 0 ? asString(row[brandIndex]) : "",
      shelfDescription: shelfDescriptionIndex >= 0 ? asString(row[shelfDescriptionIndex]) : "",
      longDescription: longDescriptionIndex >= 0 ? asString(row[longDescriptionIndex]) : "",
      keyFeatures: keyFeaturesIndex >= 0 ? parseDelimitedTextList(asString(row[keyFeaturesIndex])) : [],
      primaryImageUrl,
      galleryImageUrls: dedupeUrls([
        primaryImageUrl,
        ...additionalImageUrls,
      ]),
      variantImageUrls,
      rowIndex: index,
    });
  }

  return parsed;
}

function readZipEntry(buffer: Buffer): { filename: string; content: Buffer }[] {
  const EOCD_SIGNATURE = 0x06054b50;
  const CD_SIGNATURE = 0x02014b50;
  const LH_SIGNATURE = 0x04034b50;

  let eocdOffset = -1;
  for (let index = buffer.length - 22; index >= Math.max(0, buffer.length - 66_000); index -= 1) {
    if (buffer.readUInt32LE(index) === EOCD_SIGNATURE) {
      eocdOffset = index;
      break;
    }
  }
  if (eocdOffset < 0) {
    throw new Error("Walmart Item Report ZIP parsing failed.");
  }

  const totalEntries = buffer.readUInt16LE(eocdOffset + 10);
  const centralDirectoryOffset = buffer.readUInt32LE(eocdOffset + 16);

  const entries: { filename: string; content: Buffer }[] = [];
  let cursor = centralDirectoryOffset;

  for (let index = 0; index < totalEntries; index += 1) {
    if (buffer.readUInt32LE(cursor) !== CD_SIGNATURE) {
      throw new Error("Walmart Item Report ZIP parsing failed.");
    }

    const compressionMethod = buffer.readUInt16LE(cursor + 10);
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const fileNameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const localHeaderOffset = buffer.readUInt32LE(cursor + 42);

    const fileName = buffer.slice(cursor + 46, cursor + 46 + fileNameLength).toString("utf8");

    if (buffer.readUInt32LE(localHeaderOffset) !== LH_SIGNATURE) {
      throw new Error("Walmart Item Report ZIP local header missing.");
    }

    const localNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localHeaderOffset + 28);
    const dataOffset = localHeaderOffset + 30 + localNameLength + localExtraLength;
    const compressed = buffer.slice(dataOffset, dataOffset + compressedSize);

    let content: Buffer;
    if (compressionMethod === 0) {
      content = compressed;
    } else if (compressionMethod === 8) {
      content = inflateRawSync(compressed);
    } else {
      throw new Error("Walmart Item Report ZIP contains unsupported compression.");
    }

    entries.push({ filename: fileName, content });

    cursor += 46 + fileNameLength + extraLength + commentLength;
  }

  return entries;
}

function decodeReportBuffer(buffer: Buffer, contentType: string | null): string {
  const contentTypeLower = (contentType ?? "").toLowerCase();

  const looksLikeZip = buffer.length >= 4 && buffer.readUInt32LE(0) === 0x04034b50;
  const looksLikeGzip = buffer.length >= 2 && buffer[0] === 0x1f && buffer[1] === 0x8b;

  if (looksLikeZip || contentTypeLower.includes("zip")) {
    const entries = readZipEntry(buffer);
    const csvEntry = entries.find((entry) => entry.filename.toLowerCase().endsWith(".csv"));
    if (!csvEntry) {
      const xlsxEntry = entries.find((entry) => entry.filename.toLowerCase().endsWith(".xlsx"));
      if (xlsxEntry) {
        throw new Error("Walmart Item Report returned unsupported XLSX format.");
      }
      throw new Error("Walmart Item Report ZIP did not contain a CSV file.");
    }
    return csvEntry.content.toString("utf8");
  }

  if (looksLikeGzip || contentTypeLower.includes("gzip")) {
    return gunzipSync(buffer).toString("utf8");
  }

  return buffer.toString("utf8");
}

async function downloadReport(params: {
  accessToken: string;
  requestId: string;
  downloadUrl: string | null;
}): Promise<{
  ok: boolean;
  csv: string;
  downloadedAt: string | null;
  downloadEndpointUsed: string | null;
  failureCategory: WalmartItemReportRunResult["failureCategory"];
  failureReason: string | null;
  diagnostics: WalmartItemReportApiDiagnostic[];
}> {
  const diagnostics: WalmartItemReportApiDiagnostic[] = [];

  async function fetchReport(url: string, includeHeaders: boolean): Promise<Response> {
    const correlationId = crypto.randomUUID();
    return fetchWithTimeout(url, {
      method: "GET",
      headers: includeHeaders ? buildWalmartApiHeaders(params.accessToken, correlationId) : { Accept: "*/*" },
      cache: "no-store",
      redirect: "follow",
    });
  }

  async function readCsvFromResponse(response: Response): Promise<string> {
    const contentType = response.headers.get("content-type");
    const buffer = Buffer.from(await response.arrayBuffer());
    return decodeReportBuffer(buffer, contentType);
  }

  const candidates: Array<{ url: string; diagnosticEndpoint: string }> = [];
  if (params.downloadUrl) {
    candidates.push({
      url: params.downloadUrl,
      diagnosticEndpoint: "status.downloadUrl",
    });
  }
  const documentedDownloadPath = `/v3/reports/downloadReport?requestId=${encodeURIComponent(params.requestId)}`;
  candidates.push({
    url: new URL(documentedDownloadPath, `${WALMART_PRODUCTION_BASE_URL}/`).toString(),
    diagnosticEndpoint: "/v3/reports/downloadReport?requestId=<requestId>",
  });

  for (const candidate of candidates) {
    try {
      const url = candidate.url.startsWith("http")
        ? candidate.url
        : new URL(candidate.url, `${WALMART_PRODUCTION_BASE_URL}/`).toString();

      const sameHost = url.startsWith(WALMART_PRODUCTION_BASE_URL);
      const response = await fetchReport(url, sameHost);
      diagnostics.push({ endpoint: candidate.diagnosticEndpoint, httpStatus: response.status, ok: response.ok });

      if (response.status === 401 || response.status === 403) {
        return {
          ok: false,
          csv: "",
          downloadedAt: null,
          downloadEndpointUsed: candidate.diagnosticEndpoint,
          failureCategory: "auth_or_permission",
          failureReason: "Walmart Item Report request failed.",
          diagnostics,
        };
      }

      if (!response.ok) continue;

      const maybeJson = response.headers.get("content-type")?.toLowerCase().includes("application/json") ?? false;
      if (maybeJson) {
        const text = await response.text();
        const payload = text ? (JSON.parse(text) as unknown) : {};
        const nestedUrl = firstNonEmptyString(
          asObject(payload)?.downloadUrl,
          asObject(payload)?.downloadURL,
          asObject(payload)?.url,
          asObject(payload)?.signedUrl,
          asObject(asObject(payload)?.report)?.downloadUrl,
          asObject(asObject(payload)?.report)?.url,
          asObject(asObject(payload)?.reportDocument)?.url
        );
        if (nestedUrl) {
          const nestedResponse = await fetchReport(nestedUrl, nestedUrl.startsWith(WALMART_PRODUCTION_BASE_URL));
          diagnostics.push({ endpoint: "download.redirectUrl", httpStatus: nestedResponse.status, ok: nestedResponse.ok });
          if (!nestedResponse.ok) continue;
          const csv = await readCsvFromResponse(nestedResponse);
          return {
            ok: true,
            csv,
            downloadedAt: new Date().toISOString(),
            downloadEndpointUsed: candidate.diagnosticEndpoint,
            failureCategory: "none",
            failureReason: null,
            diagnostics,
          };
        }
        continue;
      }

      const csv = await readCsvFromResponse(response);
      return {
        ok: true,
        csv,
        downloadedAt: new Date().toISOString(),
        downloadEndpointUsed: candidate.diagnosticEndpoint,
        failureCategory: "none",
        failureReason: null,
        diagnostics,
      };
    } catch (error) {
      if (error instanceof Error && error.message.includes("unsupported XLSX")) {
        return {
          ok: false,
          csv: "",
          downloadedAt: null,
          downloadEndpointUsed: candidate.diagnosticEndpoint,
          failureCategory: "parse_failed",
          failureReason: "Walmart Item Report returned unsupported XLSX format.",
          diagnostics,
        };
      }

      diagnostics.push({ endpoint: candidate.diagnosticEndpoint, httpStatus: null, ok: false });
    }
  }

  return {
    ok: false,
    csv: "",
    downloadedAt: null,
    downloadEndpointUsed: null,
    failureCategory: "download_failed",
    failureReason: "Walmart Item Report request failed.",
    diagnostics,
  };
}

export async function runItemReportWorkflow(
  accessToken: string,
  options: WalmartItemReportWorkflowOptions = {}
): Promise<WalmartItemReportRunResult> {
  const requestResult = await requestItemReport(accessToken);
  if (!requestResult.ok || !requestResult.reportRequestId || !requestResult.endpointFamily) {
    return {
      reportRequestId: null,
      reportGeneratedAt: null,
      reportDownloadedAt: null,
      itemReportRequested: false,
      itemReportDownloaded: false,
      itemReportRowsParsed: 0,
      status: requestResult.failureCategory === "auth_or_permission" ? "failed" : "unavailable",
      failureCategory: requestResult.failureCategory,
      failureReason: requestResult.failureReason,
      diagnostics: {
        requestAttempts: requestResult.diagnostics,
        statusAttempts: [],
        downloadAttempts: [],
        requestEndpointTried: requestResult.requestEndpointTried,
        requestEndpointUsed: requestResult.requestEndpointUsed,
        requestStatusCode: requestResult.requestStatusCode,
        statusEndpointUsed: null,
        downloadEndpointUsed: null,
      },
      rows: [],
    };
  }

  const statusResult = await getReportRequestStatus({
    accessToken,
    reportRequestId: requestResult.reportRequestId,
    endpointFamily: requestResult.endpointFamily,
    pollDelaysMs: options.statusPollDelaysMs,
  });
  if (!statusResult.ok || !statusResult.status) {
    return {
      reportRequestId: requestResult.reportRequestId,
      reportGeneratedAt: null,
      reportDownloadedAt: null,
      itemReportRequested: true,
      itemReportDownloaded: false,
      itemReportRowsParsed: 0,
      status: statusResult.timedOut ? "timed_out" : "failed",
      failureCategory: statusResult.failureCategory,
      failureReason: statusResult.failureReason,
      diagnostics: {
        requestAttempts: requestResult.diagnostics,
        statusAttempts: statusResult.diagnostics,
        downloadAttempts: [],
        requestEndpointTried: requestResult.requestEndpointTried,
        requestEndpointUsed: requestResult.requestEndpointUsed,
        requestStatusCode: requestResult.requestStatusCode,
        statusEndpointUsed: statusResult.statusEndpointUsed,
        downloadEndpointUsed: null,
      },
      rows: [],
    };
  }

  const downloadResult = await downloadReport({
    accessToken,
    requestId: requestResult.reportRequestId,
    downloadUrl: statusResult.status.downloadUrl,
  });

  if (!downloadResult.ok) {
    return {
      reportRequestId: requestResult.reportRequestId,
      reportGeneratedAt: statusResult.status.generatedAt,
      reportDownloadedAt: null,
      itemReportRequested: true,
      itemReportDownloaded: false,
      itemReportRowsParsed: 0,
      status: downloadResult.failureCategory === "auth_or_permission" ? "failed" : "unavailable",
      failureCategory: downloadResult.failureCategory,
      failureReason: downloadResult.failureReason,
      diagnostics: {
        requestAttempts: requestResult.diagnostics,
        statusAttempts: statusResult.diagnostics,
        downloadAttempts: downloadResult.diagnostics,
        requestEndpointTried: requestResult.requestEndpointTried,
        requestEndpointUsed: requestResult.requestEndpointUsed,
        requestStatusCode: requestResult.requestStatusCode,
        statusEndpointUsed: statusResult.statusEndpointUsed,
        downloadEndpointUsed: downloadResult.downloadEndpointUsed,
      },
      rows: [],
    };
  }

  try {
    const rows = parseItemReportCsv(downloadResult.csv);
    const anyRowHasImage = rows.some((row) => rowHasUsableImage(row));
    const rowCategory: WalmartItemReportRunResult["failureCategory"] = rows.length === 0 ? "no_rows" : anyRowHasImage ? "none" : "no_image_columns";
    const rowReason =
      rowCategory === "no_rows"
        ? "Walmart Item Report returned no rows."
        : rowCategory === "no_image_columns"
          ? "Item Report row found, but no usable image URL was provided."
          : null;
    return {
      reportRequestId: requestResult.reportRequestId,
      reportGeneratedAt: statusResult.status.generatedAt,
      reportDownloadedAt: downloadResult.downloadedAt,
      itemReportRequested: true,
      itemReportDownloaded: true,
      itemReportRowsParsed: rows.length,
      status: "ready",
      failureCategory: rowCategory,
      failureReason: rowReason,
      diagnostics: {
        requestAttempts: requestResult.diagnostics,
        statusAttempts: statusResult.diagnostics,
        downloadAttempts: downloadResult.diagnostics,
        requestEndpointTried: requestResult.requestEndpointTried,
        requestEndpointUsed: requestResult.requestEndpointUsed,
        requestStatusCode: requestResult.requestStatusCode,
        statusEndpointUsed: statusResult.statusEndpointUsed,
        downloadEndpointUsed: downloadResult.downloadEndpointUsed,
      },
      rows,
    };
  } catch {
    return {
      reportRequestId: requestResult.reportRequestId,
      reportGeneratedAt: statusResult.status.generatedAt,
      reportDownloadedAt: downloadResult.downloadedAt,
      itemReportRequested: true,
      itemReportDownloaded: true,
      itemReportRowsParsed: 0,
      status: "failed",
      failureCategory: "parse_failed",
      failureReason: "Walmart Item Report request failed.",
      diagnostics: {
        requestAttempts: requestResult.diagnostics,
        statusAttempts: statusResult.diagnostics,
        downloadAttempts: downloadResult.diagnostics,
        requestEndpointTried: requestResult.requestEndpointTried,
        requestEndpointUsed: requestResult.requestEndpointUsed,
        requestStatusCode: requestResult.requestStatusCode,
        statusEndpointUsed: statusResult.statusEndpointUsed,
        downloadEndpointUsed: downloadResult.downloadEndpointUsed,
      },
      rows: [],
    };
  }
}

function rowHasUsableImage(row: WalmartItemReportRow): boolean {
  return Boolean(row.primaryImageUrl || row.galleryImageUrls.length > 0 || row.variantImageUrls.length > 0);
}

const NON_MEANINGFUL_TEXT = new Set([
  "unknown",
  "not available",
  "n/a",
  "na",
  "none",
  "null",
  "undefined",
  "not provided",
]);

function isMeaningfulText(value: unknown): boolean {
  const normalized = asString(value).trim().toLowerCase();
  if (!normalized) return false;
  return !NON_MEANINGFUL_TEXT.has(normalized);
}

function meaningfulTextList(value: string[] | undefined): string[] {
  return (value ?? []).map((entry) => asString(entry)).filter((entry) => isMeaningfulText(entry));
}

function contentNeedsHydration(product: WalmartProductRecord): boolean {
  const hasShort = isMeaningfulText(product.shortDescription);
  const hasLong = isMeaningfulText(product.longDescription);
  const hasBullets = meaningfulTextList(product.bulletPoints).length > 0;
  return !(hasShort && hasLong && hasBullets);
}

function mergeMissingContentFromItemReportRow(
  product: WalmartProductRecord,
  row: WalmartItemReportRow
): WalmartProductRecord | null {
  const nextShortDescription = asString(row.shelfDescription);
  const nextLongDescription = asString(row.longDescription);
  const nextBulletPoints = meaningfulTextList(row.keyFeatures);

  let changed = false;
  const nextProduct: WalmartProductRecord = {
    ...product,
  };

  if (!isMeaningfulText(nextProduct.shortDescription) && isMeaningfulText(nextShortDescription)) {
    nextProduct.shortDescription = nextShortDescription;
    changed = true;
  }

  if (!isMeaningfulText(nextProduct.longDescription) && isMeaningfulText(nextLongDescription)) {
    nextProduct.longDescription = nextLongDescription;
    changed = true;
  }

  if (meaningfulTextList(nextProduct.bulletPoints).length === 0 && nextBulletPoints.length > 0) {
    nextProduct.bulletPoints = nextBulletPoints;
    changed = true;
  }

  if (!changed) return null;

  const now = new Date().toISOString();
  const rawPayload = asObject(nextProduct.rawPayload) ?? {};
  const normalizedPayload = asObject(nextProduct.normalizedPayload) ?? {};
  const normalizedItemReportHydration = asObject(normalizedPayload.itemReportHydration) ?? {};

  nextProduct.rawPayload = {
    ...rawPayload,
    itemReportContentHydratedAt: now,
    itemReportRowIndex: row.rowIndex,
  };
  nextProduct.normalizedPayload = {
    ...normalizedPayload,
    itemReportHydration: {
      ...normalizedItemReportHydration,
      shortDescription: nextProduct.shortDescription,
      longDescription: nextProduct.longDescription,
      bulletPoints: [...nextProduct.bulletPoints],
      rowIndex: row.rowIndex,
      source: "walmart_item_report",
      hydratedAt: now,
    },
  };
  nextProduct.updatedAt = now;

  return nextProduct;
}

function rowMatchQuality(row: WalmartItemReportRow): number {
  let score = 0;
  if (row.primaryImageUrl) score += 200;
  if (row.galleryImageUrls.length > 0) score += 80;
  if (row.variantImageUrls.length > 0) score += 40;
  if (row.itemId) score += 12;
  if (row.productId) score += 8;
  return score;
}

function bestRow(rows: WalmartItemReportRow[]): WalmartItemReportRow | null {
  if (rows.length === 0) return null;
  return [...rows].sort((left, right) => rowMatchQuality(right) - rowMatchQuality(left))[0] ?? null;
}

function makeDecision(params: {
  sku: string;
  syncedAt: string;
  status: WalmartImageSyncStatus;
  reason: string;
  matchMethod: WalmartImageMatchMethod | null;
  matchedItemId: string | null;
  primaryImageUrl: string;
  galleryImageUrls: string[];
  variantImageUrls: string[];
  allowFallback: boolean;
}): WalmartItemReportProductDecision {
  return {
    sku: params.sku,
    imageSyncStatus: params.status,
    statusReason: params.reason,
    imageSource: "walmart_item_report",
    primaryImageUrl: params.primaryImageUrl,
    galleryImageUrls: params.galleryImageUrls,
    variantImageUrls: params.variantImageUrls,
    matchedItemId: params.matchedItemId,
    matchMethod: params.matchMethod,
    lastImageSyncedAt: params.syncedAt,
    allowItemSearchFallback: params.allowFallback,
  };
}

function buildRowIndexes(rows: WalmartItemReportRow[]): {
  bySku: Map<string, WalmartItemReportRow[]>;
  byProductId: Map<string, WalmartItemReportRow[]>;
  byItemId: Map<string, WalmartItemReportRow[]>;
  byWpid: Map<string, WalmartItemReportRow[]>;
  allRows: WalmartItemReportRow[];
} {
  const bySku = new Map<string, WalmartItemReportRow[]>();
  const byProductId = new Map<string, WalmartItemReportRow[]>();
  const byItemId = new Map<string, WalmartItemReportRow[]>();
  const byWpid = new Map<string, WalmartItemReportRow[]>();

  for (const row of rows) {
    const skuKey = normalizeSkuKey(row.sku);
    if (skuKey) {
      bySku.set(skuKey, [...(bySku.get(skuKey) ?? []), row]);
    }

    const productIdKey = normalizeIdentifier(row.productId);
    const productIdTypeKey = normalizeIdentifier(row.productIdType);
    if (productIdKey && productIdTypeKey) {
      const key = `${productIdTypeKey}:${productIdKey}`;
      byProductId.set(key, [...(byProductId.get(key) ?? []), row]);
    }

    const itemIdKey = normalizeIdentifier(row.itemId);
    if (itemIdKey) {
      byItemId.set(itemIdKey, [...(byItemId.get(itemIdKey) ?? []), row]);
    }

    const wpidKey = normalizeIdentifier(row.wpid);
    if (wpidKey) {
      byWpid.set(wpidKey, [...(byWpid.get(wpidKey) ?? []), row]);
    }
  }

  return { bySku, byProductId, byItemId, byWpid, allRows: rows };
}

function pickReportRowForProduct(
  product: WalmartProductRecord,
  indexes: ReturnType<typeof buildRowIndexes>
): { row: WalmartItemReportRow | null; method: WalmartImageMatchMethod | null; rowMatched: boolean } {
  const skuRows = indexes.bySku.get(normalizeSkuKey(product.sku)) ?? [];
  if (skuRows.length > 0) {
    return { row: bestRow(skuRows), method: "item_report_sku", rowMatched: true };
  }

  const gtin = normalizeIdentifier(product.gtin ?? "");
  if (gtin) {
    const rows = indexes.byProductId.get(`GTIN:${gtin}`) ?? indexes.byProductId.get(`EAN:${gtin}`) ?? [];
    if (rows.length > 0) {
      return { row: bestRow(rows), method: "item_report_productid", rowMatched: true };
    }
  }

  const upc = normalizeIdentifier(product.upc ?? "");
  if (upc) {
    const rows = indexes.byProductId.get(`UPC:${upc}`) ?? [];
    if (rows.length > 0) {
      return { row: bestRow(rows), method: "item_report_productid", rowMatched: true };
    }
  }

  const itemId = normalizeIdentifier(product.itemId ?? "");
  if (itemId) {
    const rows = indexes.byItemId.get(itemId) ?? [];
    if (rows.length > 0) {
      return { row: bestRow(rows), method: "item_report_itemid", rowMatched: true };
    }
  }

  const wpid = normalizeIdentifier(product.wpid ?? "");
  if (wpid) {
    const rows = indexes.byWpid.get(wpid) ?? [];
    if (rows.length > 0) {
      return { row: bestRow(rows), method: "item_report_wpid", rowMatched: true };
    }
  }

  const titleBrandCandidates = indexes.allRows
    .map((row) => ({ row, score: titleBrandSimilarity(product, row) }))
    .filter((entry) => entry.score >= 85)
    .sort((left, right) => right.score - left.score);

  if (titleBrandCandidates.length > 0) {
    const top = titleBrandCandidates[0]!;
    const runnerUp = titleBrandCandidates[1];
    const scoreGap = runnerUp ? top.score - runnerUp.score : top.score;
    if (!runnerUp || scoreGap >= 18) {
      return { row: top.row, method: "item_report_title_brand", rowMatched: true };
    }
  }

  return { row: null, method: null, rowMatched: false };
}

export function hydrateMissingContentFromItemReportRows(
  products: WalmartProductRecord[],
  rows: WalmartItemReportRow[]
): WalmartProductRecord[] {
  if (products.length === 0 || rows.length === 0) return products;

  const indexes = buildRowIndexes(rows);
  return products.map((product) => {
    if (!contentNeedsHydration(product)) return product;
    const matched = pickReportRowForProduct(product, indexes);
    if (!matched.row) return product;
    return mergeMissingContentFromItemReportRow(product, matched.row) ?? product;
  });
}

export function enrichProductsFromParsedItemReport(params: {
  products: WalmartProductRecord[];
  rows: WalmartItemReportRow[];
}): Map<string, WalmartItemReportProductDecision> {
  const syncedAt = new Date().toISOString();
  const indexes = buildRowIndexes(params.rows);
  const decisions = new Map<string, WalmartItemReportProductDecision>();

  for (const product of params.products) {
    const key = normalizeSkuKey(product.sku);
    const matched = pickReportRowForProduct(product, indexes);

    if (!matched.row || !matched.method) {
      decisions.set(
        key,
        makeDecision({
          sku: product.sku,
          syncedAt,
          status: "not_found",
          reason: "No matching row found in Walmart Item Report.",
          matchMethod: null,
          matchedItemId: null,
          primaryImageUrl: "",
          galleryImageUrls: [],
          variantImageUrls: [],
          allowFallback: true,
        })
      );
      continue;
    }

    const row = matched.row;
    const primaryImageUrl = row.primaryImageUrl || row.galleryImageUrls[0] || row.variantImageUrls[0] || "";
    const galleryImageUrls = dedupeUrls([primaryImageUrl, ...row.galleryImageUrls]);
    const variantImageUrls = dedupeUrls(row.variantImageUrls);

    if (primaryImageUrl && rowHasUsableImage(row)) {
      decisions.set(
        key,
        makeDecision({
          sku: product.sku,
          syncedAt,
          status: "found",
          reason: "Image found in Walmart Item Report.",
          matchMethod: matched.method,
          matchedItemId: row.itemId || null,
          primaryImageUrl,
          galleryImageUrls,
          variantImageUrls,
          allowFallback: false,
        })
      );
      continue;
    }

    decisions.set(
      key,
      makeDecision({
        sku: product.sku,
        syncedAt,
        status: "not_found",
        reason: "Item Report row found, but no usable image URL was provided.",
        matchMethod: matched.method,
        matchedItemId: row.itemId || null,
        primaryImageUrl: "",
        galleryImageUrls: [],
        variantImageUrls: [],
        allowFallback: false,
      })
    );
  }

  return decisions;
}

export async function enrichProductsFromItemReport(params: {
  accessToken: string;
  products: WalmartProductRecord[];
  statusPollDelaysMs?: number[];
}): Promise<WalmartItemReportEnrichmentResult> {
  const run = await runItemReportWorkflow(params.accessToken, {
    statusPollDelaysMs: params.statusPollDelaysMs,
  });
  const decisionsBySku = new Map<string, WalmartItemReportProductDecision>();

  const productsNeedingImage = params.products.filter((product) => !product.imageUrl.trim());
  if (productsNeedingImage.length === 0) {
    return { run, decisionsBySku };
  }

  if (run.status !== "ready") {
    const safeReason =
      run.failureCategory === "timeout"
        ? "Walmart Item Report was unavailable or timed out."
        : "Walmart Item Report request failed.";

    for (const product of productsNeedingImage) {
      decisionsBySku.set(
        normalizeSkuKey(product.sku),
        makeDecision({
          sku: product.sku,
          syncedAt: new Date().toISOString(),
          status: "failed",
          reason: safeReason,
          matchMethod: null,
          matchedItemId: null,
          primaryImageUrl: "",
          galleryImageUrls: [],
          variantImageUrls: [],
          allowFallback: true,
        })
      );
    }

    return { run, decisionsBySku };
  }

  return {
    run,
    decisionsBySku: enrichProductsFromParsedItemReport({
      products: productsNeedingImage,
      rows: run.rows,
    }),
  };
}

export const walmartItemReportInternals = {
  normalizeHeaderName,
  normalizeImageUrl,
  parseAdditionalImageUrls,
  parseCsvRows,
  readZipEntry,
  decodeReportBuffer,
  rowMatchQuality,
  buildRowIndexes,
};

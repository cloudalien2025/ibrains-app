import "server-only";

import crypto from "crypto";
import { WALMART_PRODUCTION_BASE_URL } from "@/lib/ecomviper/walmart/walmart-client";
import { requestWalmartTokenForUser } from "@/lib/ecomviper/walmart/walmart-auth";
import {
  parseItemReportCsv,
  type WalmartItemReportRow,
  walmartItemReportInternals,
} from "@/lib/ecomviper/walmart/walmart-item-report";
import type {
  WalmartDocketFreshnessSummary,
  WalmartItemReportBackfillStatus,
} from "@/lib/ecomviper/walmart/walmart-docket-freshness";

export type WalmartItemReportBackfillSource = "live" | "fixture" | "unavailable";
export type WalmartItemReportCredentialMode = "byo_live" | "mock" | "unavailable";

export interface WalmartItemReportBackfillDiagnostic {
  code: string;
  message: string;
  source: "walmart_item_report" | "fixture" | "backfill";
  level?: "info" | "warning" | "error";
}

export interface WalmartItemReportBackfillRequest {
  sku?: string;
  reportType: "ITEM";
  reportVersion?: string | null;
  requestedBy?: string | null;
}

export interface WalmartItemReportBackfillRequestResult {
  ok: boolean;
  status: WalmartItemReportBackfillStatus;
  requestId: string | null;
  reportType: "ITEM";
  reportVersion: string | null;
  requestedAt: string | null;
  cooldownUntil: string | null;
  source: WalmartItemReportBackfillSource;
  credentialMode: WalmartItemReportCredentialMode;
  diagnostics: WalmartItemReportBackfillDiagnostic[];
}

export interface WalmartItemReportBackfillPollResult {
  ok: boolean;
  status: WalmartItemReportBackfillStatus;
  requestId: string;
  reportType: "ITEM";
  reportVersion: string | null;
  walmartStatus: string | null;
  ready: boolean;
  downloadUrl: string | null;
  lastCheckedAt: string;
  readyAt: string | null;
  expiresAt: string | null;
  source: WalmartItemReportBackfillSource;
  credentialMode: WalmartItemReportCredentialMode;
  diagnostics: WalmartItemReportBackfillDiagnostic[];
}

export interface WalmartItemReportDownloadResult {
  ok: boolean;
  status: WalmartItemReportBackfillStatus;
  requestId: string;
  content: string;
  contentType: string | null;
  downloadedAt: string | null;
  source: WalmartItemReportBackfillSource;
  credentialMode: WalmartItemReportCredentialMode;
  diagnostics: WalmartItemReportBackfillDiagnostic[];
}

export interface WalmartItemReportApplyResult {
  status: WalmartItemReportBackfillStatus;
  rowCount: number;
  appliedSkuCount: number;
  warningCount: number;
  errorCount: number;
  source: WalmartItemReportBackfillSource;
  credentialMode: WalmartItemReportCredentialMode;
  diagnostics: WalmartItemReportBackfillDiagnostic[];
  freshness?: WalmartDocketFreshnessSummary | null;
}

export interface WalmartItemReportProvider {
  providerName: string;
  source: WalmartItemReportBackfillSource;
  credentialMode: WalmartItemReportCredentialMode;
  createItemReportRequest(
    request: WalmartItemReportBackfillRequest
  ): Promise<WalmartItemReportBackfillRequestResult>;
  getReportRequestStatus(requestId: string): Promise<WalmartItemReportBackfillPollResult>;
  getReportDownloadUrl(requestId: string): Promise<{
    ok: boolean;
    status: WalmartItemReportBackfillStatus;
    downloadUrl: string | null;
    diagnostics: WalmartItemReportBackfillDiagnostic[];
  }>;
  downloadReport(input: { requestId: string; downloadUrl?: string | null }): Promise<WalmartItemReportDownloadResult>;
  parseItemReport(content: string): Promise<WalmartItemReportRow[]>;
  applyItemReportRows(input: {
    rows: WalmartItemReportRow[];
    requestedSku?: string;
  }): Promise<WalmartItemReportApplyResult>;
}

type ReportEndpointFamily = "reportRequests" | "requests";

const REQUEST_TIMEOUT_MS = 12_000;
const RETAINED_DAYS = 30;

function asObject(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function asText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function addDaysIso(baseIso: string, days: number): string {
  const base = Date.parse(baseIso);
  if (!Number.isFinite(base)) return baseIso;
  return new Date(base + days * 24 * 60 * 60 * 1000).toISOString();
}

function normalizeReportStatus(raw: string): WalmartItemReportBackfillStatus {
  const normalized = raw.trim().toUpperCase();
  if (["RECEIVED", "SUBMITTED", "PENDING"].includes(normalized)) return "submitted";
  if (["INPROGRESS", "IN_PROGRESS", "PROCESSING", "RUNNING"].includes(normalized)) return "in_progress";
  if (["READY", "PROCESSED", "COMPLETED", "COMPLETE", "SUCCESS", "DONE"].includes(normalized)) {
    return "ready";
  }
  if (["FAILED", "FAILURE", "ERROR", "REJECTED", "CANCELED", "CANCELLED"].includes(normalized)) {
    return "request_failed";
  }
  return "in_progress";
}

function extractRequestId(payload: unknown): string {
  const root = asObject(payload) ?? {};
  return (
    asText(root.reportRequestId) ||
    asText(root.requestId) ||
    asText(root.request_id) ||
    asText(root.id) ||
    asText(asObject(root.reportRequest)?.reportRequestId) ||
    asText(asObject(root.report)?.reportRequestId) ||
    ""
  );
}

function extractStatusPayload(payload: unknown): {
  statusRaw: string;
  downloadUrl: string | null;
  reportVersion: string | null;
  generatedAt: string | null;
} {
  const root = asObject(payload) ?? {};
  const report = asObject(root.report) ?? asObject(root.reportRequest) ?? asObject(root.data) ?? {};

  const statusRaw =
    asText(root.reportStatus) ||
    asText(root.requestStatus) ||
    asText(root.status) ||
    asText(root.processingStatus) ||
    asText(report.reportStatus) ||
    asText(report.requestStatus) ||
    asText(report.status) ||
    asText(report.processingStatus);

  const downloadUrl =
    asText(root.downloadUrl) ||
    asText(root.downloadURL) ||
    asText(root.url) ||
    asText(report.downloadUrl) ||
    asText(report.downloadURL) ||
    asText(asObject(root.links)?.download) ||
    asText(asObject(root.links)?.downloadUrl) ||
    null;

  const reportVersion =
    asText(root.reportVersion) ||
    asText(report.reportVersion) ||
    asText(root.version) ||
    asText(report.version) ||
    null;

  const generatedAt =
    asText(root.generatedAt) ||
    asText(root.createdTime) ||
    asText(root.createdAt) ||
    asText(report.generatedAt) ||
    asText(report.createdTime) ||
    asText(report.createdAt) ||
    null;

  return {
    statusRaw,
    downloadUrl,
    reportVersion,
    generatedAt,
  };
}

function createHeaders(accessToken: string): HeadersInit {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
    "WM_SEC.ACCESS_TOKEN": accessToken,
    "WM_QOS.CORRELATION_ID": crypto.randomUUID(),
    "WM_SVC.NAME": "Walmart Marketplace",
  };

  const consumerChannelType = process.env.WALMART_CONSUMER_CHANNEL_TYPE?.trim();
  const partnerId = process.env.WALMART_PARTNER_ID?.trim();
  if (consumerChannelType) headers["WM_CONSUMER.CHANNEL.TYPE"] = consumerChannelType;
  if (partnerId) headers["WM_PARTNER.ID"] = partnerId;

  return headers;
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
      cache: "no-store",
    });
  } finally {
    clearTimeout(timeout);
  }
}

function isCooldownResponse(statusCode: number, payload: unknown): boolean {
  if (statusCode === 429) return true;
  const message = [
    asText(asObject(payload)?.message),
    asText(asObject(payload)?.description),
    asText(asObject(asObject(payload)?.error)?.message),
  ]
    .join(" ")
    .toLowerCase();
  return message.includes("one report") && message.includes("hour");
}

async function resolveLiveToken(userId: string): Promise<{ ok: boolean; token: string | null; diagnostic?: string }> {
  const token = await requestWalmartTokenForUser(userId, { forceRefresh: true });
  if (!token.ok || !token.accessToken) {
    return {
      ok: false,
      token: null,
      diagnostic: token.lastError?.message || "Walmart credentials are not configured.",
    };
  }
  return { ok: true, token: token.accessToken };
}

async function requestReportViaEndpoint(input: {
  accessToken: string;
  family: ReportEndpointFamily;
}): Promise<{
  response: Response;
  payload: unknown;
  requestId: string;
}> {
  const path =
    input.family === "reportRequests"
      ? "/v3/reports/reportRequests"
      : "/v3/reports/requests";
  const endpoint = new URL(path, `${WALMART_PRODUCTION_BASE_URL}/`).toString();
  const response = await fetchWithTimeout(endpoint, {
    method: "POST",
    headers: createHeaders(input.accessToken),
    body: JSON.stringify({ reportType: "ITEM", format: "CSV" }),
  });
  const text = await response.text();
  const payload = text ? (JSON.parse(text) as unknown) : {};
  const requestId = extractRequestId(payload);
  return { response, payload, requestId };
}

async function getStatusViaEndpoint(input: {
  accessToken: string;
  family: ReportEndpointFamily;
  requestId: string;
}): Promise<{ response: Response; payload: unknown }> {
  const path =
    input.family === "reportRequests"
      ? `/v3/reports/reportRequests/${encodeURIComponent(input.requestId)}`
      : `/v3/reports/requests/${encodeURIComponent(input.requestId)}`;
  const endpoint = new URL(path, `${WALMART_PRODUCTION_BASE_URL}/`).toString();
  const response = await fetchWithTimeout(endpoint, {
    method: "GET",
    headers: createHeaders(input.accessToken),
  });
  const text = await response.text();
  return {
    response,
    payload: text ? (JSON.parse(text) as unknown) : {},
  };
}

function unavailableRequestResult(message: string): WalmartItemReportBackfillRequestResult {
  return {
    ok: false,
    status: "request_blocked_no_credentials",
    requestId: null,
    reportType: "ITEM",
    reportVersion: null,
    requestedAt: null,
    cooldownUntil: null,
    source: "unavailable",
    credentialMode: "unavailable",
    diagnostics: [
      {
        code: "credentials_unavailable",
        message,
        source: "walmart_item_report",
        level: "warning",
      },
    ],
  };
}

export function createLiveWalmartItemReportProvider(input: { userId: string }): WalmartItemReportProvider {
  return {
    providerName: "walmart_live_item_report",
    source: "live",
    credentialMode: "byo_live",
    async createItemReportRequest(): Promise<WalmartItemReportBackfillRequestResult> {
      const token = await resolveLiveToken(input.userId);
      if (!token.ok || !token.token) {
        return unavailableRequestResult(token.diagnostic || "Walmart credentials are not configured.");
      }

      const diagnostics: WalmartItemReportBackfillDiagnostic[] = [];

      const primary = await requestReportViaEndpoint({
        accessToken: token.token,
        family: "reportRequests",
      }).catch(() => null);

      if (primary) {
        diagnostics.push({
          code: "request_report_requests",
          message: `HTTP ${primary.response.status}`,
          source: "walmart_item_report",
          level: primary.response.ok ? "info" : "warning",
        });
        if (primary.response.ok && primary.requestId) {
          const now = new Date().toISOString();
          return {
            ok: true,
            status: "requested",
            requestId: primary.requestId,
            reportType: "ITEM",
            reportVersion: null,
            requestedAt: now,
            cooldownUntil: new Date(Date.parse(now) + 60 * 60 * 1000).toISOString(),
            source: "live",
            credentialMode: "byo_live",
            diagnostics,
          };
        }
        if (isCooldownResponse(primary.response.status, primary.payload)) {
          const now = new Date().toISOString();
          const cooldownUntil = new Date(Date.now() + 60 * 60 * 1000).toISOString();
          return {
            ok: false,
            status: "request_blocked_cooldown",
            requestId: null,
            reportType: "ITEM",
            reportVersion: null,
            requestedAt: now,
            cooldownUntil,
            source: "live",
            credentialMode: "byo_live",
            diagnostics: [
              ...diagnostics,
              {
                code: "request_cooldown",
                message: "Walmart report request cooldown is active.",
                source: "walmart_item_report",
                level: "warning",
              },
            ],
          };
        }
      }

      const shouldFallback = !primary || primary.response.status === 404;
      if (shouldFallback) {
        const fallback = await requestReportViaEndpoint({
          accessToken: token.token,
          family: "requests",
        }).catch(() => null);

        if (fallback) {
          diagnostics.push({
            code: "request_requests",
            message: `HTTP ${fallback.response.status}`,
            source: "walmart_item_report",
            level: fallback.response.ok ? "info" : "warning",
          });

          if (fallback.response.ok && fallback.requestId) {
            const now = new Date().toISOString();
            return {
              ok: true,
              status: "requested",
              requestId: fallback.requestId,
              reportType: "ITEM",
              reportVersion: null,
              requestedAt: now,
              cooldownUntil: new Date(Date.parse(now) + 60 * 60 * 1000).toISOString(),
              source: "live",
              credentialMode: "byo_live",
              diagnostics,
            };
          }

          if (isCooldownResponse(fallback.response.status, fallback.payload)) {
            const now = new Date().toISOString();
            const cooldownUntil = new Date(Date.now() + 60 * 60 * 1000).toISOString();
            return {
              ok: false,
              status: "request_blocked_cooldown",
              requestId: null,
              reportType: "ITEM",
              reportVersion: null,
              requestedAt: now,
              cooldownUntil,
              source: "live",
              credentialMode: "byo_live",
              diagnostics,
            };
          }
        }
      }

      return {
        ok: false,
        status: "request_failed",
        requestId: null,
        reportType: "ITEM",
        reportVersion: null,
        requestedAt: null,
        cooldownUntil: null,
        source: "live",
        credentialMode: "byo_live",
        diagnostics: diagnostics.length
          ? diagnostics
          : [
              {
                code: "request_failed",
                message: "Walmart item report request failed.",
                source: "walmart_item_report",
                level: "error",
              },
            ],
      };
    },

    async getReportRequestStatus(requestId: string): Promise<WalmartItemReportBackfillPollResult> {
      const token = await resolveLiveToken(input.userId);
      const now = new Date().toISOString();
      if (!token.ok || !token.token) {
        return {
          ok: false,
          status: "request_blocked_no_credentials",
          requestId,
          reportType: "ITEM",
          reportVersion: null,
          walmartStatus: null,
          ready: false,
          downloadUrl: null,
          lastCheckedAt: now,
          readyAt: null,
          expiresAt: null,
          source: "unavailable",
          credentialMode: "unavailable",
          diagnostics: [
            {
              code: "credentials_unavailable",
              message: token.diagnostic || "Walmart credentials are not configured.",
              source: "walmart_item_report",
              level: "warning",
            },
          ],
        };
      }

      const diagnostics: WalmartItemReportBackfillDiagnostic[] = [];
      const primary = await getStatusViaEndpoint({
        accessToken: token.token,
        family: "reportRequests",
        requestId,
      }).catch(() => null);

      let chosen = primary;
      if (!chosen || chosen.response.status === 404) {
        const fallback = await getStatusViaEndpoint({
          accessToken: token.token,
          family: "requests",
          requestId,
        }).catch(() => null);
        chosen = fallback ?? chosen;
      }

      if (!chosen) {
        return {
          ok: false,
          status: "request_failed",
          requestId,
          reportType: "ITEM",
          reportVersion: null,
          walmartStatus: null,
          ready: false,
          downloadUrl: null,
          lastCheckedAt: now,
          readyAt: null,
          expiresAt: null,
          source: "live",
          credentialMode: "byo_live",
          diagnostics: [
            {
              code: "status_request_failed",
              message: "Failed to read item report request status.",
              source: "walmart_item_report",
              level: "error",
            },
          ],
        };
      }

      diagnostics.push({
        code: "status_request",
        message: `HTTP ${chosen.response.status}`,
        source: "walmart_item_report",
        level: chosen.response.ok ? "info" : "warning",
      });

      if (!chosen.response.ok) {
        return {
          ok: false,
          status: chosen.response.status === 404 ? "unavailable" : "request_failed",
          requestId,
          reportType: "ITEM",
          reportVersion: null,
          walmartStatus: null,
          ready: false,
          downloadUrl: null,
          lastCheckedAt: now,
          readyAt: null,
          expiresAt: null,
          source: "live",
          credentialMode: "byo_live",
          diagnostics,
        };
      }

      const extracted = extractStatusPayload(chosen.payload);
      const mappedStatus = normalizeReportStatus(extracted.statusRaw || "");
      const ready = mappedStatus === "ready";
      const readyAt = ready ? extracted.generatedAt || now : null;

      return {
        ok: mappedStatus !== "request_failed",
        status: mappedStatus,
        requestId,
        reportType: "ITEM",
        reportVersion: extracted.reportVersion,
        walmartStatus: extracted.statusRaw || null,
        ready,
        downloadUrl: extracted.downloadUrl,
        lastCheckedAt: now,
        readyAt,
        expiresAt: readyAt ? addDaysIso(readyAt, RETAINED_DAYS) : null,
        source: "live",
        credentialMode: "byo_live",
        diagnostics,
      };
    },

    async getReportDownloadUrl(requestId: string) {
      const status = await this.getReportRequestStatus(requestId);
      return {
        ok: status.ok,
        status: status.status,
        downloadUrl: status.downloadUrl,
        diagnostics: [...status.diagnostics],
      };
    },

    async downloadReport(inputDownload): Promise<WalmartItemReportDownloadResult> {
      const token = await resolveLiveToken(input.userId);
      if (!token.ok || !token.token) {
        return {
          ok: false,
          status: "request_blocked_no_credentials",
          requestId: inputDownload.requestId,
          content: "",
          contentType: null,
          downloadedAt: null,
          source: "unavailable",
          credentialMode: "unavailable",
          diagnostics: [
            {
              code: "credentials_unavailable",
              message: token.diagnostic || "Walmart credentials are not configured.",
              source: "walmart_item_report",
              level: "warning",
            },
          ],
        };
      }

      const diagnostics: WalmartItemReportBackfillDiagnostic[] = [];
      const candidates: string[] = [];
      if (inputDownload.downloadUrl) {
        candidates.push(inputDownload.downloadUrl);
      }
      candidates.push(
        new URL(
          `/v3/reports/downloadReport?requestId=${encodeURIComponent(inputDownload.requestId)}`,
          `${WALMART_PRODUCTION_BASE_URL}/`
        ).toString()
      );

      for (const candidate of candidates) {
        try {
          const sameHost = candidate.startsWith(WALMART_PRODUCTION_BASE_URL);
          const response = await fetchWithTimeout(candidate, {
            method: "GET",
            headers: sameHost ? createHeaders(token.token) : { Accept: "*/*" },
            redirect: "follow",
          });

          diagnostics.push({
            code: "download_attempt",
            message: `${candidate} -> HTTP ${response.status}`,
            source: "walmart_item_report",
            level: response.ok ? "info" : "warning",
          });

          if (!response.ok) {
            continue;
          }

          const contentType = response.headers.get("content-type");
          const buffer = Buffer.from(await response.arrayBuffer());

          const maybeJson = contentType?.toLowerCase().includes("application/json") ?? false;
          if (maybeJson) {
            const payload = JSON.parse(buffer.toString("utf8")) as unknown;
            const nestedUrl =
              asText(asObject(payload)?.downloadUrl) ||
              asText(asObject(payload)?.downloadURL) ||
              asText(asObject(payload)?.url) ||
              asText(asObject(asObject(payload)?.report)?.downloadUrl) ||
              asText(asObject(asObject(payload)?.report)?.url);
            if (nestedUrl) {
              candidates.push(nestedUrl);
            }
            continue;
          }

          const decoded = walmartItemReportInternals.decodeReportBuffer(buffer, contentType);
          return {
            ok: true,
            status: "downloaded",
            requestId: inputDownload.requestId,
            content: decoded,
            contentType,
            downloadedAt: new Date().toISOString(),
            source: "live",
            credentialMode: "byo_live",
            diagnostics,
          };
        } catch {
          diagnostics.push({
            code: "download_exception",
            message: `Download failed for ${candidate}.`,
            source: "walmart_item_report",
            level: "warning",
          });
        }
      }

      return {
        ok: false,
        status: "download_failed",
        requestId: inputDownload.requestId,
        content: "",
        contentType: null,
        downloadedAt: null,
        source: "live",
        credentialMode: "byo_live",
        diagnostics,
      };
    },

    async parseItemReport(content: string): Promise<WalmartItemReportRow[]> {
      return parseItemReportCsv(content);
    },

    async applyItemReportRows(inputApply): Promise<WalmartItemReportApplyResult> {
      return {
        status: inputApply.rows.length > 0 ? "applied" : "no_matching_rows",
        rowCount: inputApply.rows.length,
        appliedSkuCount: inputApply.requestedSku ? Number(inputApply.rows.some((row) => row.sku === inputApply.requestedSku)) : 0,
        warningCount: 0,
        errorCount: 0,
        source: "live",
        credentialMode: "byo_live",
        diagnostics: [
          {
            code: "provider_apply_passthrough",
            message: "Provider parsed rows successfully; domain merge is responsible for docket updates.",
            source: "backfill",
            level: "info",
          },
        ],
      };
    },
  };
}

export function createFixtureWalmartItemReportProvider(input: {
  requestResult?: Partial<WalmartItemReportBackfillRequestResult>;
  statusSequence?: Array<Partial<WalmartItemReportBackfillPollResult>>;
  downloadResult?: Partial<WalmartItemReportDownloadResult>;
  rows?: WalmartItemReportRow[];
}): WalmartItemReportProvider {
  let statusIndex = 0;

  return {
    providerName: "fixture_item_report",
    source: "fixture",
    credentialMode: "mock",
    async createItemReportRequest() {
      return {
        ok: true,
        status: "requested",
        requestId: "REQ-FIXTURE",
        reportType: "ITEM",
        reportVersion: null,
        requestedAt: new Date().toISOString(),
        cooldownUntil: null,
        source: "fixture",
        credentialMode: "mock",
        diagnostics: [
          {
            code: "fixture_request",
            message: "Fixture request created.",
            source: "fixture",
            level: "info",
          },
        ],
        ...input.requestResult,
      };
    },
    async getReportRequestStatus(requestId: string) {
      const fromSequence = input.statusSequence?.[statusIndex] ?? null;
      statusIndex += 1;
      return {
        ok: true,
        status: "ready",
        requestId,
        reportType: "ITEM",
        reportVersion: "fixture",
        walmartStatus: "READY",
        ready: true,
        downloadUrl: "fixture://download",
        lastCheckedAt: new Date().toISOString(),
        readyAt: new Date().toISOString(),
        expiresAt: addDaysIso(new Date().toISOString(), RETAINED_DAYS),
        source: "fixture",
        credentialMode: "mock",
        diagnostics: [
          {
            code: "fixture_status",
            message: "Fixture status checked.",
            source: "fixture",
            level: "info",
          },
        ],
        ...fromSequence,
      };
    },
    async getReportDownloadUrl(requestId: string) {
      const status = await this.getReportRequestStatus(requestId);
      return {
        ok: status.ok,
        status: status.status,
        downloadUrl: status.downloadUrl,
        diagnostics: status.diagnostics,
      };
    },
    async downloadReport(inputDownload) {
      const defaultContent = "SKU,ProductName\nROC948,Fixture Product";
      return {
        ok: true,
        status: "downloaded",
        requestId: inputDownload.requestId,
        content: defaultContent,
        contentType: "text/csv",
        downloadedAt: new Date().toISOString(),
        source: "fixture",
        credentialMode: "mock",
        diagnostics: [
          {
            code: "fixture_download",
            message: "Fixture report downloaded.",
            source: "fixture",
            level: "info",
          },
        ],
        ...input.downloadResult,
      };
    },
    async parseItemReport(content: string) {
      if (input.rows) return input.rows;
      return parseItemReportCsv(content);
    },
    async applyItemReportRows(inputApply) {
      return {
        status: inputApply.rows.length > 0 ? "applied" : "no_matching_rows",
        rowCount: inputApply.rows.length,
        appliedSkuCount: inputApply.requestedSku
          ? Number(inputApply.rows.some((row) => row.sku === inputApply.requestedSku))
          : inputApply.rows.length,
        warningCount: 0,
        errorCount: 0,
        source: "fixture",
        credentialMode: "mock",
        diagnostics: [
          {
            code: "fixture_apply",
            message: "Fixture rows ready for apply.",
            source: "fixture",
            level: "info",
          },
        ],
      };
    },
  };
}

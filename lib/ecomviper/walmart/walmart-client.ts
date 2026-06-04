import "server-only";

import crypto from "crypto";
import type { WalmartApiError, WalmartSafeReadStatus } from "@/lib/ecomviper/walmart/walmart-types";

export const WALMART_PRODUCTION_BASE_URL = "https://marketplace.walmartapis.com";

interface SafeReadCheckOptions {
  accessToken: string;
}

export interface WalmartSafeReadResult {
  ok: boolean;
  safeReadStatus: WalmartSafeReadStatus;
  httpStatus: number | null;
  correlationId: string;
  lastSuccessfulRead: string | null;
  lastError: WalmartApiError | null;
  note: string;
}

function optionalHeader(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function safeMessageByStatus(status: number): string {
  if (status === 401) {
    return "Production safe read failed: HTTP 401 unauthorized. The access token is invalid or expired.";
  }
  if (status === 403) {
    return "Production safe read failed: HTTP 403 forbidden. Check app roles/scopes.";
  }
  if (status === 404) {
    return "Production token succeeded. Safe read check is not configured yet, so EcomViper cannot confirm catalog access.";
  }
  return `Production safe read failed: HTTP ${status}.`;
}

export async function runWalmartSafeReadCheck(options: SafeReadCheckOptions): Promise<WalmartSafeReadResult> {
  const correlationId = crypto.randomUUID();

  // Conservative safe read: list feeds endpoint. If unavailable in a tenant, we mark as not configured.
  const safeReadUrl = `${WALMART_PRODUCTION_BASE_URL}/v3/feeds?limit=1`;

  const headers: Record<string, string> = {
    Accept: "application/json",
    "WM_SEC.ACCESS_TOKEN": options.accessToken,
    "WM_QOS.CORRELATION_ID": correlationId,
    "WM_SVC.NAME": "Walmart Marketplace",
  };

  const consumerChannelType = optionalHeader(process.env.WALMART_CONSUMER_CHANNEL_TYPE);
  const partnerId = optionalHeader(process.env.WALMART_PARTNER_ID);

  if (consumerChannelType) {
    headers["WM_CONSUMER.CHANNEL.TYPE"] = consumerChannelType;
  }
  if (partnerId) {
    headers["WM_PARTNER.ID"] = partnerId;
  }

  try {
    const response = await fetch(safeReadUrl, {
      method: "GET",
      headers,
      cache: "no-store",
    });

    if (response.ok) {
      return {
        ok: true,
        safeReadStatus: "valid",
        httpStatus: response.status,
        correlationId,
        lastSuccessfulRead: new Date().toISOString(),
        lastError: null,
        note: "Connected. Production OAuth token and safe read check succeeded.",
      };
    }

    if (response.status === 404 || response.status === 405 || response.status === 501) {
      return {
        ok: false,
        safeReadStatus: "not_configured",
        httpStatus: response.status,
        correlationId,
        lastSuccessfulRead: null,
        lastError: {
          code: `WALMART_SAFE_READ_HTTP_${response.status}`,
          message: "Production read not configured",
        },
        note: "Production token succeeded. Safe read check is not configured yet, so EcomViper cannot confirm catalog access.",
      };
    }

    return {
      ok: false,
      safeReadStatus: "invalid",
      httpStatus: response.status,
      correlationId,
      lastSuccessfulRead: null,
      lastError: {
        code: `WALMART_SAFE_READ_HTTP_${response.status}`,
        message: safeMessageByStatus(response.status),
      },
      note: safeMessageByStatus(response.status),
    };
  } catch {
    return {
      ok: false,
      safeReadStatus: "unknown",
      httpStatus: null,
      correlationId,
      lastSuccessfulRead: null,
      lastError: {
        code: "WALMART_SAFE_READ_NETWORK_ERROR",
        message: "Production safe read failed: network error.",
      },
      note: "Production safe read failed: network error.",
    };
  }
}

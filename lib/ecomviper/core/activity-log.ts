import "server-only";

import crypto from "crypto";
import type { ActivityLogEntry, MarketplaceId } from "@/lib/ecomviper/core/marketplace-types";

const SECRET_KEY_PATTERN = /(secret|token|password|authorization|api[-_]?key|client[-_]?secret|wm_sec\.access_token)/i;

export interface ActivityLogInput {
  marketplace: MarketplaceId;
  actionType: string;
  result: ActivityLogEntry["result"];
  message: string;
  sku?: string | null;
  actor?: string | null;
  beforePayload?: unknown;
  afterPayload?: unknown;
}

type ActivityStore = {
  entries: ActivityLogEntry[];
};

declare global {
  var __ecomviper_activity_store__: ActivityStore | undefined;
}

function getStore(): ActivityStore {
  if (!globalThis.__ecomviper_activity_store__) {
    globalThis.__ecomviper_activity_store__ = {
      entries: [],
    };
  }
  return globalThis.__ecomviper_activity_store__;
}

function redactObject(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => redactObject(entry));
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  const record = value as Record<string, unknown>;
  return Object.fromEntries(
    Object.entries(record).map(([key, current]) => {
      if (SECRET_KEY_PATTERN.test(key)) {
        return [key, "[REDACTED]"];
      }
      return [key, redactObject(current)];
    })
  );
}

export function redactSensitivePayload<T>(value: T): T {
  return redactObject(value) as T;
}

export function appendActivityLog(input: ActivityLogInput): ActivityLogEntry {
  const store = getStore();
  const entry: ActivityLogEntry = {
    id: `ev_act_${crypto.randomUUID()}`,
    marketplace: input.marketplace,
    actionType: input.actionType,
    result: input.result,
    message: input.message,
    sku: input.sku ?? null,
    actor: input.actor ?? "system",
    createdAt: new Date().toISOString(),
    beforePayload: input.beforePayload ? redactObject(input.beforePayload) : undefined,
    afterPayload: input.afterPayload ? redactObject(input.afterPayload) : undefined,
  };

  store.entries.unshift(entry);
  if (store.entries.length > 300) {
    store.entries.length = 300;
  }
  return entry;
}

export function listActivityLogs(params?: { marketplace?: MarketplaceId; limit?: number }): ActivityLogEntry[] {
  const store = getStore();
  const limit = params?.limit ?? 50;
  const rows = params?.marketplace
    ? store.entries.filter((entry) => entry.marketplace === params.marketplace)
    : store.entries;
  return rows.slice(0, limit);
}

export function clearActivityLogs(): void {
  const store = getStore();
  store.entries = [];
}

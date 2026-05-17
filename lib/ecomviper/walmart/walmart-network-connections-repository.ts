import "server-only";

import crypto from "crypto";
import {
  normalizeConnectionUrl,
  sanitizeList,
  type WalmartNetworkConnection,
  type WalmartNetworkConnectionInput,
  type WalmartNetworkDefaultPublishingStatus,
  type WalmartNetworkPublishingMode,
} from "@/lib/ecomviper/walmart/walmart-network-connections";

type UserConnectionsStore = Map<string, WalmartNetworkConnection>;

declare global {
  var __ecomviper_walmart_network_connections_fallback__:
    | Map<string, UserConnectionsStore>
    | undefined;
}

function getStore(): Map<string, UserConnectionsStore> {
  if (!globalThis.__ecomviper_walmart_network_connections_fallback__) {
    globalThis.__ecomviper_walmart_network_connections_fallback__ = new Map<string, UserConnectionsStore>();
  }
  return globalThis.__ecomviper_walmart_network_connections_fallback__;
}

function getUserStore(userId: string): UserConnectionsStore {
  const store = getStore();
  const existing = store.get(userId);
  if (existing) return existing;
  const created = new Map<string, WalmartNetworkConnection>();
  store.set(userId, created);
  return created;
}

function resolvePublishingMode(value: unknown): WalmartNetworkPublishingMode {
  if (value === "manual_copy" || value === "approval_required" || value === "draft_only") {
    return value;
  }
  return "draft_only";
}

function resolveDefaultPublishingStatus(value: unknown): WalmartNetworkDefaultPublishingStatus {
  if (value === "pending_review") return "pending_review";
  return "draft";
}

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeInput(input: WalmartNetworkConnectionInput): {
  name: string;
  platform: WalmartNetworkConnection["platform"];
  url?: string;
  status: WalmartNetworkConnection["status"];
  credentialLabel?: string;
  credentialStored: boolean;
  defaultPublishingStatus: WalmartNetworkDefaultPublishingStatus;
  defaultCategory?: string;
  defaultAuthor?: string;
  publishingMode: WalmartNetworkPublishingMode;
  guardrails: WalmartNetworkConnection["guardrails"];
  notes?: string;
} {
  const platform =
    input.platform === "walmart" || input.platform === "wordpress" || input.platform === "other"
      ? input.platform
      : "other";

  const status =
    input.status === "connected" || input.status === "needs_attention" || input.status === "not_connected"
      ? input.status
      : "connected";

  const guardrails = input.guardrails
    ? {
        primaryNiche: asText(input.guardrails.primaryNiche),
        secondaryNiches: sanitizeList(input.guardrails.secondaryNiches),
        allowedTopics: sanitizeList(input.guardrails.allowedTopics),
        blockedTopics: sanitizeList(input.guardrails.blockedTopics),
        preferredContentTypes: sanitizeList(input.guardrails.preferredContentTypes),
        audience: asText(input.guardrails.audience),
        notesForIBrains: asText(input.guardrails.notesForIBrains) || undefined,
      }
    : undefined;

  return {
    name: asText(input.name),
    platform,
    url: normalizeConnectionUrl(input.url),
    status,
    credentialLabel: asText(input.credentialLabel) || undefined,
    credentialStored: Boolean(asText(input.applicationPassword)),
    defaultPublishingStatus: resolveDefaultPublishingStatus(input.defaultPublishingStatus),
    defaultCategory: asText(input.defaultCategory) || undefined,
    defaultAuthor: asText(input.defaultAuthor) || undefined,
    publishingMode: resolvePublishingMode(input.publishingMode),
    guardrails,
    notes: asText(input.notes) || undefined,
  };
}

export async function listWalmartNetworkConnectionsForUser(userId: string): Promise<WalmartNetworkConnection[]> {
  const store = getUserStore(userId);
  return Array.from(store.values()).sort((left, right) => left.name.localeCompare(right.name));
}

export async function createWalmartNetworkConnectionForUser(input: {
  userId: string;
  connection: WalmartNetworkConnectionInput;
}): Promise<WalmartNetworkConnection> {
  const store = getUserStore(input.userId);
  const normalized = normalizeInput(input.connection);
  if (!normalized.name) {
    throw new Error("Connection name is required.");
  }

  const now = new Date().toISOString();
  const record: WalmartNetworkConnection = {
    id: `wm_network_${crypto.randomUUID()}`,
    name: normalized.name,
    platform: normalized.platform,
    url: normalized.url,
    status: normalized.status,
    credentialLabel: normalized.credentialLabel,
    credentialStored: normalized.credentialStored,
    defaultPublishingStatus: normalized.defaultPublishingStatus,
    defaultCategory: normalized.defaultCategory,
    defaultAuthor: normalized.defaultAuthor,
    publishingMode: normalized.publishingMode,
    guardrails: normalized.guardrails,
    notes: normalized.notes,
    createdAt: now,
    updatedAt: now,
  };

  store.set(record.id, record);
  return record;
}

export async function updateWalmartNetworkConnectionForUser(input: {
  userId: string;
  connectionId: string;
  connection: WalmartNetworkConnectionInput;
}): Promise<WalmartNetworkConnection> {
  const store = getUserStore(input.userId);
  const existing = store.get(input.connectionId);
  if (!existing) {
    throw new Error("Connection was not found.");
  }

  const normalized = normalizeInput(input.connection);
  if (!normalized.name) {
    throw new Error("Connection name is required.");
  }

  const updated: WalmartNetworkConnection = {
    ...existing,
    name: normalized.name,
    platform: normalized.platform,
    url: normalized.url,
    status: normalized.status,
    credentialLabel: normalized.credentialLabel,
    credentialStored: normalized.credentialStored || existing.credentialStored || false,
    defaultPublishingStatus: normalized.defaultPublishingStatus,
    defaultCategory: normalized.defaultCategory,
    defaultAuthor: normalized.defaultAuthor,
    publishingMode: normalized.publishingMode,
    guardrails: normalized.guardrails,
    notes: normalized.notes,
    updatedAt: new Date().toISOString(),
  };

  store.set(updated.id, updated);
  return updated;
}

export async function deleteWalmartNetworkConnectionForUser(input: {
  userId: string;
  connectionId: string;
}): Promise<void> {
  const store = getUserStore(input.userId);
  store.delete(input.connectionId);
}

export async function replaceWalmartNetworkConnectionsForUser(input: {
  userId: string;
  connections: WalmartNetworkConnection[];
}): Promise<void> {
  const store = getUserStore(input.userId);
  store.clear();
  for (const connection of input.connections) {
    store.set(connection.id, {
      ...connection,
      guardrails: connection.guardrails
        ? {
            primaryNiche: connection.guardrails.primaryNiche,
            secondaryNiches: sanitizeList(connection.guardrails.secondaryNiches),
            allowedTopics: sanitizeList(connection.guardrails.allowedTopics),
            blockedTopics: sanitizeList(connection.guardrails.blockedTopics),
            preferredContentTypes: sanitizeList(connection.guardrails.preferredContentTypes),
            audience: connection.guardrails.audience,
            notesForIBrains: connection.guardrails.notesForIBrains,
          }
        : undefined,
    });
  }
}

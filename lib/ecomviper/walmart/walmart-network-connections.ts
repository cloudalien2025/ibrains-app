export type WalmartNetworkConnectionPlatform = "walmart" | "wordpress" | "other";

export type WalmartNetworkConnectionStatus = "connected" | "needs_attention" | "not_connected";

export type WalmartNetworkPublishingMode = "draft_only" | "approval_required" | "manual_copy";

export type WalmartNetworkDefaultPublishingStatus = "draft" | "pending_review";

export interface WalmartNetworkPropertyGuardrails {
  primaryNiche: string;
  secondaryNiches: string[];
  allowedTopics: string[];
  blockedTopics: string[];
  preferredContentTypes: string[];
  audience: string;
  notesForIBrains?: string;
}

export interface WalmartNetworkConnection {
  id: string;
  name: string;
  platform: WalmartNetworkConnectionPlatform;
  url?: string;
  status: WalmartNetworkConnectionStatus;
  credentialLabel?: string;
  credentialStored?: boolean;
  defaultPublishingStatus?: WalmartNetworkDefaultPublishingStatus;
  defaultCategory?: string;
  defaultAuthor?: string;
  publishingMode: WalmartNetworkPublishingMode;
  guardrails?: WalmartNetworkPropertyGuardrails;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WalmartNetworkConnectionInput {
  name: string;
  platform: WalmartNetworkConnectionPlatform;
  url?: string;
  status?: WalmartNetworkConnectionStatus;
  credentialLabel?: string;
  applicationPassword?: string;
  defaultPublishingStatus?: WalmartNetworkDefaultPublishingStatus;
  defaultCategory?: string;
  defaultAuthor?: string;
  publishingMode?: WalmartNetworkPublishingMode;
  guardrails?: Partial<WalmartNetworkPropertyGuardrails>;
  notes?: string;
}

export function sanitizeList(values: string[] | undefined): string[] {
  if (!Array.isArray(values)) return [];
  const dedupe = new Set<string>();
  for (const value of values) {
    const normalized = typeof value === "string" ? value.trim() : "";
    if (!normalized) continue;
    dedupe.add(normalized);
  }
  return Array.from(dedupe);
}

export function normalizeConnectionUrl(value: string | undefined): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(withProtocol);
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return undefined;
  }
}

export function hostFromUrl(value: string | undefined): string {
  if (!value) return "";
  try {
    return new URL(value).hostname.replace(/^www\./i, "");
  } catch {
    return value;
  }
}

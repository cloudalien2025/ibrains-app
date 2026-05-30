import "server-only";

import crypto from "crypto";
import { encryptSecret } from "@/app/api/ecomviper/_utils/crypto";
import { query } from "@/app/api/ecomviper/_utils/db";
import { isUndefinedRelationError } from "@/app/api/directoryiq/_utils/sqlErrors";

const CONNECTOR_ID = "ecomviper_supplier_membership";
const CREDENTIAL_SCOPE = "ecomviper:settings:supplier_membership";

interface CredentialRow {
  config_json: unknown;
}

interface MembershipConfig {
  scope: string;
  membershipTier: string | null;
}

declare global {
  var __ecomviper_supplier_membership_fallback__: Map<string, string | null> | undefined;
}

function dbConfigured(): boolean {
  return Boolean(process.env.DIRECTORYIQ_DATABASE_URL?.trim() || process.env.DATABASE_URL?.trim());
}

function allowFallbackStore(): boolean {
  return process.env.NODE_ENV === "test";
}

function relationMissingOrUnavailable(error: unknown): boolean {
  if (isUndefinedRelationError(error, "directoryiq_signal_source_credentials")) return true;
  return error instanceof Error && error.message.toLowerCase().includes("missing required env var");
}

function normalizeCredentialUserId(userId: string): string {
  const trimmed = userId.trim();
  if (!trimmed) return "00000000-0000-4000-8000-000000000000";

  const normalized = trimmed.toLowerCase();
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
  if (uuidPattern.test(normalized)) return normalized;

  const hash = crypto.createHash("sha256").update(normalized).digest();
  const bytes = Buffer.from(hash.subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeTier(value: string | null | undefined): string | null {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed ? trimmed : null;
}

function parseConfig(value: unknown): MembershipConfig {
  const record = asRecord(value);
  return {
    scope: asString(record?.scope) || "ecomviper_settings",
    membershipTier: normalizeTier(asString(record?.membershipTier) || null),
  };
}

function buildConfigJson(config: MembershipConfig): string {
  return JSON.stringify({
    scope: config.scope,
    membershipTier: config.membershipTier,
  });
}

function getFallbackStore(): Map<string, string | null> {
  if (!globalThis.__ecomviper_supplier_membership_fallback__) {
    globalThis.__ecomviper_supplier_membership_fallback__ = new Map<string, string | null>();
  }
  return globalThis.__ecomviper_supplier_membership_fallback__;
}

function availabilityError(): Error {
  return new Error(
    "Supplier membership settings persistence is not available. Ensure DATABASE_URL (or DIRECTORYIQ_DATABASE_URL) and directoryiq_signal_source_credentials are configured."
  );
}

export async function getSupplierMembershipTierSelectionForUser(userId: string): Promise<string | null> {
  const normalizedUserId = normalizeCredentialUserId(userId);
  if (allowFallbackStore()) {
    return getFallbackStore().get(normalizedUserId) ?? null;
  }

  if (!dbConfigured()) return null;

  try {
    const rows = await query<CredentialRow>(
      `
      SELECT config_json
      FROM directoryiq_signal_source_credentials
      WHERE user_id = $1 AND connector_id = $2
      LIMIT 1
      `,
      [normalizedUserId, CONNECTOR_ID]
    );
    const row = rows[0] ?? null;
    if (!row) return null;
    return parseConfig(row.config_json).membershipTier;
  } catch (error) {
    if (relationMissingOrUnavailable(error)) return null;
    throw error;
  }
}

export async function saveSupplierMembershipTierSelectionForUser(params: {
  userId: string;
  membershipTier: string | null;
}): Promise<string | null> {
  const normalizedUserId = normalizeCredentialUserId(params.userId);
  const membershipTier = normalizeTier(params.membershipTier);

  if (allowFallbackStore()) {
    getFallbackStore().set(normalizedUserId, membershipTier);
    return membershipTier;
  }

  if (!dbConfigured()) {
    throw availabilityError();
  }

  const config: MembershipConfig = {
    scope: "ecomviper_settings",
    membershipTier,
  };

  const ciphertext = encryptSecret(membershipTier || "none", `${normalizedUserId}:${CREDENTIAL_SCOPE}`);
  const last4 = membershipTier ? membershipTier.slice(-4) : null;
  const secretLength = membershipTier?.length ?? 0;

  try {
    await query(
      `
      INSERT INTO directoryiq_signal_source_credentials
      (user_id, connector_id, secret_ciphertext, secret_last4, secret_length, label, config_json, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, now(), now())
      ON CONFLICT (user_id, connector_id)
      DO UPDATE SET
        secret_ciphertext = EXCLUDED.secret_ciphertext,
        secret_last4 = EXCLUDED.secret_last4,
        secret_length = EXCLUDED.secret_length,
        label = EXCLUDED.label,
        config_json = EXCLUDED.config_json,
        updated_at = now()
      `,
      [
        normalizedUserId,
        CONNECTOR_ID,
        ciphertext,
        last4,
        secretLength,
        "EcomViper Supplier Membership Tier",
        buildConfigJson(config),
      ]
    );
    return membershipTier;
  } catch (error) {
    if (relationMissingOrUnavailable(error)) {
      throw availabilityError();
    }
    throw error;
  }
}

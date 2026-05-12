import "server-only";

import crypto from "crypto";
import { decryptSecret, encryptSecret } from "@/app/api/ecomviper/_utils/crypto";
import { query } from "@/app/api/ecomviper/_utils/db";
import { isUndefinedRelationError } from "@/app/api/directoryiq/_utils/sqlErrors";
import { runShopifyGraphqlRequest, detectShopifyMissingScope } from "@/lib/ecomviper/shopify/shopify-client";
import { normalizeShopifyStoreDomain } from "@/lib/ecomviper/shopify/shopify-domain";
import {
  DEFAULT_SHOPIFY_API_VERSION,
  type ShopifyConnectionStatus,
  type ShopifyConnectionTestResult,
} from "@/lib/ecomviper/shopify/shopify-types";

const CONNECTOR_ID = "ecomviper_shopify_admin";
const CREDENTIAL_SCOPE = "ecomviper:shopify:admin";

interface CredentialRow {
  secret_ciphertext: string;
  secret_last4: string | null;
  secret_length: number | null;
  config_json: unknown;
  updated_at: string;
}

interface CredentialConfig {
  storeDomain: string;
  apiVersion: string;
}

interface FallbackCredential {
  secretCiphertext: string;
  secretLast4: string | null;
  secretLength: number;
  config: CredentialConfig;
  updatedAt: string;
}

export interface ShopifyAdminCredentials {
  connected: boolean;
  storeDomain: string;
  apiVersion: string;
  adminApiToken: string;
}

export interface ShopifyConnectionInput {
  storeDomain: string;
  adminApiToken: string;
  apiVersion?: string | null;
}

declare global {
  var __ecomviper_shopify_connection_fallback__: Map<string, FallbackCredential> | undefined;
}

function dbConfigured(): boolean {
  return Boolean(process.env.DIRECTORYIQ_DATABASE_URL?.trim() || process.env.DATABASE_URL?.trim());
}

function allowFallbackStore(): boolean {
  return process.env.NODE_ENV === "test";
}

function relationMissingOrUnavailable(error: unknown): boolean {
  if (isUndefinedRelationError(error, "directoryiq_signal_source_credentials")) {
    return true;
  }
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

function connectorKey(userId: string): string {
  return `${normalizeCredentialUserId(userId)}:${CONNECTOR_ID}`;
}

function getFallbackStore(): Map<string, FallbackCredential> {
  if (!globalThis.__ecomviper_shopify_connection_fallback__) {
    globalThis.__ecomviper_shopify_connection_fallback__ = new Map<string, FallbackCredential>();
  }
  return globalThis.__ecomviper_shopify_connection_fallback__;
}

function maskAccessToken(last4: string | null, length: number | null): string {
  if (!last4 || !length || length <= 0) return "Not configured";
  const hidden = "*".repeat(Math.max(Math.min(length - 4, 16), 6));
  return `${hidden}${last4}`;
}

function disconnectedStatus(saveSupported: boolean): ShopifyConnectionStatus {
  return {
    connected: false,
    status: "disconnected",
    storeDomain: "",
    apiVersion: DEFAULT_SHOPIFY_API_VERSION,
    maskedAccessToken: "Not configured",
    updatedAt: null,
    saveSupported,
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function parseCredentialConfig(value: unknown): CredentialConfig {
  const record = asRecord(value);
  return {
    storeDomain: asString(record?.storeDomain),
    apiVersion: asString(record?.apiVersion) || DEFAULT_SHOPIFY_API_VERSION,
  };
}

function asStatus(row: CredentialRow | null, saveSupported: boolean): ShopifyConnectionStatus {
  if (!row) return disconnectedStatus(saveSupported);
  const config = parseCredentialConfig(row.config_json);
  return {
    connected: true,
    status: "connected",
    storeDomain: config.storeDomain,
    apiVersion: config.apiVersion,
    maskedAccessToken: maskAccessToken(row.secret_last4, row.secret_length),
    updatedAt: row.updated_at,
    saveSupported,
  };
}

function availabilityError(): Error {
  return new Error(
    "Shopify credential persistence is not available. Ensure DATABASE_URL (or DIRECTORYIQ_DATABASE_URL) and directoryiq_signal_source_credentials are configured."
  );
}

function normalizeApiVersion(value: string | null | undefined): string {
  const raw = value?.trim() || DEFAULT_SHOPIFY_API_VERSION;
  return /^[0-9]{4}-[0-9]{2}$/.test(raw) ? raw : DEFAULT_SHOPIFY_API_VERSION;
}

async function readCredential(userId: string): Promise<CredentialRow | null> {
  const credentialUserId = normalizeCredentialUserId(userId);

  if (allowFallbackStore()) {
    const row = getFallbackStore().get(connectorKey(userId));
    if (!row) return null;
    return {
      secret_ciphertext: row.secretCiphertext,
      secret_last4: row.secretLast4,
      secret_length: row.secretLength,
      config_json: row.config,
      updated_at: row.updatedAt,
    };
  }

  if (!dbConfigured()) {
    throw availabilityError();
  }

  try {
    const rows = await query<CredentialRow>(
      `
      SELECT secret_ciphertext, secret_last4, secret_length, config_json, updated_at
      FROM directoryiq_signal_source_credentials
      WHERE user_id = $1 AND connector_id = $2
      LIMIT 1
      `,
      [credentialUserId, CONNECTOR_ID]
    );
    return rows[0] ?? null;
  } catch (error) {
    if (relationMissingOrUnavailable(error)) {
      throw availabilityError();
    }
    throw error;
  }
}

export async function isShopifyStoreAvailable(): Promise<boolean> {
  if (allowFallbackStore()) return true;
  if (!dbConfigured()) return false;

  try {
    const rows = await query<{ exists: string | null }>(
      "SELECT to_regclass('public.directoryiq_signal_source_credentials')::text as exists"
    );
    return Boolean(rows[0]?.exists);
  } catch {
    return false;
  }
}

export async function getShopifyConnectionStatusForUser(userId: string): Promise<ShopifyConnectionStatus> {
  const saveSupported = await isShopifyStoreAvailable();
  if (!saveSupported) {
    return disconnectedStatus(false);
  }

  const row = await readCredential(userId);
  return asStatus(row, true);
}

export async function saveShopifyConnectionForUser(input: {
  userId: string;
  storeDomain: string;
  adminApiToken: string;
  apiVersion?: string | null;
}): Promise<ShopifyConnectionStatus> {
  const credentialUserId = normalizeCredentialUserId(input.userId);
  const normalizedStoreDomain = normalizeShopifyStoreDomain(input.storeDomain);
  if (!normalizedStoreDomain) {
    throw new Error("Shopify store domain must be a valid *.myshopify.com host.");
  }

  const secret = input.adminApiToken.trim();
  if (!secret) {
    throw new Error("Shopify Admin API access token is required.");
  }

  const apiVersion = normalizeApiVersion(input.apiVersion);
  const encrypted = encryptSecret(secret, `${credentialUserId}:${CREDENTIAL_SCOPE}`);
  const last4 = secret.slice(-4) || null;
  const secretLength = secret.length;
  const config: CredentialConfig = {
    storeDomain: normalizedStoreDomain,
    apiVersion,
  };

  if (allowFallbackStore()) {
    getFallbackStore().set(connectorKey(input.userId), {
      secretCiphertext: encrypted,
      secretLast4: last4,
      secretLength,
      config,
      updatedAt: new Date().toISOString(),
    });
    return getShopifyConnectionStatusForUser(input.userId);
  }

  if (!dbConfigured()) {
    throw availabilityError();
  }

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
        credentialUserId,
        CONNECTOR_ID,
        encrypted,
        last4,
        secretLength,
        "EcomViper Shopify Admin",
        JSON.stringify({
          scope: "ecomviper_shopify",
          provider: "shopify_admin_graphql",
          storeDomain: config.storeDomain,
          apiVersion: config.apiVersion,
        }),
      ]
    );

    return getShopifyConnectionStatusForUser(input.userId);
  } catch (error) {
    if (relationMissingOrUnavailable(error)) {
      throw availabilityError();
    }
    throw error;
  }
}

export async function deleteShopifyConnectionForUser(userId: string): Promise<ShopifyConnectionStatus> {
  const credentialUserId = normalizeCredentialUserId(userId);

  if (allowFallbackStore()) {
    getFallbackStore().delete(connectorKey(userId));
    return getShopifyConnectionStatusForUser(userId);
  }

  if (!dbConfigured()) {
    throw availabilityError();
  }

  try {
    await query(
      `
      DELETE FROM directoryiq_signal_source_credentials
      WHERE user_id = $1 AND connector_id = $2
      `,
      [credentialUserId, CONNECTOR_ID]
    );
    return getShopifyConnectionStatusForUser(userId);
  } catch (error) {
    if (relationMissingOrUnavailable(error)) {
      throw availabilityError();
    }
    throw error;
  }
}

export async function getShopifyAdminCredentialsForUser(userId: string): Promise<ShopifyAdminCredentials> {
  const credentialUserId = normalizeCredentialUserId(userId);
  const saveSupported = await isShopifyStoreAvailable();
  if (!saveSupported) {
    return {
      connected: false,
      storeDomain: "",
      apiVersion: DEFAULT_SHOPIFY_API_VERSION,
      adminApiToken: "",
    };
  }

  const row = await readCredential(userId);
  if (!row?.secret_ciphertext) {
    return {
      connected: false,
      storeDomain: "",
      apiVersion: DEFAULT_SHOPIFY_API_VERSION,
      adminApiToken: "",
    };
  }

  const config = parseCredentialConfig(row.config_json);
  if (!config.storeDomain) {
    return {
      connected: false,
      storeDomain: "",
      apiVersion: DEFAULT_SHOPIFY_API_VERSION,
      adminApiToken: "",
    };
  }

  try {
    const adminApiToken = decryptSecret(row.secret_ciphertext, `${credentialUserId}:${CREDENTIAL_SCOPE}`);
    return {
      connected: true,
      storeDomain: config.storeDomain,
      apiVersion: normalizeApiVersion(config.apiVersion),
      adminApiToken,
    };
  } catch {
    throw new Error(
      "Stored Shopify credentials could not be decrypted. Re-save the token after configuring ECOMVIPER_CREDENTIAL_ENCRYPTION_KEY."
    );
  }
}

export async function testShopifyConnectionForUser(input: {
  userId: string;
  storeDomain?: string | null;
  adminApiToken?: string | null;
  apiVersion?: string | null;
}): Promise<ShopifyConnectionTestResult> {
  const stored = await getShopifyAdminCredentialsForUser(input.userId);

  const resolvedStoreDomain = normalizeShopifyStoreDomain(input.storeDomain ?? "") ?? stored.storeDomain;
  const resolvedToken = input.adminApiToken?.trim() || stored.adminApiToken;
  const resolvedApiVersion = normalizeApiVersion(input.apiVersion ?? stored.apiVersion);

  if (!resolvedStoreDomain) {
    throw new Error("Shopify store domain is required.");
  }
  if (!resolvedToken) {
    throw new Error("Shopify Admin API access token is required.");
  }

  const probe = await runShopifyGraphqlRequest<{
    shop?: { id?: string; name?: string } | null;
    products?: { nodes?: Array<{ id?: string; title?: string }> } | null;
  }>({
    storeDomain: resolvedStoreDomain,
    adminApiToken: resolvedToken,
    apiVersion: resolvedApiVersion,
    query: `#graphql
      query ShopifyConnectionProbe {
        shop {
          id
          name
        }
        products(first: 1) {
          nodes {
            id
            title
          }
        }
      }
    `,
  });

  const missingScope = detectShopifyMissingScope(probe.payload.errors);

  if (missingScope) {
    return {
      ok: false,
      connectionStatus: "disconnected",
      requiredScope: "read_products",
      missingScope: true,
      statusCode: probe.statusCode,
      storeDomain: resolvedStoreDomain,
      apiVersion: resolvedApiVersion,
      requestId: probe.requestId,
      message: "Shopify token is missing required scope: read_products.",
      diagnosticEvent: "shopify_connection_missing_scope",
    };
  }

  if (!probe.ok) {
    throw new Error(probe.errorMessage ?? "Shopify connection test failed.");
  }

  return {
    ok: true,
    connectionStatus: "connected",
    requiredScope: "read_products",
    missingScope: false,
    statusCode: probe.statusCode,
    storeDomain: resolvedStoreDomain,
    apiVersion: resolvedApiVersion,
    requestId: probe.requestId,
    message: "Shopify connection verified with read_products scope.",
    diagnosticEvent: "shopify_connection_test_success",
  };
}

import "server-only";

import crypto from "crypto";
import { query } from "@/app/api/ecomviper/_utils/db";
import { isUndefinedRelationError } from "@/app/api/directoryiq/_utils/sqlErrors";
import type { WalmartConnectionStatus, WalmartSafeReadStatus, WalmartTokenStatus } from "@/lib/ecomviper/walmart/walmart-types";

interface MarketplaceConnectionRow {
  id: string;
  user_id: string;
  marketplace: string;
  account_name: string;
  environment: string;
  region: string;
  status: WalmartConnectionStatus;
  client_id: string | null;
  masked_client_id: string;
  encrypted_client_secret: string | null;
  credential_storage_mode: "env" | "memory" | "encrypted-db";
  last_token_status: WalmartTokenStatus;
  last_safe_read_status: WalmartSafeReadStatus;
  last_successful_auth_at: string | null;
  last_successful_read_at: string | null;
  last_error_code: string | null;
  last_error_message: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PersistedWalmartConnection {
  id: string;
  userId: string;
  accountName: string;
  environment: "production";
  region: "US";
  status: WalmartConnectionStatus;
  clientId: string | null;
  maskedClientId: string;
  encryptedClientSecret: string | null;
  credentialStorageMode: "env" | "memory" | "encrypted-db";
  lastTokenStatus: WalmartTokenStatus;
  lastSafeReadStatus: WalmartSafeReadStatus;
  lastSuccessfulAuthAt: string | null;
  lastSuccessfulReadAt: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

interface UpsertWalmartConnectionInput {
  userId: string;
  accountName: string;
  environment: "production";
  region: "US";
  status: WalmartConnectionStatus;
  clientId: string | null;
  maskedClientId: string;
  encryptedClientSecret: string | null;
  credentialStorageMode: "env" | "memory" | "encrypted-db";
  lastTokenStatus: WalmartTokenStatus;
  lastSafeReadStatus: WalmartSafeReadStatus;
  lastSuccessfulAuthAt: string | null;
  lastSuccessfulReadAt: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  notes?: string | null;
}

interface UpdateWalmartConnectionStatusInput {
  userId: string;
  status: WalmartConnectionStatus;
  lastTokenStatus: WalmartTokenStatus;
  lastSafeReadStatus: WalmartSafeReadStatus;
  lastSuccessfulAuthAt: string | null;
  lastSuccessfulReadAt: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
}

declare global {
  var __ecomviper_walmart_connection_fallback__: Map<string, PersistedWalmartConnection> | undefined;
}

const TABLE_NAME = "marketplace_connections";

function dbConfigured(): boolean {
  return Boolean(process.env.DIRECTORYIQ_DATABASE_URL?.trim() || process.env.DATABASE_URL?.trim());
}

function allowFallbackStore(): boolean {
  return process.env.NODE_ENV === "test";
}

function getFallbackStore(): Map<string, PersistedWalmartConnection> {
  if (!globalThis.__ecomviper_walmart_connection_fallback__) {
    globalThis.__ecomviper_walmart_connection_fallback__ = new Map<string, PersistedWalmartConnection>();
  }
  return globalThis.__ecomviper_walmart_connection_fallback__;
}

function mapRow(row: MarketplaceConnectionRow): PersistedWalmartConnection {
  return {
    id: row.id,
    userId: row.user_id,
    accountName: row.account_name,
    environment: "production",
    region: "US",
    status: row.status,
    clientId: row.client_id,
    maskedClientId: row.masked_client_id,
    encryptedClientSecret: row.encrypted_client_secret,
    credentialStorageMode: row.credential_storage_mode,
    lastTokenStatus: row.last_token_status,
    lastSafeReadStatus: row.last_safe_read_status,
    lastSuccessfulAuthAt: row.last_successful_auth_at,
    lastSuccessfulReadAt: row.last_successful_read_at,
    lastErrorCode: row.last_error_code,
    lastErrorMessage: row.last_error_message,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function tableMissingError(): Error {
  return new Error(
    "marketplace_connections table is not available. Apply db/migrations/20260507_ecomviper_marketplace_connections.sql."
  );
}

function databaseUnavailableError(): Error {
  return new Error("Database is not configured. Set DATABASE_URL (or DIRECTORYIQ_DATABASE_URL).");
}

function fallbackKey(userId: string): string {
  return `${userId}:walmart`;
}

function setFallback(input: UpsertWalmartConnectionInput): PersistedWalmartConnection {
  const store = getFallbackStore();
  const existing = store.get(fallbackKey(input.userId));
  const now = new Date().toISOString();

  const record: PersistedWalmartConnection = {
    id: existing?.id ?? `wm_conn_${crypto.randomUUID()}`,
    userId: input.userId,
    accountName: input.accountName,
    environment: "production",
    region: "US",
    status: input.status,
    clientId: input.clientId,
    maskedClientId: input.maskedClientId,
    encryptedClientSecret: input.encryptedClientSecret,
    credentialStorageMode: input.credentialStorageMode,
    lastTokenStatus: input.lastTokenStatus,
    lastSafeReadStatus: input.lastSafeReadStatus,
    lastSuccessfulAuthAt: input.lastSuccessfulAuthAt,
    lastSuccessfulReadAt: input.lastSuccessfulReadAt,
    lastErrorCode: input.lastErrorCode,
    lastErrorMessage: input.lastErrorMessage,
    notes: input.notes ?? null,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  store.set(fallbackKey(input.userId), record);
  return record;
}

function patchFallbackStatus(input: UpdateWalmartConnectionStatusInput): PersistedWalmartConnection | null {
  const store = getFallbackStore();
  const key = fallbackKey(input.userId);
  const existing = store.get(key);
  if (!existing) return null;

  const updated: PersistedWalmartConnection = {
    ...existing,
    status: input.status,
    lastTokenStatus: input.lastTokenStatus,
    lastSafeReadStatus: input.lastSafeReadStatus,
    lastSuccessfulAuthAt: input.lastSuccessfulAuthAt,
    lastSuccessfulReadAt: input.lastSuccessfulReadAt,
    lastErrorCode: input.lastErrorCode,
    lastErrorMessage: input.lastErrorMessage,
    updatedAt: new Date().toISOString(),
  };

  store.set(key, updated);
  return updated;
}

export async function getPersistedWalmartConnection(userId: string): Promise<PersistedWalmartConnection | null> {
  if (allowFallbackStore()) {
    return getFallbackStore().get(fallbackKey(userId)) ?? null;
  }

  if (!dbConfigured()) {
    throw databaseUnavailableError();
  }

  try {
    const rows = await query<MarketplaceConnectionRow>(
      `
      SELECT id, user_id, marketplace, account_name, environment, region, status, client_id,
             masked_client_id, encrypted_client_secret, credential_storage_mode, last_token_status,
             last_safe_read_status, last_successful_auth_at, last_successful_read_at,
             last_error_code, last_error_message, notes, created_at, updated_at
      FROM ${TABLE_NAME}
      WHERE user_id = $1 AND marketplace = 'walmart'
      LIMIT 1
      `,
      [userId]
    );

    const row = rows[0];
    return row ? mapRow(row) : null;
  } catch (error) {
    if (isUndefinedRelationError(error, TABLE_NAME)) {
      if (allowFallbackStore()) {
        return getFallbackStore().get(fallbackKey(userId)) ?? null;
      }
      throw tableMissingError();
    }
    throw error;
  }
}

export async function upsertPersistedWalmartConnection(
  input: UpsertWalmartConnectionInput
): Promise<PersistedWalmartConnection> {
  if (allowFallbackStore()) {
    return setFallback(input);
  }

  if (!dbConfigured()) {
    throw databaseUnavailableError();
  }

  const id = `wm_conn_${crypto.randomUUID()}`;

  try {
    const rows = await query<MarketplaceConnectionRow>(
      `
      INSERT INTO ${TABLE_NAME}
      (id, user_id, marketplace, account_name, environment, region, status, client_id, masked_client_id,
       encrypted_client_secret, credential_storage_mode, last_token_status, last_safe_read_status,
       last_successful_auth_at, last_successful_read_at, last_error_code, last_error_message, notes, created_at, updated_at)
      VALUES ($1, $2, 'walmart', $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
              $13::timestamptz, $14::timestamptz, $15, $16, $17, now(), now())
      ON CONFLICT (user_id, marketplace)
      DO UPDATE SET
        account_name = EXCLUDED.account_name,
        environment = EXCLUDED.environment,
        region = EXCLUDED.region,
        status = EXCLUDED.status,
        client_id = EXCLUDED.client_id,
        masked_client_id = EXCLUDED.masked_client_id,
        encrypted_client_secret = EXCLUDED.encrypted_client_secret,
        credential_storage_mode = EXCLUDED.credential_storage_mode,
        last_token_status = EXCLUDED.last_token_status,
        last_safe_read_status = EXCLUDED.last_safe_read_status,
        last_successful_auth_at = EXCLUDED.last_successful_auth_at,
        last_successful_read_at = EXCLUDED.last_successful_read_at,
        last_error_code = EXCLUDED.last_error_code,
        last_error_message = EXCLUDED.last_error_message,
        notes = EXCLUDED.notes,
        updated_at = now()
      RETURNING id, user_id, marketplace, account_name, environment, region, status, client_id,
                masked_client_id, encrypted_client_secret, credential_storage_mode, last_token_status,
                last_safe_read_status, last_successful_auth_at, last_successful_read_at,
                last_error_code, last_error_message, notes, created_at, updated_at
      `,
      [
        id,
        input.userId,
        input.accountName,
        input.environment,
        input.region,
        input.status,
        input.clientId,
        input.maskedClientId,
        input.encryptedClientSecret,
        input.credentialStorageMode,
        input.lastTokenStatus,
        input.lastSafeReadStatus,
        input.lastSuccessfulAuthAt,
        input.lastSuccessfulReadAt,
        input.lastErrorCode,
        input.lastErrorMessage,
        input.notes ?? null,
      ]
    );

    return mapRow(rows[0]);
  } catch (error) {
    if (isUndefinedRelationError(error, TABLE_NAME)) {
      if (allowFallbackStore()) {
        return setFallback(input);
      }
      throw tableMissingError();
    }
    throw error;
  }
}

export async function updatePersistedWalmartConnectionStatus(
  input: UpdateWalmartConnectionStatusInput
): Promise<PersistedWalmartConnection | null> {
  if (allowFallbackStore()) {
    return patchFallbackStatus(input);
  }

  if (!dbConfigured()) {
    throw databaseUnavailableError();
  }

  try {
    const rows = await query<MarketplaceConnectionRow>(
      `
      UPDATE ${TABLE_NAME}
      SET status = $2,
          last_token_status = $3,
          last_safe_read_status = $4,
          last_successful_auth_at = $5::timestamptz,
          last_successful_read_at = $6::timestamptz,
          last_error_code = $7,
          last_error_message = $8,
          updated_at = now()
      WHERE user_id = $1 AND marketplace = 'walmart'
      RETURNING id, user_id, marketplace, account_name, environment, region, status, client_id,
                masked_client_id, encrypted_client_secret, credential_storage_mode, last_token_status,
                last_safe_read_status, last_successful_auth_at, last_successful_read_at,
                last_error_code, last_error_message, notes, created_at, updated_at
      `,
      [
        input.userId,
        input.status,
        input.lastTokenStatus,
        input.lastSafeReadStatus,
        input.lastSuccessfulAuthAt,
        input.lastSuccessfulReadAt,
        input.lastErrorCode,
        input.lastErrorMessage,
      ]
    );

    return rows[0] ? mapRow(rows[0]) : null;
  } catch (error) {
    if (isUndefinedRelationError(error, TABLE_NAME)) {
      if (allowFallbackStore()) {
        return patchFallbackStatus(input);
      }
      throw tableMissingError();
    }
    throw error;
  }
}

export async function deletePersistedWalmartConnection(userId: string): Promise<void> {
  if (allowFallbackStore()) {
    getFallbackStore().delete(fallbackKey(userId));
    return;
  }

  if (!dbConfigured()) {
    throw databaseUnavailableError();
  }

  try {
    await query(
      `
      DELETE FROM ${TABLE_NAME}
      WHERE user_id = $1 AND marketplace = 'walmart'
      `,
      [userId]
    );
  } catch (error) {
    if (isUndefinedRelationError(error, TABLE_NAME)) {
      if (allowFallbackStore()) {
        getFallbackStore().delete(fallbackKey(userId));
        return;
      }
      throw tableMissingError();
    }
    throw error;
  }
}

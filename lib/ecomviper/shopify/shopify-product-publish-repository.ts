import "server-only";

import { query } from "@/app/api/ecomviper/_utils/db";
import { isUndefinedRelationError } from "@/app/api/directoryiq/_utils/sqlErrors";

export interface ShopifyPublishAttemptRecord {
  id: string;
  userId: string;
  productId: string;
  mode: "dry_run" | "execute";
  idempotencyKey: string | null;
  requestFingerprint: string;
  outcomeStatus: string;
  outcomeCode: string;
  outcomeMessage: string;
  outcomePayload: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

interface ShopifyPublishAttemptRow {
  user_id: string;
  attempt_id: string;
  product_id: string;
  mode: string;
  idempotency_key: string | null;
  request_fingerprint: string;
  outcome_status: string;
  outcome_code: string;
  outcome_message: string;
  outcome_payload: Record<string, unknown>;
  created_at: string | Date;
  updated_at: string | Date;
}

type FallbackStore = Map<string, Map<string, ShopifyPublishAttemptRecord>>;

declare global {
  var __ecomviper_shopify_publish_attempt_fallback__: FallbackStore | undefined;
  var __ecomviper_shopify_publish_attempt_tables_checked__: boolean | undefined;
}

const ATTEMPTS_TABLE = "shopify_publish_attempts";

function dbConfigured(): boolean {
  return Boolean(process.env.DIRECTORYIQ_DATABASE_URL?.trim() || process.env.DATABASE_URL?.trim());
}

function allowFallbackStore(): boolean {
  return process.env.NODE_ENV === "test";
}

function tableMissingError(): Error {
  return new Error(
    "Shopify publish-attempt persistence table is unavailable. Sprint 006 should formalize migration for shopify_publish_attempts."
  );
}

function normalizeUserId(userId: string): string {
  return userId.trim();
}

function normalizeProductId(productId: string): string {
  return productId.trim();
}

function asIso(value: string | Date): string {
  if (value instanceof Date) return value.toISOString();
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return new Date().toISOString();
  return new Date(parsed).toISOString();
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return { ...(value as Record<string, unknown>) };
  }
  return {};
}

function cloneAttempt(input: ShopifyPublishAttemptRecord): ShopifyPublishAttemptRecord {
  return {
    ...input,
    outcomePayload: asObject(input.outcomePayload),
  };
}

function getFallbackStore(): FallbackStore {
  if (!globalThis.__ecomviper_shopify_publish_attempt_fallback__) {
    globalThis.__ecomviper_shopify_publish_attempt_fallback__ = new Map<string, Map<string, ShopifyPublishAttemptRecord>>();
  }
  return globalThis.__ecomviper_shopify_publish_attempt_fallback__;
}

function getFallbackUserStore(userId: string): Map<string, ShopifyPublishAttemptRecord> {
  const normalizedUserId = normalizeUserId(userId);
  const store = getFallbackStore();
  const existing = store.get(normalizedUserId);
  if (existing) return existing;
  const created = new Map<string, ShopifyPublishAttemptRecord>();
  store.set(normalizedUserId, created);
  return created;
}

async function ensureTable(): Promise<void> {
  if (allowFallbackStore()) return;
  if (globalThis.__ecomviper_shopify_publish_attempt_tables_checked__) return;

  await query(
    `
    CREATE TABLE IF NOT EXISTS ${ATTEMPTS_TABLE} (
      user_id TEXT NOT NULL,
      attempt_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      mode TEXT NOT NULL,
      idempotency_key TEXT NULL,
      request_fingerprint TEXT NOT NULL,
      outcome_status TEXT NOT NULL,
      outcome_code TEXT NOT NULL,
      outcome_message TEXT NOT NULL,
      outcome_payload JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL,
      PRIMARY KEY (user_id, attempt_id)
    )
    `
  );

  await query(
    `CREATE INDEX IF NOT EXISTS idx_${ATTEMPTS_TABLE}_user_product_updated
     ON ${ATTEMPTS_TABLE}(user_id, product_id, updated_at DESC)`
  );

  await query(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_${ATTEMPTS_TABLE}_idempotency
     ON ${ATTEMPTS_TABLE}(user_id, product_id, idempotency_key)
     WHERE idempotency_key IS NOT NULL`
  );

  globalThis.__ecomviper_shopify_publish_attempt_tables_checked__ = true;
}

function sanitizeRow(row: ShopifyPublishAttemptRow): ShopifyPublishAttemptRecord {
  return {
    id: asString(row.attempt_id),
    userId: asString(row.user_id),
    productId: asString(row.product_id),
    mode: asString(row.mode) === "execute" ? "execute" : "dry_run",
    idempotencyKey: asString(row.idempotency_key) || null,
    requestFingerprint: asString(row.request_fingerprint),
    outcomeStatus: asString(row.outcome_status),
    outcomeCode: asString(row.outcome_code),
    outcomeMessage: asString(row.outcome_message),
    outcomePayload: asObject(row.outcome_payload),
    createdAt: asIso(row.created_at),
    updatedAt: asIso(row.updated_at),
  };
}

export async function getPersistedShopifyPublishAttemptByIdempotency(input: {
  userId: string;
  productId: string;
  idempotencyKey: string;
}): Promise<ShopifyPublishAttemptRecord | null> {
  const userId = normalizeUserId(input.userId);
  const productId = normalizeProductId(input.productId);
  const idempotencyKey = input.idempotencyKey.trim();
  if (!userId || !productId || !idempotencyKey) return null;

  if (allowFallbackStore()) {
    const userStore = getFallbackUserStore(userId);
    const matched = Array.from(userStore.values())
      .filter((entry) => entry.productId === productId && entry.idempotencyKey === idempotencyKey)
      .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))[0];
    return matched ? cloneAttempt(matched) : null;
  }

  if (!dbConfigured()) return null;

  try {
    await ensureTable();
    const rows = await query<ShopifyPublishAttemptRow>(
      `
      SELECT user_id, attempt_id, product_id, mode, idempotency_key, request_fingerprint,
             outcome_status, outcome_code, outcome_message, outcome_payload, created_at, updated_at
      FROM ${ATTEMPTS_TABLE}
      WHERE user_id = $1
        AND product_id = $2
        AND idempotency_key = $3
      ORDER BY updated_at DESC
      LIMIT 1
      `,
      [userId, productId, idempotencyKey]
    );
    const row = rows[0];
    return row ? sanitizeRow(row) : null;
  } catch (error) {
    if (isUndefinedRelationError(error, ATTEMPTS_TABLE)) throw tableMissingError();
    throw error;
  }
}

export async function savePersistedShopifyPublishAttempt(
  input: ShopifyPublishAttemptRecord
): Promise<ShopifyPublishAttemptRecord> {
  const record = cloneAttempt({
    ...input,
    userId: normalizeUserId(input.userId),
    productId: normalizeProductId(input.productId),
    idempotencyKey: input.idempotencyKey?.trim() || null,
    createdAt: asIso(input.createdAt),
    updatedAt: asIso(input.updatedAt),
  });

  if (allowFallbackStore()) {
    const userStore = getFallbackUserStore(record.userId);
    userStore.set(record.id, record);
    return cloneAttempt(record);
  }

  if (!dbConfigured()) {
    return record;
  }

  try {
    await ensureTable();
    await query(
      `
      INSERT INTO ${ATTEMPTS_TABLE}
        (user_id, attempt_id, product_id, mode, idempotency_key, request_fingerprint,
         outcome_status, outcome_code, outcome_message, outcome_payload, created_at, updated_at)
      VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::timestamptz, $12::timestamptz)
      ON CONFLICT (user_id, attempt_id)
      DO UPDATE SET
        product_id = EXCLUDED.product_id,
        mode = EXCLUDED.mode,
        idempotency_key = EXCLUDED.idempotency_key,
        request_fingerprint = EXCLUDED.request_fingerprint,
        outcome_status = EXCLUDED.outcome_status,
        outcome_code = EXCLUDED.outcome_code,
        outcome_message = EXCLUDED.outcome_message,
        outcome_payload = EXCLUDED.outcome_payload,
        created_at = EXCLUDED.created_at,
        updated_at = EXCLUDED.updated_at
      `,
      [
        record.userId,
        record.id,
        record.productId,
        record.mode,
        record.idempotencyKey,
        record.requestFingerprint,
        record.outcomeStatus,
        record.outcomeCode,
        record.outcomeMessage,
        JSON.stringify(record.outcomePayload),
        record.createdAt,
        record.updatedAt,
      ]
    );
    return record;
  } catch (error) {
    if (isUndefinedRelationError(error, ATTEMPTS_TABLE)) throw tableMissingError();
    throw error;
  }
}

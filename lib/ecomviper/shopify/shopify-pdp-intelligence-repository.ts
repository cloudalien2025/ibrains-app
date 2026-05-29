import "server-only";

import { query } from "@/app/api/ecomviper/_utils/db";
import { isUndefinedRelationError } from "@/app/api/directoryiq/_utils/sqlErrors";
import {
  createEmptyShopifyPdpIntelligenceRecord,
  sanitizeShopifyPdpIntelligenceRecord,
  type ShopifyPdpIntelligenceRecord,
} from "@/lib/ecomviper/shopify/shopify-pdp-intelligence";

interface ShopifyPdpIntelligenceRow {
  user_id: string;
  shopify_product_id: string;
  product_handle: string | null;
  intelligence_payload: ShopifyPdpIntelligenceRecord;
  updated_at: string | Date;
}

type FallbackStore = Map<string, Map<string, ShopifyPdpIntelligenceRecord>>;

declare global {
  var __ecomviper_shopify_pdp_intelligence_fallback__: FallbackStore | undefined;
  var __ecomviper_shopify_pdp_intelligence_tables_checked__: boolean | undefined;
}

const TABLE = "shopify_pdp_intelligence";

function dbConfigured(): boolean {
  return Boolean(process.env.DIRECTORYIQ_DATABASE_URL?.trim() || process.env.DATABASE_URL?.trim());
}

function allowFallbackStore(): boolean {
  return process.env.NODE_ENV === "test";
}

function databaseUnavailableError(): Error {
  return new Error("Database is not configured. Set DATABASE_URL (or DIRECTORYIQ_DATABASE_URL).");
}

function tableMissingError(): Error {
  return new Error(
    "Shopify PDP intelligence persistence table is unavailable. Apply db/migrations/20260529_ecomviper_shopify_pdp_intelligence.sql."
  );
}

function asString(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeUserId(userId: string): string {
  return userId.trim();
}

function getFallbackStore(): FallbackStore {
  if (!globalThis.__ecomviper_shopify_pdp_intelligence_fallback__) {
    globalThis.__ecomviper_shopify_pdp_intelligence_fallback__ = new Map();
  }
  return globalThis.__ecomviper_shopify_pdp_intelligence_fallback__;
}

function getFallbackUserStore(userId: string): Map<string, ShopifyPdpIntelligenceRecord> {
  const normalized = normalizeUserId(userId);
  const store = getFallbackStore();
  const existing = store.get(normalized);
  if (existing) return existing;
  const created = new Map<string, ShopifyPdpIntelligenceRecord>();
  store.set(normalized, created);
  return created;
}

function fallbackKey(shopifyProductId: string, productHandle: string | null): string {
  return `${asString(shopifyProductId)}::${asString(productHandle).toLowerCase()}`;
}

async function ensureTable(): Promise<void> {
  if (allowFallbackStore()) return;
  if (globalThis.__ecomviper_shopify_pdp_intelligence_tables_checked__) return;

  await query(
    `
    CREATE TABLE IF NOT EXISTS ${TABLE} (
      user_id TEXT NOT NULL,
      shopify_product_id TEXT NOT NULL,
      product_handle TEXT NULL,
      intelligence_payload JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, shopify_product_id)
    )
    `
  );

  await query(
    `CREATE INDEX IF NOT EXISTS idx_${TABLE}_user_handle
     ON ${TABLE}(user_id, lower(product_handle))`
  );

  await query(
    `CREATE INDEX IF NOT EXISTS idx_${TABLE}_user_updated
     ON ${TABLE}(user_id, updated_at DESC)`
  );

  globalThis.__ecomviper_shopify_pdp_intelligence_tables_checked__ = true;
}

export async function getPersistedShopifyPdpIntelligenceForProduct(input: {
  userId: string;
  shopifyProductId: string;
  productHandle: string | null;
}): Promise<ShopifyPdpIntelligenceRecord | null> {
  const normalizedUserId = normalizeUserId(input.userId);
  const shopifyProductId = asString(input.shopifyProductId);
  const productHandle = asString(input.productHandle) || null;

  if (!shopifyProductId && !productHandle) return null;

  const fallbackRecord = createEmptyShopifyPdpIntelligenceRecord({
    shopifyProductId,
    productHandle,
    supplier: null,
    supplierSku: null,
  });

  if (allowFallbackStore()) {
    const userStore = getFallbackUserStore(normalizedUserId);
    const byPrimary = userStore.get(fallbackKey(shopifyProductId, productHandle));
    if (byPrimary) return sanitizeShopifyPdpIntelligenceRecord(byPrimary, fallbackRecord);
    const byId = Array.from(userStore.values()).find(
      (entry) => asString(entry.shopify_product_id) === shopifyProductId
    );
    return byId ? sanitizeShopifyPdpIntelligenceRecord(byId, fallbackRecord) : null;
  }

  if (!dbConfigured()) throw databaseUnavailableError();

  try {
    await ensureTable();
    const rows = await query<ShopifyPdpIntelligenceRow>(
      `
      SELECT user_id, shopify_product_id, product_handle, intelligence_payload, updated_at
      FROM ${TABLE}
      WHERE user_id = $1
        AND (
          shopify_product_id = $2
          OR ($3::text IS NOT NULL AND lower(product_handle) = lower($3))
        )
      ORDER BY updated_at DESC
      LIMIT 1
      `,
      [normalizedUserId, shopifyProductId, productHandle]
    );
    const record = rows[0]?.intelligence_payload ?? null;
    return record ? sanitizeShopifyPdpIntelligenceRecord(record, fallbackRecord) : null;
  } catch (error) {
    if (isUndefinedRelationError(error, TABLE)) throw tableMissingError();
    throw error;
  }
}

export async function savePersistedShopifyPdpIntelligence(input: {
  userId: string;
  shopifyProductId: string;
  productHandle: string | null;
  record: ShopifyPdpIntelligenceRecord;
}): Promise<ShopifyPdpIntelligenceRecord> {
  const normalizedUserId = normalizeUserId(input.userId);
  const shopifyProductId = asString(input.shopifyProductId);
  const productHandle = asString(input.productHandle) || null;

  if (!shopifyProductId) {
    throw new Error("shopify_product_id is required for PDP intelligence persistence.");
  }

  const fallbackRecord = createEmptyShopifyPdpIntelligenceRecord({
    shopifyProductId,
    productHandle,
    supplier: input.record.supplier,
    supplierSku: input.record.supplier_sku,
  });
  const record = sanitizeShopifyPdpIntelligenceRecord(input.record, fallbackRecord);

  if (allowFallbackStore()) {
    const userStore = getFallbackUserStore(normalizedUserId);
    userStore.set(fallbackKey(shopifyProductId, productHandle), record);
    return sanitizeShopifyPdpIntelligenceRecord(record, fallbackRecord);
  }

  if (!dbConfigured()) throw databaseUnavailableError();

  try {
    await ensureTable();
    await query(
      `
      INSERT INTO ${TABLE}
        (user_id, shopify_product_id, product_handle, intelligence_payload, created_at, updated_at)
      VALUES
        ($1, $2, $3, $4::jsonb, now(), now())
      ON CONFLICT (user_id, shopify_product_id)
      DO UPDATE SET
        product_handle = EXCLUDED.product_handle,
        intelligence_payload = EXCLUDED.intelligence_payload,
        updated_at = now()
      `,
      [normalizedUserId, shopifyProductId, productHandle, JSON.stringify(record)]
    );
    return record;
  } catch (error) {
    if (isUndefinedRelationError(error, TABLE)) throw tableMissingError();
    throw error;
  }
}

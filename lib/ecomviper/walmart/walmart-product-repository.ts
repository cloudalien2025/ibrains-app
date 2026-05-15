import "server-only";

import { query } from "@/app/api/ecomviper/_utils/db";
import { isUndefinedRelationError } from "@/app/api/directoryiq/_utils/sqlErrors";
import type { WalmartProductRecord } from "@/lib/ecomviper/walmart/walmart-types";

interface WalmartProductRow {
  user_id: string;
  sku: string;
  product_payload: WalmartProductRecord;
  imported_at: string | Date;
  updated_at: string | Date;
  archived_at: string | Date | null;
}

interface WalmartProductStateRow {
  user_id: string;
  last_import_at: string | Date | null;
}

type FallbackUserState = {
  productsBySku: Map<string, WalmartProductRecord>;
  archivedSkus: Set<string>;
  lastImportAt: string | null;
};

type FallbackStore = Map<string, FallbackUserState>;

declare global {
  var __ecomviper_walmart_product_fallback__: FallbackStore | undefined;
  var __ecomviper_walmart_product_tables_checked__: boolean | undefined;
}

const PRODUCTS_TABLE = "walmart_products";
const STATE_TABLE = "walmart_product_import_state";
const WALMART_PRODUCT_STATUSES = new Set<WalmartProductRecord["status"]>([
  "active",
  "attention",
  "draft",
  "sync_failed",
]);
const WALMART_INVENTORY_STATUSES = new Set<WalmartProductRecord["inventoryStatus"]>([
  "known",
  "unknown",
  "out_of_stock",
]);
const WALMART_IMAGE_STATUSES = new Set<NonNullable<WalmartProductRecord["imageStatus"]>>([
  "image_available",
  "catalog_missing",
  "enrichment_unconfigured",
]);
const WALMART_IMAGE_SYNC_STATUSES = new Set<NonNullable<WalmartProductRecord["imageSyncStatus"]>>([
  "found",
  "not_found",
  "ambiguous",
  "failed",
  "not_synced",
]);
const WALMART_IMAGE_SOURCES = new Set<NonNullable<WalmartProductRecord["imageSource"]>>([
  "walmart_item_report",
  "walmart_catalog",
  "walmart_item_search",
  "serpapi_walmart_brand_search",
  "public_walmart_listing_serpapi",
  "shopify_product",
  "shopify_variant",
  "openai_generated",
  "manual",
  "shopify_placeholder",
  "manual_placeholder",
  "none",
]);
const WALMART_IMAGE_MATCH_METHODS = new Set<NonNullable<WalmartProductRecord["imageMatchMethod"]>>([
  "gtin",
  "upc",
  "itemId",
  "wpid",
  "query",
  "catalog",
  "public_url_product_id",
  "serpapi_product_id",
  "serpapi_search_upc",
  "serpapi_search_gtin",
  "serpapi_search_title_brand",
  "item_report_sku",
  "item_report_productid",
  "item_report_itemid",
  "item_report_wpid",
  "item_report_title_brand",
  "shopify_sku_exact",
  "shopify_barcode_exact",
  "shopify_barcode_normalized",
  "shopify_title_vendor_high",
  "shopify_ambiguous",
  "shopify_no_match",
]);

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
    "Walmart product persistence tables are unavailable. Apply db/migrations/20260509_ecomviper_walmart_products.sql."
  );
}

function toIsoTimestamp(value: string | Date | null | undefined): string | null {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || null;
  }
  return null;
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function asString(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function asNumber(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => asString(entry))
    .filter((entry) => entry.length > 0);
}

function asStringRecord(value: unknown): Record<string, string> {
  const row = asObject(value);
  if (!row) return {};
  return Object.fromEntries(
    Object.entries(row)
      .map(([key, entry]) => [key.trim(), asString(entry)] as const)
      .filter(([key, entry]) => key.length > 0 && entry.length > 0)
  );
}

function asEnum<T extends string>(value: unknown, allowed: Set<T>): T | undefined {
  const normalized = asString(value) as T;
  if (!normalized) return undefined;
  return allowed.has(normalized) ? normalized : undefined;
}

function normalizeSku(sku: unknown): string {
  return asString(sku).toUpperCase();
}

function sanitizePersistedWalmartProduct(payload: unknown): WalmartProductRecord | null {
  const row = asObject(payload);
  if (!row) return null;

  const now = new Date().toISOString();
  const sku = asString(row.sku) || "UNKNOWN-SKU";
  const imageUrl = asString(row.imageUrl);
  const galleryImageUrls = asStringArray(row.galleryImageUrls);
  const variantImageUrls = asStringArray(row.variantImageUrls);
  const primaryImageUrl = asString(row.primaryImageUrl);
  const normalizedPrice = asNumber(row.price, 0);
  const normalizedInventory = Math.max(0, asNumber(row.inventoryQuantity, 0));
  const issues = asStringArray(row.issues);

  const searchBrowseAttributes = asStringRecord(row.searchBrowseAttributes);
  const mediaRecommendations = asStringArray(row.mediaRecommendations);

  const imageStatus = asEnum(row.imageStatus, WALMART_IMAGE_STATUSES);
  const imageSyncStatus = asEnum(row.imageSyncStatus, WALMART_IMAGE_SYNC_STATUSES);
  const imageSource = asEnum(row.imageSource, WALMART_IMAGE_SOURCES);
  const imageMatchMethod = asEnum(row.imageMatchMethod, WALMART_IMAGE_MATCH_METHODS);

  return {
    id: asString(row.id) || `walmart_${sku.toLowerCase()}`,
    marketplace: "walmart",
    sku,
    externalItemId: asString(row.externalItemId) || `wm_${sku.toLowerCase()}`,
    upc: asString(row.upc) || undefined,
    gtin: asString(row.gtin) || undefined,
    wpid: asString(row.wpid) || undefined,
    itemId: asString(row.itemId) || undefined,
    publishedStatus: asString(row.publishedStatus) || undefined,
    title: asString(row.title) || sku,
    brand: asString(row.brand) || "",
    category: asString(row.category) || "Supplements",
    price: Number.isFinite(normalizedPrice) ? normalizedPrice : 0,
    inventoryQuantity: normalizedInventory,
    inventoryStatus: asEnum(row.inventoryStatus, WALMART_INVENTORY_STATUSES) ?? "unknown",
    status: asEnum(row.status, WALMART_PRODUCT_STATUSES) ?? "attention",
    imageUrl,
    galleryImageUrls,
    variantImageUrls,
    imageStatus,
    imageStatusMessage: asString(row.imageStatusMessage) || undefined,
    imageSource,
    imageSyncStatus,
    imageMatchMethod,
    shopifyProductId: asString(row.shopifyProductId) || undefined,
    shopifyVariantId: asString(row.shopifyVariantId) || undefined,
    matchedItemId: asString(row.matchedItemId) || undefined,
    publicWalmartUrl: asString(row.publicWalmartUrl) || undefined,
    publicWalmartProductId: asString(row.publicWalmartProductId) || undefined,
    primaryImageUrl: primaryImageUrl || undefined,
    lastImageSyncedAt: asString(row.lastImageSyncedAt) || null,
    imageSyncReason: asString(row.imageSyncReason) || null,
    issues,
    attributes: asStringRecord(row.attributes),
    searchBrowseAttributes:
      Object.keys(searchBrowseAttributes).length > 0 ? searchBrowseAttributes : undefined,
    mediaRecommendations:
      mediaRecommendations.length > 0 ? mediaRecommendations : undefined,
    altText: asString(row.altText) || undefined,
    shortDescription: asString(row.shortDescription),
    longDescription: asString(row.longDescription),
    bulletPoints: asStringArray(row.bulletPoints),
    rawPayload: row.rawPayload ?? row,
    normalizedPayload: row.normalizedPayload ?? row,
    lastSyncedAt: asString(row.lastSyncedAt) || now,
    createdAt: asString(row.createdAt) || now,
    updatedAt: asString(row.updatedAt) || now,
  };
}

function getFallbackStore(): FallbackStore {
  if (!globalThis.__ecomviper_walmart_product_fallback__) {
    globalThis.__ecomviper_walmart_product_fallback__ = new Map<string, FallbackUserState>();
  }
  return globalThis.__ecomviper_walmart_product_fallback__;
}

function getFallbackUserState(userId: string): FallbackUserState {
  const store = getFallbackStore();
  const existing = store.get(userId);
  if (existing) return existing;

  const created: FallbackUserState = {
    productsBySku: new Map<string, WalmartProductRecord>(),
    archivedSkus: new Set<string>(),
    lastImportAt: null,
  };
  store.set(userId, created);
  return created;
}

async function ensureTables(): Promise<void> {
  if (allowFallbackStore()) return;
  if (globalThis.__ecomviper_walmart_product_tables_checked__) return;

  await query(
    `
    CREATE TABLE IF NOT EXISTS ${PRODUCTS_TABLE} (
      user_id TEXT NOT NULL,
      sku TEXT NOT NULL,
      product_payload JSONB NOT NULL,
      imported_at TIMESTAMPTZ NOT NULL,
      archived_at TIMESTAMPTZ NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, sku)
    )
    `
  );

  await query(
    `
    ALTER TABLE ${PRODUCTS_TABLE}
    ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ NULL
    `
  );

  await query(
    `
    CREATE TABLE IF NOT EXISTS ${STATE_TABLE} (
      user_id TEXT PRIMARY KEY,
      last_import_at TIMESTAMPTZ NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
    `
  );

  await query(
    `CREATE INDEX IF NOT EXISTS idx_${PRODUCTS_TABLE}_user_updated
     ON ${PRODUCTS_TABLE}(user_id, updated_at DESC)`
  );
  await query(
    `CREATE INDEX IF NOT EXISTS idx_${PRODUCTS_TABLE}_user_archived_updated
     ON ${PRODUCTS_TABLE}(user_id, archived_at, updated_at DESC)`
  );

  globalThis.__ecomviper_walmart_product_tables_checked__ = true;
}

export async function listPersistedWalmartProducts(userId: string): Promise<WalmartProductRecord[]> {
  if (allowFallbackStore()) {
    const state = getFallbackUserState(userId);
    return Array.from(state.productsBySku.values())
      .map((product) => sanitizePersistedWalmartProduct(product))
      .filter((product): product is WalmartProductRecord => Boolean(product))
      .sort((left, right) => left.sku.localeCompare(right.sku));
  }

  if (!dbConfigured()) {
    throw databaseUnavailableError();
  }

  try {
    await ensureTables();

    const rows = await query<WalmartProductRow>(
      `
      SELECT user_id, sku, product_payload, imported_at, updated_at, archived_at
      FROM ${PRODUCTS_TABLE}
      WHERE user_id = $1 AND archived_at IS NULL
      ORDER BY updated_at DESC, sku ASC
      `,
      [userId]
    );

    return rows
      .map((row) => sanitizePersistedWalmartProduct(row.product_payload))
      .filter((payload): payload is WalmartProductRecord => Boolean(payload));
  } catch (error) {
    if (isUndefinedRelationError(error, PRODUCTS_TABLE) || isUndefinedRelationError(error, STATE_TABLE)) {
      throw tableMissingError();
    }
    throw error;
  }
}

export async function getPersistedWalmartProductBySkuWithArchiveState(input: {
  userId: string;
  sku: string;
}): Promise<{ product: WalmartProductRecord | null; archived: boolean }> {
  const { userId, sku } = input;
  const normalizedSku = normalizeSku(sku);

  if (allowFallbackStore()) {
    const state = getFallbackUserState(userId);
    if (state.archivedSkus.has(normalizedSku)) {
      return { product: null, archived: true };
    }
    return {
      product: sanitizePersistedWalmartProduct(state.productsBySku.get(normalizedSku) ?? null),
      archived: false,
    };
  }

  if (!dbConfigured()) {
    throw databaseUnavailableError();
  }

  try {
    await ensureTables();

    const rows = await query<WalmartProductRow>(
      `
      SELECT user_id, sku, product_payload, imported_at, updated_at, archived_at
      FROM ${PRODUCTS_TABLE}
      WHERE user_id = $1 AND sku = $2
      LIMIT 1
      `,
      [userId, normalizedSku]
    );

    const row = rows[0];
    if (!row) {
      return { product: null, archived: false };
    }
    if (row.archived_at) {
      return { product: null, archived: true };
    }

    return { product: sanitizePersistedWalmartProduct(row.product_payload), archived: false };
  } catch (error) {
    if (isUndefinedRelationError(error, PRODUCTS_TABLE) || isUndefinedRelationError(error, STATE_TABLE)) {
      throw tableMissingError();
    }
    throw error;
  }
}

export async function getPersistedWalmartProductBySku(
  userId: string,
  sku: string
): Promise<WalmartProductRecord | null> {
  const lookup = await getPersistedWalmartProductBySkuWithArchiveState({ userId, sku });
  return lookup.product;
}

export async function replacePersistedWalmartProducts(input: {
  userId: string;
  products: WalmartProductRecord[];
  importedAt: string | null;
}): Promise<void> {
  const importedAt = input.importedAt ?? new Date().toISOString();

  if (allowFallbackStore()) {
    const state = getFallbackUserState(input.userId);
    const nextProductsBySku = new Map<string, WalmartProductRecord>();
    for (const product of input.products) {
      const normalizedSku = normalizeSku(product.sku);
      if (state.archivedSkus.has(normalizedSku)) continue;
      nextProductsBySku.set(normalizedSku, product);
    }
    state.productsBySku = nextProductsBySku;
    state.lastImportAt = importedAt;
    return;
  }

  if (!dbConfigured()) {
    throw databaseUnavailableError();
  }

  try {
    await ensureTables();

    const normalizedProductsBySku = new Map<string, WalmartProductRecord>();
    for (const product of input.products) {
      normalizedProductsBySku.set(normalizeSku(product.sku), product);
    }

    const skus = Array.from(normalizedProductsBySku.keys());

    if (skus.length === 0) {
      await query(`DELETE FROM ${PRODUCTS_TABLE} WHERE user_id = $1 AND archived_at IS NULL`, [input.userId]);
    } else {
      for (const [normalizedSku, product] of normalizedProductsBySku.entries()) {
        await query(
          `
          INSERT INTO ${PRODUCTS_TABLE}
            (user_id, sku, product_payload, imported_at, archived_at, created_at, updated_at)
          VALUES
            ($1, $2, $3::jsonb, $4::timestamptz, null, now(), now())
          ON CONFLICT (user_id, sku)
          DO UPDATE SET
            product_payload = EXCLUDED.product_payload,
            imported_at = EXCLUDED.imported_at,
            archived_at = ${PRODUCTS_TABLE}.archived_at,
            updated_at = now()
          `,
          [input.userId, normalizedSku, JSON.stringify(product), importedAt]
        );
      }

      await query(
        `DELETE FROM ${PRODUCTS_TABLE}
         WHERE user_id = $1 AND archived_at IS NULL AND NOT (sku = ANY($2::text[]))`,
        [input.userId, skus]
      );
    }

    await query(
      `
      INSERT INTO ${STATE_TABLE}
        (user_id, last_import_at, created_at, updated_at)
      VALUES
        ($1, $2::timestamptz, now(), now())
      ON CONFLICT (user_id)
      DO UPDATE SET
        last_import_at = EXCLUDED.last_import_at,
        updated_at = now()
      `,
      [input.userId, importedAt]
    );
  } catch (error) {
    if (isUndefinedRelationError(error, PRODUCTS_TABLE) || isUndefinedRelationError(error, STATE_TABLE)) {
      throw tableMissingError();
    }
    throw error;
  }
}

export async function getPersistedWalmartLastImportAt(userId: string): Promise<string | null> {
  if (allowFallbackStore()) {
    return getFallbackUserState(userId).lastImportAt;
  }

  if (!dbConfigured()) {
    throw databaseUnavailableError();
  }

  try {
    await ensureTables();

    const rows = await query<WalmartProductStateRow>(
      `SELECT user_id, last_import_at FROM ${STATE_TABLE} WHERE user_id = $1 LIMIT 1`,
      [userId]
    );

    return toIsoTimestamp(rows[0]?.last_import_at);
  } catch (error) {
    if (isUndefinedRelationError(error, PRODUCTS_TABLE) || isUndefinedRelationError(error, STATE_TABLE)) {
      throw tableMissingError();
    }
    throw error;
  }
}

export async function archivePersistedWalmartProductBySku(input: {
  userId: string;
  sku: string;
}): Promise<boolean> {
  const normalizedSku = normalizeSku(input.sku);
  if (!normalizedSku) return false;

  if (allowFallbackStore()) {
    const state = getFallbackUserState(input.userId);
    const existing = state.productsBySku.get(normalizedSku);
    if (!existing) return false;
    state.productsBySku.delete(normalizedSku);
    state.archivedSkus.add(normalizedSku);
    return true;
  }

  if (!dbConfigured()) {
    throw databaseUnavailableError();
  }

  try {
    await ensureTables();

    const rows = await query<{ sku: string }>(
      `
      UPDATE ${PRODUCTS_TABLE}
      SET archived_at = now(), updated_at = now()
      WHERE user_id = $1 AND sku = $2 AND archived_at IS NULL
      RETURNING sku
      `,
      [input.userId, normalizedSku]
    );

    return rows.length > 0;
  } catch (error) {
    if (isUndefinedRelationError(error, PRODUCTS_TABLE) || isUndefinedRelationError(error, STATE_TABLE)) {
      throw tableMissingError();
    }
    throw error;
  }
}

export async function clearPersistedWalmartProducts(userId: string): Promise<{
  clearedProductCount: number;
  clearedImportStateCount: number;
}> {
  if (allowFallbackStore()) {
    const state = getFallbackUserState(userId);
    const clearedProductCount = state.productsBySku.size;
    state.productsBySku.clear();
    state.archivedSkus.clear();
    state.lastImportAt = null;
    return {
      clearedProductCount,
      clearedImportStateCount: 1,
    };
  }

  if (!dbConfigured()) {
    throw databaseUnavailableError();
  }

  try {
    await ensureTables();

    const clearedRows = await query<{ sku: string }>(
      `DELETE FROM ${PRODUCTS_TABLE} WHERE user_id = $1 RETURNING sku`,
      [userId]
    );
    await query(
      `
      INSERT INTO ${STATE_TABLE}
        (user_id, last_import_at, created_at, updated_at)
      VALUES
        ($1, null, now(), now())
      ON CONFLICT (user_id)
      DO UPDATE SET
        last_import_at = null,
        updated_at = now()
      `,
      [userId]
    );

    return {
      clearedProductCount: clearedRows.length,
      clearedImportStateCount: 1,
    };
  } catch (error) {
    if (isUndefinedRelationError(error, PRODUCTS_TABLE) || isUndefinedRelationError(error, STATE_TABLE)) {
      throw tableMissingError();
    }
    throw error;
  }
}

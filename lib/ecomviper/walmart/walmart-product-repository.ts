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

function normalizeSku(sku: string): string {
  return sku.trim().toUpperCase();
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
    return Array.from(state.productsBySku.values()).sort((left, right) => left.sku.localeCompare(right.sku));
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
      .map((row) => row.product_payload)
      .filter((payload): payload is WalmartProductRecord => Boolean(payload && typeof payload === "object"));
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
    return { product: state.productsBySku.get(normalizedSku) ?? null, archived: false };
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

    return { product: row.product_payload ?? null, archived: false };
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

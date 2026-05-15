import "server-only";

import { query } from "@/app/api/ecomviper/_utils/db";
import { isUndefinedRelationError } from "@/app/api/directoryiq/_utils/sqlErrors";
import type {
  ShopifyImportState,
  ShopifyMetafieldRecord,
  ShopifyProductRecord,
} from "@/lib/ecomviper/shopify/shopify-types";

interface ShopifyProductRow {
  user_id: string;
  shopify_product_id: string;
  product_payload: ShopifyProductRecord;
  imported_at: string | Date;
  updated_at: string | Date;
}

interface ShopifyProductStateRow {
  user_id: string;
  last_import_at: string | Date | null;
  last_import_status: string | null;
  last_import_message: string | null;
  product_count: number | null;
  image_count: number | null;
  updated_at: string | Date;
}

type FallbackUserState = {
  productsById: Map<string, ShopifyProductRecord>;
  importState: ShopifyImportState;
};

type FallbackStore = Map<string, FallbackUserState>;

declare global {
  var __ecomviper_shopify_product_fallback__: FallbackStore | undefined;
  var __ecomviper_shopify_product_tables_checked__: boolean | undefined;
}

const PRODUCTS_TABLE = "shopify_products";
const STATE_TABLE = "shopify_product_import_state";

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
    "Shopify product persistence tables are unavailable. Apply db/migrations/20260512_ecomviper_shopify_products.sql."
  );
}

function asString(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => asString(entry))
    .filter((entry) => entry.length > 0);
}

function asMetafieldArray(value: unknown): ShopifyMetafieldRecord[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => asObject(entry))
    .filter((entry): entry is Record<string, unknown> => entry !== null)
    .map((entry) => ({
      id: asString(entry.id),
      namespace: asString(entry.namespace),
      key: asString(entry.key),
      type: asString(entry.type),
      value: asString(entry.value),
      description: asString(entry.description) || null,
    }))
    .filter((entry) => entry.namespace.length > 0 && entry.key.length > 0);
}

function toIsoTimestamp(value: string | Date | null | undefined): string | null {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || null;
  }
  return null;
}

function sanitizeShopifyProduct(payload: unknown): ShopifyProductRecord | null {
  const row = asObject(payload);
  if (!row) return null;

  const now = new Date().toISOString();
  const id = asString(row.id);
  if (!id) return null;

  const variants = Array.isArray(row.variants)
    ? row.variants
        .map((entry) => asObject(entry))
        .filter((entry): entry is Record<string, unknown> => entry !== null)
        .map((entry) => ({
          id: asString(entry.id),
          productId: asString(entry.productId) || id,
          title: asString(entry.title),
          sku: asString(entry.sku),
          barcode: asString(entry.barcode),
          price: asNumber(entry.price),
          compareAtPrice: asNumber(entry.compareAtPrice),
          inventoryQuantity: asNumber(entry.inventoryQuantity),
          selectedOptions: Array.isArray(entry.selectedOptions)
            ? entry.selectedOptions
                .map((option) => asObject(option))
                .filter((option): option is Record<string, unknown> => option !== null)
                .map((option) => ({
                  name: asString(option.name),
                  value: asString(option.value),
                }))
                .filter((option) => option.name.length > 0 || option.value.length > 0)
            : [],
          imageUrl: asString(entry.imageUrl),
          imageAltText: asString(entry.imageAltText) || null,
          imageUrls: asStringArray(entry.imageUrls),
        }))
        .filter((entry) => entry.id.length > 0)
    : [];

  const galleryImages = Array.isArray(row.galleryImages)
    ? row.galleryImages
        .map((entry) => asObject(entry))
        .filter((entry): entry is Record<string, unknown> => entry !== null)
        .map((entry) => ({
          id: asString(entry.id),
          url: asString(entry.url),
          altText: asString(entry.altText) || null,
          width: asNumber(entry.width),
          height: asNumber(entry.height),
          source: (entry.source === "variant" ? "variant" : "product") as "product" | "variant",
          variantId: asString(entry.variantId) || null,
        }))
        .filter((entry) => entry.url.length > 0)
    : [];

  return {
    id,
    storeDomain: asString(row.storeDomain),
    title: asString(row.title),
    handle: asString(row.handle),
    vendor: asString(row.vendor),
    productType: asString(row.productType),
    status: asString(row.status),
    tags: asStringArray(row.tags),
    description: asString(row.description),
    descriptionHtml: asString(row.descriptionHtml),
    seoTitle: asString(row.seoTitle),
    seoDescription: asString(row.seoDescription),
    metafields: asMetafieldArray(row.metafields),
    onlineStoreUrl: asString(row.onlineStoreUrl),
    primaryImageUrl: asString(row.primaryImageUrl),
    galleryImageUrls: asStringArray(row.galleryImageUrls),
    galleryImages,
    createdAt: asString(row.createdAt) || now,
    updatedAt: asString(row.updatedAt) || now,
    variants,
  };
}

function getFallbackStore(): FallbackStore {
  if (!globalThis.__ecomviper_shopify_product_fallback__) {
    globalThis.__ecomviper_shopify_product_fallback__ = new Map<string, FallbackUserState>();
  }
  return globalThis.__ecomviper_shopify_product_fallback__;
}

function getFallbackUserState(userId: string): FallbackUserState {
  const store = getFallbackStore();
  const existing = store.get(userId);
  if (existing) return existing;

  const created: FallbackUserState = {
    productsById: new Map<string, ShopifyProductRecord>(),
    importState: {
      lastImportAt: null,
      lastImportStatus: "unknown",
      lastImportMessage: null,
      productCount: 0,
      imageCount: 0,
      updatedAt: null,
    },
  };
  store.set(userId, created);
  return created;
}

async function ensureTables(): Promise<void> {
  if (allowFallbackStore()) return;
  if (globalThis.__ecomviper_shopify_product_tables_checked__) return;

  await query(
    `
    CREATE TABLE IF NOT EXISTS ${PRODUCTS_TABLE} (
      user_id TEXT NOT NULL,
      shopify_product_id TEXT NOT NULL,
      product_payload JSONB NOT NULL,
      imported_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, shopify_product_id)
    )
    `
  );

  await query(
    `
    CREATE TABLE IF NOT EXISTS ${STATE_TABLE} (
      user_id TEXT PRIMARY KEY,
      last_import_at TIMESTAMPTZ NULL,
      last_import_status TEXT NOT NULL DEFAULT 'unknown',
      last_import_message TEXT NULL,
      product_count INTEGER NOT NULL DEFAULT 0,
      image_count INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
    `
  );

  await query(
    `CREATE INDEX IF NOT EXISTS idx_${PRODUCTS_TABLE}_user_updated
     ON ${PRODUCTS_TABLE}(user_id, updated_at DESC)`
  );

  globalThis.__ecomviper_shopify_product_tables_checked__ = true;
}

export async function listPersistedShopifyProducts(userId: string): Promise<ShopifyProductRecord[]> {
  if (allowFallbackStore()) {
    const state = getFallbackUserState(userId);
    return Array.from(state.productsById.values()).sort((left, right) => left.id.localeCompare(right.id));
  }

  if (!dbConfigured()) {
    throw databaseUnavailableError();
  }

  try {
    await ensureTables();

    const rows = await query<ShopifyProductRow>(
      `
      SELECT user_id, shopify_product_id, product_payload, imported_at, updated_at
      FROM ${PRODUCTS_TABLE}
      WHERE user_id = $1
      ORDER BY updated_at DESC, shopify_product_id ASC
      `,
      [userId]
    );

    return rows
      .map((row) => sanitizeShopifyProduct(row.product_payload))
      .filter((entry): entry is ShopifyProductRecord => entry !== null);
  } catch (error) {
    if (isUndefinedRelationError(error, PRODUCTS_TABLE) || isUndefinedRelationError(error, STATE_TABLE)) {
      throw tableMissingError();
    }
    throw error;
  }
}

export async function getPersistedShopifyImportState(userId: string): Promise<ShopifyImportState> {
  if (allowFallbackStore()) {
    return { ...getFallbackUserState(userId).importState };
  }

  if (!dbConfigured()) {
    throw databaseUnavailableError();
  }

  try {
    await ensureTables();
    const rows = await query<ShopifyProductStateRow>(
      `
      SELECT user_id, last_import_at, last_import_status, last_import_message, product_count, image_count, updated_at
      FROM ${STATE_TABLE}
      WHERE user_id = $1
      LIMIT 1
      `,
      [userId]
    );

    const row = rows[0];
    if (!row) {
      return {
        lastImportAt: null,
        lastImportStatus: "unknown",
        lastImportMessage: null,
        productCount: 0,
        imageCount: 0,
        updatedAt: null,
      };
    }

    const status = asString(row.last_import_status);

    return {
      lastImportAt: toIsoTimestamp(row.last_import_at),
      lastImportStatus:
        status === "success" || status === "failed" || status === "unknown"
          ? status
          : "unknown",
      lastImportMessage: asString(row.last_import_message) || null,
      productCount: Math.max(0, Math.trunc(asNumber(row.product_count) ?? 0)),
      imageCount: Math.max(0, Math.trunc(asNumber(row.image_count) ?? 0)),
      updatedAt: toIsoTimestamp(row.updated_at),
    };
  } catch (error) {
    if (isUndefinedRelationError(error, PRODUCTS_TABLE) || isUndefinedRelationError(error, STATE_TABLE)) {
      throw tableMissingError();
    }
    throw error;
  }
}

export async function replacePersistedShopifyProducts(input: {
  userId: string;
  products: ShopifyProductRecord[];
  importedAt: string;
  importStatus: ShopifyImportState["lastImportStatus"];
  importMessage: string | null;
}): Promise<void> {
  if (allowFallbackStore()) {
    const state = getFallbackUserState(input.userId);
    const nextProductsById = new Map<string, ShopifyProductRecord>();
    for (const product of input.products) {
      nextProductsById.set(product.id, product);
    }
    state.productsById = nextProductsById;

    const imageCount = input.products.reduce(
      (sum, product) => sum + new Set(product.galleryImageUrls).size,
      0
    );

    state.importState = {
      lastImportAt: input.importedAt,
      lastImportStatus: input.importStatus,
      lastImportMessage: input.importMessage,
      productCount: input.products.length,
      imageCount,
      updatedAt: new Date().toISOString(),
    };
    return;
  }

  if (!dbConfigured()) {
    throw databaseUnavailableError();
  }

  try {
    await ensureTables();

    const productIds = input.products.map((product) => product.id);
    for (const product of input.products) {
      await query(
        `
        INSERT INTO ${PRODUCTS_TABLE}
          (user_id, shopify_product_id, product_payload, imported_at, created_at, updated_at)
        VALUES
          ($1, $2, $3::jsonb, $4::timestamptz, now(), now())
        ON CONFLICT (user_id, shopify_product_id)
        DO UPDATE SET
          product_payload = EXCLUDED.product_payload,
          imported_at = EXCLUDED.imported_at,
          updated_at = now()
        `,
        [input.userId, product.id, JSON.stringify(product), input.importedAt]
      );
    }

    if (productIds.length === 0) {
      await query(`DELETE FROM ${PRODUCTS_TABLE} WHERE user_id = $1`, [input.userId]);
    } else {
      await query(
        `DELETE FROM ${PRODUCTS_TABLE}
         WHERE user_id = $1 AND NOT (shopify_product_id = ANY($2::text[]))`,
        [input.userId, productIds]
      );
    }

    const imageCount = input.products.reduce(
      (sum, product) => sum + new Set(product.galleryImageUrls).size,
      0
    );

    await query(
      `
      INSERT INTO ${STATE_TABLE}
        (user_id, last_import_at, last_import_status, last_import_message, product_count, image_count, created_at, updated_at)
      VALUES
        ($1, $2::timestamptz, $3, $4, $5, $6, now(), now())
      ON CONFLICT (user_id)
      DO UPDATE SET
        last_import_at = EXCLUDED.last_import_at,
        last_import_status = EXCLUDED.last_import_status,
        last_import_message = EXCLUDED.last_import_message,
        product_count = EXCLUDED.product_count,
        image_count = EXCLUDED.image_count,
        updated_at = now()
      `,
      [
        input.userId,
        input.importedAt,
        input.importStatus,
        input.importMessage,
        input.products.length,
        imageCount,
      ]
    );
  } catch (error) {
    if (isUndefinedRelationError(error, PRODUCTS_TABLE) || isUndefinedRelationError(error, STATE_TABLE)) {
      throw tableMissingError();
    }
    throw error;
  }
}

export async function markShopifyImportFailure(input: {
  userId: string;
  message: string;
}): Promise<void> {
  if (allowFallbackStore()) {
    const state = getFallbackUserState(input.userId);
    state.importState = {
      ...state.importState,
      lastImportStatus: "failed",
      lastImportMessage: input.message,
      updatedAt: new Date().toISOString(),
    };
    return;
  }

  if (!dbConfigured()) {
    throw databaseUnavailableError();
  }

  try {
    await ensureTables();
    await query(
      `
      INSERT INTO ${STATE_TABLE}
        (user_id, last_import_at, last_import_status, last_import_message, product_count, image_count, created_at, updated_at)
      VALUES
        ($1, null, 'failed', $2, 0, 0, now(), now())
      ON CONFLICT (user_id)
      DO UPDATE SET
        last_import_status = 'failed',
        last_import_message = EXCLUDED.last_import_message,
        updated_at = now()
      `,
      [input.userId, input.message]
    );
  } catch (error) {
    if (isUndefinedRelationError(error, PRODUCTS_TABLE) || isUndefinedRelationError(error, STATE_TABLE)) {
      throw tableMissingError();
    }
    throw error;
  }
}

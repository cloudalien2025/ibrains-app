import "server-only";

import crypto from "crypto";
import { query } from "@/app/api/ecomviper/_utils/db";
import { isUndefinedRelationError } from "@/app/api/directoryiq/_utils/sqlErrors";

export type SupplierSourceSyncStatus =
  | "never_synced"
  | "synced"
  | "sync_failed"
  | "source_inaccessible"
  | "source_auth_required"
  | "parsing_partial"
  | "ocr_required"
  | "sync_in_progress";

export interface PersistedSupplierProductNormalized {
  sku: string;
  productName: string;
  category: string | null;
  labelSize: string | null;
  containerSize: string | null;
  productWeight: string | null;
  productForm: string | null;
  supplementFactsRaw: string | null;
  supplementFactsText: string | null;
  servingSize: string | null;
  servingsPerContainer: string | null;
  activeIngredients: string[];
  amountPerServing: string | null;
  otherIngredients: string | null;
  ingredientHighlightsSource: string[];
  keyProductFeatures: string[];
  dietaryAttributes: string[];
  manufacturingClaims: string[];
  certifications: string[];
  warnings: string | null;
  suggestedUse: string | null;
  coaUrl: string | null;
  coaStatus: string | null;
  coaExtractionStatus: string | null;
  coaExtractionError: string | null;
  labelTemplateUrl: string | null;
  mockupUrl: string | null;
  sourceCatalogPage: number | null;
  sourceVersion: string | null;
  extractionStatus: string | null;
  extractionErrors: string[];
  lastSyncedAt: string;
  rawPayload: Record<string, unknown>;
}

export interface PersistedSupplierInventoryNormalized {
  sku: string;
  inventoryStatusRaw: string | null;
  inventoryStatusNormalized: string;
  availabilityDisplay: string;
  sourceReport: string | null;
  sourceUpdatedAt: string | null;
  lastSyncedAt: string;
  extractionStatus: string | null;
  extractionErrors: string[];
}

export interface PersistedSupplierPricingNormalized {
  sku: string;
  productName: string | null;
  category: string | null;
  detectedMembershipTiers: string[];
  costsByMembershipTier: Record<string, number>;
  msrp: number | null;
  sourceSheet: string | null;
  sourceTab: string | null;
  sourceRow: number | null;
  sourceVersion: string | null;
  lastSyncedAt: string;
  extractionStatus: string | null;
  extractionErrors: string[];
}

export interface PersistedSupplierAssetsNormalized {
  sku: string;
  labelTemplateUrl: string | null;
  mockupUrl: string | null;
  supplementFactsAssetUrl: string | null;
  coaUrl: string | null;
  assetStatus: string;
  lastSyncedAt: string;
  extractionStatus: string | null;
  extractionErrors: string[];
}

export interface PersistedSupplierSourceStatus {
  sourceId: string;
  sourceLabel: string;
  configured: boolean;
  fetchable: boolean;
  parsed: boolean;
  recordCount: number;
  syncStatus: SupplierSourceSyncStatus;
  sourceUrl: string | null;
  fetchUrl: string | null;
  lastCheckedAt: string | null;
  lastSuccessfulSyncAt: string | null;
  lastError: string | null;
  metadata: Record<string, unknown>;
}

export interface PersistedSupplierSyncRun {
  syncStatus: SupplierSourceSyncStatus;
  productsParsedCount: number;
  inventoryRecordsParsedCount: number;
  pricingRecordsParsedCount: number;
  assetRecordsParsedCount: number;
  sourceDiagnostics: PersistedSupplierSourceStatus[];
  attemptedAt: string;
  completedAt: string | null;
  lastError: string | null;
}

export interface PersistedSupplierSnapshot {
  products: PersistedSupplierProductNormalized[];
  inventoryBySku: Map<string, PersistedSupplierInventoryNormalized>;
  pricingBySku: Map<string, PersistedSupplierPricingNormalized>;
  assetsBySku: Map<string, PersistedSupplierAssetsNormalized>;
  sourceStatuses: PersistedSupplierSourceStatus[];
  latestRun: PersistedSupplierSyncRun | null;
}

interface PersistInput {
  userId: string;
  supplierId: string;
  products: PersistedSupplierProductNormalized[];
  inventoryRows: PersistedSupplierInventoryNormalized[];
  pricingRows: PersistedSupplierPricingNormalized[];
  assetRows: PersistedSupplierAssetsNormalized[];
  sourceStatuses: PersistedSupplierSourceStatus[];
  run: PersistedSupplierSyncRun;
}

interface LockResult {
  acquired: boolean;
  token: string | null;
}

const TABLES = {
  products: "supplier_products_normalized",
  inventory: "supplier_inventory_normalized",
  pricing: "supplier_pricing_normalized",
  assets: "supplier_assets_normalized",
  sourceStatus: "supplier_source_sync_status",
  runs: "supplier_source_sync_runs",
  locks: "supplier_source_sync_locks",
} as const;

export const GLOBAL_SUPPLIER_SCOPE_USER_ID = "__global__";

declare global {
  var __rocktomic_normalized_store_products__: Map<string, PersistedSupplierProductNormalized[]> | undefined;
  var __rocktomic_normalized_store_inventory__: Map<string, PersistedSupplierInventoryNormalized[]> | undefined;
  var __rocktomic_normalized_store_pricing__: Map<string, PersistedSupplierPricingNormalized[]> | undefined;
  var __rocktomic_normalized_store_assets__: Map<string, PersistedSupplierAssetsNormalized[]> | undefined;
  var __rocktomic_normalized_store_source_status__: Map<string, PersistedSupplierSourceStatus[]> | undefined;
  var __rocktomic_normalized_store_runs__: Map<string, PersistedSupplierSyncRun> | undefined;
  var __rocktomic_normalized_store_locks__: Map<string, { token: string; expiresAt: number }> | undefined;
  var __rocktomic_normalized_tables_checked__: boolean | undefined;
}

function dbConfigured(): boolean {
  return Boolean(process.env.DIRECTORYIQ_DATABASE_URL?.trim() || process.env.DATABASE_URL?.trim());
}

function allowFallbackStore(): boolean {
  return process.env.NODE_ENV === "test";
}

function tableMissingError(): Error {
  return new Error(
    "Supplier normalized persistence tables are unavailable. Apply db/migrations/20260530_ecomviper_supplier_normalized.sql."
  );
}

function key(userId: string, supplierId: string): string {
  return `${userId.trim()}::${supplierId.trim().toLowerCase()}`;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asNullableString(value: unknown): string | null {
  const normalized = asString(value);
  return normalized || null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => asString(entry)).filter(Boolean);
}

function asJsonRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function asDateIso(value: unknown): string | null {
  const normalized = asString(value);
  if (!normalized) return null;
  const parsed = Date.parse(normalized);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).toISOString();
}

function parseStatus(value: unknown): SupplierSourceSyncStatus {
  const normalized = asString(value).toLowerCase();
  if (
    normalized === "never_synced" ||
    normalized === "synced" ||
    normalized === "sync_failed" ||
    normalized === "source_inaccessible" ||
    normalized === "source_auth_required" ||
    normalized === "parsing_partial" ||
    normalized === "ocr_required" ||
    normalized === "sync_in_progress"
  ) {
    return normalized;
  }
  return "never_synced";
}

function getFallbackMap<T>(name: string): Map<string, T> {
  const globalRef = globalThis as Record<string, unknown>;
  const current = globalRef[name];
  if (current instanceof Map) return current as Map<string, T>;
  const created = new Map<string, T>();
  globalRef[name] = created;
  return created;
}

function getFallbackProductsStore(): Map<string, PersistedSupplierProductNormalized[]> {
  return getFallbackMap<PersistedSupplierProductNormalized[]>("__rocktomic_normalized_store_products__");
}

function getFallbackInventoryStore(): Map<string, PersistedSupplierInventoryNormalized[]> {
  return getFallbackMap<PersistedSupplierInventoryNormalized[]>("__rocktomic_normalized_store_inventory__");
}

function getFallbackPricingStore(): Map<string, PersistedSupplierPricingNormalized[]> {
  return getFallbackMap<PersistedSupplierPricingNormalized[]>("__rocktomic_normalized_store_pricing__");
}

function getFallbackAssetsStore(): Map<string, PersistedSupplierAssetsNormalized[]> {
  return getFallbackMap<PersistedSupplierAssetsNormalized[]>("__rocktomic_normalized_store_assets__");
}

function getFallbackSourceStatusStore(): Map<string, PersistedSupplierSourceStatus[]> {
  return getFallbackMap<PersistedSupplierSourceStatus[]>("__rocktomic_normalized_store_source_status__");
}

function getFallbackRunsStore(): Map<string, PersistedSupplierSyncRun> {
  return getFallbackMap<PersistedSupplierSyncRun>("__rocktomic_normalized_store_runs__");
}

function getFallbackLocksStore(): Map<string, { token: string; expiresAt: number }> {
  return getFallbackMap<{ token: string; expiresAt: number }>("__rocktomic_normalized_store_locks__");
}

async function ensureTables(): Promise<void> {
  if (allowFallbackStore()) return;
  if (!dbConfigured()) return;
  if (globalThis.__rocktomic_normalized_tables_checked__) return;

  await query(`
    CREATE TABLE IF NOT EXISTS ${TABLES.products} (
      user_id TEXT NOT NULL,
      supplier_id TEXT NOT NULL,
      sku TEXT NOT NULL,
      product_name TEXT NOT NULL,
      category TEXT NULL,
      label_size TEXT NULL,
      container_size TEXT NULL,
      product_weight TEXT NULL,
      product_form TEXT NULL,
      supplement_facts_raw TEXT NULL,
      supplement_facts_text TEXT NULL,
      serving_size TEXT NULL,
      servings_per_container TEXT NULL,
      active_ingredients JSONB NOT NULL DEFAULT '[]'::jsonb,
      amount_per_serving TEXT NULL,
      other_ingredients TEXT NULL,
      ingredient_highlights_source JSONB NOT NULL DEFAULT '[]'::jsonb,
      key_product_features JSONB NOT NULL DEFAULT '[]'::jsonb,
      dietary_attributes JSONB NOT NULL DEFAULT '[]'::jsonb,
      manufacturing_claims JSONB NOT NULL DEFAULT '[]'::jsonb,
      certifications JSONB NOT NULL DEFAULT '[]'::jsonb,
      warnings TEXT NULL,
      suggested_use TEXT NULL,
      coa_url TEXT NULL,
      coa_status TEXT NULL,
      coa_extraction_status TEXT NULL,
      coa_extraction_error TEXT NULL,
      label_template_url TEXT NULL,
      mockup_url TEXT NULL,
      source_catalog_page INTEGER NULL,
      source_version TEXT NULL,
      extraction_status TEXT NULL,
      extraction_errors JSONB NOT NULL DEFAULT '[]'::jsonb,
      last_synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, supplier_id, sku)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS ${TABLES.inventory} (
      user_id TEXT NOT NULL,
      supplier_id TEXT NOT NULL,
      sku TEXT NOT NULL,
      inventory_status_raw TEXT NULL,
      inventory_status_normalized TEXT NOT NULL DEFAULT 'unknown',
      availability_display TEXT NOT NULL DEFAULT 'Availability Unknown',
      source_report TEXT NULL,
      source_updated_at TIMESTAMPTZ NULL,
      last_synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      extraction_status TEXT NULL,
      extraction_errors JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, supplier_id, sku)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS ${TABLES.pricing} (
      user_id TEXT NOT NULL,
      supplier_id TEXT NOT NULL,
      sku TEXT NOT NULL,
      product_name TEXT NULL,
      category TEXT NULL,
      detected_membership_tiers JSONB NOT NULL DEFAULT '[]'::jsonb,
      costs_by_membership_tier JSONB NOT NULL DEFAULT '{}'::jsonb,
      msrp NUMERIC NULL,
      source_sheet TEXT NULL,
      source_tab TEXT NULL,
      source_row INTEGER NULL,
      source_version TEXT NULL,
      last_synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      extraction_status TEXT NULL,
      extraction_errors JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, supplier_id, sku)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS ${TABLES.assets} (
      user_id TEXT NOT NULL,
      supplier_id TEXT NOT NULL,
      sku TEXT NOT NULL,
      label_template_url TEXT NULL,
      mockup_url TEXT NULL,
      supplement_facts_asset_url TEXT NULL,
      coa_url TEXT NULL,
      asset_status TEXT NOT NULL DEFAULT 'unknown',
      last_synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      extraction_status TEXT NULL,
      extraction_errors JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, supplier_id, sku)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS ${TABLES.sourceStatus} (
      user_id TEXT NOT NULL,
      supplier_id TEXT NOT NULL,
      source_id TEXT NOT NULL,
      source_label TEXT NOT NULL,
      configured BOOLEAN NOT NULL DEFAULT false,
      fetchable BOOLEAN NOT NULL DEFAULT false,
      parsed BOOLEAN NOT NULL DEFAULT false,
      record_count INTEGER NOT NULL DEFAULT 0,
      sync_status TEXT NOT NULL DEFAULT 'never_synced',
      source_url TEXT NULL,
      fetch_url TEXT NULL,
      last_checked_at TIMESTAMPTZ NULL,
      last_successful_sync_at TIMESTAMPTZ NULL,
      last_error TEXT NULL,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, supplier_id, source_id)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS ${TABLES.runs} (
      id BIGSERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      supplier_id TEXT NOT NULL,
      requested_by TEXT NULL,
      trigger_kind TEXT NOT NULL DEFAULT 'manual',
      sync_status TEXT NOT NULL DEFAULT 'never_synced',
      products_parsed_count INTEGER NOT NULL DEFAULT 0,
      inventory_records_parsed_count INTEGER NOT NULL DEFAULT 0,
      pricing_records_parsed_count INTEGER NOT NULL DEFAULT 0,
      asset_records_parsed_count INTEGER NOT NULL DEFAULT 0,
      source_diagnostics JSONB NOT NULL DEFAULT '[]'::jsonb,
      attempted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      completed_at TIMESTAMPTZ NULL,
      last_error TEXT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS ${TABLES.locks} (
      user_id TEXT NOT NULL,
      supplier_id TEXT NOT NULL,
      lock_token TEXT NOT NULL,
      acquired_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      expires_at TIMESTAMPTZ NOT NULL,
      PRIMARY KEY (user_id, supplier_id)
    )
  `);

  globalThis.__rocktomic_normalized_tables_checked__ = true;
}

export async function acquireSupplierSyncLock(input: {
  userId: string;
  supplierId: string;
  ttlMs?: number;
}): Promise<LockResult> {
  const normalizedKey = key(input.userId, input.supplierId);
  const ttlMs = Math.max(5_000, input.ttlMs ?? 120_000);
  const token =
    typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  if (allowFallbackStore() || !dbConfigured()) {
    const locks = getFallbackLocksStore();
    const now = Date.now();
    const existing = locks.get(normalizedKey);
    if (existing && existing.expiresAt > now) {
      return { acquired: false, token: null };
    }
    locks.set(normalizedKey, { token, expiresAt: now + ttlMs });
    return { acquired: true, token };
  }

  await ensureTables();

  const rows = await query<{ lock_token: string }>(
    `
    INSERT INTO ${TABLES.locks}
      (user_id, supplier_id, lock_token, acquired_at, expires_at)
    VALUES
      ($1, $2, $3, now(), now() + ($4::text || ' milliseconds')::interval)
    ON CONFLICT (user_id, supplier_id)
    DO UPDATE SET
      lock_token = EXCLUDED.lock_token,
      acquired_at = now(),
      expires_at = now() + ($4::text || ' milliseconds')::interval
    WHERE ${TABLES.locks}.expires_at <= now()
    RETURNING lock_token
    `,
    [input.userId, input.supplierId, token, ttlMs]
  );

  return rows[0]?.lock_token ? { acquired: true, token } : { acquired: false, token: null };
}

export async function releaseSupplierSyncLock(input: {
  userId: string;
  supplierId: string;
  token: string;
}): Promise<void> {
  const normalizedKey = key(input.userId, input.supplierId);

  if (allowFallbackStore() || !dbConfigured()) {
    const locks = getFallbackLocksStore();
    const existing = locks.get(normalizedKey);
    if (existing?.token === input.token) {
      locks.delete(normalizedKey);
    }
    return;
  }

  await ensureTables();
  await query(
    `DELETE FROM ${TABLES.locks} WHERE user_id = $1 AND supplier_id = $2 AND lock_token = $3`,
    [input.userId, input.supplierId, input.token]
  );
}

export async function persistSupplierNormalizedSnapshot(input: PersistInput): Promise<void> {
  const normalizedKey = key(input.userId, input.supplierId);

  if (allowFallbackStore() || !dbConfigured()) {
    getFallbackProductsStore().set(normalizedKey, input.products);
    getFallbackInventoryStore().set(normalizedKey, input.inventoryRows);
    getFallbackPricingStore().set(normalizedKey, input.pricingRows);
    getFallbackAssetsStore().set(normalizedKey, input.assetRows);
    getFallbackSourceStatusStore().set(normalizedKey, input.sourceStatuses);
    getFallbackRunsStore().set(normalizedKey, input.run);
    return;
  }

  try {
    await ensureTables();

    await query(`DELETE FROM ${TABLES.products} WHERE user_id = $1 AND supplier_id = $2`, [input.userId, input.supplierId]);
    await query(`DELETE FROM ${TABLES.inventory} WHERE user_id = $1 AND supplier_id = $2`, [input.userId, input.supplierId]);
    await query(`DELETE FROM ${TABLES.pricing} WHERE user_id = $1 AND supplier_id = $2`, [input.userId, input.supplierId]);
    await query(`DELETE FROM ${TABLES.assets} WHERE user_id = $1 AND supplier_id = $2`, [input.userId, input.supplierId]);

    for (const product of input.products) {
      await query(
        `
        INSERT INTO ${TABLES.products}
        (
          user_id, supplier_id, sku, product_name, category, label_size, container_size, product_weight, product_form,
          supplement_facts_raw, supplement_facts_text, serving_size, servings_per_container, active_ingredients,
          amount_per_serving, other_ingredients, ingredient_highlights_source, key_product_features, dietary_attributes,
          manufacturing_claims, certifications, warnings, suggested_use, coa_url, coa_status, coa_extraction_status,
          coa_extraction_error, label_template_url, mockup_url, source_catalog_page, source_version, extraction_status,
          extraction_errors, last_synced_at, raw_payload, created_at, updated_at
        )
        VALUES
        (
          $1, $2, $3, $4, $5, $6, $7, $8, $9,
          $10, $11, $12, $13, $14::jsonb,
          $15, $16, $17::jsonb, $18::jsonb, $19::jsonb,
          $20::jsonb, $21::jsonb, $22, $23, $24, $25, $26,
          $27, $28, $29, $30, $31, $32,
          $33::jsonb, $34::timestamptz, $35::jsonb, now(), now()
        )
        `,
        [
          input.userId,
          input.supplierId,
          product.sku,
          product.productName,
          product.category,
          product.labelSize,
          product.containerSize,
          product.productWeight,
          product.productForm,
          product.supplementFactsRaw,
          product.supplementFactsText,
          product.servingSize,
          product.servingsPerContainer,
          JSON.stringify(product.activeIngredients),
          product.amountPerServing,
          product.otherIngredients,
          JSON.stringify(product.ingredientHighlightsSource),
          JSON.stringify(product.keyProductFeatures),
          JSON.stringify(product.dietaryAttributes),
          JSON.stringify(product.manufacturingClaims),
          JSON.stringify(product.certifications),
          product.warnings,
          product.suggestedUse,
          product.coaUrl,
          product.coaStatus,
          product.coaExtractionStatus,
          product.coaExtractionError,
          product.labelTemplateUrl,
          product.mockupUrl,
          product.sourceCatalogPage,
          product.sourceVersion,
          product.extractionStatus,
          JSON.stringify(product.extractionErrors),
          product.lastSyncedAt,
          JSON.stringify(product.rawPayload || {}),
        ]
      );
    }

    for (const inventory of input.inventoryRows) {
      await query(
        `
        INSERT INTO ${TABLES.inventory}
          (user_id, supplier_id, sku, inventory_status_raw, inventory_status_normalized, availability_display, source_report,
           source_updated_at, last_synced_at, extraction_status, extraction_errors, created_at, updated_at)
        VALUES
          ($1, $2, $3, $4, $5, $6, $7, $8::timestamptz, $9::timestamptz, $10, $11::jsonb, now(), now())
        `,
        [
          input.userId,
          input.supplierId,
          inventory.sku,
          inventory.inventoryStatusRaw,
          inventory.inventoryStatusNormalized,
          inventory.availabilityDisplay,
          inventory.sourceReport,
          inventory.sourceUpdatedAt,
          inventory.lastSyncedAt,
          inventory.extractionStatus,
          JSON.stringify(inventory.extractionErrors),
        ]
      );
    }

    for (const pricing of input.pricingRows) {
      await query(
        `
        INSERT INTO ${TABLES.pricing}
          (user_id, supplier_id, sku, product_name, category, detected_membership_tiers, costs_by_membership_tier,
           msrp, source_sheet, source_tab, source_row, source_version, last_synced_at, extraction_status, extraction_errors,
           created_at, updated_at)
        VALUES
          ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb,
           $8, $9, $10, $11, $12, $13::timestamptz, $14, $15::jsonb,
           now(), now())
        `,
        [
          input.userId,
          input.supplierId,
          pricing.sku,
          pricing.productName,
          pricing.category,
          JSON.stringify(pricing.detectedMembershipTiers),
          JSON.stringify(pricing.costsByMembershipTier),
          pricing.msrp,
          pricing.sourceSheet,
          pricing.sourceTab,
          pricing.sourceRow,
          pricing.sourceVersion,
          pricing.lastSyncedAt,
          pricing.extractionStatus,
          JSON.stringify(pricing.extractionErrors),
        ]
      );
    }

    for (const asset of input.assetRows) {
      await query(
        `
        INSERT INTO ${TABLES.assets}
          (user_id, supplier_id, sku, label_template_url, mockup_url, supplement_facts_asset_url, coa_url,
           asset_status, last_synced_at, extraction_status, extraction_errors, created_at, updated_at)
        VALUES
          ($1, $2, $3, $4, $5, $6, $7,
           $8, $9::timestamptz, $10, $11::jsonb, now(), now())
        `,
        [
          input.userId,
          input.supplierId,
          asset.sku,
          asset.labelTemplateUrl,
          asset.mockupUrl,
          asset.supplementFactsAssetUrl,
          asset.coaUrl,
          asset.assetStatus,
          asset.lastSyncedAt,
          asset.extractionStatus,
          JSON.stringify(asset.extractionErrors),
        ]
      );
    }

    for (const status of input.sourceStatuses) {
      await query(
        `
        INSERT INTO ${TABLES.sourceStatus}
          (user_id, supplier_id, source_id, source_label, configured, fetchable, parsed, record_count, sync_status,
           source_url, fetch_url, last_checked_at, last_successful_sync_at, last_error, metadata, created_at, updated_at)
        VALUES
          ($1, $2, $3, $4, $5, $6, $7, $8, $9,
           $10, $11, $12::timestamptz, $13::timestamptz, $14, $15::jsonb, now(), now())
        ON CONFLICT (user_id, supplier_id, source_id)
        DO UPDATE SET
          source_label = EXCLUDED.source_label,
          configured = EXCLUDED.configured,
          fetchable = EXCLUDED.fetchable,
          parsed = EXCLUDED.parsed,
          record_count = EXCLUDED.record_count,
          sync_status = EXCLUDED.sync_status,
          source_url = EXCLUDED.source_url,
          fetch_url = EXCLUDED.fetch_url,
          last_checked_at = EXCLUDED.last_checked_at,
          last_successful_sync_at = EXCLUDED.last_successful_sync_at,
          last_error = EXCLUDED.last_error,
          metadata = EXCLUDED.metadata,
          updated_at = now()
        `,
        [
          input.userId,
          input.supplierId,
          status.sourceId,
          status.sourceLabel,
          status.configured,
          status.fetchable,
          status.parsed,
          status.recordCount,
          status.syncStatus,
          status.sourceUrl,
          status.fetchUrl,
          status.lastCheckedAt,
          status.lastSuccessfulSyncAt,
          status.lastError,
          JSON.stringify(status.metadata || {}),
        ]
      );
    }

    await query(
      `
      INSERT INTO ${TABLES.runs}
        (user_id, supplier_id, requested_by, trigger_kind, sync_status, products_parsed_count,
         inventory_records_parsed_count, pricing_records_parsed_count, asset_records_parsed_count,
         source_diagnostics, attempted_at, completed_at, last_error, created_at, updated_at)
      VALUES
        ($1, $2, $3, $4, $5, $6,
         $7, $8, $9,
         $10::jsonb, $11::timestamptz, $12::timestamptz, $13, now(), now())
      `,
      [
        input.userId,
        input.supplierId,
        input.userId,
        "manual",
        input.run.syncStatus,
        input.run.productsParsedCount,
        input.run.inventoryRecordsParsedCount,
        input.run.pricingRecordsParsedCount,
        input.run.assetRecordsParsedCount,
        JSON.stringify(input.run.sourceDiagnostics),
        input.run.attemptedAt,
        input.run.completedAt,
        input.run.lastError,
      ]
    );
  } catch (error) {
    if (isUndefinedRelationError(error, TABLES.products)) throw tableMissingError();
    throw error;
  }
}

export async function getSupplierNormalizedSnapshot(input: {
  userId: string;
  supplierId: string;
}): Promise<PersistedSupplierSnapshot | null> {
  const normalizedKey = key(input.userId, input.supplierId);

  if (allowFallbackStore() || !dbConfigured()) {
    const products = getFallbackProductsStore().get(normalizedKey) || [];
    const inventoryRows = getFallbackInventoryStore().get(normalizedKey) || [];
    const pricingRows = getFallbackPricingStore().get(normalizedKey) || [];
    const assetRows = getFallbackAssetsStore().get(normalizedKey) || [];
    const sourceStatuses = getFallbackSourceStatusStore().get(normalizedKey) || [];
    const latestRun = getFallbackRunsStore().get(normalizedKey) || null;

    if (!products.length && !sourceStatuses.length && !latestRun) return null;
    return {
      products,
      inventoryBySku: new Map(inventoryRows.map((row) => [row.sku, row])),
      pricingBySku: new Map(pricingRows.map((row) => [row.sku, row])),
      assetsBySku: new Map(assetRows.map((row) => [row.sku, row])),
      sourceStatuses,
      latestRun,
    };
  }

  await ensureTables();

  const [productRows, inventoryRows, pricingRows, assetRows, sourceStatusRows, runRows] = await Promise.all([
    query<Record<string, unknown>>(
      `SELECT * FROM ${TABLES.products} WHERE user_id = $1 AND supplier_id = $2 ORDER BY sku ASC`,
      [input.userId, input.supplierId]
    ),
    query<Record<string, unknown>>(
      `SELECT * FROM ${TABLES.inventory} WHERE user_id = $1 AND supplier_id = $2 ORDER BY sku ASC`,
      [input.userId, input.supplierId]
    ),
    query<Record<string, unknown>>(
      `SELECT * FROM ${TABLES.pricing} WHERE user_id = $1 AND supplier_id = $2 ORDER BY sku ASC`,
      [input.userId, input.supplierId]
    ),
    query<Record<string, unknown>>(
      `SELECT * FROM ${TABLES.assets} WHERE user_id = $1 AND supplier_id = $2 ORDER BY sku ASC`,
      [input.userId, input.supplierId]
    ),
    query<Record<string, unknown>>(
      `SELECT * FROM ${TABLES.sourceStatus} WHERE user_id = $1 AND supplier_id = $2 ORDER BY source_id ASC`,
      [input.userId, input.supplierId]
    ),
    query<Record<string, unknown>>(
      `SELECT * FROM ${TABLES.runs} WHERE user_id = $1 AND supplier_id = $2 ORDER BY attempted_at DESC LIMIT 1`,
      [input.userId, input.supplierId]
    ),
  ]);

  if (!productRows.length && !sourceStatusRows.length && !runRows.length) return null;

  const products: PersistedSupplierProductNormalized[] = productRows.map((row) => ({
    sku: asString(row.sku),
    productName: asString(row.product_name),
    category: asNullableString(row.category),
    labelSize: asNullableString(row.label_size),
    containerSize: asNullableString(row.container_size),
    productWeight: asNullableString(row.product_weight),
    productForm: asNullableString(row.product_form),
    supplementFactsRaw: asNullableString(row.supplement_facts_raw),
    supplementFactsText: asNullableString(row.supplement_facts_text),
    servingSize: asNullableString(row.serving_size),
    servingsPerContainer: asNullableString(row.servings_per_container),
    activeIngredients: asStringArray(row.active_ingredients),
    amountPerServing: asNullableString(row.amount_per_serving),
    otherIngredients: asNullableString(row.other_ingredients),
    ingredientHighlightsSource: asStringArray(row.ingredient_highlights_source),
    keyProductFeatures: asStringArray(row.key_product_features),
    dietaryAttributes: asStringArray(row.dietary_attributes),
    manufacturingClaims: asStringArray(row.manufacturing_claims),
    certifications: asStringArray(row.certifications),
    warnings: asNullableString(row.warnings),
    suggestedUse: asNullableString(row.suggested_use),
    coaUrl: asNullableString(row.coa_url),
    coaStatus: asNullableString(row.coa_status),
    coaExtractionStatus: asNullableString(row.coa_extraction_status),
    coaExtractionError: asNullableString(row.coa_extraction_error),
    labelTemplateUrl: asNullableString(row.label_template_url),
    mockupUrl: asNullableString(row.mockup_url),
    sourceCatalogPage: typeof row.source_catalog_page === "number" ? row.source_catalog_page : null,
    sourceVersion: asNullableString(row.source_version),
    extractionStatus: asNullableString(row.extraction_status),
    extractionErrors: asStringArray(row.extraction_errors),
    lastSyncedAt: asDateIso(row.last_synced_at) || new Date().toISOString(),
    rawPayload: asJsonRecord(row.raw_payload),
  }));

  const inventory = inventoryRows.map((row): PersistedSupplierInventoryNormalized => ({
    sku: asString(row.sku),
    inventoryStatusRaw: asNullableString(row.inventory_status_raw),
    inventoryStatusNormalized: asString(row.inventory_status_normalized) || "unknown",
    availabilityDisplay: asString(row.availability_display) || "Availability Unknown",
    sourceReport: asNullableString(row.source_report),
    sourceUpdatedAt: asDateIso(row.source_updated_at),
    lastSyncedAt: asDateIso(row.last_synced_at) || new Date().toISOString(),
    extractionStatus: asNullableString(row.extraction_status),
    extractionErrors: asStringArray(row.extraction_errors),
  }));

  const pricing = pricingRows.map((row): PersistedSupplierPricingNormalized => ({
    sku: asString(row.sku),
    productName: asNullableString(row.product_name),
    category: asNullableString(row.category),
    detectedMembershipTiers: asStringArray(row.detected_membership_tiers),
    costsByMembershipTier: Object.fromEntries(
      Object.entries(asJsonRecord(row.costs_by_membership_tier)).flatMap(([tier, value]) => {
        const numeric = asNumber(value);
        return numeric == null ? [] : [[tier, numeric]];
      })
    ),
    msrp: asNumber(row.msrp),
    sourceSheet: asNullableString(row.source_sheet),
    sourceTab: asNullableString(row.source_tab),
    sourceRow: typeof row.source_row === "number" ? row.source_row : null,
    sourceVersion: asNullableString(row.source_version),
    lastSyncedAt: asDateIso(row.last_synced_at) || new Date().toISOString(),
    extractionStatus: asNullableString(row.extraction_status),
    extractionErrors: asStringArray(row.extraction_errors),
  }));

  const assets = assetRows.map((row): PersistedSupplierAssetsNormalized => ({
    sku: asString(row.sku),
    labelTemplateUrl: asNullableString(row.label_template_url),
    mockupUrl: asNullableString(row.mockup_url),
    supplementFactsAssetUrl: asNullableString(row.supplement_facts_asset_url),
    coaUrl: asNullableString(row.coa_url),
    assetStatus: asString(row.asset_status) || "unknown",
    lastSyncedAt: asDateIso(row.last_synced_at) || new Date().toISOString(),
    extractionStatus: asNullableString(row.extraction_status),
    extractionErrors: asStringArray(row.extraction_errors),
  }));

  const sourceStatuses = sourceStatusRows.map((row): PersistedSupplierSourceStatus => ({
    sourceId: asString(row.source_id),
    sourceLabel: asString(row.source_label),
    configured: row.configured === true,
    fetchable: row.fetchable === true,
    parsed: row.parsed === true,
    recordCount: typeof row.record_count === "number" ? row.record_count : 0,
    syncStatus: parseStatus(row.sync_status),
    sourceUrl: asNullableString(row.source_url),
    fetchUrl: asNullableString(row.fetch_url),
    lastCheckedAt: asDateIso(row.last_checked_at),
    lastSuccessfulSyncAt: asDateIso(row.last_successful_sync_at),
    lastError: asNullableString(row.last_error),
    metadata: asJsonRecord(row.metadata),
  }));

  const latestRun = runRows[0]
    ? {
        syncStatus: parseStatus(runRows[0].sync_status),
        productsParsedCount: typeof runRows[0].products_parsed_count === "number" ? runRows[0].products_parsed_count : 0,
        inventoryRecordsParsedCount:
          typeof runRows[0].inventory_records_parsed_count === "number" ? runRows[0].inventory_records_parsed_count : 0,
        pricingRecordsParsedCount:
          typeof runRows[0].pricing_records_parsed_count === "number" ? runRows[0].pricing_records_parsed_count : 0,
        assetRecordsParsedCount:
          typeof runRows[0].asset_records_parsed_count === "number" ? runRows[0].asset_records_parsed_count : 0,
        sourceDiagnostics: sourceStatuses,
        attemptedAt: asDateIso(runRows[0].attempted_at) || new Date().toISOString(),
        completedAt: asDateIso(runRows[0].completed_at),
        lastError: asNullableString(runRows[0].last_error),
      }
    : null;

  return {
    products,
    inventoryBySku: new Map(inventory.map((row) => [row.sku, row])),
    pricingBySku: new Map(pricing.map((row) => [row.sku, row])),
    assetsBySku: new Map(assets.map((row) => [row.sku, row])),
    sourceStatuses,
    latestRun,
  };
}

export async function clearRocktomicNormalizedStoreForTests(): Promise<void> {
  if (allowFallbackStore() || !dbConfigured()) {
    getFallbackProductsStore().clear();
    getFallbackInventoryStore().clear();
    getFallbackPricingStore().clear();
    getFallbackAssetsStore().clear();
    getFallbackSourceStatusStore().clear();
    getFallbackRunsStore().clear();
    getFallbackLocksStore().clear();
    return;
  }

  await ensureTables();
  await Promise.all([
    query(`DELETE FROM ${TABLES.products}`),
    query(`DELETE FROM ${TABLES.inventory}`),
    query(`DELETE FROM ${TABLES.pricing}`),
    query(`DELETE FROM ${TABLES.assets}`),
    query(`DELETE FROM ${TABLES.sourceStatus}`),
    query(`DELETE FROM ${TABLES.runs}`),
    query(`DELETE FROM ${TABLES.locks}`),
  ]);
}

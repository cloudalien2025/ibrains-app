import "server-only";

import { query } from "@/app/api/ecomviper/_utils/db";
import { isUndefinedRelationError } from "@/app/api/directoryiq/_utils/sqlErrors";
import type { WalmartDraftRecord } from "@/lib/ecomviper/walmart/walmart-types";

interface WalmartDraftRow {
  user_id: string;
  draft_id: string;
  sku: string;
  status: WalmartDraftRecord["status"];
  publish_status: WalmartDraftRecord["publishStatus"];
  draft_record: WalmartDraftRecord;
  created_at: string | Date;
  updated_at: string | Date;
}

type FallbackStore = Map<string, Map<string, WalmartDraftRecord>>;

declare global {
  var __ecomviper_walmart_draft_fallback__: FallbackStore | undefined;
  var __ecomviper_walmart_draft_tables_checked__: boolean | undefined;
}

const DRAFTS_TABLE = "walmart_drafts";

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
    "Walmart draft persistence table is unavailable. Apply db/migrations/20260510_ecomviper_walmart_drafts.sql."
  );
}

function normalizeUserId(userId: string): string {
  return userId.trim();
}

function normalizeSku(sku: string): string {
  return sku.trim().toUpperCase();
}

function asEpoch(value: string): number {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function cloneDraft(draft: WalmartDraftRecord): WalmartDraftRecord {
  return {
    ...draft,
    draftPayload: { ...draft.draftPayload },
    validationResult: {
      ...draft.validationResult,
      violations: draft.validationResult.violations ? [...draft.validationResult.violations] : [],
      warnings: [...draft.validationResult.warnings],
      suggestions: draft.validationResult.suggestions ? [...draft.validationResult.suggestions] : [],
    },
  };
}

function getFallbackStore(): FallbackStore {
  if (!globalThis.__ecomviper_walmart_draft_fallback__) {
    globalThis.__ecomviper_walmart_draft_fallback__ = new Map<string, Map<string, WalmartDraftRecord>>();
  }
  return globalThis.__ecomviper_walmart_draft_fallback__;
}

function getFallbackUserStore(userId: string): Map<string, WalmartDraftRecord> {
  const normalizedUserId = normalizeUserId(userId);
  const store = getFallbackStore();
  const existing = store.get(normalizedUserId);
  if (existing) return existing;
  const created = new Map<string, WalmartDraftRecord>();
  store.set(normalizedUserId, created);
  return created;
}

async function ensureTable(): Promise<void> {
  if (allowFallbackStore()) return;
  if (globalThis.__ecomviper_walmart_draft_tables_checked__) return;

  await query(
    `
    CREATE TABLE IF NOT EXISTS ${DRAFTS_TABLE} (
      user_id TEXT NOT NULL,
      draft_id TEXT NOT NULL,
      sku TEXT NOT NULL,
      status TEXT NOT NULL,
      publish_status TEXT NOT NULL,
      draft_record JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL,
      PRIMARY KEY (user_id, draft_id)
    )
    `
  );

  await query(
    `CREATE INDEX IF NOT EXISTS idx_${DRAFTS_TABLE}_user_updated
     ON ${DRAFTS_TABLE}(user_id, updated_at DESC)`
  );

  await query(
    `CREATE INDEX IF NOT EXISTS idx_${DRAFTS_TABLE}_user_sku
     ON ${DRAFTS_TABLE}(user_id, sku)`
  );

  globalThis.__ecomviper_walmart_draft_tables_checked__ = true;
}

export async function listPersistedWalmartDrafts(input: {
  userId: string;
  includeDiscarded?: boolean;
}): Promise<WalmartDraftRecord[]> {
  const normalizedUserId = normalizeUserId(input.userId);
  const includeDiscarded = Boolean(input.includeDiscarded);

  if (allowFallbackStore()) {
    const userStore = getFallbackUserStore(normalizedUserId);
    const drafts = Array.from(userStore.values());
    return drafts
      .filter((draft) => includeDiscarded || draft.status !== "discarded")
      .sort((left, right) => asEpoch(right.updatedAt) - asEpoch(left.updatedAt))
      .map((draft) => cloneDraft(draft));
  }

  if (!dbConfigured()) {
    throw databaseUnavailableError();
  }

  try {
    await ensureTable();

    const rows = await query<WalmartDraftRow>(
      `
      SELECT user_id, draft_id, sku, status, publish_status, draft_record, created_at, updated_at
      FROM ${DRAFTS_TABLE}
      WHERE user_id = $1
      ORDER BY updated_at DESC, sku ASC
      `,
      [normalizedUserId]
    );

    return rows
      .map((row) => row.draft_record)
      .filter((record): record is WalmartDraftRecord => Boolean(record && typeof record === "object"))
      .filter((draft) => includeDiscarded || draft.status !== "discarded")
      .map((draft) => cloneDraft(draft));
  } catch (error) {
    if (isUndefinedRelationError(error, DRAFTS_TABLE)) {
      throw tableMissingError();
    }
    throw error;
  }
}

export async function getPersistedWalmartDraftById(input: {
  userId: string;
  draftId: string;
}): Promise<WalmartDraftRecord | null> {
  const normalizedUserId = normalizeUserId(input.userId);
  const draftId = input.draftId.trim();
  if (!draftId) return null;

  if (allowFallbackStore()) {
    const userStore = getFallbackUserStore(normalizedUserId);
    const draft = userStore.get(draftId) ?? null;
    return draft ? cloneDraft(draft) : null;
  }

  if (!dbConfigured()) {
    throw databaseUnavailableError();
  }

  try {
    await ensureTable();

    const rows = await query<WalmartDraftRow>(
      `
      SELECT user_id, draft_id, sku, status, publish_status, draft_record, created_at, updated_at
      FROM ${DRAFTS_TABLE}
      WHERE user_id = $1 AND draft_id = $2
      LIMIT 1
      `,
      [normalizedUserId, draftId]
    );

    const draft = rows[0]?.draft_record ?? null;
    return draft ? cloneDraft(draft) : null;
  } catch (error) {
    if (isUndefinedRelationError(error, DRAFTS_TABLE)) {
      throw tableMissingError();
    }
    throw error;
  }
}

export async function getLatestPersistedWalmartDraftForSku(input: {
  userId: string;
  sku: string;
  includeDiscarded?: boolean;
}): Promise<WalmartDraftRecord | null> {
  const normalizedUserId = normalizeUserId(input.userId);
  const normalizedSku = normalizeSku(input.sku);
  const includeDiscarded = Boolean(input.includeDiscarded);
  if (!normalizedSku) return null;

  if (allowFallbackStore()) {
    const userStore = getFallbackUserStore(normalizedUserId);
    const candidates = Array.from(userStore.values())
      .filter((draft) => normalizeSku(draft.sku) === normalizedSku)
      .filter((draft) => includeDiscarded || draft.status !== "discarded")
      .sort((left, right) => asEpoch(right.updatedAt) - asEpoch(left.updatedAt));
    return candidates[0] ? cloneDraft(candidates[0]) : null;
  }

  if (!dbConfigured()) {
    throw databaseUnavailableError();
  }

  try {
    await ensureTable();

    const rows = await query<WalmartDraftRow>(
      `
      SELECT user_id, draft_id, sku, status, publish_status, draft_record, created_at, updated_at
      FROM ${DRAFTS_TABLE}
      WHERE user_id = $1
        AND sku = $2
        AND ($3::boolean = true OR status <> 'discarded')
      ORDER BY updated_at DESC
      LIMIT 1
      `,
      [normalizedUserId, normalizedSku, includeDiscarded]
    );

    const draft = rows[0]?.draft_record ?? null;
    return draft ? cloneDraft(draft) : null;
  } catch (error) {
    if (isUndefinedRelationError(error, DRAFTS_TABLE)) {
      throw tableMissingError();
    }
    throw error;
  }
}

export async function savePersistedWalmartDraft(input: {
  userId: string;
  draft: WalmartDraftRecord;
}): Promise<WalmartDraftRecord> {
  const normalizedUserId = normalizeUserId(input.userId);
  const record = cloneDraft(input.draft);

  if (allowFallbackStore()) {
    const userStore = getFallbackUserStore(normalizedUserId);
    userStore.set(record.id, record);
    return cloneDraft(record);
  }

  if (!dbConfigured()) {
    throw databaseUnavailableError();
  }

  try {
    await ensureTable();

    await query(
      `
      INSERT INTO ${DRAFTS_TABLE}
        (user_id, draft_id, sku, status, publish_status, draft_record, created_at, updated_at)
      VALUES
        ($1, $2, $3, $4, $5, $6::jsonb, $7::timestamptz, $8::timestamptz)
      ON CONFLICT (user_id, draft_id)
      DO UPDATE SET
        sku = EXCLUDED.sku,
        status = EXCLUDED.status,
        publish_status = EXCLUDED.publish_status,
        draft_record = EXCLUDED.draft_record,
        created_at = EXCLUDED.created_at,
        updated_at = EXCLUDED.updated_at
      `,
      [
        normalizedUserId,
        record.id,
        normalizeSku(record.sku),
        record.status,
        record.publishStatus,
        JSON.stringify(record),
        record.createdAt,
        record.updatedAt,
      ]
    );

    return record;
  } catch (error) {
    if (isUndefinedRelationError(error, DRAFTS_TABLE)) {
      throw tableMissingError();
    }
    throw error;
  }
}

export async function clearPersistedWalmartDraftsForUser(userId: string): Promise<void> {
  const normalizedUserId = normalizeUserId(userId);

  if (allowFallbackStore()) {
    const userStore = getFallbackUserStore(normalizedUserId);
    userStore.clear();
    return;
  }

  if (!dbConfigured()) {
    throw databaseUnavailableError();
  }

  try {
    await ensureTable();
    await query(`DELETE FROM ${DRAFTS_TABLE} WHERE user_id = $1`, [normalizedUserId]);
  } catch (error) {
    if (isUndefinedRelationError(error, DRAFTS_TABLE)) {
      throw tableMissingError();
    }
    throw error;
  }
}

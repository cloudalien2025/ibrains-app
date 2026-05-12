import "server-only";

import crypto from "crypto";
import { query } from "@/app/api/ecomviper/_utils/db";
import type { WalmartGeneratedImageType } from "@/lib/ecomviper/walmart/walmart-types";

const GENERATED_MEDIA_TABLE = "ecomviper_walmart_generated_media";

interface GeneratedMediaMetadata {
  source: "openai_generated";
  imageType: WalmartGeneratedImageType;
  promptSummary?: string;
  guidance?: string;
}

interface GeneratedMediaRow {
  asset_id: string;
  user_id: string;
  sku: string;
  mime_type: string;
  image_base64: string;
  metadata_json: GeneratedMediaMetadata;
  created_at: string;
  updated_at: string;
}

interface FallbackGeneratedMediaRecord {
  assetId: string;
  userId: string;
  sku: string;
  mimeType: string;
  imageBase64: string;
  metadata: GeneratedMediaMetadata;
  createdAt: string;
  updatedAt: string;
}

declare global {
  var __ecomviper_walmart_generated_media_fallback__:
    | Map<string, FallbackGeneratedMediaRecord>
    | undefined;
  var __ecomviper_walmart_generated_media_tables_checked__: boolean | undefined;
}

function dbConfigured(): boolean {
  return Boolean(process.env.DIRECTORYIQ_DATABASE_URL?.trim() || process.env.DATABASE_URL?.trim());
}

function allowFallbackStore(): boolean {
  return process.env.NODE_ENV === "test";
}

function asText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  return "";
}

function asMetadata(value: unknown): GeneratedMediaMetadata {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      source: "openai_generated",
      imageType: "lifestyle",
    };
  }

  const row = value as Record<string, unknown>;
  const imageTypeRaw = asText(row.imageType);
  const imageType: WalmartGeneratedImageType =
    imageTypeRaw === "lifestyle" ||
    imageTypeRaw === "supplement_facts" ||
    imageTypeRaw === "ingredient_spotlight" ||
    imageTypeRaw === "product_hero"
      ? imageTypeRaw
      : "lifestyle";

  const promptSummary = asText(row.promptSummary);
  const guidance = asText(row.guidance);

  return {
    source: "openai_generated",
    imageType,
    promptSummary: promptSummary || undefined,
    guidance: guidance || undefined,
  };
}

function getFallbackStore(): Map<string, FallbackGeneratedMediaRecord> {
  if (!globalThis.__ecomviper_walmart_generated_media_fallback__) {
    globalThis.__ecomviper_walmart_generated_media_fallback__ = new Map<
      string,
      FallbackGeneratedMediaRecord
    >();
  }
  return globalThis.__ecomviper_walmart_generated_media_fallback__;
}

async function ensureTables(): Promise<void> {
  if (allowFallbackStore()) return;
  if (!dbConfigured()) {
    throw new Error(
      "Generated media persistence is unavailable. Set DATABASE_URL (or DIRECTORYIQ_DATABASE_URL)."
    );
  }
  if (globalThis.__ecomviper_walmart_generated_media_tables_checked__) return;

  await query(
    `
    CREATE TABLE IF NOT EXISTS ${GENERATED_MEDIA_TABLE} (
      asset_id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      sku TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      image_base64 TEXT NOT NULL,
      metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
    `
  );

  await query(
    `
    CREATE INDEX IF NOT EXISTS idx_${GENERATED_MEDIA_TABLE}_user_sku_created
    ON ${GENERATED_MEDIA_TABLE}(user_id, sku, created_at DESC)
    `
  );

  globalThis.__ecomviper_walmart_generated_media_tables_checked__ = true;
}

export interface SavedGeneratedMediaAsset {
  assetId: string;
  userId: string;
  sku: string;
  mimeType: string;
  createdAt: string;
  imageType: WalmartGeneratedImageType;
  promptSummary?: string;
  guidance?: string;
}

export async function saveGeneratedWalmartMediaForUser(input: {
  userId: string;
  sku: string;
  imageBytes: Uint8Array;
  mimeType: string;
  imageType: WalmartGeneratedImageType;
  promptSummary?: string;
  guidance?: string;
}): Promise<SavedGeneratedMediaAsset> {
  const assetId = `ev_wm_img_${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  const imageBase64 = Buffer.from(input.imageBytes).toString("base64");
  const metadata: GeneratedMediaMetadata = {
    source: "openai_generated",
    imageType: input.imageType,
    promptSummary: asText(input.promptSummary) || undefined,
    guidance: asText(input.guidance) || undefined,
  };

  if (allowFallbackStore()) {
    getFallbackStore().set(assetId, {
      assetId,
      userId: input.userId,
      sku: input.sku,
      mimeType: input.mimeType,
      imageBase64,
      metadata,
      createdAt: now,
      updatedAt: now,
    });
    return {
      assetId,
      userId: input.userId,
      sku: input.sku,
      mimeType: input.mimeType,
      createdAt: now,
      imageType: metadata.imageType,
      promptSummary: metadata.promptSummary,
      guidance: metadata.guidance,
    };
  }

  await ensureTables();

  await query(
    `
    INSERT INTO ${GENERATED_MEDIA_TABLE}
      (asset_id, user_id, sku, mime_type, image_base64, metadata_json, created_at, updated_at)
    VALUES
      ($1, $2, $3, $4, $5, $6::jsonb, now(), now())
    `,
    [
      assetId,
      input.userId,
      input.sku,
      input.mimeType,
      imageBase64,
      JSON.stringify(metadata),
    ]
  );

  return {
    assetId,
    userId: input.userId,
    sku: input.sku,
    mimeType: input.mimeType,
    createdAt: now,
    imageType: metadata.imageType,
    promptSummary: metadata.promptSummary,
    guidance: metadata.guidance,
  };
}

export interface RetrievedGeneratedMediaAsset {
  assetId: string;
  userId: string;
  sku: string;
  mimeType: string;
  imageBytes: Uint8Array;
  imageType: WalmartGeneratedImageType;
  createdAt: string;
  promptSummary?: string;
  guidance?: string;
}

export async function getGeneratedWalmartMediaByAssetId(
  assetId: string
): Promise<RetrievedGeneratedMediaAsset | null> {
  const normalizedAssetId = asText(assetId);
  if (!normalizedAssetId) return null;

  if (allowFallbackStore()) {
    const row = getFallbackStore().get(normalizedAssetId);
    if (!row) return null;
    const metadata = asMetadata(row.metadata);
    return {
      assetId: row.assetId,
      userId: row.userId,
      sku: row.sku,
      mimeType: row.mimeType || "image/png",
      imageBytes: Buffer.from(row.imageBase64, "base64"),
      imageType: metadata.imageType,
      createdAt: row.createdAt,
      promptSummary: metadata.promptSummary,
      guidance: metadata.guidance,
    };
  }

  await ensureTables();

  const rows = await query<GeneratedMediaRow>(
    `
    SELECT asset_id, user_id, sku, mime_type, image_base64, metadata_json, created_at, updated_at
    FROM ${GENERATED_MEDIA_TABLE}
    WHERE asset_id = $1
    LIMIT 1
    `,
    [normalizedAssetId]
  );

  const row = rows[0];
  if (!row) return null;

  const metadata = asMetadata(row.metadata_json);

  return {
    assetId: row.asset_id,
    userId: asText(row.user_id),
    sku: asText(row.sku),
    mimeType: asText(row.mime_type) || "image/png",
    imageBytes: Buffer.from(asText(row.image_base64), "base64"),
    imageType: metadata.imageType,
    createdAt: asText(row.created_at),
    promptSummary: metadata.promptSummary,
    guidance: metadata.guidance,
  };
}

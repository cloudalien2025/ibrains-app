import crypto from "crypto";
import { queryDb } from "@/src/directoryiq/repositories/db";

export type UpgradeDraftRecord = {
  id: string;
  userId: string;
  listingId: string;
  originalHash: string;
  originalText: string;
  proposedText: string;
  status: "draft" | "previewed" | "pushed";
  bdRef: string | null;
  createdAt: string;
  previewedAt: string | null;
  pushedAt: string | null;
};

type UpgradeDraftRow = {
  id: string;
  user_id: string;
  listing_source_id: string;
  original_description_hash: string;
  original_description: string;
  proposed_description: string;
  status: "draft" | "previewed" | "pushed";
  bd_update_ref: string | null;
  created_at: string;
  previewed_at: string | null;
  pushed_at: string | null;
};

function mapRow(row: UpgradeDraftRow): UpgradeDraftRecord {
  return {
    id: row.id,
    userId: row.user_id,
    listingId: row.listing_source_id,
    originalHash: row.original_description_hash,
    originalText: row.original_description,
    proposedText: row.proposed_description,
    status: row.status,
    bdRef: row.bd_update_ref,
    createdAt: row.created_at,
    previewedAt: row.previewed_at,
    pushedAt: row.pushed_at,
  };
}

const memory = new Map<string, UpgradeDraftRecord>();

function canUseDb(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export async function createDraft(
  listingId: string,
  originalHash: string,
  proposedText: string,
  createdBy?: string,
  originalText = ""
): Promise<UpgradeDraftRecord> {
  const userId = createdBy ?? "00000000-0000-4000-8000-000000000001";

  if (process.env.E2E_MOCK_OPENAI === "1" || !canUseDb()) {
    const id = `draft-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
    const row: UpgradeDraftRecord = {
      id,
      userId,
      listingId,
      originalHash,
      originalText,
      proposedText,
      status: "draft",
      bdRef: null,
      createdAt: new Date().toISOString(),
      previewedAt: null,
      pushedAt: null,
    };
    memory.set(id, row);
    return row;
  }

  const rows = await queryDb<UpgradeDraftRow>(
    `
    INSERT INTO directoryiq_listing_upgrades
      (user_id, listing_source_id, created_by_user_id, original_description_hash, original_description, proposed_description, status)
    VALUES
      ($1, $2, $3, $4, $5, $6, 'draft')
    RETURNING id, user_id, listing_source_id, original_description_hash, original_description, proposed_description, status, bd_update_ref, created_at, previewed_at, pushed_at
    `,
    [userId, listingId, userId, originalHash, originalText, proposedText]
  );

  return mapRow(rows[0]);
}

export async function getDraft(draftId: string): Promise<UpgradeDraftRecord | null> {
  const mem = memory.get(draftId);
  if (mem) return mem;

  if (!canUseDb()) return null;

  const rows = await queryDb<UpgradeDraftRow>(
    `
    SELECT id, user_id, listing_source_id, original_description_hash, original_description, proposed_description, status, bd_update_ref, created_at, previewed_at, pushed_at
    FROM directoryiq_listing_upgrades
    WHERE id = $1
    LIMIT 1
    `,
    [draftId]
  );

  if (!rows[0]) return null;
  return mapRow(rows[0]);
}

export async function markPreviewed(draftId: string): Promise<void> {
  const mem = memory.get(draftId);
  if (mem) {
    mem.status = "previewed";
    mem.previewedAt = new Date().toISOString();
    memory.set(draftId, mem);
    return;
  }

  if (!canUseDb()) return;

  await queryDb(
    `
    UPDATE directoryiq_listing_upgrades
    SET status = 'previewed', previewed_at = now()
    WHERE id = $1
    `,
    [draftId]
  );
}

export async function markPushed(draftId: string, bdRef?: string): Promise<void> {
  const mem = memory.get(draftId);
  if (mem) {
    mem.status = "pushed";
    mem.bdRef = bdRef ?? null;
    mem.pushedAt = new Date().toISOString();
    memory.set(draftId, mem);
    return;
  }

  if (!canUseDb()) return;

  await queryDb(
    `
    UPDATE directoryiq_listing_upgrades
    SET status = 'pushed', pushed_at = now(), bd_update_ref = $2
    WHERE id = $1
    `,
    [draftId, bdRef ?? null]
  );
}

export function hashText(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

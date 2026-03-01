import { randomUUID } from "node:crypto";
import { directoryIqConfig, serpCacheFile } from "../config.ts";
import type { EnqueueInput, SerpCacheEntry, SerpStatus } from "../types.ts";
import { readJsonFile, writeJsonFile } from "./fileStore.ts";

type CacheState = { items: SerpCacheEntry[] };

const nowIso = () => new Date().toISOString();
const expiryIso = () => new Date(Date.now() + directoryIqConfig.serpCacheTtlDays * 86400_000).toISOString();

const dedupeKeyMatch = (item: SerpCacheEntry, input: EnqueueInput) =>
  item.listing_id === input.listing_id &&
  item.slot_id === input.slot_id &&
  item.focus_keyword === input.focus_keyword &&
  (item.location_modifier ?? null) === (input.location_modifier ?? null);

const readState = () => readJsonFile<CacheState>(serpCacheFile, { items: [] });
const writeState = (state: CacheState) => writeJsonFile(serpCacheFile, state);

export const findSerpCache = async (input: EnqueueInput): Promise<SerpCacheEntry | undefined> => {
  const state = await readState();
  return state.items.find((item) => dedupeKeyMatch(item, input));
};

export const listSerpStatus = async (listingId: string): Promise<SerpCacheEntry[]> => {
  const state = await readState();
  return state.items.filter((item) => item.listing_id === listingId);
};

export const upsertQueuedSerpCache = async (input: EnqueueInput): Promise<SerpCacheEntry> => {
  const state = await readState();
  const existingIndex = state.items.findIndex((item) => dedupeKeyMatch(item, input));
  const timestamp = nowIso();
  if (existingIndex >= 0) {
    const existing = state.items[existingIndex];
    const nonExpiredReady = existing.status === "READY" && new Date(existing.expires_at).getTime() > Date.now();
    if (nonExpiredReady) {
      return existing;
    }

    const updated: SerpCacheEntry = {
      ...existing,
      status: "QUEUED",
      updated_at: timestamp,
      expires_at: expiryIso(),
      error_message: null,
    };
    state.items[existingIndex] = updated;
    await writeState(state);
    return updated;
  }

  const created: SerpCacheEntry = {
    id: randomUUID(),
    listing_id: input.listing_id,
    slot_id: input.slot_id,
    focus_keyword: input.focus_keyword,
    location_modifier: input.location_modifier ?? null,
    serp_query_used: "",
    status: "QUEUED",
    top_results: [],
    extracted_outline: [],
    consensus_outline: null,
    content_deltas: [],
    error_message: null,
    created_at: timestamp,
    updated_at: timestamp,
    expires_at: expiryIso(),
  };
  state.items.push(created);
  await writeState(state);
  return created;
};

export const updateSerpCacheById = async (
  id: string,
  partial: Partial<SerpCacheEntry> & { status?: SerpStatus },
): Promise<SerpCacheEntry | undefined> => {
  const state = await readState();
  const index = state.items.findIndex((item) => item.id === id);
  if (index < 0) return undefined;
  const updated = { ...state.items[index], ...partial, updated_at: nowIso() };
  state.items[index] = updated;
  await writeState(state);
  return updated;
};

export const getSerpCacheById = async (id: string): Promise<SerpCacheEntry | undefined> => {
  const state = await readState();
  return state.items.find((item) => item.id === id);
};

import { randomUUID } from "node:crypto";
import type { BlogDraft } from "../types.ts";
import { draftsFile } from "../config.ts";
import { readJsonFile, writeJsonFile } from "./fileStore.ts";

type DraftState = { items: BlogDraft[] };
const readState = () => readJsonFile<DraftState>(draftsFile, { items: [] });
const writeState = (state: DraftState) => writeJsonFile(draftsFile, state);

export const saveDraft = async (draft: Omit<BlogDraft, "draft_id" | "created_at" | "updated_at">): Promise<BlogDraft> => {
  const state = await readState();
  const timestamp = new Date().toISOString();
  const item: BlogDraft = { ...draft, draft_id: randomUUID(), created_at: timestamp, updated_at: timestamp };
  state.items.push(item);
  await writeState(state);
  return item;
};

export const getDraftById = async (draftId: string): Promise<BlogDraft | undefined> => {
  const state = await readState();
  return state.items.find((item) => item.draft_id === draftId);
};

export const listDraftsByListing = async (listingId: string): Promise<BlogDraft[]> => {
  const state = await readState();
  return state.items.filter((item) => item.listing_id === listingId);
};

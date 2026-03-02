export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getStore, getStorage } from "../_utils/runtime";
import { ensurePromptPacksLoaded } from "../_utils/service";
import { sscError } from "../_utils/errors";

export async function GET() {
  try {
    const store = getStore();
    const storage = getStorage();
    await ensurePromptPacksLoaded(store, storage);

    const packs = await store.listPromptPacks();
    return NextResponse.json({ packs });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return sscError("SSC_PROMPT_PACKS_FAILED", message, 500);
  }
}

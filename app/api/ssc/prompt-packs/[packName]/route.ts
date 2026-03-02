export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getStore, getStorage } from "../../_utils/runtime";
import { ensurePromptPacksLoaded } from "../../_utils/service";
import { sscError } from "../../_utils/errors";

export async function GET(
  _: Request,
  { params }: { params: { packName: string } }
) {
  try {
    const { packName } = params;
    const store = getStore();
    const storage = getStorage();
    await ensurePromptPacksLoaded(store, storage);

    const pack = await store.getPromptPackByName(packName);
    if (!pack) {
      return sscError("SSC_PACK_NOT_FOUND", "Prompt pack not found", 404);
    }
    return NextResponse.json({ pack });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return sscError("SSC_PROMPT_PACK_FAILED", message, 500);
  }
}

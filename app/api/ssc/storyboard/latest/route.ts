export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getStore, getStorage } from "../../_utils/runtime";
import { ensurePromptPacksLoaded } from "../../_utils/service";
import { sscError } from "../../_utils/errors";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const entityType = url.searchParams.get("entity_type");
    const entityId = url.searchParams.get("entity_id");
    if (!entityType || !entityId) {
      return sscError("SSC_BAD_REQUEST", "entity_type and entity_id required", 400);
    }

    const store = getStore();
    const storage = getStorage();
    await ensurePromptPacksLoaded(store, storage);

    const run = await store.getLatestStoryboardRun(entityType, entityId);
    if (!run) {
      return NextResponse.json({ run: null });
    }

    return NextResponse.json({
      run: {
        ...run,
        screenshot_url: storage.getPublicUrl(run.screenshot_full_key),
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return sscError("SSC_STORYBOARD_LATEST_FAILED", message, 500);
  }
}

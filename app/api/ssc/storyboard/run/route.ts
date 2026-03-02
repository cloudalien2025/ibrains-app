export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getLlmClient, getStore, getStorage } from "../../_utils/runtime";
import { runStoryboardEvaluation } from "../../_utils/service";
import { captureStoryboard } from "../../_utils/playwright";
import { sscError } from "../../_utils/errors";
import { SscValidationError } from "../../_utils/validator";

type StoryboardRequest = {
  entity_type: string;
  entity_id: string;
  url: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as StoryboardRequest;
    if (!body?.entity_type || !body?.entity_id || !body?.url) {
      return sscError(
        "SSC_BAD_REQUEST",
        "entity_type, entity_id, url required",
        400
      );
    }

    let capture;
    try {
      capture = await captureStoryboard(body.url);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      if (message === "PLAYWRIGHT_NOT_INSTALLED") {
        return sscError(
          "SSC_PLAYWRIGHT_MISSING",
          "Playwright not installed. Use /api/ssc/storyboard/upload instead.",
          501
        );
      }
      return sscError("SSC_PLAYWRIGHT_FAILED", message, 500);
    }

    const store = getStore();
    const storage = getStorage();
    const llm = getLlmClient();

    const result = await runStoryboardEvaluation({
      store,
      storage,
      llm,
      entityType: body.entity_type,
      entityId: body.entity_id,
      url: body.url,
      screenshotBytes: capture.screenshot,
      visibleText: capture.visibleText,
    });

    return NextResponse.json({
      run_id: result.run.id,
      pack: result.packMeta,
      scores: result.scores,
      screenshot_url: storage.getPublicUrl(result.run.screenshot_full_key),
    });
  } catch (e) {
    if (e instanceof SscValidationError) {
      return sscError("SSC_VALIDATION_FAILED", e.failure.rule_failed, 400, e.failure);
    }
    const message = e instanceof Error ? e.message : "Unknown error";
    return sscError("SSC_STORYBOARD_FAILED", message, 500);
  }
}

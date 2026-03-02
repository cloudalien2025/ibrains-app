export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getLlmClient, getStore, getStorage } from "../../_utils/runtime";
import { runStoryboardEvaluation } from "../../_utils/service";
import { sscError } from "../../_utils/errors";
import { SscValidationError } from "../../_utils/validator";

type StoryboardUploadRequest = {
  entity_type: string;
  entity_id: string;
  url?: string;
  screenshot_base64: string;
  visible_text: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as StoryboardUploadRequest;
    if (
      !body?.entity_type ||
      !body?.entity_id ||
      !body?.screenshot_base64 ||
      body.visible_text === undefined
    ) {
      return sscError(
        "SSC_BAD_REQUEST",
        "entity_type, entity_id, screenshot_base64, visible_text required",
        400
      );
    }

    const buffer = Buffer.from(body.screenshot_base64, "base64");
    const store = getStore();
    const storage = getStorage();
    const llm = getLlmClient();

    const result = await runStoryboardEvaluation({
      store,
      storage,
      llm,
      entityType: body.entity_type,
      entityId: body.entity_id,
      url: body.url ?? "",
      screenshotBytes: buffer,
      visibleText: body.visible_text ?? "",
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
    return sscError("SSC_STORYBOARD_UPLOAD_FAILED", message, 500);
  }
}

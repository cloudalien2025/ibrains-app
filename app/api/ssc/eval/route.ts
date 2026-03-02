export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getLlmClient, getStore, getStorage } from "../_utils/runtime";
import { evaluateDimension } from "../_utils/service";
import { sscError } from "../_utils/errors";
import { SscValidationError } from "../_utils/validator";

type EvalRequest = {
  pack_name: "DB_PROMPTS" | "EB_PROMPTS_EcomViper";
  dimension: string;
  snapshot_text: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as EvalRequest;

    if (!body?.pack_name || !body?.dimension) {
      return sscError("SSC_BAD_REQUEST", "pack_name and dimension required", 400);
    }

    const store = getStore();
    const storage = getStorage();
    const llm = getLlmClient();

    const result = await evaluateDimension(store, storage, llm, {
      packName: body.pack_name,
      dimension: body.dimension,
      snapshotText: body.snapshot_text ?? "",
    });

    return NextResponse.json({
      score: result.score,
      pack: {
        pack_name: result.pack.pack,
        version: result.pack.ssc_prompt_pack_version,
        sha256: result.pack.ssc_prompt_pack_sha256,
      },
    });
  } catch (e) {
    if (e instanceof SscValidationError) {
      return sscError("SSC_VALIDATION_FAILED", e.failure.rule_failed, 400, e.failure);
    }
    const message = e instanceof Error ? e.message : "Unknown error";
    return sscError("SSC_EVAL_FAILED", message, 500);
  }
}

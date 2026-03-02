import type {
  PromptPackInput,
  ScorePayload,
  StoryboardRunRecord,
} from "./types";
import type { LlmClient } from "./llm";
import type { SscStore } from "./store";
import type { StorageAdapter } from "./storage";
import { persistPromptPacks } from "./promptPacks";
import { validateSscResponse } from "./validator";

export const DB_DIMENSIONS = [
  "DB_indexability_crawlability",
  "DB_onpage_seo_signals",
  "DB_structured_data_entities",
  "DB_internal_linking_architecture",
  "DB_content_uniqueness_listing_quality",
];

export const EB_DIMENSIONS = [
  "EB_conversion_clarity",
  "EB_product_positioning",
  "EB_trust_and_social_proof",
];

export const VISUAL_DIMENSIONS = [
  "VIS_primary_entity_clarity",
  "VIS_visual_hierarchy",
  "VIS_action_affordance",
  "VIS_information_density",
  "VIS_trust_signal_visibility",
];

let loadPromise: Promise<void> | null = null;

export async function ensurePromptPacksLoaded(
  store: SscStore,
  storage: StorageAdapter
): Promise<void> {
  if (!loadPromise) {
    loadPromise = persistPromptPacks(store, storage);
  }
  await loadPromise;
}

export function renderTemplate(template: string, variables: Record<string, string>) {
  return Object.entries(variables).reduce((acc, [key, value]) => {
    return acc.replaceAll(`{{${key}}}`, value);
  }, template);
}

export async function evaluateDimension(
  store: SscStore,
  storage: StorageAdapter,
  llm: LlmClient,
  params: {
    packName: "DB_PROMPTS" | "EB_PROMPTS_EcomViper" | "VISUAL_PROMPTS";
    dimension: string;
    snapshotText?: string;
    visibleText?: string;
    imageBase64?: string;
  }
): Promise<{ score: ScorePayload; pack: PromptPackInput }> {
  await ensurePromptPacksLoaded(store, storage);

  const active = await store.getActivePrompt(params.packName, params.dimension);
  if (!active) {
    throw new Error(`Prompt not found for ${params.packName}:${params.dimension}`);
  }

  const { prompt, pack } = active;
  const sourceText =
    params.packName === "VISUAL_PROMPTS"
      ? params.visibleText ?? ""
      : params.snapshotText ?? "";

  const userPrompt = params.packName === "VISUAL_PROMPTS"
    ? renderTemplate(prompt.user_prompt, {
        VISIBLE_TEXT: params.visibleText ?? "",
      })
    : renderTemplate(prompt.user_prompt, {
        SNAPSHOT_CONTENT: params.snapshotText ?? "",
      });

  const responseText = await llm.generate({
    systemPrompt: prompt.system_prompt,
    userPrompt,
    imageBase64: params.imageBase64,
  });

  const score = validateSscResponse(responseText, {
    dimension: params.dimension,
    sourceText,
    flagsVocabulary: prompt.flags_vocabulary ?? [],
  });

  return {
    score,
    pack: {
      pack: pack.pack_name,
      ssc_prompt_pack_version: pack.version,
      ssc_prompt_pack_build_date: pack.build_date,
      ssc_prompt_pack_sha256: pack.sha256,
      canonicalization_rules: pack.canonicalization_rules,
      dimensions: [],
    },
  };
}

export async function runStoryboardEvaluation(params: {
  store: SscStore;
  storage: StorageAdapter;
  llm: LlmClient;
  entityType: string;
  entityId: string;
  url: string;
  screenshotBytes: Buffer;
  visibleText: string;
}): Promise<{
  run: StoryboardRunRecord;
  scores: ScorePayload[];
  packMeta: { version: string; sha256: string };
}> {
  const { store, storage, llm, entityType, entityId, url, screenshotBytes, visibleText } =
    params;
  await ensurePromptPacksLoaded(store, storage);

  const runId = crypto.randomUUID();
  const screenshotKey = `ssc/storyboards/${entityType}/${entityId}/${runId}/screenshot_full.png`;
  const visibleTextKey = `ssc/storyboards/${entityType}/${entityId}/${runId}/visible_text.txt`;

  await storage.putBytes(screenshotKey, screenshotBytes, "image/png");
  await storage.putText(visibleTextKey, visibleText);

  const run: StoryboardRunRecord = {
    id: runId,
    entity_type: entityType,
    entity_id: entityId,
    url,
    screenshot_full_key: screenshotKey,
    visible_text_key: visibleTextKey,
  };
  await store.createStoryboardRun(run);

  const scores: ScorePayload[] = [];
  let packMeta = { version: "", sha256: "" };

  for (const dimension of VISUAL_DIMENSIONS) {
    const result = await evaluateDimension(store, storage, llm, {
      packName: "VISUAL_PROMPTS",
      dimension,
      visibleText,
      imageBase64: screenshotBytes.toString("base64"),
    });

    packMeta = {
      version: result.pack.ssc_prompt_pack_version,
      sha256: result.pack.ssc_prompt_pack_sha256,
    };

    scores.push(result.score);
    await store.createStoryboardScore({
      run_id: runId,
      dimension,
      score_json: result.score,
    });
  }

  return { run, scores, packMeta };
}
